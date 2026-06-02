import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Stethoscope, 
  MapPin, 
  Activity,
  AlertCircle,
  FileText,
  Calendar,
  Download,
  Search
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Invoice, Expense, Patient, Examination } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const COLORS = ['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
const MODERN_COLOR_REGEX = /(color-mix|oklch|oklab|color)\([^;{}]+\)/g;

const sanitizePdfNode = (root: HTMLElement) => {
  root.setAttribute('dir', 'rtl');
  root.style.direction = 'rtl';
  root.style.textAlign = 'right';
  root.style.fontFamily = '"Cairo", "Tajawal", "IBM Plex Sans Arabic", Arial, sans-serif';
  root.style.backgroundColor = '#ffffff';
  root.style.color = '#0f172a';
  root.style.width = '1120px';
  root.style.maxWidth = '1120px';
  root.style.padding = '24px';

  const elements = Array.from(root.querySelectorAll<HTMLElement>('*'));
  elements.forEach((el) => {
    el.style.animation = 'none';
    el.style.transition = 'none';
    el.style.transform = 'none';
    el.style.opacity = '1';
    el.style.direction = 'rtl';
    el.style.letterSpacing = '0';

    if (el.tagName === 'BUTTON' || el.tagName === 'INPUT') {
      el.style.display = 'none';
    }

    if (el.classList.contains('overflow-x-auto') || el.classList.contains('overflow-hidden')) {
      el.style.overflow = 'visible';
    }

    if (el.tagName === 'TABLE') {
      el.style.width = '100%';
      el.style.borderCollapse = 'collapse';
    }

    if (el.classList.contains('truncate')) {
      el.style.overflow = 'visible';
      el.style.textOverflow = 'clip';
      el.style.whiteSpace = 'normal';
    }
  });
};

const inlineSvgCharts = async (root: HTMLElement) => {
  const svgs = Array.from(root.querySelectorAll<SVGSVGElement>('svg'));
  const imageLoads: Promise<void>[] = [];

  svgs.forEach((svg) => {
    const width = svg.getBoundingClientRect().width || Number(svg.getAttribute('width')) || 600;
    const height = svg.getBoundingClientRect().height || Number(svg.getAttribute('height')) || 280;
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement;

    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('width', String(width));
    clonedSvg.setAttribute('height', String(height));

    const svgText = new XMLSerializer().serializeToString(clonedSvg);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = document.createElement('img');

    img.src = url;
    img.width = Math.round(width);
    img.height = Math.round(height);
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.maxWidth = `${Math.round(width)}px`;
    img.style.height = 'auto';
    img.style.margin = '0 auto';
    imageLoads.push(new Promise((resolve) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
    }));

    svg.replaceWith(img);
  });

  await Promise.all(imageLoads);
};

export default function Reports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const financialRef = useRef<HTMLDivElement>(null);
  const complaintsRef = useRef<HTMLDivElement>(null);
  const patientDataRef = useRef<HTMLDivElement>(null);
  const patientListRef = useRef<HTMLDivElement>(null);
  const efficiencyRef = useRef<HTMLDivElement>(null);

  // Date Filter State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First day of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const invoicesSnap = await getDocs(collection(db, 'invoices'));
        const expensesSnap = await getDocs(collection(db, 'expenses'));
        const patientsSnap = await getDocs(collection(db, 'patients'));
        const examsSnap = await getDocs(collection(db, 'examinations'));

        setInvoices(invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
        setExpenses(expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
        setPatients(patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
        setExaminations(examsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Examination)));
      } catch (error) {
        console.error("Error fetching report data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filtered Data
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const date = inv.date?.split('T')[0] || '';
      return date >= startDate && date <= endDate;
    });
  }, [invoices, startDate, endDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const date = exp.date?.split('T')[0] || '';
      return date >= startDate && date <= endDate;
    });
  }, [expenses, startDate, endDate]);

  const filteredExaminations = useMemo(() => {
    return examinations.filter(exam => {
      const date = exam.createdAt?.split('T')[0] || '';
      return date >= startDate && date <= endDate;
    });
  }, [examinations, startDate, endDate]);

  const [patientSearchTerm, setPatientSearchTerm] = useState('');

  const filteredPatients = useMemo(() => {
    return patients.filter(patient => {
      const date = patient.createdAt?.split('T')[0] || '';
      const search = patientSearchTerm.toLowerCase().trim();
      const matchesDate = date >= startDate && date <= endDate;
      const matchesSearch = !search || 
                          patient.name.toLowerCase().includes(search) || 
                          patient.phone.includes(search);
      return matchesDate && matchesSearch;
    });
  }, [patients, startDate, endDate, patientSearchTerm]);

  // 1. Revenue Calculations
  const totalIncome = filteredInvoices.reduce((acc, inv) => acc + (inv.status === 'paid' ? (Number(inv.amount) || 0) : 0), 0);
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
  
  const revenueData = [
    { name: 'صافى الربح', value: totalIncome - totalExpenses, fill: '#0ea5e9' },
    { name: 'المصاريف', value: totalExpenses, fill: '#ef4444' },
    { name: 'الايرادات', value: totalIncome, fill: '#10b981' }
  ];

  // 2. Complaint Analysis
  const complaintCounts = filteredExaminations.reduce((acc: Record<string, number>, exam) => {
    const complaint = exam.complaint?.trim() || 'غير محدد';
    acc[complaint] = (acc[complaint] || 0) + 1;
    return acc;
  }, {});

  const topComplaints = Object.entries(complaintCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 3. Diagnosis Analysis (from examinations)
  const diagnosisCounts = filteredExaminations.reduce((acc: Record<string, number>, exam) => {
    const diagnosis = exam.diagnosis?.trim();
    if (diagnosis) {
      acc[diagnosis] = (acc[diagnosis] || 0) + 1;
    }
    return acc;
  }, {});

  const topDiagnoses = Object.entries(diagnosisCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // 4. City/Address Analysis
  const addressCounts = patients.reduce((acc: Record<string, number>, patient) => {
    const address = patient.address?.split(' ')[0]?.trim() || 'غير محدد';
    acc[address] = (acc[address] || 0) + 1;
    return acc;
  }, {});

  const topAddresses = Object.entries(addressCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const [exporting, setExporting] = useState(false);

  const escapeHtml = (value: unknown) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const makeBarRows = (items: Array<{ name: string; value: number; color: string }>) => {
    const maxValue = Math.max(...items.map((item) => Math.abs(item.value)), 1);

    return items.map((item) => {
      const width = Math.max((Math.abs(item.value) / maxValue) * 100, 4);

      return `
        <div class="bar-row">
          <div class="bar-meta">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(formatCurrency(item.value))}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%; background:${item.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  };

  const makeListRows = (items: Array<{ name: string; value: number }>) => {
    const maxValue = Math.max(...items.map((item) => item.value), 1);

    return items.map((item, index) => `
      <div class="rank-row">
        <span class="rank-index">${index + 1}</span>
        <span class="rank-name">${escapeHtml(item.name)}</span>
        <span class="rank-value">${item.value}</span>
        <div class="mini-track"><div style="width:${Math.max((item.value / maxValue) * 100, 5)}%; background:${COLORS[index % COLORS.length]}"></div></div>
      </div>
    `).join('');
  };

  const makeDonut = (items: Array<{ name: string; value: number }>) => {
    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
    let cursor = 0;
    const stops = items.map((item, index) => {
      const start = cursor;
      cursor += (item.value / total) * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
    }).join(', ');

    return `
      <div class="donut-wrap">
        <div class="donut" style="background: conic-gradient(${stops || '#e2e8f0 0 100%'})"></div>
        <div class="legend">${items.map((item, index) => `
          <div><span style="background:${COLORS[index % COLORS.length]}"></span>${escapeHtml(item.name)} (${item.value})</div>
        `).join('')}</div>
      </div>
    `;
  };

  const buildPrintableReport = (filename: string) => {
    const financialItems = [
      { name: 'الإيرادات', value: totalIncome, color: '#16a34a' },
      { name: 'المصروفات', value: totalExpenses, color: '#dc2626' },
      { name: 'صافي الربح', value: totalIncome - totalExpenses, color: '#0284c7' },
    ];

    const showAll = filename === 'full-clinic-report';
    const showFinancial = showAll || filename === 'financial-summary';
    const showComplaints = showAll || filename === 'complaints-analysis';
    const showPatients = showAll || filename === 'patient-stats';
    const showPatientList = showAll || filename === 'detailed-patient-list';
    const showEfficiency = showAll || filename === 'efficiency-analysis';

    return `
      <section class="report-header">
        <h1>تقرير العيادة</h1>
        <p>الفترة من ${escapeHtml(startDate)} إلى ${escapeHtml(endDate)}</p>
      </section>

      ${showFinancial ? `
        <section class="report-section">
          <h2>الأداء المالي</h2>
          <div class="summary-grid">
            <div><span>الإيرادات</span><strong>${escapeHtml(formatCurrency(totalIncome))}</strong></div>
            <div><span>المصروفات</span><strong>${escapeHtml(formatCurrency(totalExpenses))}</strong></div>
            <div><span>صافي الربح</span><strong>${escapeHtml(formatCurrency(totalIncome - totalExpenses))}</strong></div>
          </div>
          <div class="chart-card">${makeBarRows(financialItems)}</div>
        </section>
      ` : ''}

      ${showComplaints ? `
        <section class="report-section">
          <h2>تحليل الشكاوى والتشخيصات</h2>
          <div class="two-col">
            <div class="chart-card">
              <h3>أكثر الشكاوى شيوعاً</h3>
              ${topComplaints.length ? makeDonut(topComplaints) : '<p class="empty">لا توجد بيانات شكاوى في هذه الفترة.</p>'}
            </div>
            <div class="chart-card">
              <h3>أكثر التشخيصات الطبية</h3>
              ${topDiagnoses.length ? makeListRows(topDiagnoses) : '<p class="empty">لا توجد بيانات تشخيصية في هذه الفترة.</p>'}
            </div>
          </div>
        </section>
      ` : ''}

      ${showPatients ? `
        <section class="report-section">
          <h2>بيانات المرضى والتوزيع الجغرافي</h2>
          <div class="summary-grid">
            <div><span>عدد المرضى</span><strong>${filteredPatients.length}</strong></div>
            <div><span>عدد الكشوفات</span><strong>${filteredExaminations.length}</strong></div>
            <div><span>عدد الفواتير</span><strong>${filteredInvoices.length}</strong></div>
          </div>
          <div class="chart-card">
            <h3>التوزيع الجغرافي</h3>
            ${topAddresses.length ? makeListRows(topAddresses) : '<p class="empty">لا توجد بيانات عناوين.</p>'}
          </div>
        </section>
      ` : ''}

      ${showPatientList ? `
        <section class="report-section">
          <h2>قائمة المرضى التفصيلية</h2>
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>العمر</th>
                <th>رقم الهاتف</th>
                <th>العنوان</th>
                <th>تاريخ التسجيل</th>
                <th>السجل الطبي</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPatients.map((p) => `
                <tr>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(p.age)}</td>
                  <td>${escapeHtml(p.phone)}</td>
                  <td>${escapeHtml(p.address)}</td>
                  <td>${p.createdAt ? escapeHtml(new Date(p.createdAt).toLocaleDateString('ar-EG')) : '-'}</td>
                  <td>${escapeHtml(p.medicalHistory || '-')}</td>
                </tr>
              `).join('') || '<tr><td colspan="6">لا يوجد مرضى مسجلين في هذه الفترة.</td></tr>'}
            </tbody>
          </table>
        </section>
      ` : ''}

      ${showEfficiency ? `
        <section class="report-section">
          <h2>تحليل الكفاءة والمؤشرات</h2>
          <div class="summary-grid">
            <div><span>متوسط قيمة الفواتير</span><strong>${escapeHtml(formatCurrency(totalIncome / (filteredInvoices.length || 1)))}</strong></div>
            <div><span>نسبة المصروفات</span><strong>${((totalExpenses / (totalIncome || 1)) * 100).toFixed(1)}%</strong></div>
            <div><span>نسبة التحصيل</span><strong>${((filteredInvoices.filter(inv => inv.status === 'paid').length / (filteredInvoices.length || 1)) * 100).toFixed(1)}%</strong></div>
          </div>
        </section>
      ` : ''}
    `;
  };

  const exportSectionPDF = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    setExporting(true);
    
    try {
      await document.fonts?.ready;
      {
      const exportNode = ref.current.cloneNode(true) as HTMLElement;
      sanitizePdfNode(exportNode);
      await inlineSvgCharts(exportNode);
      const reportMarkup = buildPrintableReport(filename);

      const printWindow = window.open('', '_blank', 'width=1200,height=900');
      if (!printWindow) {
        throw new Error('Popup blocked');
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('\n')
        .replace(/color-mix\([^;{}]+\)/g, '#f8fafc')
        .replace(MODERN_COLOR_REGEX, '#94a3b8');

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8" />
            <base href="${document.baseURI}" />
            <title>${filename}-${startDate}</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
            ${styles}
            <style>
              @page { size: A4; margin: 10mm; }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                background: #ffffff;
                direction: rtl;
                font-family: "Cairo", "Noto Naskh Arabic", "Tajawal", Arial, sans-serif;
                color: #0f172a;
                text-rendering: optimizeLegibility;
              }
              body { font-size: 12px; line-height: 1.7; }
              h1, h2, h3, h4, p, span, th, td, div {
                direction: rtl;
                unicode-bidi: isolate;
                letter-spacing: 0 !important;
              }
              button, input, .animate-spin { display: none !important; }
              table { width: 100% !important; border-collapse: collapse; }
              th, td {
                white-space: normal !important;
                overflow: visible !important;
                text-overflow: clip !important;
                padding: 8px 10px !important;
                border-bottom: 1px solid #e2e8f0;
                vertical-align: top;
              }
              svg {
                max-width: 100%;
                height: auto;
                overflow: visible;
              }
              .overflow-x-auto, .overflow-hidden { overflow: visible !important; }
              .truncate { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
              .recharts-wrapper, .recharts-surface {
                direction: ltr;
                overflow: visible !important;
              }
              .recharts-wrapper {
                width: 100% !important;
                min-height: 260px !important;
                margin: 0 auto;
              }
              .recharts-text, .recharts-label, .recharts-legend-item-text {
                font-family: "Cairo", "Noto Naskh Arabic", Arial, sans-serif !important;
                letter-spacing: 0 !important;
              }
              .grid { break-inside: avoid; page-break-inside: avoid; }
              [class*="shadow"] { box-shadow: none !important; }
              .pdf-page {
                width: 100%;
                max-width: 190mm;
                margin: 0 auto;
                background: #ffffff;
                direction: rtl;
                text-align: right;
              }
              .report-header {
                padding: 0 0 14px;
                margin-bottom: 18px;
                border-bottom: 2px solid #0ea5e9;
              }
              .report-header h1 {
                margin: 0 0 6px;
                font-size: 28px;
                font-weight: 900;
                color: #0f172a;
              }
              .report-header p {
                margin: 0;
                font-size: 13px;
                font-weight: 700;
                color: #64748b;
              }
              .report-section {
                break-inside: avoid;
                page-break-inside: avoid;
                margin: 0 0 18px;
                padding: 16px;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                background: #ffffff;
              }
              .report-section h2 {
                margin: 0 0 14px;
                font-size: 18px;
                font-weight: 900;
                color: #075985;
              }
              .report-section h3 {
                margin: 0 0 12px;
                font-size: 14px;
                font-weight: 900;
                color: #1e293b;
              }
              .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 14px;
              }
              .summary-grid div {
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                background: #f8fafc;
              }
              .summary-grid span {
                display: block;
                margin-bottom: 6px;
                font-size: 11px;
                font-weight: 800;
                color: #64748b;
              }
              .summary-grid strong {
                display: block;
                font-size: 18px;
                font-weight: 900;
                color: #0f172a;
              }
              .two-col {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
              }
              .chart-card {
                padding: 14px;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                background: #ffffff;
              }
              .bar-row { margin-bottom: 12px; }
              .bar-meta {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 6px;
                font-size: 12px;
              }
              .bar-meta strong { font-weight: 900; color: #1e293b; }
              .bar-meta span { font-weight: 800; color: #475569; }
              .bar-track, .mini-track {
                height: 12px;
                overflow: hidden;
                border-radius: 999px;
                background: #e2e8f0;
              }
              .bar-fill, .mini-track div {
                height: 100%;
                border-radius: 999px;
              }
              .rank-row {
                display: grid;
                grid-template-columns: 28px 1fr 38px;
                gap: 8px;
                align-items: center;
                margin-bottom: 10px;
                font-size: 12px;
              }
              .rank-index {
                display: inline-flex;
                width: 24px;
                height: 24px;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                background: #e0f2fe;
                color: #0369a1;
                font-weight: 900;
              }
              .rank-name { font-weight: 800; color: #1e293b; }
              .rank-value { font-weight: 900; color: #64748b; text-align: left; }
              .mini-track { grid-column: 2 / 4; height: 8px; }
              .donut-wrap {
                display: grid;
                grid-template-columns: 130px 1fr;
                gap: 18px;
                align-items: center;
              }
              .donut {
                width: 130px;
                height: 130px;
                border-radius: 50%;
                position: relative;
              }
              .donut::after {
                content: "";
                position: absolute;
                inset: 32px;
                border-radius: 50%;
                background: #ffffff;
                border: 1px solid #e2e8f0;
              }
              .legend div {
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: 800;
                color: #334155;
              }
              .legend span {
                display: inline-block;
                width: 10px;
                height: 10px;
                margin-left: 8px;
                border-radius: 999px;
              }
              .empty {
                padding: 18px;
                border-radius: 10px;
                background: #f8fafc;
                color: #94a3b8;
                font-weight: 700;
                text-align: center;
              }
              @media print {
                .report-section { break-inside: avoid; }
                .summary-grid, .two-col { break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <main class="pdf-page">${reportMarkup}</main>
          </body>
        </html>
      `);
      printWindow.document.close();

      const printReport = async () => {
        await printWindow.document.fonts?.ready;
        printWindow.focus();
        printWindow.print();
      };

      printWindow.addEventListener('load', () => {
        setTimeout(() => {
          void printReport();
        }, 300);
      });
      if (printWindow.document.readyState === 'complete') {
        setTimeout(() => {
          void printReport();
        }, 300);
      }
      return;
      }

      const exportNode = ref.current.cloneNode(true) as HTMLElement;
      sanitizePdfNode(exportNode);

      const exportHost = document.createElement('div');
      exportHost.style.position = 'fixed';
      exportHost.style.left = '-10000px';
      exportHost.style.top = '0';
      exportHost.style.width = '1120px';
      exportHost.style.backgroundColor = '#ffffff';
      exportHost.style.zIndex = '-1';
      exportHost.appendChild(exportNode);
      document.body.appendChild(exportHost);

      let canvas!: HTMLCanvasElement;
      try {
        canvas = await html2canvas(exportNode, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1120,
        width: exportNode.scrollWidth,
        height: exportNode.scrollHeight,
        ignoreElements: (element) => element.tagName === 'BUTTON' || element.tagName === 'INPUT',
        onclone: (clonedDoc) => {
          // 1. Pre-sanitize all style tags in the cloned document to remove oklch
          const styleTags = clonedDoc.getElementsByTagName('style');
          for (let i = 0; i < styleTags.length; i++) {
            try {
              let css = styleTags[i].innerHTML;
              if (css.includes('oklch') || css.includes('oklab') || css.includes('color(') || css.includes('color-mix')) {
                // Replace any modern color function calls with safe fallbacks to prevent html2canvas parsing errors
                css = css.replace(/color-mix\([^;{}]+\)/g, '#f8fafc');
                css = css.replace(MODERN_COLOR_REGEX, '#94a3b8');
                styleTags[i].innerHTML = css;
              }
            } catch (e) { /* skip */ }
          }

          // 2. Force all elements to use standard hex/rgb colors
          const elements = Array.from(clonedDoc.getElementsByTagName('*')) as HTMLElement[];
          
          elements.forEach(el => {
            try {
              // Specific tailwind 4 variable overrides
              if (el.classList.contains('bg-primary')) el.style.backgroundColor = '#0ea5e9';
              if (el.classList.contains('bg-primary-dark')) el.style.backgroundColor = '#0284c7';
              if (el.classList.contains('text-primary')) el.style.color = '#0ea5e9';
              if (el.classList.contains('bg-slate-50')) el.style.backgroundColor = '#f8fafc';
              if (el.classList.contains('bg-white')) el.style.backgroundColor = '#ffffff';
              if (el.classList.contains('text-slate-900')) el.style.color = '#0f172a';
              if (el.classList.contains('text-slate-700')) el.style.color = '#334155';
              if (el.classList.contains('text-slate-500')) el.style.color = '#64748b';
              if (el.classList.contains('text-slate-400')) el.style.color = '#94a3b8';
              if (el.classList.contains('border-border')) el.style.borderColor = '#e2e8f0';
              if (el.classList.contains('border-slate-100')) el.style.borderColor = '#f1f5f9';
              if (el.classList.contains('bg-green-50')) el.style.backgroundColor = '#f0fdf4';
              if (el.classList.contains('text-green-600')) el.style.color = '#16a34a';
              if (el.classList.contains('bg-red-50')) el.style.backgroundColor = '#fef2f2';
              if (el.classList.contains('text-red-600')) el.style.color = '#dc2626';

              // Aggressive property cleanup for any remaining oklch or color functions
              const props = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke'];
              const computedStyle = window.getComputedStyle(el);
              
              props.forEach(prop => {
                const value = (el.style as any)[prop] || computedStyle.getPropertyValue(prop.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`));
              if (value && typeof value === 'string' && (value.includes('oklch') || value.includes('oklab') || value.includes('color(') || value.includes('color-mix'))) {
                if (prop === 'borderColor') el.style.borderColor = '#e2e8f0';
                else if (prop === 'backgroundColor') el.style.backgroundColor = '#ffffff';
                else if (prop === 'color') el.style.color = '#1e293b';
                  else el.style.setProperty(prop, '#94a3b8', 'important');
                }
              });

              // SVG specific fixes for charts
              if (el.tagName.toLowerCase() === 'path' || el.tagName.toLowerCase() === 'rect') {
                const fill = el.getAttribute('fill');
                const stroke = el.getAttribute('stroke');
                if (fill && (fill.includes('oklch') || fill.includes('oklab') || fill.includes('color(') || fill.includes('color-mix') || fill.startsWith('var'))) el.setAttribute('fill', '#0ea5e9');
                if (stroke && (stroke.includes('oklch') || stroke.includes('oklab') || stroke.includes('color(') || stroke.includes('color-mix') || stroke.startsWith('var'))) el.setAttribute('stroke', '#0ea4e9');
              }
            } catch (e) { /* skip */ }
          });
          
          // 3. Inject a final global style to the clone to ensure absolute safety
          const baseStyle = clonedDoc.createElement('style');
          baseStyle.innerHTML = `
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              --color-primary: #0ea5e9 !important;
              --color-primary-dark: #0284c7 !important;
              --color-slate-50: #f8fafc !important;
              --color-slate-100: #f1f5f9 !important;
              --color-slate-200: #e2e8f0 !important;
              --color-slate-300: #cbd5e1 !important;
              --color-slate-400: #94a3b8 !important;
              --color-slate-500: #64748b !important;
              --color-slate-600: #475569 !important;
              --color-slate-700: #334155 !important;
              --color-slate-800: #1e293b !important;
              --color-slate-900: #0f172a !important;
            }
            .animate-spin { display: none !important; }
            .bg-slate-50 { background-color: #f8fafc !important; }
            .bg-white { background-color: #ffffff !important; }
            .text-slate-900 { color: #0f172a !important; }
          `;
          clonedDoc.head.appendChild(baseStyle);
          }
        });
      } finally {
        exportHost.remove();
      }
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`${filename}-${startDate}.pdf`);
    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("عذراً، حدث خطأ أثناء إنشاء ملف PDF.");
    } finally {
      setExporting(false);
    }
  };

  const exportPDF = async () => {
    await exportSectionPDF(reportRef, 'full-clinic-report');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (profile?.role === 'receptionist') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">عذراً، لا تملك صلاحية الوصول</h3>
        <p className="text-sm text-slate-500 max-w-md">التقارير المالية والتحليلية متاحة فقط للمدير والأطباء.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">التقارير وذكاء الأعمال</h2>
          <p className="text-sm text-slate-500 font-medium">نظرة شاملة على الأداء المالي والطبي للعيادة.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-border shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <div className="flex items-center gap-1">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
              />
              <span className="text-slate-300">|</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold text-slate-600 focus:outline-none bg-transparent"
              />
            </div>
          </div>
          <button 
            onClick={exportPDF}
            disabled={exporting}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-black hover:brightness-110 transition-all shadow-lg shadow-primary/20 active:scale-95",
              exporting && "opacity-50 cursor-not-allowed hover:brightness-100"
            )}
          >
            {exporting ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                جاري التجهيز...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                تصدير PDF
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={reportRef} className="space-y-6 pt-2 pb-10">

      {/* Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div 
          ref={financialRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-12 xl:col-span-7 bg-white p-6 rounded-2xl border border-border shadow-sm h-full"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-light text-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">الأداء المالي</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Financial Performance</p>
              </div>
            </div>
            <button 
              onClick={() => exportSectionPDF(financialRef, 'financial-summary')}
              className="p-2 text-slate-300 hover:text-primary transition-colors bg-slate-50 rounded-lg"
              title="تصدير القسم PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50}>
                  {revenueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="p-4 bg-green-50/50 rounded-xl border border-green-100/50 text-center">
               <p className="text-[10px] font-bold text-green-600 mb-1">الايرادات</p>
               <p className="text-base font-black text-green-700">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="p-4 bg-red-50/50 rounded-xl border border-red-100/50 text-center">
               <p className="text-[10px] font-bold text-red-600 mb-1">المصاريف</p>
               <p className="text-base font-black text-red-700">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 text-center text-blue-700">
               <p className="text-[10px] font-bold text-blue-600 mb-1">صافى الربح</p>
               <p className="text-base font-black text-blue-800">{formatCurrency(totalIncome - totalExpenses)}</p>
            </div>
          </div>
        </motion.div>

        {/* Complaints Analysis */}
        <motion.div 
          ref={complaintsRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-12 xl:col-span-5 bg-white p-6 rounded-2xl border border-border shadow-sm h-full"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">أكثر الشكاوى شيوعاً</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Common Complaints</p>
              </div>
            </div>
            <button 
              onClick={() => exportSectionPDF(complaintsRef, 'complaints-analysis')}
              className="p-2 text-slate-300 hover:text-amber-600 transition-colors bg-slate-50 rounded-lg"
              title="تصدير القسم PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topComplaints}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topComplaints.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800, fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="columns-2 gap-4 mt-4 bg-slate-50 p-4 rounded-xl">
            {topComplaints.map((item, idx) => (
              <div key={idx} className="flex items-center break-inside-avoid gap-2 mb-2 last:mb-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                <span className="text-[11px] font-bold text-slate-600 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Patient Data Section */}
      <div ref={patientDataRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Patient Count Stats */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-12 xl:col-span-4 bg-gradient-to-br from-primary to-primary-dark p-6 px-8 rounded-3xl text-white shadow-xl shadow-primary/20 flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6" />
            </div>
            <button 
              onClick={() => exportSectionPDF(patientDataRef, 'patient-stats')}
              className="p-2 text-white/40 hover:text-white transition-colors bg-white/10 rounded-xl"
              title="تصدير بيانات المرضى PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="text-lg font-black mb-1">قاعدة العملاء</h3>
            <p className="text-primary-light text-xs font-bold uppercase tracking-widest">Patient Database</p>
          </div>
          <div className="mt-8">
            <span className="text-7xl font-black tabular-nums">{filteredPatients.length}</span>
            <p className="text-sm font-bold opacity-80 mt-2">مريض مسجل في هذه الفترة</p>
          </div>
        </motion.div>

        {/* Top Diagnoses */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-12 xl:col-span-4 bg-white p-6 rounded-2xl border border-border shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">أكثر التشخيصات الطبية</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Medical Diagnoses</p>
            </div>
          </div>

          <div className="space-y-5">
            {topDiagnoses.length > 0 ? topDiagnoses.map((item, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-[11px] font-black text-slate-600 uppercase">
                  <span>{item.name}</span>
                  <span className="text-slate-400">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.value / (filteredExaminations.length || 1)) * 100}%` }}
                    className="h-full bg-green-500 rounded-full" 
                  />
                </div>
              </div>
            )) : (
              <div className="py-12 text-center text-slate-300 italic text-sm">لا توجد بيانات تشخيصية</div>
            )}
          </div>
        </motion.div>

        {/* Top Locations */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-12 xl:col-span-4 bg-white p-6 rounded-2xl border border-border shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">التوزيع الجغرافي</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Geographical Distribution</p>
            </div>
          </div>

          <div className="space-y-3">
            {topAddresses.length > 0 ? topAddresses.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white border border-slate-200 text-blue-500 rounded-xl flex items-center justify-center text-xs font-black shadow-sm">
                    {idx + 1}
                  </div>
                  <p className="text-sm font-bold text-slate-800">{item.name}</p>
                </div>
                <span className="text-[11px] font-black text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">{item.value} مريض</span>
              </div>
            )) : (
              <div className="py-12 text-center text-slate-300 italic text-sm">لا توجد بيانات عناوين</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Detailed Patient Database Table */}
      <motion.div 
        ref={patientListRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">قاعدة بيانات المرضى التفصيلية</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Detailed Patient Records</p>
              </div>
            </div>
            
            <div className="relative group flex-1 max-w-sm">
              <input
                type="text"
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                value={patientSearchTerm}
                onChange={(e) => setPatientSearchTerm(e.target.value)}
                className="w-full h-9 pr-10 pl-4 bg-slate-50 border border-slate-200 rounded-full text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
            </div>
          </div>
          <button 
            onClick={() => exportSectionPDF(patientListRef, 'detailed-patient-list')}
            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
            title="تصدير القائمة PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">الاسم</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">العمر</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">رقم الهاتف</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">العنوان</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">تاريخ التسجيل</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">السجل الطبي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPatients.length > 0 ? filteredPatients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{p.age}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-600">{p.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{p.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-slate-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : '-'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500 overflow-hidden max-w-[200px] truncate">
                    {p.medicalHistory || '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 italic text-sm">
                    لا يوجد مرضى مسجلين في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Efficiency Cards */}
      <motion.div 
        ref={efficiencyRef}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white p-6 rounded-3xl border border-border shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center shadow-inner">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">تحليل الكفاءة والمقاييس</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Operational Efficiency & Metrics</p>
            </div>
          </div>
          <button 
            onClick={() => exportSectionPDF(efficiencyRef, 'efficiency-analysis')}
            className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 rounded-xl shadow-sm border border-slate-100"
            title="تصدير القسم PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">متوسط قيمة الفواتير</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalIncome / (filteredInvoices.length || 1))}</p>
            <div className="mt-2 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-primary w-2/3" />
            </div>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">نسبة المصاريف</p>
            <p className="text-2xl font-black text-red-600">{((totalExpenses / (totalIncome || 1)) * 100).toFixed(1)}%</p>
            <div className="mt-2 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-red-400 w-1/3" />
            </div>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">عدد الكشوفات</p>
            <p className="text-2xl font-black text-indigo-600 tabular-nums">{filteredExaminations.length}</p>
            <div className="mt-2 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-indigo-400 w-1/2" />
            </div>
          </div>
          <div className="p-6 bg-slate-50 border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">نسبة التحصيل</p>
            <p className="text-2xl font-black text-green-600">
              {((filteredInvoices.filter(inv => inv.status === 'paid').length / (filteredInvoices.length || 1)) * 100).toFixed(1)}%
            </p>
            <div className="mt-2 w-full h-1 bg-slate-200 rounded-full overflow-hidden">
               <div className="h-full bg-green-500 w-full" />
            </div>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
