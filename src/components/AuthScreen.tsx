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
      className="bg-white p-10 sm:p-12 rounded-[40px] shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-slate-200/50 mt-4 sm:mt-12 max-w-lg mx-auto"
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 mb-6 border border-indigo-100/50 shadow-inner">
          <Smartphone size={28} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">
          {isLogin ? 'Welcome back' : 'Create Account'}
        </h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">
          {isLogin 
            ? 'Sign in to access your dashboard' 
            : 'Join us and start building custom apps'}
        </p>
      </div>

      {error && (
        <div className="mb-8 p-5 bg-red-50 text-red-700 rounded-2xl text-sm font-medium flex items-start gap-4 border border-red-100 shadow-sm animate-in shake-in duration-300">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
          <div className="relative group">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-medium text-slate-700"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all font-medium text-slate-700"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all flex justify-center items-center mt-8 disabled:opacity-70 active:scale-95 text-base"
        >
          {loading ? <RefreshCw className="animate-spin" size={22} /> : (isLogin ? 'Sign In' : 'Get Started')}
        </button>
      </form>

      <div className="mt-10 py-6 border-t border-slate-100 text-center text-sm font-medium text-slate-500">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)}
          className="ml-2 text-indigo-600 font-bold hover:text-indigo-700 transition"
        >
          {isLogin ? 'Join now' : 'Sign in instead'}
        </button>
      </div>
    </motion.div>
  );
}
