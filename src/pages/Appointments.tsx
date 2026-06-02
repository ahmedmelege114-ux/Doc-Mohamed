import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  User, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  UserPlus,
  Trash2
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Appointment, Patient, AppointmentStatus } from '../types';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Appointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    notes: ''
  });

  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male' as const
  });

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenModal();
    }
  }, [searchParams]);

  const fetchAppointments = async () => {
    const q = query(collection(db, 'appointments'), orderBy('date', 'asc'), orderBy('time', 'asc'));
    const snap = await getDocs(q);
    setAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
  };

  const fetchPatients = async () => {
    const snap = await getDocs(collection(db, 'patients'));
    setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
  };

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, []);

  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  const filteredPatientList = useMemo(() => {
    const term = patientSearchTerm.toLowerCase().trim();
    if (!term) return [];
    return patients.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.phone.includes(term)
    );
  }, [patients, patientSearchTerm]);

  const handleSelectPatient = (patient: Patient) => {
    setNewAppointment({ ...newAppointment, patientId: patient.id! });
    setPatientSearchTerm(patient.name);
    setIsPatientDropdownOpen(false);
  };

  const handleOpenModal = (appointment?: Appointment) => {
    if (appointment) {
      const patient = patients.find(p => p.id === appointment.patientId);
      setPatientSearchTerm(patient?.name || '');
      setNewAppointment({
        patientId: appointment.patientId,
        date: appointment.date,
        time: appointment.time,
        notes: appointment.notes || ''
      });
      setEditingAppointmentId(appointment.id!);
    } else {
      setPatientSearchTerm('');
      setNewAppointment({
        patientId: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        notes: ''
      });
      setEditingAppointmentId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientName = patients.find(p => p.id === newAppointment.patientId)?.name || '';
    try {
      if (editingAppointmentId) {
        await updateDoc(doc(db, 'appointments', editingAppointmentId), {
          ...newAppointment,
          patientName,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...newAppointment,
          patientName,
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdBy: user?.uid
        });
      }
      setIsModalOpen(false);
      setEditingAppointmentId(null);
      fetchAppointments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const patientData = {
        ...newPatient,
        age: parseInt(newPatient.age),
        address: '',
        medicalHistory: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid
      };

      const docRef = await addDoc(collection(db, 'patients'), patientData);
      
      const createdPatient = { id: docRef.id, ...patientData } as Patient;
      setPatients(prev => [...prev, createdPatient]);
      setNewAppointment(prev => ({ ...prev, patientId: docRef.id }));
      setIsPatientModalOpen(false);
      setNewPatient({ name: '', phone: '', age: '', gender: 'male' });
    } catch (error) {
      console.error(error);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    await updateDoc(doc(db, 'appointments', id), { status });
    fetchAppointments();
  };

  const handleDeleteAppointment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'appointments', id));
      fetchAppointments();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    await handleDeleteAppointment(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">جدول المواعيد</h2>
          <p className="text-sm text-slate-500 font-medium">إدارة مواعيد الكشف والاستشارات اليومية.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          حجز موعد جديد
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Weekly Nav Mini */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">مايو 2026</h3>
              <div className="flex gap-1">
                <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></button>
                <button className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400"><ChevronLeft className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-3">
              {['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'].map(day => (
                <div key={day} className="text-[9px] font-black text-slate-300 uppercase">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: 31 }).map((_, i) => (
                <button 
                  key={i} 
                  className={cn(
                    "w-7 h-7 flex items-center justify-center text-[10px] font-bold rounded-lg transition-colors",
                    i + 1 === 1 ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl text-white shadow-lg shadow-slate-950/20">
            <h4 className="font-black text-slate-400 uppercase text-[9px] tracking-widest mb-3">تنبيه المواعيد</h4>
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] font-medium leading-relaxed text-slate-300">لديك <span className="text-white font-bold">5 مواعيد</span> قادمة خلال الساعتين القادمتين. يرجى التأكد من جاهزية غرف الكشف.</p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 space-y-3">
          {appointments.length > 0 ? appointments.map((apt) => (
            <motion.div 
              layout
              key={apt.id}
              className="bg-white p-4 rounded-xl border border-border shadow-sm hover:border-primary/30 transition-colors group flex items-center gap-5"
            >
              <div className="flex flex-col items-center justify-center bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 group-hover:bg-primary-light group-hover:border-primary/20 transition-colors min-w-[70px]">
                <p className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-primary transition-colors">{apt.time}</p>
                <Clock className="w-4 h-4 text-primary mt-0.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-0.5">
                  <h4 className="font-bold text-slate-900 text-sm">{apt.patientName}</h4>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight",
                    apt.status === 'pending' ? "bg-amber-100 text-amber-700" :
                    apt.status === 'completed' ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                  )}>
                    {apt.status === 'pending' ? 'انتظار' : apt.status === 'completed' ? 'تم الكشف' : 'ملغى'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">{apt.notes || 'لا يوجد ملاحظات إضافية'}</p>
              </div>
              <div className="flex items-center gap-1.5 text-right">
                {apt.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => updateStatus(apt.id!, 'completed')}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600 rounded-lg transition-all"
                      title="تم الكشف"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => updateStatus(apt.id!, 'cancelled')}
                      className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                      title="إلغاء الموعد"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                  <button 
                    onClick={() => setDeleteConfirmId(apt.id!)}
                    className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                    title="حذف الموعد"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                <button 
                  onClick={() => handleOpenModal(apt)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors"
                  title="تعديل الموعد"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center text-center opacity-30 grayscale">
              <CalendarIcon className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-900">لا يوجد مواعيد مجدولة اليوم</p>
              <p className="text-xs font-medium text-slate-500 mt-1">اضغط على زر حجز موعد جديد للبدء</p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">{editingAppointmentId ? 'تعديل موعد' : 'حجز موعد جديد'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5 relative">
                    <div className="flex items-center justify-between mr-1">
                      <label className="text-xs font-bold text-slate-700">المريض</label>
                      <button 
                        type="button"
                        onClick={() => setIsPatientModalOpen(true)}
                        className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                      >
                        <UserPlus className="w-3 h-3" />
                        إضافة مريض جديد
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="ابحث باسم المريض أو رقم الهاتف..."
                        value={patientSearchTerm}
                        onBlur={() => {
                          setTimeout(() => setIsPatientDropdownOpen(false), 200);
                        }}
                        onFocus={() => setIsPatientDropdownOpen(true)}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value);
                          setIsPatientDropdownOpen(true);
                        }}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      />
                      {isPatientDropdownOpen && filteredPatientList.length > 0 && (
                        <div className="absolute z-[110] top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {filteredPatientList.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur before selection
                                handleSelectPatient(p);
                              }}
                              className="w-full px-4 py-3 text-right hover:bg-slate-50 flex flex-col border-b border-slate-50 last:border-0 transition-colors"
                            >
                              <span className="text-sm font-bold text-slate-900">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{p.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">التاريخ</label>
                      <input
                        type="date"
                        required
                        value={newAppointment.date}
                        onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm font-sans"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 mr-1">الوقت</label>
                      <input
                        type="time"
                        required
                        value={newAppointment.time}
                        onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                        className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm font-sans"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">ملاحظات إضافية</label>
                    <textarea
                      rows={2}
                      value={newAppointment.notes}
                      onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      placeholder="ملاحظات..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 shrink-0">
                  <button 
                    type="submit"
                    className="flex-1 h-12 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-md shrink-0"
                  >
                    حفظ
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all shrink-0"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPatientModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden shadow-primary/10"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary-light text-primary rounded-lg flex items-center justify-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">إضافة مريض جديد</h3>
                </div>
                <button onClick={() => setIsPatientModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePatient} className="p-5 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 mr-1">اسم المريض</label>
                    <input
                      required
                      type="text"
                      className="w-full h-10 pr-3 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                      placeholder="الأسم الكامل"
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">رقم الهاتف</label>
                      <input
                        required
                        type="tel"
                        className="w-full h-10 pr-3 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                        placeholder="01xxxxxxxxx"
                        value={newPatient.phone}
                        onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">العمر</label>
                      <input
                        required
                        type="number"
                        className="w-full h-10 pr-3 bg-slate-50 border border-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-primary/20 outline-none"
                        placeholder="25"
                        value={newPatient.age}
                        onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 mr-1">الجنس</label>
                    <div className="flex gap-2">
                      {['male', 'female'].map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setNewPatient({ ...newPatient, gender: g as any })}
                          className={cn(
                            "flex-1 h-10 rounded-lg text-[10px] font-bold transition-all border",
                            newPatient.gender === g 
                              ? "bg-primary text-white border-primary shadow-sm" 
                              : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                          )}
                        >
                          {g === 'male' ? 'ذكر' : 'أنثى'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="submit"
                    className="flex-1 h-11 bg-primary text-white rounded-xl text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-95"
                  >
                    تسجيل المريض
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPatientModalOpen(false)}
                    className="flex-1 h-11 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all active:scale-95"
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
        {deleteConfirmId && (
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
              <h3 className="text-xl font-black text-slate-900 mb-2">تأكيد حذف الموعد؟</h3>
              <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف هذا الموعد نهائياً؟ <br />
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
                  onClick={() => setDeleteConfirmId(null)}
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
