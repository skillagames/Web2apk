import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Rocket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';

interface ProjectFormProps {
  user: User;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'INTERNET', label: 'Internet', default: true },
  { id: 'CAMERA', label: 'Camera', default: false },
  { id: 'RECORD_AUDIO', label: 'Microphone', default: false },
  { id: 'ACCESS_FINE_LOCATION', label: 'Location', default: false },
  { id: 'POST_NOTIFICATIONS', label: 'Notifications', default: false },
];

export default function ProjectForm({ user }: ProjectFormProps) {
  const navigate = useNavigate();
  const [appName, setAppName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [permissions, setPermissions] = useState<string[]>(['INTERNET']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePermission = (id: string) => {
    if (id === 'INTERNET') return; // Internet is always required for web wrappers
    setPermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!appName || !repoUrl) {
      setError('App Name and Repo URL are required.');
      return;
    }

    if (!repoUrl.startsWith('https://github.com/')) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }

    setLoading(true);
    
    try {
      const newDocRef = doc(collection(db, 'projects'));
      const now = new Date().toISOString();
      
      const payload = {
        userId: user.uid,
        appName,
        repoUrl,
        status: 'building', // simulated build right away
        permissions,
        createdAt: now,
        updatedAt: now
      };
      
      await setDoc(newDocRef, payload);
      
      // Navigate back to dashboard where user can see the "Building..." state
      navigate('/');
      
      // Simulate build completion after 5 seconds
      setTimeout(async () => {
        try {
          await setDoc(newDocRef, { status: 'completed', updatedAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.error("Simulation update failed", e);
        }
      }, 5000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-xl mx-auto"
    >
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-4">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Convert Web App to APK</h1>
        <p className="text-sm text-slate-500 mt-1">Configure your app's metadata and Android permissions.</p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">App Name</label>
              <input 
                type="text" 
                value={appName}
                onChange={e => setAppName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                placeholder="My Awesome App"
                maxLength={40}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GitHub Repository URL</label>
              <input 
                type="url" 
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                placeholder="https://github.com/username/repo-name"
              />
              <p className="text-xs text-slate-400 mt-2">Must be a Google AI Studio exported web app or Vite React app.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-800 mb-3">Android Permissions Required</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_PERMISSIONS.map(perm => {
                const isActive = permissions.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() => togglePermission(perm.id)}
                    disabled={perm.id === 'INTERNET'}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${
                      isActive 
                        ? 'border-blue-500 bg-blue-50/50' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    } ${perm.id === 'INTERNET' ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded-full outline outline-1 outline-offset-2 flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-blue-600 outline-blue-600' : 'outline-slate-300'
                    }`}>
                      {isActive && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <div>
                      <div className={`text-sm font-medium ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                        {perm.label}
                      </div>
                      {perm.id === 'INTERNET' && <div className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">Required</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl transition flex justify-center items-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>Building App...</>
              ) : (
                <>
                  <Rocket size={18} />
                  Build APK
                </>
              )}
            </button>
            <div className="text-xs text-center sm:text-left text-slate-500 mt-4 leading-relaxed max-w-sm">
              The generated APK will wrap your web app with the URL bar hidden (fullscreen immersive UI) and handle the configured permissions automatically.
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
