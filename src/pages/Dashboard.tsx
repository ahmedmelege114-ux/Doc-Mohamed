import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { collection, query, getDocs, orderBy, limit, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { Appointment, Invoice, ClinicSettings } from '../types';

const data = [
  { name: 'السبت', revenue: 4000 },
  { name: 'الأحد', revenue: 3000 },
  { name: 'الاثنين', revenue: 2000 },
  { name: 'الثلاثاء', revenue: 2780 },
  { name: 'الأربعاء', revenue: 1890 },
  { name: 'الخميس', revenue: 2390 },
  { name: 'الجمعة', revenue: 3490 },
];

export default function Dashboard() {
  const { profile } = useAuth();
  const [clinicName, setClinicName] = useState('عيادة طبية');
  const [stats, setStats] = useState({
    totalPatients: 0,
    appointmentsToday: 0,
    monthlyRevenue: 0,
    growth: 12.5
  });
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch clinic settings for name
      const settingsDoc = await getDoc(doc(db, 'settings', 'clinic'));
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data() as ClinicSettings;
        if (settings.name) setClinicName(settings.name);
      }

      const patientsSnap = await getDocs(collection(db, 'patients'));
      const appointmentsSnap = await getDocs(collection(db, 'appointments'));
      const invoicesSnap = await getDocs(collection(db, 'invoices'));
      const expensesSnap = await getDocs(collection(db, 'expenses'));

      const today = new Date().toISOString().split('T')[0];
      const todayAppointments = appointmentsSnap.docs.filter(doc => (doc.data() as Appointment).date === today);
      
      let totalRev = 0;
      invoicesSnap.docs.forEach(doc => {
        const inv = doc.data() as Invoice;
        if (inv.status === 'paid') totalRev += (Number(inv.amount) || 0);
      });

      let totalExp = 0;
      expensesSnap.docs.forEach(doc => {
        totalExp += (Number(doc.data().amount) || 0);
      });

      setStats({
        totalPatients: patientsSnap.size,
        appointmentsToday: todayAppointments.length,
        monthlyRevenue: totalRev - totalExp,
        growth: 12.5
      });

      const recent = appointmentsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Appointment))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5);
      
      setRecentAppointments(recent);
    };

    fetchData();
  }, []);

  const isReceptionist = profile?.role === 'receptionist';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">مرحباً بكم فى {clinicName}</h2>
          <p className="text-sm text-slate-500 font-medium">إحصائيات العيادة المباشرة اليوم.</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="إجمالي المرضى" 
          value={stats.totalPatients.toLocaleString()} 
          icon={Users} 
          trend={+12} 
          subtitle="مريض مسجل" 
        />
        <StatCard 
          title="مواعيد اليوم" 
          value={stats.appointmentsToday.toString()} 
          icon={Clock} 
          trend={+5} 
          subtitle="موعد مجدول" 
        />
        {!isReceptionist && (
          <>
            <StatCard 
              title="صافي الدخل" 
              value={formatCurrency(stats.monthlyRevenue)} 
              icon={CreditCard} 
              trend={+18} 
              subtitle="إجمالي الأرباح" 
            />
            <StatCard 
              title="معدل النمو" 
              value={stats.growth + "%"} 
              icon={TrendingUp} 
              trend={-2} 
              subtitle="نسبة الاستقرار" 
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        {!isReceptionist && (
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-900">إحصائيات الإيرادات الأسبوعية</h3>
              <select className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 font-semibold text-slate-600 focus:ring-2 focus:ring-primary/20 transition-all">
                <option>آخر 7 أيام</option>
                <option>آخر 30 يوم</option>
              </select>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#0284c7" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Appointments */}
        <div className="bg-white p-6 rounded-xl border border-border shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-900">أحدث المواعيد</h3>
            <button className="text-xs text-primary font-bold hover:underline underline-offset-4 tracking-tight">عرض الكل</button>
          </div>
          <div className="flex-1 space-y-5">
            {recentAppointments.length > 0 ? recentAppointments.map((apt, i) => (
              <div key={apt.id} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 flex-shrink-0 rounded-lg border border-slate-100 flex items-center justify-center text-primary">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-xs">{apt.patientName}</p>
                  <p className="text-[10px] text-slate-400 font-medium">{apt.time} - {formatDate(apt.date)}</p>
                </div>
                <div className={cn(
                  "px-2.5 py-1 rounded-full text-[9px] font-bold uppercase",
                  apt.status === 'pending' ? "bg-amber-100 text-amber-700" :
                  apt.status === 'completed' ? "bg-green-100 text-green-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {apt.status === 'pending' ? 'منتظر' : apt.status === 'completed' ? 'تم' : 'ملغى'}
                </div>
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale py-8">
                <Calendar className="w-10 h-10 mb-3" />
                <p className="text-xs font-bold">لا يوجد مواعيد</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend, subtitle }: any) {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="bg-white p-5 rounded-xl border border-border shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="stat-label uppercase tracking-[0.1em] text-[10px] font-black">{title}</div>
        <div className={cn(
          "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-lg",
          trend > 0 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
        )}>
          {trend > 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
          {Math.abs(trend)}%
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-[10px] text-slate-400 font-medium mt-1">{subtitle}</p>
        </div>
        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

function UserIcon(props: any) {
  return (
    <svg 
      {...props}
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
