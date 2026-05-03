import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Rocket, AlertCircle, CheckCircle2, Loader2, Sparkles, Layout, Smartphone, X, Wrench, Bell, FileCode2 } from 'lucide-react';
import { Link } from 'react-router';
import SplashScreenDialog from './SplashScreenDialog';
import SplashPreview from './SplashPreview';
import NotificationIconStudio from './NotificationIconStudio';

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

const AndroidXMLPreview = ({ xmlBase64 }: { xmlBase64: string }) => {
  try {
    const b64Data = xmlBase64.split('base64,')[1] || '';
    const text = atob(b64Data);
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');
    const vector = doc.querySelector('vector');
    if (!vector) return <FileCode2 className="w-8 h-8 text-slate-500" />;

    const width = parseFloat(vector.getAttribute('android:viewportWidth') || '24');
    const height = parseFloat(vector.getAttribute('android:viewportHeight') || '24');
    
    const paths = Array.from(doc.querySelectorAll('path')).map((p, i) => {
      const d = p.getAttribute('android:pathData');
      const fill = p.getAttribute('android:fillColor') || 'currentColor';
      return <path key={i} d={d || ''} fill={fill} />;
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full object-contain">
        {paths}
      </svg>
    );
  } catch (e) {
    return <FileCode2 className="w-8 h-8 text-slate-500" />;
  }
};

export default function ProjectForm({ user }: ProjectFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const existingProject = location.state?.project;

  const [appName, setAppName] = useState(existingProject?.appName || '');
  const [packageName, setPackageName] = useState(existingProject?.packageName || '');
  const [versionName, setVersionName] = useState(existingProject?.versionName || '1.0.0');
  const [versionCode, setVersionCode] = useState(existingProject ? String(parseInt(existingProject.versionCode || '0') + 1) : '1');
  const [orientation, setOrientation] = useState<'default' | 'portrait' | 'landscape'>(existingProject?.orientation || 'default');
  const [fullscreen, setFullscreen] = useState(existingProject?.fullscreen || false);
  const [allowCleartext, setAllowCleartext] = useState(existingProject?.allowCleartext || false);
  const [repoUrl, setRepoUrl] = useState(existingProject?.repoUrl || '');
  const [appIconBase64, setAppIconBase64] = useState<string>('');
  const [appIconName, setAppIconName] = useState<string>('');
  const [permissions, setPermissions] = useState<string[]>(existingProject?.permissions || ['INTERNET']);
  const [doubleTapToExit, setDoubleTapToExit] = useState(existingProject?.doubleTapToExit ?? true);
  const [googleServicesJsonBase64, setGoogleServicesJsonBase64] = useState<string>('');
  const [googleServicesJsonName, setGoogleServicesJsonName] = useState<string>(existingProject?.googleServicesJsonName || '');
  const [askNotificationsOnLaunch, setAskNotificationsOnLaunch] = useState(existingProject?.askNotificationsOnLaunch || false);
  const [notificationIconBase64, setNotificationIconBase64] = useState<string>(existingProject?.notificationIconBase64 || '');
  const [notificationIconName, setNotificationIconName] = useState<string>(existingProject?.notificationIconName || '');
  const [showNotificationStudio, setShowNotificationStudio] = useState(false);
  
  const hasCustomSplash = !!existingProject?.splashIconSize || (!!existingProject?.splashBackgroundColor && existingProject.splashIconSize !== null && existingProject.splashIconSize !== undefined);
  const hasBasicSplashColor = !!existingProject?.splashBackgroundColor && !hasCustomSplash;
  
  const [enableCustomSplash, setEnableCustomSplash] = useState(hasCustomSplash);
  const [enableSplashColor, setEnableSplashColor] = useState(hasBasicSplashColor);
  const [showSplashDesigner, setShowSplashDesigner] = useState(false);
  const [splashConfig, setSplashConfig] = useState({
    backgroundColor: existingProject?.splashBackgroundColor || '#FFFFFF',
    iconSize: existingProject?.splashIconSize || 50,
    animation: (existingProject?.splashAnimation as any) || 'fade' as const
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
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_SIZE = 256;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > MAX_SIZE) {
                  height *= MAX_SIZE / width;
                  width = MAX_SIZE;
                }
              } else {
                if (height > MAX_SIZE) {
                  width *= MAX_SIZE / height;
                  height = MAX_SIZE;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/png', 0.8);
              setAppIconBase64(dataUrl);
            };
            img.src = event.target.result;
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

  const handleNotificationIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setNotificationIconName(file.name);
      
      if (file.name.toLowerCase().endsWith('.xml') || file.type.includes('xml')) {
         const reader = new FileReader();
         reader.onload = (event) => {
            if (event.target?.result && typeof event.target.result === 'string') {
               setNotificationIconBase64(event.target.result);
            }
         };
         reader.readAsDataURL(file);
         return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
         if (event.target?.result && typeof event.target.result === 'string') {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_SIZE = 96;
              let width = img.width;
              let height = img.height;
              
              if (width > height) {
                if (width > MAX_SIZE) {
                  height *= MAX_SIZE / width;
                  width = MAX_SIZE;
                }
              } else {
                if (height > MAX_SIZE) {
                  width *= MAX_SIZE / height;
                  height = MAX_SIZE;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/png');
                setNotificationIconBase64(dataUrl);
              }
            };
            img.src = event.target.result;
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

  const clearNotificationIcon = () => {
    setNotificationIconBase64('');
    setNotificationIconName('');
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
      const docRef = existingProject ? doc(db, 'projects', existingProject.id) : doc(collection(db, 'projects'));
      
      const payload: any = {
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
        notificationIconName,
        splashBackgroundColor: enableCustomSplash ? splashConfig.backgroundColor : (enableSplashColor ? splashConfig.backgroundColor : null),
        splashIconSize: enableCustomSplash ? splashConfig.iconSize : null,
        splashAnimation: enableCustomSplash ? splashConfig.animation : null,
        settingsVersion: (existingProject?.settingsVersion || 0) + 1,
        updatedAt: serverTimestamp()
      };
      
      if (!existingProject) {
        payload.createdAt = serverTimestamp();
      }
      
      try {
        await setDoc(docRef, payload, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `projects/${docRef.id}`);
      }
      
      // Call our backend to start Cloud Build
      try {
        const buildRes = await fetch('/api/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
             projectId: docRef.id,
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
             googleServicesJsonBase64: googleServicesJsonBase64 || existingProject?.googleServicesJsonBase64 || '',
             notificationIconBase64: notificationIconBase64 || existingProject?.notificationIconBase64 || '',
             appIconBase64: appIconBase64 || existingProject?.appIconBase64 || '',
             splashBackgroundColor: enableCustomSplash ? splashConfig.backgroundColor : (enableSplashColor ? splashConfig.backgroundColor : null),
             splashIconSize: enableCustomSplash ? splashConfig.iconSize : null,
             splashAnimation: enableCustomSplash ? splashConfig.animation : null
          })
        });

        const buildData = await buildRes.json();
        if (!buildRes.ok) {
           console.warn("Backend build failed, potentially missing GCP creds. Still logging in Firestore...", buildData);
           await setDoc(docRef, { 
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
           await setDoc(docRef, { 
             buildId: bId,
             buildStatusDetails: 'QUEUED',
             updatedAt: serverTimestamp() 
           }, { merge: true });

           // Create record in builds subcollection
           const buildDocRef = doc(collection(db, 'projects', docRef.id, 'builds'), bId);
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
        navigate(existingProject ? `/project/${existingProject.id}` : '/');
      } catch (backendErr: any) {
        console.error(backendErr);
        await setDoc(docRef, { 
          status: 'failed', 
          buildStatusDetails: backendErr.message || 'Network error',
          updatedAt: serverTimestamp() 
        }, { merge: true });
        setError(backendErr.message || 'Failed to communicate with backend builder.');
        setLoading(false);
      }
      
    } catch (err: any) {
      if (err?.message?.includes('Quota limit exceeded')) {
        setError('Firebase Quota Reached: Your free daily limit has been exceeded. Please wait until tomorrow or use a different Firebase project.');
      } else {
        setError(err.message || 'Failed to create project.');
      }
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto w-full relative"
    >
      <div className="sticky top-[72px] z-30 bg-slate-50/90 backdrop-blur-md py-3 md:py-4 px-2 sm:px-4 border-b border-slate-200/80 mb-8 flex items-center justify-between -mx-2 sm:-mx-4">
        <div className="min-w-0 flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-800 to-blue-950 shadow-md shadow-slate-900/10 border border-slate-900/50 flex items-center justify-center shrink-0 overflow-hidden text-white">
            <div className="absolute -bottom-4 w-[150%] h-8 bg-blue-500/50 blur-md rounded-full"></div>
            <Wrench size={24} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight leading-none mb-0.5">
              {existingProject ? 'Update Build' : 'Configure Build'}
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">App Metadata & Native Config</p>
          </div>
        </div>
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
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm tracking-tight"
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
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm tracking-tight"
                  placeholder="com.web2apk.app"
                />
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-relaxed max-w-[95%] ml-1 mt-1">
                  This uniquely identifies your app. If you use Firebase Push Notifications, this must <strong className="text-slate-800">exactly match</strong> the package name in your Firebase Console project settings.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Version Name</label>
                <input 
                  type="text" 
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm tracking-tight"
                  placeholder="1.0.0"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Version Code</label>
                <input 
                  type="number" 
                  value={versionCode}
                  onChange={e => setVersionCode(e.target.value)}
                  className="w-full h-12 px-5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50 outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm tracking-tight"
                  placeholder="1"
                  min="1"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                <div className="flex justify-between items-end mb-1.5 px-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">GitHub Repository</label>
                  {isVerifyingRepo && <span className="text-blue-500 text-[9px] font-bold uppercase tracking-widest animate-pulse flex items-center gap-1.5"><Loader2 size={10} className="animate-spin" /> Verifying</span>}
                  {!isVerifyingRepo && repoStatus === 'valid' && <span className="text-emerald-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={10}/> Valid</span>}
                  {!isVerifyingRepo && repoStatus === 'invalid' && <span className="text-red-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5"><AlertCircle size={10}/> Invalid</span>}
                </div>
                <div className="relative group">
                   <input 
                     type="url" 
                     value={repoUrl}
                     onChange={e => setRepoUrl(e.target.value)}
                     className={`w-full h-12 px-5 pr-12 rounded-2xl border outline-none transition-all placeholder:text-slate-400 font-bold text-slate-900 bg-slate-50/50 focus:bg-white text-sm tracking-tight ${
                       repoStatus === 'invalid' 
                         ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' 
                         : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-slate-200/50'
                     }`}
                     placeholder="https://github.com/username/repo-name"
                   />
                   {repoUrl && (
                     <button
                       type="button"
                       onClick={() => setRepoUrl('')}
                       className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 bg-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 opacity-0 group-hover:opacity-100 focus:opacity-100"
                     >
                       <X size={14} strokeWidth={3} />
                     </button>
                   )}
                </div>
              </div>
              
              <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">App Icon</label>
                 <div className="flex items-center gap-4">
                  <div className="flex-1 h-12 flex items-center bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-slate-200/50 transition-all hover:bg-white group shadow-sm relative cursor-pointer">
                     <input 
                       type="file" 
                       accept="image/png, image/jpeg" 
                       onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                       onChange={handleIconChange}
                       className="absolute inset-0 opacity-0 cursor-pointer z-10"
                     />
                     <div className="flex items-center w-full px-4 gap-3">
                        <div className="px-3 py-1.5 bg-blue-950 text-white rounded-xl text-[9px] font-bold uppercase tracking-widest group-hover:bg-slate-900 transition-colors shrink-0">
                          {appIconBase64 ? 'Change Icon' : 'Choose Icon'}
                        </div>
                        <span className="text-sm font-bold text-slate-900 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1 tracking-tight">
                          {appIconBase64 ? appIconName || 'Icon selected' : 'No icon chosen'}
                        </span>
                        {appIconBase64 && (
                          <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); clearIcon(e); }} className="relative z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
                          >
                            <X size={14} strokeWidth={3} />
                          </button>
                        )}
                     </div>
                  </div>
                  { (appIconBase64 || existingProject?.appIconUrl) && (
                    <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xl shadow-slate-900/5 border border-slate-200 shrink-0 bg-white items-center justify-center flex animate-in zoom-in-50 duration-500">
                      <img src={appIconBase64 || existingProject?.appIconUrl} alt="App icon preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
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
                          ? 'bg-blue-950 text-white border-slate-900 shadow-md shadow-blue-950/10' 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100">
            <div className="mb-4">
               <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">Custom Splash Screen</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">Custom colors, scale & motion</p>
            </div>
            
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setEnableCustomSplash(!enableCustomSplash)}
                className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                  enableCustomSplash ? 'border-blue-500 bg-slate-100/20' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs font-bold transition-colors ${enableCustomSplash ? 'text-slate-900' : 'text-slate-700'}`}>Enable Custom Splash Screen</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${enableCustomSplash ? 'bg-blue-950' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${enableCustomSplash ? 'translate-x-3.5' : ''} shadow-sm`} />
                </div>
              </button>

              {enableCustomSplash && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSplashDesigner(true)}
                    className="relative group w-full overflow-hidden rounded-[48px] border-2 border-dashed border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-2xl hover:shadow-blue-950/10 transition-all duration-700"
                  >
                    <div className="flex flex-col items-center p-8 sm:p-10">
                      {/* Header: Title & Description */}
                      <div className="text-center mb-6 w-full animate-in fade-in duration-1000">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                            <Sparkles size={20} />
                          </div>
                          <span className="text-xl font-display font-bold text-slate-900 tracking-tight whitespace-nowrap">Splash Designer</span>
                        </div>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap overflow-hidden">
                          Custom colors, scale & motion
                        </p>
                      </div>

                      {/* Middle: Visual Preview Card */}
                      <div className="relative group-hover:scale-105 transition-transform duration-700 mb-6 shadow-2xl shadow-blue-950/10 scale-[0.8] origin-center">
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
                        <div className="px-8 py-3 bg-blue-950 text-white rounded-2xl shadow-xl shadow-blue-950/20 flex items-center gap-2 font-bold text-[10px] hover:bg-blue-950 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest">
                          Edit Splash <Sparkles size={12} strokeWidth={2.5} />
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {!enableCustomSplash && (
                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                     <input 
                        type="checkbox"
                        checked={enableSplashColor}
                        onChange={(e) => setEnableSplashColor(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                     />
                     <span className="text-xs font-bold text-slate-700 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                       Just Set Background Color
                     </span>
                  </label>

                  {enableSplashColor && (
                    <div className="flex flex-col gap-2 pl-7 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <p className="text-[10px] text-slate-500 font-medium tracking-wide">Use a custom color without animations or resizing.</p>
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 shadow-sm">
                          <input
                            type="color"
                            value={splashConfig.backgroundColor}
                            onChange={(e) => setSplashConfig({ ...splashConfig, backgroundColor: e.target.value })}
                            className="absolute -inset-2 w-14 h-14 cursor-pointer"
                          />
                        </div>
                        <input
                          type="text"
                          value={splashConfig.backgroundColor}
                          onChange={(e) => setSplashConfig({ ...splashConfig, backgroundColor: e.target.value })}
                          className="w-32 h-10 px-3 border border-slate-200 rounded-lg text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none uppercase font-mono shadow-sm"
                          placeholder="#FFFFFF"
                        />
                      </div>
                    </div>
                  )}
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
                        ? 'border-blue-500 bg-slate-100/20' 
                        : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                    } ${perm.id === 'INTERNET' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
                  >
                    <div className={`text-xs font-bold ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
                      {perm.label}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isActive ? 'bg-blue-950 border-blue-950' : 'border-slate-200 bg-white'
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
                    ? 'border-blue-500 bg-slate-100/20' 
                    : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs font-bold ${doubleTapToExit ? 'text-slate-900' : 'text-slate-700'}`}>Double Tap to Exit</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${doubleTapToExit ? 'bg-blue-950' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${doubleTapToExit ? 'translate-x-3.5' : ''} shadow-sm`} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFullscreen(!fullscreen)}
                className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                  fullscreen ? 'border-blue-500 bg-slate-100/20' : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs font-bold transition-colors ${fullscreen ? 'text-slate-900' : 'text-slate-700'}`}>Fullscreen Mode</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${fullscreen ? 'bg-blue-950' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${fullscreen ? 'translate-x-3.5' : ''} shadow-sm`} />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAllowCleartext(!allowCleartext)}
                className={`flex items-center justify-between w-full h-12 px-5 rounded-xl border transition-all group ${
                  allowCleartext ? 'border-amber-500 bg-amber-50/20' : 'border-slate-200 hover:border-slate-300 bg-white shadow-sm'
                }`}
              >
                <div className="flex flex-col items-start text-left">
                  <span className={`text-xs font-bold transition-colors ${allowCleartext ? 'text-amber-900' : 'text-slate-700'}`}>Insecure Traffic (HTTP)</span>
                </div>
                <div className={`w-8 h-4.5 rounded-full relative transition-colors ${allowCleartext ? 'bg-amber-500' : 'bg-slate-200'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${allowCleartext ? 'translate-x-3.5' : ''} shadow-sm`} />
                </div>
              </button>

              <div className="pt-2">
                <div className="p-6 rounded-[32px] border border-slate-200 bg-white space-y-5 shadow-sm">
                   <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell size={16} className="text-slate-900" />
                          <span className="text-sm font-bold text-slate-900">Firebase Push Notifications</span>
                        </div>
                        {googleServicesJsonBase64 && (
                          <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 animate-in zoom-in-50">
                            <CheckCircle2 size={10} strokeWidth={2.5} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Active</span>
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-relaxed max-w-[95%]">
                        Enable native push notifications using Firebase Cloud Messaging (FCM). Upload your project's <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[9px] border border-slate-200">google-services.json</code> file to activate this capability.
                      </p>
                   </div>
                   
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Configuration file (google-services.json)</label>
                      <div className="h-12 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all hover:bg-white group shadow-sm relative cursor-pointer">
                         <input 
                           type="file" 
                           accept=".json" 
                           onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                           onChange={handleGoogleServicesChange}
                           className="absolute inset-0 opacity-0 cursor-pointer z-10"
                         />
                         <div className="flex items-center w-full px-4 gap-3">
                            <div className="px-3 py-1.5 bg-blue-950 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest group-hover:bg-slate-900 transition-colors shrink-0">
                              {googleServicesJsonBase64 ? 'Replace' : 'Select File'}
                            </div>
                            <span className="text-[10px] font-mono font-bold text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1">
                              {googleServicesJsonBase64 ? 'google-services.json' : 'No file chosen'}
                            </span>
                            {googleServicesJsonBase64 && (
                              <button 
                                type="button"
                                onClick={(e) => { e.preventDefault(); clearGoogleServices(e); }} className="relative z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
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
                      <span className={`text-xs font-bold transition-colors ${askNotificationsOnLaunch ? 'text-slate-900' : 'text-slate-700'}`}>Request on Launch</span>
                    </div>
                    <div className={`w-8 h-4.5 rounded-full relative transition-colors ${askNotificationsOnLaunch ? 'bg-blue-950' : 'bg-slate-200'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${askNotificationsOnLaunch ? 'translate-x-3.5' : ''} shadow-sm`} />
                    </div>
                  </button>

                  <div className="space-y-2 pt-4 border-t border-slate-100">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1 leading-relaxed">
                      Push Notification Icon (Optional)
                      <span className="block text-[10px] font-medium text-slate-500 normal-case tracking-normal mt-0.5 mb-2">Recommended: 96x96 transparent PNG or Android Vector Drawable (.xml). Used for the small Android status bar icon.</span>
                    </label>
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        type="button"
                        onClick={() => setShowNotificationStudio(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-colors text-[11px] font-bold shadow-sm border border-slate-200"
                      >
                        <Wrench size={14} /> Open Push Icon Studio
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <div className="flex-1 w-full space-y-2 relative">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="flex-1 h-12 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all hover:bg-white group shadow-sm relative cursor-pointer">
                            <input 
                              type="file" 
                              accept="image/png" 
                              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                              onChange={handleNotificationIconChange}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex items-center w-full px-3 gap-2">
                              <div className="px-3 py-1.5 bg-blue-950 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest group-hover:bg-slate-900 transition-colors shrink-0">Upload PNG</div>
                              <span className="text-[10px] font-mono font-bold text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1">
                                {notificationIconName && !notificationIconName.toLowerCase().endsWith('.xml') ? notificationIconName : 'PNG File'}
                              </span>
                              {notificationIconName && !notificationIconName.toLowerCase().endsWith('.xml') && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearNotificationIcon(); }}
                                  className="relative z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
                                >
                                  <X size={14} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 h-12 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 transition-all hover:bg-white group shadow-sm relative cursor-pointer">
                            <input 
                              type="file" 
                              accept=".xml, text/xml, application/xml" 
                              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                              onChange={handleNotificationIconChange}
                              className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            />
                            <div className="flex items-center w-full px-3 gap-2">
                              <div className="px-3 py-1.5 bg-blue-950 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest group-hover:bg-slate-900 transition-colors shrink-0">Upload XML</div>
                              <span className="text-[10px] font-mono font-bold text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity flex-1">
                                {notificationIconName?.toLowerCase().endsWith('.xml') ? notificationIconName : 'XML File'}
                              </span>
                              {notificationIconName?.toLowerCase().endsWith('.xml') && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearNotificationIcon(); }}
                                  className="relative z-20 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all active:scale-90"
                                >
                                  <X size={14} strokeWidth={3} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {notificationIconBase64 && (
                        <div className="relative group shrink-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-slate-200 shrink-0 bg-slate-800 p-2 items-center justify-center flex animate-in zoom-in-50 duration-500">
                            {notificationIconName?.toLowerCase().endsWith('.xml') || notificationIconBase64.includes('xml') ? (
                              <AndroidXMLPreview xmlBase64={notificationIconBase64} />
                            ) : (
                              <img src={notificationIconBase64} alt="Notification preview" className="w-full h-full object-contain" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
              className="w-full sm:w-auto bg-blue-950 hover:bg-black text-white font-bold px-12 py-4 rounded-2xl transition-all flex justify-center items-center gap-3 shadow-xl shadow-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-sm uppercase tracking-widest group"
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

      {showNotificationStudio && (
        <NotificationIconStudio
          onClose={() => setShowNotificationStudio(false)}
          onApply={(base64, name) => {
            setNotificationIconBase64(base64);
            setNotificationIconName(name);
            setShowNotificationStudio(false);
          }}
          initialImage={notificationIconBase64}
        />
      )}
    </motion.div>
  );
}
