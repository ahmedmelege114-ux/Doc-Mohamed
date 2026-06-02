import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { 
  LogIn, 
  Stethoscope, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Activity, 
  User, 
  Lock, 
  Clock, 
  Dna,
  Heart,
  Droplet,
  Settings,
  X,
  Thermometer,
  Microscope,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ECGLine = () => (
  <svg className="absolute bottom-0 left-0 w-full h-32 opacity-20 text-cyan-400 pointer-events-none" viewBox="0 0 1000 100" preserveAspectRatio="none">
    <motion.path
      d="M0,50 L100,50 L110,30 L120,70 L130,50 L250,50 L260,10 L270,90 L280,50 L400,50 L410,35 L420,65 L430,50 L550,50 L560,40 L570,60 L580,50 L750,50 L760,20 L770,80 L780,50 L900,50 L910,45 L920,55 L930,50 L1000,50"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ 
        pathLength: [0, 1],
        opacity: [0, 0.5, 0],
        x: [0, 1000]
      }}
      transition={{ 
        duration: 4, 
        repeat: Infinity, 
        ease: "linear"
      }}
    />
  </svg>
);

const ParticleField = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
          initial={{ 
            x: Math.random() * 100 + "%", 
            y: Math.random() * 100 + "%",
            scale: Math.random() * 0.5 + 0.5,
            opacity: 0
          }}
          animate={{ 
            y: [null, "-10%"],
            opacity: [0, 1, 0]
          }}
          transition={{ 
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 5
          }}
        />
      ))}
    </div>
  );
};

const DNAHelix = () => (
  <div className="flex flex-col gap-1 items-center opacity-20">
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        className="flex gap-4"
        animate={{ rotateY: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
      >
        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        <div className="w-4 h-[1px] bg-white/20 my-auto" />
        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
      </motion.div>
    ))}
  </div>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (email === 'admin') {
        const systemAdminEmail = 'admin.v2@system.local';
        try {
          await signInWithEmailAndPassword(auth, systemAdminEmail, password);
          setTimeout(() => navigate('/'), 500);
          return;
        } catch (err: any) {
          if (password === '123456') {
            try {
              const { user: newUser } = await createUserWithEmailAndPassword(auth, systemAdminEmail, '123456');
              await setDoc(doc(db, 'users', newUser.uid), {
                uid: newUser.uid,
                name: 'مدير النظام',
                email: systemAdminEmail,
                role: 'admin',
                createdAt: new Date().toISOString()
              });
              setTimeout(() => navigate('/'), 500);
              return;
            } catch (createErr: any) {
              if (createErr.code === 'auth/email-already-in-use') {
                throw err;
              }
              throw createErr;
            }
          }
          throw err;
        }
      }

      await signInWithEmailAndPassword(auth, email, password);
      setTimeout(() => navigate('/'), 500);
    } catch (err: any) {
      console.error(err);
      let message = 'بيانات الدخول غير صحيحة. يرجى التأكد من البريد وكلمة المرور.';
      if (err.code === 'auth/invalid-email') message = 'البريد الإلكتروني المدخل غير صالح.';
      setError(message);
      setSuccess('');
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('يرجى إدخال البريد الإلكتروني أولاً لإعادة تعيين كلمة المرور.');
      setSuccess('');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const targetEmail = email === 'admin' ? 'admin.v2@system.local' : email;
      await sendPasswordResetEmail(auth, targetEmail);
      setSuccess(`تم تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني بنجاح.`);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError('هذا البريد الإلكتروني غير مسجل في النظام.');
      } else if (err.code === 'auth/invalid-email') {
        setError('البريد الإلكتروني المدخل غير صالح.');
      } else {
        setError('فشل إرسال بريد إعادة التعيين. يرجى التأكد من صحة البيانات أو المحاولة لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-cyan-500/30" dir="rtl">
      
      {/* Background Cinematic Elements */}
      <div className="absolute inset-0">
        {/* Animated Gradient Grids */}
        <div className="absolute inset-0 opacity-20" style={{ 
          backgroundImage: `linear-gradient(rgba(34, 211, 238, 0.1) 1px, transparent 1px), 
                            linear-gradient(90deg, rgba(34, 211, 238, 0.1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px' 
        }} />
        
        {/* Glowing Orbs */}
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        <ECGLine />
        <ParticleField />
        
        {/* Floating Icons */}
        <div className="absolute inset-0 pointer-events-none">
          <motion.div animate={{ y: [0, -20, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 6, repeat: Infinity }} className="absolute top-[15%] left-[10%]"><Stethoscope className="w-12 h-12 text-cyan-400" /></motion.div>
          <motion.div animate={{ y: [0, 20, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 7, repeat: Infinity }} className="absolute top-[20%] right-[12%]"><Activity className="w-16 h-16 text-blue-400" /></motion.div>
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 8, repeat: Infinity }} className="absolute bottom-[15%] left-[15%]"><Heart className="w-14 h-14 text-emerald-400" /></motion.div>
          <motion.div animate={{ x: [0, 15, 0], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 5, repeat: Infinity }} className="absolute bottom-[20%] right-[15%]"><Dna className="w-10 h-10 text-cyan-300" /></motion.div>
        </div>
      </div>

      {/* Top HUD Display */}
      <div className="absolute top-8 left-8 right-8 flex justify-between items-start z-50 pointer-events-none">
        <div className="flex flex-col">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">System Secure & Online</span>
          </motion.div>
        </div>
        
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 shadow-lg text-right">
          <div className="flex items-center gap-3 text-cyan-400">
            <p className="text-xl font-bold font-mono tracking-wider">{time.toLocaleTimeString('ar-EG', { hour12: true })}</p>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">{time.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-xl relative z-10"
      >
        <div className="relative group">
          {/* Glowing Border Background */}
          <div className="absolute -inset-1 bg-gradient-to-tr from-blue-600 via-cyan-400 to-emerald-500 rounded-[3rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          
          <div className="relative bg-black/60 backdrop-blur-[40px] border border-white/10 rounded-[3rem] p-10 md:p-16 shadow-2xl overflow-hidden">
            
            {/* Header Content */}
            <div className="relative z-10 flex flex-col items-center text-center mb-12">
              <motion.div 
                animate={{ 
                  boxShadow: ["0 0 20px rgba(34,211,238,0.2)", "0 0 40px rgba(34,211,238,0.4)", "0 0 20px rgba(34,211,238,0.2)"]
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-24 h-24 bg-gradient-to-tr from-blue-600 to-cyan-400 rounded-3xl flex items-center justify-center mb-8 relative"
              >
                <div className="absolute inset-2 border-2 border-white/20 rounded-2xl" />
                <div className="absolute -top-2 -right-2 bg-emerald-500 w-6 h-6 rounded-full flex items-center justify-center border-4 border-[#020617] shadow-lg">
                  <Zap className="w-3 h-3 text-white" />
                </div>
                <Stethoscope className="text-white w-12 h-12" />
              </motion.div>

              <h1 className="text-4xl font-black text-white mb-3 tracking-tight font-tajawal drop-shadow-sm uppercase">
                عيادة الدكتور - محمد حمدي شاهين
              </h1>
              <p className="text-cyan-400 text-sm font-bold tracking-widest uppercase opacity-80 flex items-center gap-3">
                <span className="w-6 h-[1px] bg-cyan-400/30" />
                المرجع الطبي للجراحة والأوعية الدموية
                <span className="w-6 h-[1px] bg-cyan-400/30" />
              </p>
              
              <div className="mt-4 flex gap-6">
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                   <div className="w-1 h-1 rounded-full bg-cyan-400" />
                   جراحة الأوعية
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                   <div className="w-1 h-1 rounded-full bg-emerald-400" />
                   القدم السكري
                 </div>
                 <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                   <div className="w-1 h-1 rounded-full bg-blue-400" />
                   الجراحة العامة
                 </div>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-6 relative z-10">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="group/input">
                <div className="relative">
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within/input:text-cyan-400">
                     <User className="w-5 h-5" />
                   </div>
                   <input
                     type="text"
                     required
                     value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-12 text-white font-bold placeholder:text-slate-600 focus:bg-white/10 focus:border-cyan-400/50 transition-all outline-none text-right"
                     placeholder="اسم المستخدم أو البريد"
                   />
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="group/input">
                <div className="relative">
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors group-focus-within/input:text-cyan-400">
                     <Lock className="w-5 h-5" />
                   </div>
                   <input
                     type={showPassword ? "text" : "password"}
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     className="w-full h-16 bg-white/5 border border-white/10 rounded-2xl px-12 text-white font-bold placeholder:text-slate-600 focus:bg-white/10 focus:border-cyan-400/50 transition-all outline-none text-right"
                     placeholder="كلمة المرور"
                   />
                   <button 
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                   >
                     {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </button>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer group/check">
                   <div className="relative">
                     <input 
                       type="checkbox" 
                       checked={rememberMe}
                       onChange={(e) => setRememberMe(e.target.checked)}
                       className="peer sr-only" 
                     />
                     <div className="w-5 h-5 rounded-md border-2 border-slate-700 bg-transparent transition-all peer-checked:bg-cyan-500 peer-checked:border-cyan-500" />
                     <ShieldCheck className="absolute inset-0 w-3.5 h-3.5 m-auto text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                   </div>
                   <span className="text-xs font-bold text-slate-400 group-hover/check:text-slate-200 transition-colors">تذكر دخولي</span>
                </label>
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  نسيت كلمة المرور؟
                </button>
              </motion.div>

              <AnimatePresence>
                {(error || success) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className={`p-4 border rounded-2xl flex items-center gap-3 ${
                      error ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      error ? 'bg-red-500/20' : 'bg-emerald-500/20'
                    }`}>
                      {error ? <X className="w-4 h-4 text-red-500" /> : <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                    </div>
                    <p className={`text-[11px] font-bold ${error ? 'text-red-200' : 'text-emerald-200'}`}>
                      {error || success}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full h-16 bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40 border border-white/20 transition-all flex items-center justify-center gap-4 disabled:opacity-50 mt-4 relative overflow-hidden group/btn"
              >
                {loading ? (
                  <div className="flex items-center gap-4">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full"
                    />
                    <span className="font-tajawal text-lg">جري التحقق...</span>
                  </div>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500 skew-x-12" />
                    <span className="relative z-10 text-lg font-tajawal">تسجيل الدخول</span>
                    <LogIn className="w-6 h-6 relative z-10" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Bottom Reflections */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          </div>
        </div>

        {/* System DNA Helix Sidebar Decoration */}
        <div className="absolute -right-12 top-1/2 -translate-y-1/2 hidden xl:block">
           <DNAHelix />
        </div>
        
        {/* Footer Info */}
        <div className="mt-12 flex flex-col items-center gap-6 text-center">
          <div className="flex items-center gap-8 text-slate-500 opacity-60">
             <div className="flex flex-col items-center gap-1 group cursor-default">
               <Thermometer className="w-5 h-5 group-hover:text-cyan-400 transition-colors" />
               <span className="text-[9px] font-bold uppercase tracking-wider">Precision</span>
             </div>
             <div className="flex flex-col items-center gap-1 group cursor-default">
               <Microscope className="w-5 h-5 group-hover:text-emerald-400 transition-colors" />
               <span className="text-[9px] font-bold uppercase tracking-wider">Analysis</span>
             </div>
             <div className="flex flex-col items-center gap-1 group cursor-default">
               <ShieldCheck className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
               <span className="text-[9px] font-bold uppercase tracking-wider">Security</span>
             </div>
          </div>
          
          <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full backdrop-blur-sm">
            <p className="text-[10px] font-bold text-slate-400 tracking-[0.1em]">
               VASCULAR HUB v4.0.0 — <span className="text-cyan-500">MEDICAL INTELLIGENCE UNIT</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
