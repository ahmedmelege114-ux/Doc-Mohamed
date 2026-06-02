import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Calendar, 
  FileText, 
  CreditCard, 
  LogOut, 
  Plus, 
  User as UserIcon,
  Search,
  LayoutDashboard,
  Stethoscope,
  Settings
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { backupService } from '../services/backupService';

const sidebarItems = [
  { name: 'لوحة التحكم', path: '/', icon: LayoutDashboard, permission: 'viewDashboard' as const },
  { name: 'المرضى', path: '/patients', icon: Users, permission: 'managePatients' as const },
  { name: 'المواعيد', path: '/appointments', icon: Calendar, permission: 'manageAppointments' as const },
  { name: 'الكشوفات', path: '/examinations', icon: Stethoscope, permission: 'viewMedicalRecords' as const },
  { name: 'الفواتير والمدفوعات', path: '/invoices', icon: CreditCard, permission: 'viewFinances' as const },
  { name: 'التقارير', path: '/reports', icon: BarChart3, permission: 'viewReports' as const },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { profile, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [clinicName, setClinicName] = React.useState('عيادة دكتور محمد حمدي شاهين');

  const filteredItems = sidebarItems.filter(item => hasPermission(item.permission));
  const canManageSettings = hasPermission('manageSettings');

  React.useEffect(() => {
    async function fetchClinicName() {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'clinic'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          if (settings.name) setClinicName(settings.name);
        }
      } catch (e) { /* ignore */ }
    }
    fetchClinicName();
  }, []);

  React.useEffect(() => {
    if (profile?.role === 'admin') {
      return backupService.startAutoBackupScheduler();
    }
  }, [profile?.role]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const [globalSearch, setGlobalSearch] = React.useState('');

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchVal = params.get('search') || '';
    if (location.pathname === '/patients') {
      setGlobalSearch(searchVal);
    } else if (globalSearch && location.pathname !== '/patients') {
      setGlobalSearch('');
    }
  }, [location.pathname, location.search]);

  const handleSearchChange = (val: string) => {
    setGlobalSearch(val);
    navigate(`/patients?search=${encodeURIComponent(val)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/patients?search=${encodeURIComponent(globalSearch)}`);
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'المدير';
      case 'doctor': return 'طبيب';
      case 'receptionist': return 'موظف استقبال';
      default: return 'مستخدم';
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-right" dir="rtl">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 right-0 z-50 w-64 bg-white border-l border-gray-200">
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-6 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Plus className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">{clinicName}</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Smart Clinic</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-6 space-y-1">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-gray-400")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Settings link conditional */}
            {canManageSettings && (
              <Link
                to="/settings"
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm mt-4",
                  location.pathname === '/settings'
                    ? "bg-primary/10 text-primary" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Settings className={cn("w-4 h-4", location.pathname === '/settings' ? "text-primary" : "text-gray-400")} />
                <span>الإعدادات</span>
              </Link>
            )}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-sm">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 overflow-hidden text-right">
                  <p className="text-xs font-bold text-gray-900 truncate">{profile?.name || 'مستخدم'}</p>
                  <p className="text-[10px] text-gray-400">{getRoleLabel(profile?.role)}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pr-64 bg-gray-50">
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-8 h-[70px] flex items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="flex-1 max-w-sm">
            <div className="relative group">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="بحث عن مريض بالاسم أو الهاتف..."
                className="w-full h-10 pr-10 pl-4 bg-gray-100 border-none rounded-full text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary transition-colors" />
            </div>
          </form>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/appointments?action=new')}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-xs font-bold hover:brightness-110 transition-all shadow-lg active:scale-95"
            >
              <Plus className="w-4 h-4" />
              موعد جديد
            </button>
          </div>
        </header>
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
