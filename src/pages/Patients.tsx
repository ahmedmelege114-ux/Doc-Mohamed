import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Phone, 
  MapPin, 
  Calendar,
  ChevronRight,
  Filter,
  UserPlus,
  Image as ImageIcon,
  FileText,
  X,
  Upload,
  Eye,
  Trash2
} from 'lucide-react';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Patient } from '../types';
import { cn, formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export default function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [newPatient, setNewPatient] = useState({
    name: '',
    age: 0,
    phone: '',
    address: '',
    medicalHistory: '',
    attachments: [] as { name: string; url: string; type: string; date: string }[]
  });
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search !== null) {
      setSearchTerm(search);
    }
  }, [searchParams]);

  const fetchPatients = async () => {
    const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    setPatients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient)));
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleOpenModal = (patient?: Patient) => {
    if (patient) {
      setNewPatient({
        name: patient.name,
        age: patient.age,
        phone: patient.phone,
        address: patient.address,
        medicalHistory: patient.medicalHistory || '',
        attachments: patient.attachments || []
      });
      setEditingPatientId(patient.id);
    } else {
      setNewPatient({ name: '', age: 0, phone: '', address: '', medicalHistory: '', attachments: [] });
      setEditingPatientId(null);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPatientId) {
        const patientRef = doc(db, 'patients', editingPatientId);
        await updateDoc(patientRef, {
          ...newPatient,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await addDoc(collection(db, 'patients'), {
          ...newPatient,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: user?.uid
        });
      }
      setIsModalOpen(false);
      setNewPatient({ name: '', age: 0, phone: '', address: '', medicalHistory: '', attachments: [] });
      setEditingPatientId(null);
      fetchPatients();
    } catch (error) {
      console.error(error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments = [...newPatient.attachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Limit file size to ~500KB to stay within Firestore 1MB document limit comfortably
      if (file.size > 512000) {
        alert(`الملف ${file.name} كبير جداً. الحد الأقصى 500 كيلوبايت.`);
        continue;
      }

      const reader = new FileReader();
      const promise = new Promise((resolve) => {
        reader.onload = (event) => {
          resolve({
            name: file.name,
            url: event.target?.result as string,
            type: file.type,
            date: new Date().toISOString()
          });
        };
      });
      reader.readAsDataURL(file);
      const attachment = await promise as any;
      newAttachments.push(attachment);
    }

    setNewPatient({ ...newPatient, attachments: newAttachments });
    setIsUploading(false);
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...newPatient.attachments];
    newAttachments.splice(index, 1);
    setNewPatient({ ...newPatient, attachments: newAttachments });
  };
  const filteredPatients = patients.filter(p => {
    const search = searchTerm.toLowerCase().trim();
    return p.name.toLowerCase().includes(search) || 
           p.phone.includes(search);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">إدارة المرضى</h2>
          <p className="text-sm text-slate-500 font-medium">عرض وإدارة قاعدة بيانات المرضى.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-md active:scale-[0.98]"
        >
          <UserPlus className="w-4 h-4" />
          مريض جديد
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-5 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative group max-w-sm w-full">
            <input
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pr-11 pl-4 bg-slate-50 border border-slate-200 rounded-full text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-medium hover:border-slate-300"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-100">
              <Filter className="w-3.5 h-3.5" />
              تصفية
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/30">
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">الاسم بالكامل</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">العمر</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">رقم الهاتف</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">تاريخ التسجيل</th>
                <th className="px-6 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPatients.map((patient) => (
                <tr key={patient.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 font-bold group-hover:bg-primary-light group-hover:text-primary transition-colors">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{patient.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{patient.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600 text-center">{patient.age} سنة</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-600">
                    <span className="flex items-center gap-2">
                       <Phone className="w-3 h-3 text-primary" />
                       {patient.phone}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[11px] font-medium text-slate-400">{formatDate(patient.createdAt)}</td>
                  <td className="px-6 py-4 text-left whitespace-nowrap">
                    <button 
                      onClick={() => handleOpenModal(patient)}
                      className="px-3 py-1.5 text-[10px] font-bold text-primary bg-primary-light rounded-lg hover:brightness-95 transition-all shadow-sm"
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPatients.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300 grayscale opacity-40">
              <Users className="w-16 h-16 mb-3" />
              <p className="text-sm font-bold">لا يوجد نتائج</p>
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
              className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{editingPatientId ? 'تعديل بيانات المريض' : 'تسجيل مريض جديد'}</h3>
                  <p className="text-xs text-slate-500 font-medium">{editingPatientId ? 'قم بتحديث المعلومات المطلوبة أدناه.' : 'يرجى ملء البيانات بدقة.'}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
                  <Plus className="rotate-45 w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">الاسم بالكامل</label>
                    <input
                      type="text"
                      required
                      value={newPatient.name}
                      onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                      placeholder="اسم المريض"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">العمر</label>
                    <input
                      type="number"
                      required
                      value={newPatient.age || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, age: parseInt(e.target.value) })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      required
                      value={newPatient.phone}
                      onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 mr-1">العنوان</label>
                    <input
                      type="text"
                      value={newPatient.address}
                      onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                      className="w-full h-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 mr-1">التاريخ المرضي</label>
                  <textarea
                    rows={2}
                    value={newPatient.medicalHistory}
                    onChange={(e) => setNewPatient({ ...newPatient, medicalHistory: e.target.value })}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium text-sm"
                  ></textarea>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 mr-1">الأشعة والصور والملفات</label>
                    <label className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer transition-all">
                      <Upload className="w-3 h-3" />
                      رفع ملفات
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,.pdf" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>

                  {newPatient.attachments.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {newPatient.attachments.map((file, idx) => (
                        <div key={idx} className="group relative bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {file.type.startsWith('image/') ? (
                              <div className="w-8 h-8 rounded bg-slate-200 flex-shrink-0 overflow-hidden">
                                <img src={file.url} alt="" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded bg-primary-light text-primary flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-700 truncate">{file.name}</p>
                              <p className="text-[8px] text-slate-400 font-medium">{formatDate(file.date)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <a 
                              href={file.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-primary transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                            <button 
                              type="button"
                              onClick={() => removeAttachment(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-100 rounded-xl py-6 flex flex-col items-center justify-center text-slate-300">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-[10px] font-bold">لا يوجد ملفات مرفوعة</p>
                    </div>
                  )}
                  {isUploading && (
                    <div className="flex items-center justify-center gap-2 py-2">
                       <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                       <span className="text-[10px] font-bold text-slate-400">جاري الرفع...</span>
                    </div>
                  )}
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
    </div>
  );
}
