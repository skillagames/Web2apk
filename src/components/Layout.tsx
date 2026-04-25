import { Outlet, Link } from 'react-router';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import ActiveBuildMonitor from './ActiveBuildMonitor';

interface LayoutProps {
  user: User | null;
}

export function Layout({ user }: LayoutProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col font-sans relative selection:bg-indigo-100 selection:text-indigo-900">
      {user && <ActiveBuildMonitor user={user} />}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-40 min-h-[72px]">
        <div className="flex-1"></div>
        <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 group">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
            className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-[10px] bg-gradient-to-b from-slate-800 to-slate-900 shadow-md shadow-slate-900/10 border border-slate-900/50 group-hover:shadow-indigo-500/20 transition-all duration-500 overflow-hidden group-hover:-translate-y-0.5 group-hover:border-slate-700"
          >
            <div className="absolute -bottom-3 w-[150%] h-6 bg-indigo-500/50 blur-md rounded-full group-hover:bg-indigo-400/60 transition-colors duration-500"></div>
            <svg viewBox="0 0 24 24" className="w-[16px] h-[16px] sm:w-[18px] sm:h-[18px] relative z-10 transform group-hover:scale-[1.05] transition-transform duration-500" fill="none">
              <path d="M3 8L7.5 17L12 10L16.5 17L21 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"/>
              <circle cx="12" cy="5.5" r="1.5" className="fill-indigo-400 group-hover:fill-indigo-300 transition-colors duration-500 drop-shadow-sm" />
            </svg>
          </motion.div>
          <div className="font-sans font-medium text-[19px] sm:text-[21px] tracking-[0.05em] flex items-center pt-0.5 pl-0.5 uppercase">
            <motion.span 
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, type: "spring", stiffness: 350, damping: 25 }}
              className="text-blue-950"
            >
              WEB
            </motion.span>
            <motion.span 
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
              className="text-indigo-500"
            >
              2
            </motion.span>
            <motion.span 
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, type: "spring", stiffness: 350, damping: 25 }}
              className="text-blue-950"
            >
              APK
            </motion.span>
          </div>
        </Link>
        <div className="flex-1 flex justify-end">
        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Authenticated as</span>
              <span className="text-xs font-semibold text-slate-600">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-2 pb-12 md:pt-4 md:pb-16 w-full flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
