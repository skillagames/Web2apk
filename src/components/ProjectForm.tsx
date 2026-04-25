import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Rocket, AlertCircle, CheckCircle2, Loader2, Sparkles, Layout, Smartphone, X } from 'lucide-react';
import { Link } from 'react-router';
import SplashScreenDialog from './SplashScreenDialog';
import SplashPreview from './SplashPreview';

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
  const [packageName, setPackageName] = useState('com.web2apk.app');
  const [versionName, setVersionName] = useState('1.0.0');
  const [versionCode, setVersionCode] = useState('1');
  const [orientation, setOrientation] = useState<'default' | 'portrait' | 'landscape'>('default');
  const [fullscreen, setFullscreen] = useState(false);
  const [allowCleartext, setAllowCleartext] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [appIconBase64, setAppIconBase64] = useState<string>('');
  const [appIconName, setAppIconName] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>(['INTERNET']);
  const [doubleTapToExit, setDoubleTapToExit] = useState(true);
  const [googleServicesJsonBase64, setGoogleServicesJsonBase64] = useState<string>('');
  const [googleServicesJsonName, setGoogleServicesJsonName] = useState<string>('');
  const [askNotificationsOnLaunch, setAskNotificationsOnLaunch] = useState(false);
  
  const [enableCustomSplash, setEnableCustomSplash] = useState(false);
  const [showSplashDesigner, setShowSplashDesigner] = useState(false);
  const [splashConfig, setSplashConfig] = useState({
    backgroundColor: '#FFFFFF',
    iconSize: 50,
    animation: 'fade' as const
  });

  const [isVerifyingRepo, setIsVerifyingRepo] = useState(false);
  const [repoStatus, setRepoStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  React.useEffect(() => {
    if (!repoUrl || !repoUrl.startsWith('https://github.com/')) {
      setRepoStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setIsVerifyingRepo(true);
      try {
        const res = await fetch('/api/verify-repo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repoUrl })
        });
        const data = await res.json();
        setRepoStatus(data.valid ? 'valid' : 'invalid');
      } catch (e) {
        setRepoStatus('invalid');
      } finally {
        setIsVerifyingRepo(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [repoUrl]);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAppIconName(file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
         if (event.target?.result && typeof event.target.result === 'string') {
            setAppIconBase64(event.target.result);
         }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGoogleServicesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setGoogleServicesJsonName(file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
         if (event.target?.result && typeof event.target.result === 'string') {
            setGoogleServicesJsonBase64(event.target.result);
         }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearIcon = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAppIconBase64('');
    setAppIconName('');
  };

  const clearGoogleServices = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setGoogleServicesJsonBase64('');
    setGoogleServicesJsonName('');
  };

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

    if (repoStatus === 'invalid') {
      setError('Please provide a valid, public GitHub repository URL.');
      return;
    }

    setLoading(true);
    
    try {
      const newDocRef = doc(collection(db, 'projects'));
      
      const payload = {
        userId: user.uid,
        appName,
        packageName,
        versionName,
        versionCode,
        orientation,
        fullscreen,
        allowCleartext,
        repoUrl,
        status: 'building',
        permissions,
        doubleTapToExit,
        askNotificationsOnLaunch,
        googleServicesJsonName,
        splashBackgroundColor: enableCustomSplash ? splashConfig.backgroundColor : null,
        splashIconSize: enableCustomSplash ? splashConfig.iconSize : null,
        splashAnimation: enableCustomSplash ? splashConfig.animation : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      try {
        await setDoc(newDocRef, payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `projects/${newDocRef.id}`);
      }
      
      // Call our backend to start Cloud Build
      try {
        const buildRes = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             projectId: newDocRef.id,
             repoUrl,
             appName,
             packageName,
             versionName,
             versionCode,
             orientation,
             fullscreen,
             allowCleartext,
             permissions,
             doubleTapToExit,
             askNotificationsOnLaunch,
             googleServicesJsonBase64,
             appIconBase64,
             splashBackgroundColor: enableCustomSplash ? splashConfig.backgroundColor : null,
             splashIconSize: enableCustomSplash ? splashConfig.iconSize : null,
             splashAnimation: enableCustomSplash ? splashConfig.animation : null
          })
        });

        const buildData = await buildRes.json();
        if (!buildRes.ok) {
           console.warn("Backend build failed, potentially missing GCP creds. Still logging in Firestore...", buildData);
           await setDoc(newDocRef, { 
             status: 'failed', 
             buildStatusDetails: buildData.error || 'Server error',
             updatedAt: serverTimestamp() 
           }, { merge: true });
           setError(`Build integration not fully configured: ${buildData.error || 'Server error'}`);
           setLoading(false);
           return;
        }

        // Save the build ID
        if (buildData.success && buildData.buildId) {
           const bId = buildData.buildId;
           await setDoc(newDocRef, { 
             buildId: bId,
             buildStatusDetails: 'QUEUED',
             updatedAt: serverTimestamp() 
           }, { merge: true });

           // Create record in builds subcollection
           const buildDocRef = doc(collection(db, 'projects', newDocRef.id, 'builds'), bId);
           await setDoc(buildDocRef, {
             id: bId,
             userId: user.uid,
             status: 'building',
             versionName,
             versionCode,
             createdAt: serverTimestamp()
           });
        }

        // Navigate back to dashboard where user can see the "Building..." state
        navigate('/');
      } catch (backendErr: any) {
        console.error(backendErr);
        await setDoc(newDocRef, { 
          status: 'failed', 
          buildStatusDetails: backendErr.message || 'Network error',
          updatedAt: serverTimestamp() 
        }, { merge: true });
        setError(backendErr.message || 'Failed to communicate with backend builder.');
        setLoading(false);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to create project.');
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto w-full"
    >
      <div className="mb-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition mb-8 group bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm hover:shadow active:scale-95">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" strokeWidth={2.5} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-display font-bold text-slate-900 tracking-tight">Configure Build</h1>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">App Metadata & Native Config</p>
      </div>

      <div className="bg-white p-8 sm:p-12 rounded-[48px] shadow-[0_8px_40px_-10px_rgba(0,0,0,0.04)] border border-slate-200/60 transition-all">
        
        {error && (
          <div className="mb-10 p-6 bg-red-50/80 border border-red-100 text-red-800 rounded-3xl text-sm flex items-start gap-4 shadow-sm animate-in shake-in duration-300">
            <AlertCircle size={22} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex flex-col gap-1">
              <span className="font-bold uppercase tracking-widest text-[10px] text-red-600">Error Occurred</span>
              <p className="font-semibold text-sm leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">App Name</label>
                <input 
                  type="text" 
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm"
                  placeholder="App Title"
                  maxLength={40}
                />
              </div>

              <div className="space-y-1.5 md:col-span-1 lg:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Package Name</label>
                <input 
                  type="text" 
                  value={packageName}
                  onChange={e => setPackageName(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all placeholder:text-slate-400 font-mono text-[10px] bg-slate-50/50 focus:bg-white font-bold tracking-tight"
                  placeholder="com.example.app"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Version Name</label>
                <input 
                  type="text" 
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all placeholder:text-slate-400 font-bold bg-slate-50/50 focus:bg-white text-[13px]"
                  placeholder="1.0.0"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Version Code</label>
                <input 
                  type="number" 
                  value={versionCode}
                  onChange={e => setVersionCode(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 outline-none transition-all placeholder:text-slate-400 font-bold bg-slate-50/50 focus:bg-white text-[13px]"
                  placeholder="1"
                  min="1"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 pt-1 lg:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">App Orientation</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['default', 'portrait', 'landscape'] as const).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOrientation(o)}
                      className={`py-2.5 px-1 rounded-xl border text-[10px] font-bold capitalize transition-all overflow-hidden text-ellipsis whitespace-nowrap ${
                        orientation === o 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-900/10' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 md:col-span-2 lg:col-span-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFullscreen(!fullscreen)}
                    className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                      fullscreen ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className={`text-[12px] font-bold transition-colors ${fullscreen ? 'text-indigo-900' : 'text-slate-700'}`}>Fullscreen Mode</span>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full relative transition-colors ${fullscreen ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${fullscreen ? 'translate-x-3.5' : ''} shadow-sm`} />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllowCleartext(!allowCleartext)}
                    className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                      allowCleartext ? 'border-amber-500 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                    }`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className={`text-[12px] font-bold transition-colors ${allowCleartext ? 'text-amber-900' : 'text-slate-700'}`}>Insecure Traffic (HTTP)</span>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full relative transition-colors ${allowCleartext ? 'bg-amber-500' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${allowCleartext ? 'translate-x-3.5' : ''} shadow-sm`} />
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2 pt-1 lg:col-span-4">
                <div className="flex justify-between items-end mb-1.5 px-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">GitHub Repository</label>
                  {isVerifyingRepo && <span className="text-indigo-500 text-[9px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Verifying</span>}
                  {!isVerifyingRepo && repoStatus === 'valid' && <span className="text-emerald-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={10}/> Valid</span>}
                  {!isVerifyingRepo && repoStatus === 'invalid' && <span className="text-red-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={10}/> Invalid</span>}
                </div>
                <div className="relative group">
                   <input 
                     type="url" 
                     value={repoUrl}
                     onChange={e => setRepoUrl(e.target.value)}
                     className={`w-full h-12 px-5 rounded-2xl border transition-all placeholder:text-slate-400 font-mono text-xs font-bold tracking-tight ${
                       repoStatus === 'invalid' 
                         ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10 bg-red-50/50' 
                         : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-slate-50/50 focus:bg-white focus:text-indigo-600'
                     } outline-none`}
                     placeholder="https://github.com/username/repo-name"
                   />
                </div>
              </div>
              
              <div className="space-y-1.5 md:col-span-2 pt-1 lg:col-span-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">App Icon</label>
                 <div className="flex items-center gap-4">
                  <div className="flex-1 h-12 flex items-center bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100/50 transition-all hover:bg-white group cursor-pointer shadow-sm relative">
                     <input 
                       type="file" 
                       accept="image/png, image/jpeg" 
                       onChange={handleIconChange}
                       className="absolute inset-0 opacity-0 cursor-pointer z-10"
                     />
                     <div className="flex items-center w-full px-4 gap-3">
                        <div className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest group-hover:bg-indigo-600 transition-colors shrink-0">
                          {appIconBase64 ? 'Change Icon' : 'Choose Icon'}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1">
                          {appIconBase64 ? appIconName || 'Icon selected' : 'No icon chosen'}
                        </span>
                        {appIconBase64 && (
                          <button 
                            type="button"
                            onClick={clearIcon}
                            className="z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        )}
                     </div>
                  </div>
                  {appIconBase64 && (
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5 border border-slate-200 shrink-0 bg-white items-center justify-center flex animate-in zoom-in-50 duration-500">
                      <img src={appIconBase64} alt="App icon preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>


              <div className="md:col-span-2 pt-4">
                <button
                  type="button"
                  onClick={() => setEnableCustomSplash(!enableCustomSplash)}
                  className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                    enableCustomSplash ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200 bg-slate-50/50 hover:bg-white'
                  }`}
                >
                  <div className="flex flex-col items-start text-left">
                    <span className={`text-[12px] font-bold transition-colors ${enableCustomSplash ? 'text-indigo-900' : 'text-slate-700'}`}>Custom Splash Screen</span>
                  </div>
                  <div className={`w-8 h-4.5 rounded-full relative transition-colors ${enableCustomSplash ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${enableCustomSplash ? 'translate-x-3.5' : ''} shadow-sm`} />
                  </div>
                </button>
              </div>

              {enableCustomSplash && (
                <div className="md:col-span-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSplashDesigner(true)}
                    className="relative group w-full overflow-hidden rounded-[48px] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-600/10 transition-all duration-700"
                  >
                    <div className="flex flex-col items-center p-8 sm:p-10">
                      {/* Header: Title & Description */}
                      <div className="text-center mb-6 w-full animate-in fade-in duration-1000">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Sparkles size={20} />
                          </div>
                          <span className="text-xl font-display font-bold text-slate-900 tracking-tight whitespace-nowrap">Splash Designer</span>
                        </div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden">
                          Custom colors, scale & motion
                        </p>
                      </div>

                      {/* Middle: Visual Preview Card */}
                      <div className="relative group-hover:scale-105 transition-transform duration-700 mb-6 shadow-2xl shadow-slate-900/10 scale-[0.8] origin-center">
                        <SplashPreview 
                          backgroundColor={splashConfig.backgroundColor}
                          iconSize={splashConfig.iconSize}
                          animation={splashConfig.animation}
                          iconBase64={appIconBase64}
                          scale={0.3}
                        />
                      </div>

                      {/* Bottom: Configure Button only */}
                      <div className="flex items-center justify-center animate-in slide-in-from-bottom-2">
                        <div className="px-8 py-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/20 flex items-center gap-2 font-bold text-[10px] hover:bg-black transition-all hover:scale-105 active:scale-95 uppercase tracking-widest">
                          Edit Splash <Sparkles size={12} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <div className="mb-4">
               <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">System Permissions</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">Native Android Capabilities</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {AVAILABLE_PERMISSIONS.map(perm => {
                const isActive = permissions.includes(perm.id);
                return (
                  <button
                    key={perm.id}
                    type="button"
                    onClick={() => togglePermission(perm.id)}
                    disabled={perm.id === 'INTERNET'}
                    className={`relative flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'border-indigo-500 bg-indigo-50/20' 
                        : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                    } ${perm.id === 'INTERNET' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                  >
                    <div className={`text-[11px] font-bold tracking-tight ${isActive ? 'text-indigo-900' : 'text-slate-900'}`}>
                      {perm.label}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isActive ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'
                    }`}>
                      {isActive && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <div className="mb-4">
               <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">Advanced Tuning</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">Native behavior & Integrations</p>
            </div>
            
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setDoubleTapToExit(!doubleTapToExit)}
                className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all ${
                  doubleTapToExit 
                    ? 'border-indigo-500 bg-indigo-50/20' 
                    : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs font-bold ${doubleTapToExit ? 'text-indigo-900' : 'text-slate-700'}`}>Double Tap to Exit</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${doubleTapToExit ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${doubleTapToExit ? 'translate-x-3.5' : ''} shadow-sm`} />
                </div>
              </button>

              <div className="pt-2">
                <div className="p-6 rounded-[32px] border border-slate-200 bg-white space-y-5 shadow-sm">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layout size={16} className="text-indigo-600" />
                        <span className="text-[14px] font-bold text-slate-900">Cloud Messaging (FCM)</span>
                      </div>
                      {googleServicesJsonBase64 && (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-in zoom-in-50">
                          <CheckCircle2 size={10} strokeWidth={2.5} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Active</span>
                        </div>
                      )}
                   </div>
                   
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Configuration file (google-services.json)</label>
                      <div className="h-12 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-all hover:bg-white group shadow-sm relative">
                         <input 
                           type="file" 
                           accept=".json" 
                           onChange={handleGoogleServicesChange}
                           className="absolute inset-0 opacity-0 cursor-pointer z-10"
                         />
                         <div className="flex items-center w-full px-4 gap-3">
                            <div className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest group-hover:bg-indigo-600 transition-colors shrink-0">
                              {googleServicesJsonBase64 ? 'Replace' : 'Select File'}
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1">
                              {googleServicesJsonBase64 ? 'google-services.json' : 'No file chosen'}
                            </span>
                            {googleServicesJsonBase64 && (
                              <button 
                                type="button"
                                onClick={clearGoogleServices}
                                className="z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
                              >
                                <X size={14} strokeWidth={3} />
                              </button>
                            )}
                         </div>
                      </div>
                   </div>

                   <button
                    type="button"
                    onClick={() => setAskNotificationsOnLaunch(!askNotificationsOnLaunch)}
                    className="flex items-center justify-between w-full pt-4 border-t border-slate-100 group"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className={`text-[11px] font-bold uppercase tracking-tight transition-colors ${askNotificationsOnLaunch ? 'text-indigo-600' : 'text-slate-400'}`}>Request on Launch</span>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full relative transition-colors ${askNotificationsOnLaunch ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${askNotificationsOnLaunch ? 'translate-x-3.5' : ''} shadow-sm`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-t border-slate-100">
            <div className="text-[11px] text-center sm:text-left text-slate-400 leading-relaxed max-w-sm font-bold uppercase tracking-wider">
              Ready to package your application into a premium, standalone APK optimized for performance.
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-black text-white font-bold px-12 py-4 rounded-2xl transition-all flex justify-center items-center gap-3 shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm uppercase tracking-widest group"
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="animate-spin text-white/50" />
                  Generating...
                </>
              ) : (
                <>
                  <Rocket size={24} className="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                  Build App
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <SplashScreenDialog 
        isOpen={showSplashDesigner}
        onClose={() => setShowSplashDesigner(false)}
        config={splashConfig}
        onUpdate={(cfg) => setSplashConfig(cfg)}
        iconBase64={appIconBase64}
      />
    </motion.div>
  );
}
