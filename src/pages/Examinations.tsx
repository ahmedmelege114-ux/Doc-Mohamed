import React, { useState, useEffect, useMemo } from 'react';
import { 
  Stethoscope, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  MoreVertical,
  TrendingUp,
  Activity,
  Thermometer,
  Weight,
  CreditCard,
  UserPlus,
  XCircle
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, updateDoc, doc, getDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Examination, Patient } from '../types';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const Examinations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    age: '',
    gender: 'male' as const
  });

  const [newExam, setNewExam] = useState<{
    patientId: string;
    type: string;
    date: string;
    vitals: {
      weight: string;
      height: string;
      bloodPressure: string;
      pulse: string;
      temperature: string;
    };
    complaint: string;
    findings: string;
    diagnosis: string;
    notes: string;
    amount: number;
  }>({
    patientId: '',
    type: 'كشف جديد',
    date: new Date().toISOString().split('T')[0],
    vitals: {
      weight: '',
      height: '',
      bloodPressure: '',
      pulse: '',
      temperature: ''
    },
    complaint: '',
    findings: '',
    diagnosis: '',
    notes: '',
    amount: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const examSnap = await getDocs(query(collection(db, 'examinations'), orderBy('createdAt', 'desc')));
    const patientSnap = await getDocs(collection(db, 'patients'));
    
    setExaminations(examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Examination)));
    setPatients(patientSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
  };

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
    setNewExam({ ...newExam, patientId: patient.id! });
    setPatientSearchTerm(patient.name);
    setIsPatientDropdownOpen(false);
  };

  const handleOpenModal = async (exam?: Examination) => {
    let defaultPrice = 0;
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'clinic'));
      if (settingsDoc.exists()) {
        defaultPrice = settingsDoc.data().defaultPrice || 0;
      }
    } catch (e) { /* ignore */ }

    if (exam) {
      const patient = patients.find(p => p.id === exam.patientId);
      setPatientSearchTerm(patient?.name || '');
      setNewExam({
        patientId: exam.patientId,
        type: exam.type,
        date: exam.date,
        vitals: {
          weight: exam.vitals.weight || '',
          height: exam.vitals.height || '',
          bloodPressure: exam.vitals.bloodPressure || '',
          pulse: exam.vitals.pulse || '',
          temperature: exam.vitals.temperature || ''
        },
        complaint: exam.complaint,
        findings: exam.findings,
        diagnosis: exam.diagnosis || '',
        notes: exam.notes,
        amount: exam.amount || 0
      });
      setEditingId(exam.id!);
    } else {
      setPatientSearchTerm('');
      setNewExam({
        patientId: '',
        type: 'كشف جديد',
        date: new Date().toISOString().split('T')[0],
        vitals: { weight: '', height: '', bloodPressure: '', pulse: '', temperature: '' },
        complaint: '',
        findings: '',
        diagnosis: '',
        notes: '',
        amount: defaultPrice
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const patientData = {
        name: newPatient.name,
        phone: newPatient.phone,
        age: parseInt(newPatient.age),
        gender: newPatient.gender,
        address: '',
        medicalHistory: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.uid
      };

      const docRef = await addDoc(collection(db, 'patients'), patientData);
      
      const createdPatient = { id: docRef.id, ...patientData } as Patient;
      setPatients(prev => [...prev, createdPatient]);
      setNewExam(prev => ({ ...prev, patientId: docRef.id }));
      setIsPatientModalOpen(false);
      setNewPatient({ name: '', phone: '', age: '', gender: 'male' });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patientName = patients.find(p => p.id === newExam.patientId)?.name || 'غير معروف';
    try {
      if (editingId) {
        await updateDoc(doc(db, 'examinations', editingId), {
          ...newExam,
          patientName,
          updatedAt: new Date().toISOString()
        });
        setIsModalOpen(false);
        fetchData();
      } else {
        // Create examination
        await addDoc(collection(db, 'examinations'), {
          ...newExam,
          patientName,
          createdAt: new Date().toISOString(),
          createdBy: user?.uid
        });

        // Auto-create invoice
        if (newExam.amount > 0) {
          await addDoc(collection(db, 'invoices'), {
            patientId: newExam.patientId,
            patientName: patientName,
            amount: newExam.amount,
            date: new Date().toISOString(),
            paymentMethod: 'cash',
            status: 'unpaid',
            createdBy: user?.uid
          });
          setIsModalOpen(false);
          navigate('/invoices');
        } else {
          setIsModalOpen(false);
          fetchData();
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getPatientName = (patientId: string) => {
    return patients.find(p => p.id === patientId)?.name || 'غير معروف';
  };

  const filteredExams = examinations.filter(ex => {
    const patient = patients.find(p => p.id === ex.patientId);
    const pName = (patient?.name || '').toLowerCase();
    const pPhone = (patient?.phone || '').toLowerCase();
    const type = (ex.type || '').toLowerCase();
    const complaint = (ex.complaint || '').toLowerCase();
    const findings = (ex.findings || '').toLowerCase();
    const sTerm = searchTerm.toLowerCase().trim();
    
    return pName.includes(sTerm) || 
           pPhone.includes(sTerm) ||
           type.includes(sTerm) ||
           complaint.includes(sTerm) ||
           findings.includes(sTerm);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">الكشوفات</h2>
          <p className="text-sm text-slate-500 font-medium">سجل الكشوفات والزيارات اليومية للمرضى.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          كشف جديد
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors duration-300" />
            <input
              type="text"
              placeholder="بحث باسم المريض أو نوع الكشف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-12 pr-11 pl-4 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm group-hover:border-slate-300"
            />
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExams.map((exam) => (
          <motion.div
            key={exam.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary-light group-hover:text-primary transition-colors">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">{getPatientName(exam.patientId)}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                    <Calendar className="w-3 h-3" />
                    {formatDate(exam.date)}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleOpenModal(exam)}
                className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 hover:text-primary rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                {exam.type}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {exam.vitals.bloodPressure && (
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <Activity className="w-3 h-3 text-red-400 mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-slate-600 line-clamp-1">{exam.vitals.bloodPressure}</span>
                </div>
              )}
              {exam.vitals.temperature && (
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <Thermometer className="w-3 h-3 text-orange-400 mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-slate-600 line-clamp-1">{exam.vitals.temperature}°C</span>
                </div>
              )}
              {exam.vitals.weight && (
                <div className="bg-slate-50 p-2 rounded-lg text-center">
                  <Weight className="w-3 h-3 text-blue-400 mx-auto mb-1" />
                  <span className="block text-[10px] font-bold text-slate-600 line-clamp-1">{exam.vitals.weight}kg</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold text-slate-400 mt-0.5 whitespace-nowrap">الشكوى:</span>
                <p className="text-xs text-slate-600 line-clamp-2">{exam.complaint}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-slate-900">{editingId ? 'تعديل كشف' : 'كشف جديد'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          // Delay closing to allow clicking options
                          setTimeout(() => setIsPatientDropdownOpen(false), 200);
                        }}
                        onFocus={() => setIsPatientDropdownOpen(true)}
                        onChange={(e) => {
                          setPatientSearchTerm(e.target.value);
                          setIsPatientDropdownOpen(true);
                        }}
                        className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 px-4 font-medium"
                      />
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      
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
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">نوع الكشف</label>
                    <select
                      value={newExam.type}
                      onChange={(e) => setNewExam({...newExam, type: e.target.value})}
                      className="w-full h-11 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 px-4 font-medium"
                    >
                      <option value="كشف جديد">كشف جديد</option>
                      <option value="استشارة">استشارة</option>
                      <option value="متابعة">متابعة</option>
                      <option value="غيار">غيار</option>
                      <option value="عملية">عملية</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">قيمة الكشف / الاستشارة (ج.م)</label>
                    <div className="relative">
                      <CreditCard className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="number"
                        required
                        min="0"
                        value={newExam.amount}
                        onChange={(e) => setNewExam({...newExam, amount: Number(e.target.value)})}
                        className="w-full h-11 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 pr-11 pl-4 font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-2">
                    <TrendingUp className="w-3 h-3" />
                    العلامات الحيوية
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">الوزن (كجم)</label>
                      <input
                        type="text"
                        value={newExam.vitals.weight}
                        onChange={(e) => setNewExam({...newExam, vitals: {...newExam.vitals, weight: e.target.value}})}
                        className="w-full h-10 bg-slate-50 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 px-3"
                        placeholder="70"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">الطول (سم)</label>
                      <input
                        type="text"
                        value={newExam.vitals.height}
                        onChange={(e) => setNewExam({...newExam, vitals: {...newExam.vitals, height: e.target.value}})}
                        className="w-full h-10 bg-slate-50 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 px-3"
                        placeholder="170"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">الضغط</label>
                      <input
                        type="text"
                        value={newExam.vitals.bloodPressure}
                        onChange={(e) => setNewExam({...newExam, vitals: {...newExam.vitals, bloodPressure: e.target.value}})}
                        className="w-full h-10 bg-slate-50 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 px-3"
                        placeholder="120/80"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">النبض</label>
                      <input
                        type="text"
                        value={newExam.vitals.pulse}
                        onChange={(e) => setNewExam({...newExam, vitals: {...newExam.vitals, pulse: e.target.value}})}
                        className="w-full h-10 bg-slate-50 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 px-3"
                        placeholder="72"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 mr-1">الحرارة</label>
                      <input
                        type="text"
                        value={newExam.vitals.temperature}
                        onChange={(e) => setNewExam({...newExam, vitals: {...newExam.vitals, temperature: e.target.value}})}
                        className="w-full h-10 bg-slate-50 border-none rounded-lg text-xs focus:ring-2 focus:ring-primary/20 px-3"
                        placeholder="37"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">الشكوى الرئيسية</label>
                    <textarea
                      required
                      value={newExam.complaint}
                      onChange={(e) => setNewExam({...newExam, complaint: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 p-4 min-h-[80px]"
                      placeholder="وصف شكوى المريض..."
                    ></textarea>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">النتائج والفحص</label>
                    <textarea
                      value={newExam.findings}
                      onChange={(e) => setNewExam({...newExam, findings: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 p-4 min-h-[80px]"
                      placeholder="نتائج الفحص الإكلينيكي..."
                    ></textarea>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">التشخيص الطبي</label>
                    <textarea
                      value={newExam.diagnosis}
                      onChange={(e) => setNewExam({...newExam, diagnosis: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 p-4 min-h-[80px]"
                      placeholder="التشخيص النهائي للحالة..."
                    ></textarea>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">ملاحظات إضافية</label>
                    <textarea
                      value={newExam.notes}
                      onChange={(e) => setNewExam({...newExam, notes: e.target.value})}
                      className="w-full bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary/20 p-4 min-h-[60px]"
                      placeholder="أي ملاحظات أخرى..."
                    ></textarea>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 shrink-0 mt-auto">
                  <button 
                    type="submit"
                    className="flex-1 h-12 bg-primary text-white rounded-xl text-sm font-bold hover:brightness-110 transition-all shadow-md active:scale-95"
                  >
                    حفظ
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 h-12 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
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
    </div>
  );
};

export default Examinations;
