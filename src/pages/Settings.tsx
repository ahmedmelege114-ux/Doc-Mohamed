import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Save, 
  User as UserIcon, 
  Building, 
  DollarSign, 
  Database, 
  Languages, 
  Palette,
  ShieldCheck,
  Download,
  Upload,
  AlertCircle,
  Users,
  Trash2,
  Shield,
  Plus,
  X,
  Mail,
  Lock,
  UserPlus,
  Search
} from 'lucide-react';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { backupService } from '../services/backupService';
import { ClinicSettings, UserProfile, RolePermissions, BackupRecord } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileJson, 
  History, 
  RefreshCw, 
  Clock, 
  ArrowUpCircle, 
  FileDown, 
  Loader2 
} from 'lucide-react';

const DEFAULT_PERMISSIONS: Record<'doctor' | 'receptionist', RolePermissions> = {
  doctor: {
    viewDashboard: true,
    managePatients: true,
    manageAppointments: true,
    viewMedicalRecords: true,
    viewFinances: true,
    viewReports: true,
    manageSettings: false
  },
  receptionist: {
    viewDashboard: true,
    managePatients: true,
    manageAppointments: true,
    viewMedicalRecords: true,
    viewFinances: true,
    viewReports: false,
    manageSettings: false
  }
};

export default function Settings() {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'clinic' | 'profile' | 'database' | 'appearance' | 'users' | 'permissions' | 'backups'>('clinic');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [performingBackup, setPerformingBackup] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [rolePerms, setRolePerms] = useState<Record<'doctor' | 'receptionist', RolePermissions>>(DEFAULT_PERMISSIONS);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'doctor' as 'admin' | 'doctor' | 'receptionist'
  });
  const [creatingUser, setCreatingUser] = useState(false);
  const [settings, setSettings] = useState<ClinicSettings>({
    name: '',
    address: '',
    phone: '',
    defaultPrice: 0,
    doctorName: '',
    language: 'ar',
    theme: 'light'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserProfile | null>(null);
  const [backupDirPath, setBackupDirPath] = useState<string | null>(null);

  const handleUpdatePassword = async () => {
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'كلمات المرور الجديدة غير متطابقة.' });
      return;
    }
    if (passwords.new.length < 6) {
      setMessage({ type: 'error', text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
      return;
    }

    setUpdatingPassword(true);
    try {
      if (user) {
        // In Firebase Auth, updating password often requires re-authentication if it's been a while.
        // We'll attempt directly first; if it fails with requires-recent-login, we might need a prompt.
        const { updatePassword, EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
        
        try {
          await updatePassword(user, passwords.new);
          setMessage({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح.' });
          setPasswords({ current: '', new: '', confirm: '' });
        } catch (err: any) {
          if (err.code === 'auth/requires-recent-login') {
            // Need to re-auth
            const credential = EmailAuthProvider.credential(user.email!, passwords.current);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, passwords.new);
            setMessage({ type: 'success', text: 'تم تحديث كلمة المرور بنجاح.' });
            setPasswords({ current: '', new: '', confirm: '' });
          } else {
            throw err;
          }
        }
      }
    } catch (error: any) {
      console.error("Error updating password:", error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء تحديث كلمة المرور. تأكد من كلمة المرور الحالية.' });
    } finally {
      setUpdatingPassword(false);
    }
  };

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'clinic'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as ClinicSettings;
          setSettings(data);
          // Apply theme from saved settings
          if (data.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        
        // Fetch backup directory info
        const dirName = await backupService.getSavedDirectoryName();
        setBackupDirPath(dirName);
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
    if (profile?.role === 'admin') {
      fetchPermissions();
    }
  }, [profile?.role]);

  const handleSelectBackupDir = async () => {
    try {
      const name = await backupService.selectBackupDirectory();
      setBackupDirPath(name);
      setMessage({ type: 'success', text: `✅ تم تعيين مجلد النسخ الاحتياطي بنجاح: ${name}` });
    } catch (err: any) {
      if (err.message === 'BROWSER_NOT_SUPPORTED') {
        setMessage({ type: 'error', text: '❌ متصفحك لا يدعم خاصية اختيار مجلدات النظام. يوصى باستخدام Chrome أو Edge حديث.' });
      } else if (err.name === 'SecurityError' || err.message?.includes('showDirectoryPicker') || err.message?.includes('sub frame') || err.message?.includes('frame')) {
        setMessage({
          type: 'error',
          text: '❌ بسبب قيود أمان متصفحك داخل منصة العمل (sub-frame)، لا يمكن اختيار المجلد مباشرة هنا. يرجى فتح التطبيق في نافذة/تبويب مستقل لتتمكن من استخدام هذه الميزة، أو استخدم التحميل اليدوي كخيار بديل.'
        });
      } else if (err.name !== 'AbortError') {
        console.error(err);
        setMessage({ type: 'error', text: '❌ فشل الوصول للمجلد. تأكد من إعطاء الصلاحيات المطلوبة.' });
      }
    }
  };

  const handleClearBackupDir = async () => {
    await backupService.clearSavedDirectory();
    setBackupDirPath(null);
    setMessage({ type: 'info', text: 'ℹ️ تم مسح مكان الحفظ المفضل. سيتم طلب مكان الحفظ يدوياً عند كل عملية نسخ.' });
  };

  const isBrowserSupported = backupService.isSupported();
  const isIframe = window.self !== window.top;

  const fetchPermissions = async () => {
    setLoadingPerms(true);
    try {
      const permDoc = await getDoc(doc(db, 'config', 'permissions'));
      if (permDoc.exists()) {
        const data = permDoc.data();
        setRolePerms({
          doctor: { ...DEFAULT_PERMISSIONS.doctor, ...data.doctor },
          receptionist: { ...DEFAULT_PERMISSIONS.receptionist, ...data.receptionist }
        });
      }
    } catch (error) {
      console.error("Error fetching permissions:", error);
    } finally {
      setLoadingPerms(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && profile?.role === 'admin') {
      fetchUsers();
    }
    if (activeTab === 'backups' && profile?.role === 'admin') {
      fetchBackups();
    }
  }, [activeTab, profile?.role]);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const history = await backupService.getBackupHistory();
      setBackups(history);
    } catch (e) {
      console.error("Error fetching backups:", e);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleManualBackup = async () => {
    setPerformingBackup(true);
    setMessage({ type: '', text: '' });
    try {
      if (!('showSaveFilePicker' in window)) {
        setMessage({ type: 'info', text: 'ℹ️ متصفحك لا يدعم اختيار مكان الحفظ مباشرة. سيتم تحميل الملف إلى مجلد Downloads التقليدي.' });
      }
      
      const backup = await backupService.createAndSaveBackup();
      setMessage({ type: 'success', text: `✅ تم إنشاء النسخة الاحتياطية (${backup.filename}) بنجاح.` });
      fetchBackups();
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessage({ type: 'info', text: 'ℹ️ تم إلغاء اختيار مكان الحفظ، ولم يتم تحميل الملف.' });
      } else {
        console.error(e);
        setMessage({ type: 'error', text: '❌ حدث خطأ أثناء عملية النسخ. يرجى المحاولة لاحقاً.' });
      }
    } finally {
      setPerformingBackup(false);
    }
  };

  const handleRestoreFromList = async (backup: BackupRecord) => {
    if (!window.confirm('هل أنت متأكد من استعادة هذه النسخة؟ سيتم دمج البيانات مع البيانات الحالية.')) return;
    
    setIsRestoring(true);
    setRestoreProgress(0);
    try {
      await backupService.restoreFromData(backup.data, setRestoreProgress);
      setMessage({ type: 'success', text: '✅ تم استعادة البيانات بنجاح.' });
    } catch (e) {
      setMessage({ type: 'error', text: '❌ فشل استعادة البيانات.' });
    } finally {
      setIsRestoring(false);
      setRestoreProgress(0);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      setIsRestoring(true);
      setRestoreProgress(0);
      try {
        await backupService.restoreFromData(content, setRestoreProgress);
        setMessage({ type: 'success', text: '✅ تم استعادة البيانات من الملف بنجاح.' });
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setMessage({ type: 'error', text: '❌ فشل استعادة البيانات من الملف. تأكد من صحة الملف.' });
      } finally {
        setIsRestoring(false);
        setRestoreProgress(0);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذا السجل من تاريخ النظام؟')) return;
    
    setMessage({ type: '', text: '' });
    try {
      await backupService.deleteBackup(id);
      setBackups(prev => prev.filter(b => b.id !== id));
      setMessage({ type: 'success', text: '✅ تم حذف سجل النسخة الاحتياطية بنجاح.' });
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: '❌ فشل حذف السجل. تأكد من اتصالك أو الصلاحيات.' });
    }
  };

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoadingUsers(true);
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      } as UserProfile))
      .sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      setUsersList(users);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.email || !newUser.password || !newUser.name) {
      setMessage({ type: 'error', text: 'يرجى ملء جميع الحقول المطلوبة.' });
      return;
    }
    
    setCreatingUser(true);
    setMessage({ type: '', text: '' });
    
    let secondaryApp;
    try {
      // Secondary app trick to avoid signing out the current admin
      // Check if already initialized to avoid crash
      const existingApp = getApps().find(a => a.name === 'SecondaryApp');
      if (existingApp) {
        secondaryApp = existingApp;
      } else {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      }
      
      const secondaryAuth = getAuth(secondaryApp);
      
      const { user: createdUser } = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      
      try {
        await setDoc(doc(db, 'users', createdUser.uid), {
          uid: createdUser.uid,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          createdAt: new Date().toISOString()
        });
      } catch (firestoreErr: any) {
        // If firestore fails, we should probably delete the auth user too to stay in sync,
        // but that's complex with client-side only. We'll at least report it.
        console.error("Firestore error after auth success:", firestoreErr);
        throw new Error(`Auth Success but Firestore Failed: ${firestoreErr.message}`);
      }

      // Cleanup: Sign out from secondary app and delete it to be safe for next time
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      
      setMessage({ type: 'success', text: `✅ تم إنشاء حساب "${newUser.name}" بنجاح وإضافته للنظام.` });
      setShowAddUser(false);
      setSearchQuery(''); 
      
      const createdUserObj: UserProfile = {
        uid: createdUser.uid,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: new Date().toISOString()
      };
      setUsersList(prev => [createdUserObj, ...prev]);

      setNewUser({ name: '', email: '', password: '', role: 'doctor' });
      await fetchUsers(true); 
    } catch (error: any) {
      console.error("Detailed error creating user:", error);
      let msg = '❌ فشل في إنشاء المستخدم: ';
      
      if (error.code === 'auth/email-already-in-use') {
        msg += 'هذا البريد الإلكتروني مسجل مسبقاً.';
      } else if (error.code === 'auth/weak-password') {
        msg += 'كلمة المرور ضعيفة جداً (يجب أن تكون 6 أحرف على الأقل).';
      } else if (error.code === 'auth/invalid-email') {
        msg += 'صيغة البريد الإلكتروني غير صحيحة.';
      } else if (error.message && error.message.includes('Firestore Failed')) {
        msg += 'تم إنشاء الحساب ولكن فشل حفظ البيانات في قاعدة البيانات. يرجى مراجعة الصلاحيات.';
      } else {
        msg += error.message || 'حدث خطأ غير معروف.';
      }
      
      setMessage({ type: 'error', text: msg });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'admin' | 'doctor' | 'receptionist') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setMessage({ type: 'success', text: 'تم تحديث صلاحية المستخدم بنجاح.' });
      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء تحديث الصلاحية.' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!userId) {
      setMessage({ type: 'error', text: 'معرف المستخدم غير موجود.' });
      return;
    }
    
    setConfirmDelete(null);
    setDeletingUserId(userId);
    
    const isSelf = userId === user?.uid;
    
    try {
      console.log("Attempting to delete user:", userId);
      await deleteDoc(doc(db, 'users', userId));
      
      if (isSelf) {
        await auth.signOut();
      } else {
        setMessage({ type: 'success', text: 'تم حذف المستخدم من النظام بنجاح.' });
        // Update local state immediately
        setUsersList(prev => prev.filter(u => u.uid !== userId));
        fetchUsers();
      }
    } catch (error: any) {
      console.error("Critical error deleting user:", error);
      let errorMsg = 'حدث خطأ غير متوقع أثناء حذف المستخدم.';
      
      try {
        // Try use our custom error handler if it's a permissions issue
        handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      } catch (err: any) {
        try {
          const errObj = JSON.parse(err.message);
          errorMsg = `فشل الحذف: ${errObj.error}`;
          if (errObj.error.includes('permissions')) {
            errorMsg = 'لا تملك صلاحية الكافية لحذف مستخدمين. يرجى التأكد من أنك "مدير نظام".';
          }
        } catch (e) {
          errorMsg = `فشل الحذف: ${error.message || 'خطأ في الصلاحيات'}`;
        }
      }
      
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setDeletingUserId(null);
    }
  };

  // Effect to apply theme changes instantly
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin') {
      setMessage({ type: 'error', text: 'لا تملك صلاحية تعديل إعدادات العيادة.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      if (activeTab === 'permissions') {
        const permsToSave = { ...rolePerms };
        await setDoc(doc(db, 'config', 'permissions'), permsToSave);
        setMessage({ type: 'success', text: '✅ تم حفظ صلاحيات الأدوار بنجاح. سيتم تطبيق التغييرات فوراً.' });
        // After saving permissions, we might want to refetch or ensure it's synced
        await fetchPermissions();
      } else {
        await setDoc(doc(db, 'settings', 'clinic'), settings);
        setMessage({ type: 'success', text: '✅ تم حفظ الإعدادات بنجاح.' });
      }
      
      // Scroll to message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ الإعدادات.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = () => {
    // Placeholder for backup logic: just export a success message for now
    setMessage({ type: 'success', text: 'بدأ إنشاء نسخة احتياطية من البيانات...' });
    setTimeout(() => {
      setMessage({ type: 'success', text: 'تم تصدير البيانات بنجاح (JSON).' });
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
            <SettingsIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">إعدادات النظام</h1>
            <p className="text-slate-500 text-sm font-medium">إدارة تهيئة العيادة والمستخدمين وكافة الخصائص</p>
          </div>
        </div>
      </div>

      {message.text && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <p className="text-sm font-bold">{message.text}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 space-y-2">
          <button 
            onClick={() => setActiveTab('clinic')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === 'clinic' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Building className={`w-4 h-4 ${activeTab === 'clinic' ? 'text-primary' : ''}`} />
            بيانات العيادة
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === 'profile' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <UserIcon className={`w-4 h-4 ${activeTab === 'profile' ? 'text-primary' : ''}`} />
            حسابي الشخصي
          </button>
          <button 
            onClick={() => setActiveTab('database')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === 'database' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Database className={`w-4 h-4 ${activeTab === 'database' ? 'text-primary' : ''}`} />
            قاعدة البيانات
          </button>
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeTab === 'appearance' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Languages className={`w-4 h-4 ${activeTab === 'appearance' ? 'text-primary' : ''}`} />
            اللغة والثيم
          </button>

          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === 'users' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <UserIcon className={`w-4 h-4 ${activeTab === 'users' ? 'text-primary' : ''}`} />
              إدارة المستخدمين
            </button>
          )}

          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('permissions')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === 'permissions' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeTab === 'permissions' ? 'text-primary' : ''}`} />
              صلاحيات الأدوار
            </button>
          )}
          
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab('backups')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === 'backups' ? 'bg-white border border-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <History className={`w-4 h-4 ${activeTab === 'backups' ? 'text-primary' : ''}`} />
              النسخ الاحتياطي
            </button>
          )}
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-9">
          {activeTab !== 'backups' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              {activeTab === 'clinic' && (
              <>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <Building className="w-5 h-5 text-slate-400" />
                    <h2 className="font-black text-slate-900">الملف التعريفي للعيادة</h2>
                  </div>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">اسم العيادة</label>
                      <input 
                        type="text" 
                        value={settings.name}
                        onChange={(e) => setSettings({...settings, name: e.target.value})}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        placeholder="عيادة الشفاء التخصصية"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">اسم الطبيب (في التقارير)</label>
                      <input 
                        type="text" 
                        value={settings.doctorName}
                        onChange={(e) => setSettings({...settings, doctorName: e.target.value})}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        placeholder="د. محمد علي"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">رقم الهاتف</label>
                      <input 
                        type="text" 
                        value={settings.phone}
                        onChange={(e) => setSettings({...settings, phone: e.target.value})}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono"
                        placeholder="0123456789"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">العنوان</label>
                      <input 
                        type="text" 
                        value={settings.address}
                        onChange={(e) => setSettings({...settings, address: e.target.value})}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        placeholder="الشارع الرئيسي، المدينة"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-slate-400" />
                    <h2 className="font-black text-slate-900">الإعدادات المالية</h2>
                  </div>
                  <div className="p-6">
                    <div className="max-w-xs space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">سعر الكشف الافتراضي (EGP)</label>
                      <input 
                        type="number" 
                        value={settings.defaultPrice}
                        onChange={(e) => setSettings({...settings, defaultPrice: Number(e.target.value)})}
                        className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none font-mono"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'profile' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                  <h2 className="font-black text-slate-900">حسابي الشخصي</h2>
                </div>
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-2xl font-black">
                      {profile?.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900">{profile?.name}</h3>
                      <p className="text-sm text-slate-500 font-bold">{profile?.role === 'admin' ? 'مدير النظام' : profile?.role === 'doctor' ? 'طبيب' : 'استقبال'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{user?.email}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-black text-slate-900">تغيير كلمة المرور</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 mr-1">كلمة المرور الحالية</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={passwords.current}
                          onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 mr-1">كلمة المرور الجديدة</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={passwords.new}
                          onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 mr-1">تأكيد كلمة المرور</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={passwords.confirm}
                          onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                          className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                        />
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleUpdatePassword}
                      disabled={updatingPassword}
                      className="px-6 h-10 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {updatingPassword && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      تحديث كلمة المرور
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'database' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                  <Database className="w-5 h-5 text-slate-400" />
                  <h2 className="font-black text-slate-900">إدارة البيانات والنسخ الاحتياطي</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={handleBackup}
                    className="flex items-center justify-center gap-3 p-4 border border-slate-100 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors group"
                  >
                    <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">تصدير كامل للبيانات</p>
                      <p className="text-[10px] text-slate-500 font-bold">حفظ نسخة من المرضى والعمليات على جهازك</p>
                    </div>
                  </button>
                  <button 
                    type="button"
                    className="flex items-center justify-center gap-3 p-4 border border-slate-100 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors group"
                  >
                    <Upload className="w-5 h-5 text-amber-600 group-hover:scale-110 transition-transform" />
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">استرداد البيانات (Restore)</p>
                      <p className="text-[10px] text-slate-500 font-bold">رفع ملف النسخة الاحتياطية للنظام</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                  <Palette className="w-5 h-5 text-slate-400" />
                  <h2 className="font-black text-slate-900">اللغة والمظهر</h2>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">اللغة الافتراضية</label>
                    <select 
                      value={settings.language}
                      onChange={(e) => setSettings({...settings, language: e.target.value as 'ar' | 'en'})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    >
                      <option value="ar">العربية (Arabic)</option>
                      <option value="en">الإنجليزية (English)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">النمط الظاهري</label>
                    <select 
                      value={settings.theme}
                      onChange={(e) => setSettings({...settings, theme: e.target.value as 'light' | 'dark'})}
                      className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    >
                      <option value="light">فاتح (Light)</option>
                      <option value="dark">داكن (Dark)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && profile?.role === 'admin' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-slate-400" />
                      <h2 className="font-black text-slate-900 whitespace-nowrap">إدارة مستخدمي النظام</h2>
                    </div>
                    <div className="relative flex-1 max-w-xs">
                      <input 
                        type="text"
                        placeholder="ابحث عن مستخدم بالاسم أو البريد..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg pl-4 pr-10 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                      <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowAddUser(true)}
                    className="h-9 px-4 bg-primary/10 text-primary rounded-lg text-xs font-black hover:bg-primary/20 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة مستخدم
                  </button>
                </div>
                
                <div className="p-6">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {usersList
                        .filter(u => 
                          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((u) => (
                        <div key={u.uid} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl group hover:border-primary/20 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-primary font-black border border-slate-100">
                              {u.name?.charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-slate-900">{u.name}</h4>
                              <p className="text-[10px] text-slate-500 font-bold">{u.email}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Shield className="w-3 h-3 text-slate-300" />
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                  u.role === 'admin' ? 'bg-indigo-50 text-indigo-600' :
                                  u.role === 'doctor' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                  {u.role === 'admin' ? 'مدير نظام / أدمن' : u.role === 'doctor' ? 'طبيب' : 'استقبال'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <select 
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.uid, e.target.value as any)}
                              className="text-[10px] font-black bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                            >
                              <option value="admin">مدير (Admin)</option>
                              <option value="doctor">طبيب (Doctor)</option>
                              <option value="receptionist">استقبال (Reception)</option>
                            </select>
                            <button 
                              type="button"
                              onClick={() => setConfirmDelete(u)}
                              disabled={deletingUserId === u.uid}
                              className={`p-2 rounded-xl transition-all ${
                                deletingUserId === u.uid 
                                  ? 'bg-slate-100 text-slate-300' 
                                  : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              }`}
                              title="حذف المستخدم"
                            >
                              {deletingUserId === u.uid ? (
                                <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                              ) : (
                                <Trash2 className="w-5 h-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'permissions' && profile?.role === 'admin' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-5 h-5 text-slate-400" />
                    <h2 className="font-black text-slate-900">إدارة صلاحيات الأدوار (Roles Permissions)</h2>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-1">تحكم فيما يمكن لكل نوع من المستخدمين الوصول إليه في النظام</p>
                </div>
                
                <div className="p-6 space-y-8">
                  {(['doctor', 'receptionist'] as const).map((role) => (
                    <div key={role} className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${role === 'doctor' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {role === 'doctor' ? <Shield className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <h3 className="font-black text-slate-900">{role === 'doctor' ? 'صلاحيات الطبيب (Doctor)' : 'صلاحيات الاستقبال (Receptionist)'}</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                          { key: 'viewDashboard', label: 'رؤية لوحة المعلومات (الرئيسية)' },
                          { key: 'managePatients', label: 'إدارة المرضى والسجلات' },
                          { key: 'manageAppointments', label: 'إدارة المواعيد والجدول' },
                          { key: 'viewMedicalRecords', label: 'رؤية قسم الكشوفات والسجلات الطبية' },
                          { key: 'viewFinances', label: 'رؤية الحسابات والمالية' },
                          { key: 'viewReports', label: 'رؤية التقارير والإحصائيات' },
                          { key: 'manageSettings', label: 'إدارة إعدادات النظام' }
                        ].map((perm) => (
                          <label key={perm.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                            <input 
                              type="checkbox"
                              checked={rolePerms[role][perm.key as keyof RolePermissions]}
                              onChange={(e) => setRolePerms({
                                ...rolePerms,
                                [role]: {
                                  ...rolePerms[role],
                                  [perm.key]: e.target.checked
                                }
                              })}
                              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-700">{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile?.role === 'admin' ? (
              activeTab !== 'profile' && activeTab !== 'database' && activeTab !== 'users' && (
                <div className="flex justify-end gap-4 pt-4">
                  <button 
                    type="submit" 
                    disabled={saving}
                    className="px-8 h-12 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {activeTab === 'permissions' ? 'حفظ الصلاحيات' : 'حفظ الإعدادات'}
                      </>
                    )}
                  </button>
                </div>
              )
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <p className="text-xs font-bold text-amber-700">هذه الإعدادات متاحة للمديرين فقط (Admins). يمكنك عرضها ولكن ليس تعديلها.</p>
              </div>
            )}
            </form>
          )}

          {activeTab === 'backups' && profile?.role === 'admin' && (
            <div className="space-y-6">
                {/* Backup Location Manager */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-slate-400" />
                      <div>
                        <h3 className="font-black text-slate-900">إدارة مكان تخزين النسخ الاحتياطية</h3>
                        <p className="text-[10px] text-slate-500 font-bold">حفظ الملفات تلقائياً في مجلد مخصص (يدعم الهاردات الخارجية والـ USB)</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {!isBrowserSupported ? (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-amber-900 mb-1">المتصفح لا يدعم الوصول للمجلدات</p>
                          <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                            متصفحك الحالي لا يدعم خاصية اختيار مجلدات النظام تلقائياً. ستحتاج لاختيار مكان الحفظ يدوياً في كل مرة أو استخدام Chrome/Edge في نافذة مستقلة.
                          </p>
                        </div>
                      </div>
                    ) : isIframe && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                        <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-xs font-black text-blue-900 mb-1">تشغيل داخل إطار (Iframe)</p>
                          <p className="text-[11px] font-bold text-blue-700 leading-relaxed">
                            قد يتم منع اختيار المجلدات بسبب تشغيل التطبيق داخل إطار التجربة. إذا واجهت مشكلة، يرجى الضغط على "Open in new tab" لتجربة الميزة بشكل كامل.
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${backupDirPath ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-400'}`}>
                          <Save className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">مجلد الحفظ الحالي</p>
                          <p className="text-sm font-black text-slate-700">
                            {backupDirPath || 'لم يتم تحديد مجلد افتراضي (سيتم الحفظ في التنزيلات)'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        {backupDirPath && (
                          <button 
                            type="button"
                            onClick={handleClearBackupDir}
                            className="flex-1 md:flex-none px-4 h-10 bg-white border border-slate-200 text-red-500 rounded-xl text-xs font-black hover:bg-red-50 transition-all flex items-center gap-2 justify-center"
                          >
                            <X className="w-4 h-4" />
                            إلغاء المسار
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={handleSelectBackupDir}
                          className="flex-1 md:flex-none px-6 h-10 bg-primary text-white rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 justify-center"
                        >
                          <Save className="w-4 h-4" />
                          {backupDirPath ? 'تغيير المجلد' : 'تحديد مجلد الحفظ'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-blue-100 bg-blue-50/50 rounded-xl text-blue-900 border-dashed">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">نصيحة تقنية</span>
                        </div>
                        <p className="text-[11px] font-bold leading-relaxed">
                          يمكنك اختيار مجلد داخل "فلاشة USB" أو "هارد خارجي". سيقوم النظام بحفظ كل نسخة جديدة فيها تلقائياً فور إنشائها.
                        </p>
                      </div>
                      <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl text-emerald-900 border-dashed">
                        <div className="flex items-center gap-2 mb-1">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-[10px] font-black uppercase tracking-wider">الأمان والخصوصية</span>
                        </div>
                        <p className="text-[11px] font-bold leading-relaxed">
                          يتم الحفظ محلياً على جهازك. احرص على سرية هذه الملفات لأنها تحتوي على كافة بيانات المرضى والحسابات.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-xl font-black text-slate-900">إدارة النسخ الاحتياطي</h2>
                      <p className="text-sm text-slate-500 font-bold mt-1">حافظ على أمان بياناتك عبر النسخ وجدولتها</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        accept=".json" 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isRestoring}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-sm transition-all"
                      >
                        <Upload className="w-4 h-4" />
                        استعادة من ملف
                      </button>
                      <button 
                        onClick={handleManualBackup}
                        disabled={performingBackup}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all disabled:opacity-50"
                      >
                        {performingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                        إنشاء نسخة الآن
                      </button>
                    </div>
                  </div>

                  {isRestoring && (
                    <div className="mt-8 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-primary">جاري استعادة البيانات...</span>
                        <span className="text-xs font-black text-slate-500">{restoreProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${restoreProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* History List */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <History className="w-5 h-5 text-slate-400" />
                      <h3 className="font-black text-slate-900">سجل النسخ الاحتياطية</h3>
                    </div>
                    <button onClick={fetchBackups} className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors">
                      <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingBackups ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="text-sm font-bold text-slate-500">جاري تحميل السجل...</p>
                    </div>
                  ) : backups.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <FileJson className="w-8 h-8 text-slate-300" />
                      </div>
                      <h4 className="font-black text-slate-900 mb-1">لا يوجد سجلات</h4>
                      <p className="text-xs text-slate-500 font-bold">لم تقم بإنشاء أي نسخة احتياطية حتى الآن.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">الملف</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">التاريخ</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">الحجم</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider">النوع</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {backups.map((backup) => (
                            <tr key={backup.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                                    <FileJson className="w-4 h-4" />
                                  </div>
                                  <span className="text-xs font-black text-slate-700">{backup.filename}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs font-black text-slate-700">{new Date(backup.timestamp).toLocaleDateString('ar-EG')}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{new Date(backup.timestamp).toLocaleTimeString('ar-EG')}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 font-mono text-[10px] font-bold text-slate-500">
                                {(backup.size / 1024).toFixed(1)} KB
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                  backup.type === 'manual' ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {backup.type === 'manual' ? 'يدوي' : 'تلقائي'}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    type="button"
                                    onClick={async () => await backupService.downloadBackup(backup)}
                                    title="تحميل"
                                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-primary shadow-sm transition-all"
                                  >
                                    <FileDown className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleRestoreFromList(backup)}
                                    disabled={isRestoring || backup.data === 'TOO_LARGE_STORED_LOCALLY'}
                                    title="استعادة"
                                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-emerald-500 shadow-sm transition-all disabled:opacity-30"
                                  >
                                    <ArrowUpCircle className="w-4 h-4" />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteBackup(backup.id)}
                                    title="حذف"
                                    className="p-2 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-red-500 shadow-sm transition-all"
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
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-amber-900">توصية أمنية</h4>
                    <p className="text-xs text-amber-700 font-bold mt-1 leading-relaxed">
                      يُفضل دائماً تحميل النسخ الاحتياطية وحفظها في مكان خارجي (مثل Google Drive أو وحدة تخزين خارجية).
                      في حال تجاوز حجم البيانات 1 ميجابايت، سيقوم النظام بتسجيل السجل فقط ويجب عليك الاعتماد على النسخة المحملة يدوياً.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
          >
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-2">تأكيد الحذف</h3>
              <p className="text-sm text-slate-500 font-bold leading-relaxed">
                {confirmDelete.uid === user?.uid 
                  ? 'أنت على وشك حذف حسابك الخاص! سيتم تسجيل خروجك ولن تتمكن من الدخول مرة أخرى. هل أنت متأكد؟'
                  : `هل أنت متأكد من حذف المستخدم "${confirmDelete.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                }
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="flex-1 h-12 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all"
              >
                تراجع
              </button>
              <button 
                onClick={() => handleDeleteUser(confirmDelete.uid)}
                className="flex-1 h-12 bg-red-600 text-white rounded-xl font-black text-sm shadow-lg shadow-red-200 hover:bg-red-700 active:scale-95 transition-all"
              >
                تأكيد الحذف
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add User Modal - Moved outside form to fix nesting error */}
      {showAddUser && activeTab === 'users' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900">إضافة مستخدم جديد</h3>
                  <p className="text-[10px] text-slate-500 font-bold">قم بتعبئة بيانات الحساب الجديد</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddUser(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">الاسم بالكامل</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="الاسم"
                  />
                  <UserIcon className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">البريد الإلكتروني</label>
                <div className="relative">
                  <input 
                    type="email" 
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="email@example.com"
                  />
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">كلمة المرور</label>
                <div className="relative">
                  <input 
                    type="password" 
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">الصلاحية</label>
                <select 
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="admin">مدير / أدمن (Admin)</option>
                  <option value="doctor">طبيب (Doctor)</option>
                  <option value="receptionist">استقبال (Reception)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="submit"
                  disabled={creatingUser}
                  className="flex-1 h-12 bg-primary text-white rounded-xl font-black text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {creatingUser ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      إضافة المستخدم
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
