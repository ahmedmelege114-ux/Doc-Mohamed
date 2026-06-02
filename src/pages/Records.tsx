import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  User, 
  Calendar, 
  Stethoscope, 
  Pill,
  ChevronLeft,
  Activity,
  XCircle
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MedicalRecord, Patient } from '../types';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Records() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newRecord, setNewRecord] = useState({
    patientId: '',
    diagnosis: '',
    treatment: '',
    prescription: ''
  });

  const fetchData = async () => {
    const recordsSnap = await getDocs(query(collection(db, 'medicalRecords'), orderBy('visitDate', 'desc')));
    const patientsSnap = await getDocs(collection(db, 'patients'));
    setRecords(recordsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MedicalRecord)));
    setPatients(patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (record?: MedicalRecord) => {
    if (record) {
      setNewRecord({
        patientId: record.patientId,
        diagnosis: record.diagnosis,
        treatment: record.treatment,
        prescription: record.prescription
      });
      setEditingRecordId(record.id!);
    } else {
      setNewRecord({ patientId: '', diagnosis: '', treatment: '', prescription: '' });
      setEditingRecordId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRecordId) {
        await updateDoc(doc(db, 'medicalRecords', editingRecordId), {
          ...newRecord,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'medicalRecords'), {
          ...newRecord,
          visitDate: new Date().toISOString(),
          doctorId: profile?.uid || 'unknown'
        });
      }
      setIsModalOpen(false);
      setEditingRecordId(null);
      setNewRecord({ patientId: '', diagnosis: '', treatment: '', prescription: '' });
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || 'غير معروف';

  const filteredRecords = records.filter(r => 
    getPatientName(r.patientId).includes(searchTerm) || r.diagnosis.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">السجلات الطبية</h2>
          <p className="text-sm text-slate-500 font-medium">سجل الزيارات والتشخيصات والروشتات الطبية.</p>
        </div>
        {profile?.role === 'doctor' && (
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            إضافة سجل زيارة
          </button>
        )}
      </div>

      <div className="bg-white p-5 rounded-xl border border-border shadow-sm">
        <div className="relative group max-w-sm w-full mb-6">
          <input
            type="text"
            placeholder="ابحث باسم المريض أو التشخيص..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pr-11 pl-4 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium hover:border-slate-300"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredRecords.map((record) => (
            <motion.div 
              layout
              key={record.id} 
              className="bg-white p-6 rounded-xl border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all group overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20 group-hover:bg-primary transition-all" />
              
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary-light group-hover:text-primary transition-colors">
                  {getPatientName(record.patientId).charAt(0)}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{getPatientName(record.patientId)}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                      <Calendar className="w-3 h-3" />
                      {formatDate(record.visitDate)}
                    </div>
                  </div>
                  {profile?.role === 'doctor' && (
                    <button 
                      onClick={() => handleOpenModal(record)}
                      className="px-3 py-1.5 text-[10px] font-bold text-primary bg-primary-light rounded-lg hover:brightness-95 transition-all shadow-sm"
                    >
                      تعديل
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 text-amber-500">
                    <Activity className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">التشخيص</h5>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{record.diagnosis}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0 text-primary">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">العلاج الموصى به</h5>
                    <p className="text-xs font-medium text-slate-600 leading-relaxed">{record.treatment}</p>
                  </div>
                </div>

                <div className="bg-primary-light/30 p-3.5 rounded-lg border border-primary/10">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Pill className="w-3.5 h-3.5 text-primary" />
                    <h5 className="text-[10px] font-black text-primary uppercase tracking-tight">الروشتة الدوائية</h5>
                  </div>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed italic">{record.prescription}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {filteredRecords.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-slate-300 grayscale opacity-30">
            <FileText className="w-14 h-14 mb-3" />
            <p className="text-sm font-bold">لا توجد سجلات طبية</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">{editingRecordId ? 'تعديل سجل الزيارة' : 'إضافة سجل زيارة جديد'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">المريض</label>
                    <select
                      required
                      value={newRecord.patientId}
                      onChange={(e) => setNewRecord({ ...newRecord, patientId: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    >
                      <option value="">-- اختر مريض --</option>
                      {patients.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">التشخيص</label>
                    <input
                      type="text"
                      required
                      value={newRecord.diagnosis}
                      onChange={(e) => setNewRecord({ ...newRecord, diagnosis: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      placeholder="وصف الحالة المرضية..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">العلاج</label>
                    <textarea
                      rows={2}
                      value={newRecord.treatment}
                      onChange={(e) => setNewRecord({ ...newRecord, treatment: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      placeholder="الإجراءات الطبية المتخذة..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">الروشتة (الأدوية)</label>
                    <textarea
                      rows={3}
                      required
                      value={newRecord.prescription}
                      onChange={(e) => setNewRecord({ ...newRecord, prescription: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-sans text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                      placeholder="1. دواء أ (مرتين يومياً)&#10;2. دواء ب (قبل الأكل)..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
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
    </div>
  );
}
