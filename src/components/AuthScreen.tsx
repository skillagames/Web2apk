import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthError } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { Smartphone, Mail, Lock, AlertCircle, RefreshCw } from 'lucide-react';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      const authError = err as AuthError;
      if (authError.code === 'auth/operation-not-allowed') {
        setError("Email/Password Authentication is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.");
      } else {
        setError(authError.message || 'An error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-xs sm:max-w-sm mx-auto w-full px-2 sm:px-0"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-900 mb-4 border border-slate-200/50 shadow-inner">
          <Smartphone size={24} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 tracking-tight">
          {isLogin ? 'Welcome back' : 'Create Account'}
        </h1>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">
          {isLogin 
            ? 'Sign in to access your dashboard' 
            : 'Join us and build custom apps'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-xs sm:text-sm font-medium flex items-start gap-3 border border-red-100 shadow-sm animate-in shake-in duration-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <div className="space-y-1.5">
          <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} />
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white pl-11 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all font-medium text-sm text-slate-700"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={18} />
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white pl-11 pr-4 py-3 sm:py-3.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all font-medium text-sm text-slate-700"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-950 hover:bg-black text-white font-bold py-3 sm:py-3.5 rounded-xl shadow-lg shadow-blue-950/20 hover:shadow-slate-900/30 transition-all flex justify-center items-center mt-6 disabled:opacity-70 active:scale-95 text-sm sm:text-base uppercase tracking-widest"
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Get Started')}
        </button>
      </form>

      <div className="mt-6 py-4 border-t border-slate-100 text-center text-xs sm:text-sm font-medium text-slate-500">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)}
          className="ml-2 text-blue-950 font-bold hover:text-black transition uppercase tracking-wide text-[10px] sm:text-xs"
        >
          {isLogin ? 'Join now' : 'Sign in instead'}
        </button>
      </div>
    </motion.div>
  );
}
