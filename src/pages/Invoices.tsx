import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Plus, 
  Search, 
  DollarSign, 
  Receipt, 
  Download, 
  MoreVertical,
  CheckCircle,
  Clock,
  Printer,
  XCircle,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Tag,
  Trash2
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Invoice, Patient, PaymentMethod, InvoiceStatus, Expense } from '../types';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

type ActiveTabType = 'invoices' | 'expenses';

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTabType>('invoices');
  
  // Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [newInvoice, setNewInvoice] = useState({
    patientId: '',
    amount: 0,
    paymentMethod: 'cash' as PaymentMethod,
    status: 'paid' as InvoiceStatus
  });

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    category: 'إيجار',
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'invoice' | 'expense' } | null>(null);

  const fetchData = async () => {
    const invoicesSnap = await getDocs(query(collection(db, 'invoices'), orderBy('date', 'desc')));
    const expensesSnap = await getDocs(query(collection(db, 'expenses'), orderBy('date', 'desc')));
    const patientsSnap = await getDocs(collection(db, 'patients'));
    
    setInvoices(invoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    setExpenses(expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    setPatients(patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenInvoiceModal = (invoice?: Invoice) => {
    if (invoice) {
      setNewInvoice({
        patientId: invoice.patientId,
        amount: invoice.amount,
        paymentMethod: invoice.paymentMethod,
        status: invoice.status
      });
      setEditingInvoiceId(invoice.id);
    } else {
      setNewInvoice({
        patientId: '',
        amount: 0,
        paymentMethod: 'cash',
        status: 'paid'
      });
      setEditingInvoiceId(null);
    }
    setIsInvoiceModalOpen(true);
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === newInvoice.patientId);
    try {
      if (editingInvoiceId) {
        await updateDoc(doc(db, 'invoices', editingInvoiceId), {
          ...newInvoice,
          patientName: patient?.name || 'غير معروف',
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'invoices'), {
          ...newInvoice,
          patientName: patient?.name || 'غير معروف',
          date: new Date().toISOString(),
          createdBy: user?.uid
        });
      }
      setIsInvoiceModalOpen(false);
      setEditingInvoiceId(null);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), {
        ...newExpense,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid
      });
      setIsExpenseModalOpen(false);
      setNewExpense({
        category: 'إيجار',
        amount: 0,
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const markAsPaid = async (id: string) => {
    await updateDoc(doc(db, 'invoices', id), { status: 'paid' });
    fetchData();
  };

  const deleteInvoice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invoices', id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'invoice') {
      await deleteInvoice(deleteConfirm.id);
    } else {
      await deleteExpense(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const totalIncome = invoices.reduce((acc, inv) => acc + (inv.status === 'paid' ? (Number(inv.amount) || 0) : 0), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">الفواتير والمدفوعات</h2>
          <p className="text-sm text-slate-500 font-medium">إدارة الحسابات المالية، الإيرادات، والمصاريف التشغيلية.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => handleOpenInvoiceModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
          >
            <Receipt className="w-4 h-4" />
            فاتورة جديدة
          </button>
          <button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            إضافة مصروف
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded-full">+12%</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي الإيرادات</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalIncome)}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">-5%</span>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">إجمالي المصاريف</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(totalExpenses)}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-primary/20 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center justify-between mb-2">
            <div className="w-10 h-10 bg-primary-light text-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest">صافي الربح</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(netProfit)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('invoices')}
            className={cn(
              "px-8 py-4 text-xs font-bold transition-all relative",
              activeTab === 'invoices' ? "text-primary" : "text-slate-400 hover:text-slate-600 focus:bg-slate-50 outline-none"
            )}
          >
            الفواتير
            {activeTab === 'invoices' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={cn(
              "px-8 py-4 text-xs font-bold transition-all relative",
              activeTab === 'expenses' ? "text-primary" : "text-slate-400 hover:text-slate-600 focus:bg-slate-50 outline-none"
            )}
          >
            المصاريف
            {activeTab === 'expenses' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        </div>

        {activeTab === 'invoices' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">المريض / الرقم</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">المبلغ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">التاريخ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الوسيلة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">الحالة</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-50 group-hover:bg-primary-light rounded-lg flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                          <Receipt className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{inv.patientName}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">#{inv.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(inv.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-400">{formatDate(inv.date)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-50 text-slate-600 rounded text-[10px] font-bold border border-slate-100">
                        {inv.paymentMethod === 'cash' ? 'نقدي' : inv.paymentMethod === 'transfer' ? 'تحويل' : 'تأمين'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={cn(
                        "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full w-fit",
                        inv.status === 'paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {inv.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {inv.status === 'paid' ? 'تم الدفع' : 'قيد الانتظار'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-left whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenInvoiceModal(inv)}
                          className="w-8 h-8 flex items-center justify-center text-primary bg-primary-light rounded-lg hover:brightness-95 transition-all shadow-sm"
                          title="تعديل"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        {inv.status === 'unpaid' && (
                          <button 
                            onClick={() => markAsPaid(inv.id)}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold hover:brightness-110 shadow-md active:scale-[0.98]"
                          >
                            تحصيل
                          </button>
                        )}
                        <button 
                          onClick={() => setDeleteConfirm({ id: inv.id, type: 'invoice' })}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">نوع المصروف</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">المبلغ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">التاريخ</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الوصف</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-50 group-hover:bg-red-100 rounded-lg flex items-center justify-center text-red-500 transition-colors">
                          <Tag className="w-4 h-4" />
                        </div>
                        <p className="font-bold text-slate-900 text-sm">{exp.category}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(exp.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-400">{formatDate(exp.date)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-bold text-slate-600 truncate max-w-[200px]">{exp.description || 'بدون وصف'}</p>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <button 
                        onClick={() => setDeleteConfirm({ id: exp.id, type: 'expense' })}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      <AnimatePresence>
        {isInvoiceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{editingInvoiceId ? 'تعديل فاتورة' : 'إنشاء فاتورة'}</h3>
                <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleInvoiceSubmit} className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">المريض</label>
                    <select
                      required
                      value={newInvoice.patientId}
                      onChange={(e) => setNewInvoice({ ...newInvoice, patientId: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    >
                      <option value="">-- اختر مريض --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">المبلغ المطلوب</label>
                    <div className="relative">
                       <input
                        type="number"
                        required
                        value={newInvoice.amount || ''}
                        onChange={(e) => setNewInvoice({ ...newInvoice, amount: parseFloat(e.target.value) })}
                        className="w-full h-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-xl"
                        placeholder="0.00"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">ج.م</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">طريقة الدفع</label>
                      <select
                        value={newInvoice.paymentMethod}
                        onChange={(e) => setNewInvoice({ ...newInvoice, paymentMethod: e.target.value as PaymentMethod })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      >
                        <option value="cash">نقدي</option>
                        <option value="transfer">تحويل بنكي</option>
                        <option value="insurance">تأمين طبي</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">الحالة</label>
                      <select
                        value={newInvoice.status}
                        onChange={(e) => setNewInvoice({ ...newInvoice, status: e.target.value as InvoiceStatus })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      >
                        <option value="paid">تم التحصيل</option>
                        <option value="unpaid">لم يتم التحصيل</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 h-12 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
                  >
                    {editingInvoiceId ? 'حفظ التغييرات' : 'تأكيد الفاتورة'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsInvoiceModalOpen(false)}
                    className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Expense Modal */}
      <AnimatePresence>
        {isExpenseModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">إضافة مصروف جديد</h3>
                <button onClick={() => setIsExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">نوع المصروف</label>
                    <select
                      required
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    >
                      <option value="إيجار">إيجار</option>
                      <option value="كهرباء/مياه">كهرباء / مياه</option>
                      <option value="أجور">أجور ورواتب</option>
                      <option value="مستلزمات طبية">مستلزمات طبية</option>
                      <option value="إعلانات">إعلانات وتسويق</option>
                      <option value="صيانة">صيانة</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">المبلغ</label>
                      <input
                        type="number"
                        required
                        value={newExpense.amount || ''}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">التاريخ</label>
                      <input
                        type="date"
                        required
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-xs font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">تفاصيل إضافية</label>
                    <textarea
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                      className="w-full h-24 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-sm font-medium"
                      placeholder="وصف مختصر للمصروف..."
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 h-12 bg-red-600 text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
                  >
                    تسجيل المصروف
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsExpenseModalOpen(false)}
                    className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-[0.98]"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden p-8 text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">تأكيد الحذف؟</h3>
              <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذا البند؟ <br />
                <span className="text-red-500 font-bold block mt-1">هذا الإجراء لا يمكن التراجع عنه.</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleConfirmDelete}
                  className="h-12 bg-red-600 text-white rounded-xl text-sm font-black hover:bg-red-700 transition-all shadow-lg shadow-red-200 active:scale-95"
                >
                  نعم، حذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="h-12 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
