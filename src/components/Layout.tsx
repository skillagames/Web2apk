import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut, Home, PlusCircle, Folder, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import ActiveBuildMonitor from './ActiveBuildMonitor';

interface LayoutProps {
  user: User | null;
}

export function Layout({ user }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { name: 'Home', path: '/', icon: Home },
    { name: 'Add Project', path: '/new', icon: PlusCircle },
    { name: 'Projects', path: '/projects', icon: Folder },
  ];

  return (
    <div className={`min-h-screen bg-slate-50/50 flex flex-col font-sans relative selection:bg-slate-200 selection:text-slate-900 ${user ? 'pb-20 sm:pb-0' : ''}`}>
      {user && <ActiveBuildMonitor user={user} />}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/60 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-40 min-h-[72px]">
        <div className="flex-1">
          {location.pathname !== '/' && user && (
            <button 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors active:scale-95"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
        </div>
        <Link to="/" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 group">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 20 }}
            className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-[12px] bg-gradient-to-b from-slate-800 to-blue-950 shadow-md shadow-slate-900/10 border border-slate-900/50 group-hover:shadow-blue-500/20 transition-all duration-500 overflow-hidden group-hover:-translate-y-0.5 group-hover:border-slate-700"
          >
            <div className="absolute -bottom-3 w-[150%] h-6 bg-blue-500/50 blur-md rounded-full group-hover:bg-blue-400/60 transition-colors duration-500"></div>
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] relative z-10 transform group-hover:scale-[1.05] transition-transform duration-500" fill="none">
              <path d="M3 8L7.5 17L12 10L16.5 17L21 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-sm"/>
              <circle cx="12" cy="5.5" r="1.5" className="fill-blue-400 group-hover:fill-blue-300 transition-colors duration-500 drop-shadow-sm" />
            </svg>
          </motion.div>
          <div className="font-display font-black text-2xl sm:text-3xl tracking-tight flex items-center uppercase">
            <motion.span 
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, type: "spring", stiffness: 350, damping: 25 }}
              className="text-blue-950"
            >
              WEB
            </motion.span>
            <motion.span 
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 20 }}
              className="text-emerald-500"
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
              className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors active:scale-95"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
        </div>
      </header>
      <main className={`flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col ${user ? 'pb-12 md:pb-16' : 'justify-center py-4 sm:py-8'}`}>
        <Outlet />
      </main>

      {user && (
        <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200/80 z-40 sm:hidden">
          <div className="flex justify-around items-center h-16 px-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path || (item.path === '/projects' && location.pathname.startsWith('/project/'));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`relative flex flex-col items-center justify-center w-16 h-full transition-colors ${
                    isActive ? 'text-blue-950' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-300 ${isActive ? '-translate-y-0.5 scale-110' : ''}`} />
                  <span className={`text-[9px] font-bold tracking-tight mt-0.5 transition-all duration-300 ${isActive ? 'opacity-100 translate-y-0.5' : 'opacity-70'}`}>
                    {item.name}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="absolute bottom-0 w-10 h-1 bg-blue-950 rounded-t-full"
                      initial={false}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
