import { Outlet, Link } from 'react-router';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Package, LogOut } from 'lucide-react';

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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-blue-600 rounded-xl p-2 text-white group-hover:bg-blue-700 transition">
            <Package size={20} />
          </div>
          <span className="font-semibold text-lg text-slate-800 tracking-tight">Web2APK</span>
        </Link>
        {user && (
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </header>
      <main className="flex-1 w-full max-w-md mx-auto sm:max-w-2xl px-4 py-6 w-full">
        <Outlet />
      </main>
    </div>
  );
}
