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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 mt-4 sm:mt-12"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 text-blue-600 mb-4">
          <Smartphone size={24} />
        </div>
        <h1 className="text-2xl font-semibold text-slate-800">
          {isLogin ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="text-slate-500 mt-2 text-sm">
          {isLogin 
            ? 'Sign in to manage your APK builds.' 
            : 'Sign up to start transforming web apps to APKs.'}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition flex justify-center items-center mt-6 disabled:opacity-70"
        >
          {loading ? <RefreshCw className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Create Account')}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-slate-500">
        {isLogin ? "Don't have an account?" : "Already have an account?"}
        <button 
          type="button" 
          onClick={() => setIsLogin(!isLogin)}
          className="ml-1 text-blue-600 font-medium hover:underline"
        >
          {isLogin ? 'Sign up' : 'Sign in'}
        </button>
      </div>
    </motion.div>
  );
}
