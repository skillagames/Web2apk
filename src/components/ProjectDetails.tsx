import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Clock, CheckCircle2, AlertCircle, FileCode2, 
  Trash2, Download, Rocket, Loader2, Calendar, 
  ChevronRight, RefreshCw, Hash, LogOut, Package, Terminal, FileText, FileDown
} from 'lucide-react';

interface Build {
  id: string;
  status: 'building' | 'completed' | 'failed';
  buildStatusDetails?: string;
  buildFailureReason?: string;
  versionName: string;
  versionCode: string;
  logUrl?: string;
  downloadUrl?: string;
  createdAt: any;
}

interface Project {
  id: string;
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: string;
  repoUrl: string;
  status: 'draft' | 'building' | 'completed' | 'failed';
  permissions: string[];
  doubleTapToExit: boolean;
  askNotificationsOnLaunch: boolean;
  orientation: 'default' | 'portrait' | 'landscape';
  fullscreen: boolean;
  allowCleartext: boolean;
  userId: string;
  appIconUrl?: string;
  appIconBase64?: string;
  googleServicesJsonName?: string;
  googleServicesJsonBase64?: string;
  splashBackgroundColor?: string | null;
  splashIconSize?: number | null;
  splashAnimation?: string | null;
  settingsVersion?: number;
  buildId?: string;
  buildStatusDetails?: string;
  downloadUrl?: string;
}

interface ProjectDetailsProps {
  user: User;
}

export default function ProjectDetails({ user }: ProjectDetailsProps) {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quotaError, setQuotaError] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [cancellingBuild, setCancellingBuild] = useState<string | null>(null);
  const [viewBuildLogs, setViewBuildLogs] = useState(false);
  const [buildLogsText, setBuildLogsText] = useState<string>('');

  const fetchBuildLogs = async () => {
    if (!project?.buildId) return;
    setBuildLogsText("Fetching logs...");
    try {
      const logsRes = await fetch(`/api/logs/${project.buildId}`);
      if (!logsRes.ok) {
        try {
          const err = await logsRes.json();
          setBuildLogsText(err.error || "Failed to fetch logs");
        } catch(e) {
          setBuildLogsText("Failed to fetch logs");
        }
      } else {
        const text = await logsRes.text();
        setBuildLogsText(text || "No logs available yet");
      }
    } catch(e) {
      setBuildLogsText("Failed to connection to log stream");
    }
  };

  useEffect(() => {
    if (viewBuildLogs && project?.buildId) {
      fetchBuildLogs();
    }
  }, [viewBuildLogs, project?.buildId]);

  useEffect(() => {
    if (project?.status !== 'building' || !project.buildId) return;
    
    // Poll for live steps when building
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/build/${project.buildId}?projectId=${project.id}&appName=${encodeURIComponent(project.appName)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status && data.status !== project.buildStatusDetails) {
             // Optimistic update
             setProject(p => p ? { ...p, buildStatusDetails: data.status } : null);
             const terminalStatuses = ['SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'];
             if (terminalStatuses.includes(data.status)) {
                // Perform DB sync on the client side to avoid backend permissions issues
                try {
                  const nextStatus = data.status === 'SUCCESS' ? 'completed' : 'failed';
                  setProject(p => p ? { ...p, status: nextStatus, buildStatusDetails: data.status } : null);
                  const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
                  const projectRef = doc(db, 'projects', project.id);
                  let updateData: any = {
                    status: nextStatus,
                    buildStatusDetails: data.status,
                    updatedAt: serverTimestamp()
                  };
                  if (data.downloadUrl) updateData.downloadUrl = data.downloadUrl;
                  let reason = '';
                  if (data.failureInfo) {
                    reason = data.failureInfo.detail || data.failureInfo.type || 'Build failed';
                    if (typeof reason !== 'string') reason = JSON.stringify(reason);
                    updateData.buildFailureReason = reason.substring(0, 1900);
                  }
                  await updateDoc(projectRef, updateData);

                  const buildUpdateData: any = {
                    status: nextStatus,
                    updatedAt: serverTimestamp(),
                    buildFailureReason: reason.substring(0, 1900) || ''
                  };
                  if (data.downloadUrl) buildUpdateData.downloadUrl = data.downloadUrl;
                  if (data.logUrl) buildUpdateData.logUrl = data.logUrl;
                  
                  const buildRef = doc(db, 'projects', project.id, 'builds', project.buildId!);
                  await updateDoc(buildRef, buildUpdateData);
                  
                  setBuilds(prev => prev.map(b => 
                    b.id === project.buildId 
                      ? { ...b, ...buildUpdateData, updatedAt: new Date() as any } 
                      : b
                  ));
                } catch(e) {
                   console.error("Frontend db sync failed", e);
                }
             }
          }
        }
      } catch (e) {
        // network error ignores
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [project?.status, project?.buildId, project?.buildStatusDetails]);

  const handleCancelBuild = async (buildId: string) => {
    if (!window.confirm("Are you sure you want to cancel this build?")) return;
    setCancellingBuild(buildId);
    try {
      const res = await fetch(`/api/build/${buildId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project?.id })
      });
      if (res.ok) {
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const projectRef = doc(db, 'projects', project!.id);
          await updateDoc(projectRef, {
            status: 'failed',
            buildStatusDetails: 'CANCELLED',
            updatedAt: serverTimestamp(),
            buildFailureReason: 'Build cancelled by user.'
          });
          const buildRef = doc(db, 'projects', project!.id, 'builds', buildId);
          await updateDoc(buildRef, {
            status: 'failed',
            updatedAt: serverTimestamp(),
            buildFailureReason: 'Build cancelled by user.'
          });
        } catch(e) {
           console.error("Cancel sync failed", e);
        }
        
        setProject(p => p ? {
          ...p,
          status: 'failed',
          buildStatusDetails: 'CANCELLED',
          buildFailureReason: 'Build cancelled by user.',
        } : null);
        
        setBuilds(prev => prev.map(b => 
          b.id === buildId 
            ? { ...b, status: 'failed', buildFailureReason: 'Build cancelled by user.', updatedAt: new Date() as any } 
            : b
        ));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to cancel build");
      }
    } catch(e: any) {
       alert("Failed to cancel build: " + e.message);
    } finally {
       setCancellingBuild(null);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setIsRefreshing(true);
    setLoading(true);
    
    const fetchDetails = async () => {
      try {
        const { getDoc, getDocs } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'projects', projectId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const pData = { id: docSnap.id, ...data } as Project;
          pData.appIconUrl = `/api/icon/${docSnap.id}`;
          
          setProject(pData);
        } else {
          navigate('/');
        }

        const q = query(
          collection(db, 'projects', projectId, 'builds'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const buildsSnap = await getDocs(q);
        const buildData: Build[] = [];
        buildsSnap.forEach(d => buildData.push({ id: d.id, ...d.data() } as Build));
        setBuilds(buildData);
      } catch (error: any) {
        console.error("Project error:", error);
        if (error?.message?.includes('Quota limit exceeded')) setQuotaError(true);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };
    
    fetchDetails();
  }, [projectId, user.uid]);

  const fetchProjectData = async () => {
    if (!projectId) return;
    setIsRefreshing(true);
    try {
      const { getDoc, getDocs } = await import('firebase/firestore');
      const docSnap = await getDoc(doc(db, 'projects', projectId));
      if (docSnap.exists()) {
          const data = docSnap.data();
          const pData = { id: docSnap.id, ...data } as Project;
          pData.appIconUrl = `/api/icon/${docSnap.id}`;
          setProject(pData);
      }
      
      const q = query(
        collection(db, 'projects', projectId, 'builds'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      const buildsSnap = await getDocs(q);
      const buildData: Build[] = [];
      buildsSnap.forEach(d => buildData.push({ id: d.id, ...d.data() } as Build));
      setBuilds(buildData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRebuild = () => {
    if (!project) return;
    navigate('/new', { state: { project } });
  };

  const handleDelete = async () => {
    if (!projectId || !project || deleting) return;
    setDeleting(true);

    try {
      // 1. Backend cleanup (storage files)
      const res = await fetch('/api/delete-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      
      if (!res.ok) {
        console.warn("Backend cleanup warning or failure. Continuing with Firestore deletion.");
      }

      // 2. Clear builds subcollection
      const buildsRef = collection(db, 'projects', projectId, 'builds');
      const q = query(buildsRef, where('userId', '==', user.uid));
      const buildsSnap = await getDocs(q);
      for (const buildDoc of buildsSnap.docs) {
        await deleteDoc(buildDoc.ref);
      }

      // 3. Delete main project doc
      await deleteDoc(doc(db, 'projects', projectId));
      
      navigate('/');
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const downloadApk = async (build: Build) => {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: project?.id, 
          appName: project?.appName,
          buildId: build.id // We'll update the backend to support buildId for history download
        })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        alert(data.error || 'Failed to get download URL');
      }
    } catch (e) {
      alert('Download error occurred');
    }
  };

  const downloadLog = async (buildId: string) => {
    try {
      const res = await fetch(`/api/logs/${buildId}/download`);
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          const a = document.createElement('a');
          a.href = data.url;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to download log");
      }
    } catch (e) {
      alert("Failed to download log");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-slate-900 animate-spin" />
        <p className="text-slate-500 font-medium italic">Loading project details...</p>
      </div>
    );
  }

  if (quotaError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
          <AlertCircle size={48} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Database Limit Reached</h2>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            You've reached the free tier limits for your database's daily usage. Details have been paused and will load again when your quota resets.
          </p>
        </div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Header */}
      <div className="sticky top-[72px] z-30 bg-slate-50/90 backdrop-blur-md py-3 md:py-4 px-2 sm:px-4 border-b border-slate-200/80 mb-8 flex items-center justify-between -mx-2 sm:-mx-4">
        <div className="min-w-0 flex items-center gap-4">
          {project.appIconBase64 ? (
            <img src={project.appIconBase64} alt="App Icon" className="w-12 h-12 rounded-2xl shadow-md border border-slate-200/60 object-cover shrink-0" />
          ) : project.appIconUrl ? (
            <img src={project.appIconUrl} alt="App Icon" className="w-12 h-12 rounded-2xl shadow-md border border-slate-200/60 object-cover shrink-0" />
          ) : (
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-800 to-blue-950 shadow-md shadow-slate-900/10 border border-slate-900/50 flex items-center justify-center shrink-0 overflow-hidden text-white">
              <div className="absolute -bottom-4 w-[150%] h-8 bg-blue-500/50 blur-md rounded-full"></div>
              <Package size={24} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight leading-none mb-0.5">
                {project.appName}
              </h1>
              <button 
                onClick={fetchProjectData}
                disabled={isRefreshing || loading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50 mt-1"
                title="Refresh Details"
              >
                <RefreshCw size={16} className={isRefreshing ? "animate-spin text-blue-500" : ""} />
              </button>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              {project.packageName ? `${project.packageName}${project.versionName ? ` v${project.versionName}` : ''}` : 'App Details'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-2 sm:px-4 mt-6 mb-8 max-w-lg mx-auto">
        <button
          onClick={handleRebuild}
          disabled={project.status === 'building'}
          className="w-full inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-black text-white px-6 py-3.5 rounded-2xl font-bold transition shadow-xl shadow-blue-950/10 active:scale-95 disabled:opacity-50 text-[11px] uppercase tracking-widest"
        >
          {project.status === 'building' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Build New Version
        </button>
        {project.status === 'completed' && project.downloadUrl && (
          <a
            href={project.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-bold transition shadow-xl shadow-emerald-500/20 active:scale-95 text-[11px] uppercase tracking-widest"
          >
            <Download size={16} />
            Download APK
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-[0_8px_40px_-10px_rgba(0,0,0,0.04)] border border-slate-200/60 transition-all space-y-8">
            <div>
              <div className="mb-6">
                 <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">App Configuration</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">Core settings & native config</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Repository</label>
                  <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                    <span className="font-bold text-slate-900 text-xs truncate">{project.repoUrl.split('/').pop()}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Version</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="font-mono text-slate-900 font-bold text-[11px] truncate">v{project.versionName} ({project.versionCode})</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Orientation</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs truncate">{project.orientation}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Fullscreen</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.fullscreen ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Cleartext</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.allowCleartext ? 'Allowed' : 'Blocked'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Double Tap Exit</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.doubleTapToExit ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Req. Push</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.askNotificationsOnLaunch ? 'Launch' : 'Off'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Custom Splash</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.splashBackgroundColor ? 'Enabled' : 'No'}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">FCM Config</label>
                    <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                       <span className="capitalize font-bold text-slate-900 text-xs">{project.googleServicesJsonName ? 'Active' : 'Missing'}</span>
                    </div>
                  </div>
                </div>

                {(project.splashIconSize || project.splashAnimation) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Splash Size</label>
                      <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <span className="font-bold text-slate-900 text-xs">{project.splashIconSize || 50}%</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Splash Anim</label>
                      <div className="h-11 flex items-center px-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                        <span className="capitalize font-bold text-slate-900 text-xs">{project.splashAnimation || 'Fade'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100/60">
               <div className="mb-4">
                  <h2 className="text-[15px] font-display font-bold text-slate-900 tracking-tight">Enabled Permissions</h2>
               </div>
              <div className="flex flex-wrap gap-2">
                {project.permissions.map(p => (
                  <span key={p} className="px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl font-mono text-[10px] font-bold text-slate-600 shadow-sm">{p}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-[0_8px_40px_-10px_rgba(0,0,0,0.04)] border border-red-100/80 transition-all space-y-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-red-50/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative z-10">
               <h2 className="text-[15px] font-display font-bold text-red-600 tracking-tight flex items-center gap-2">
                 <AlertCircle size={16} /> 
                 Danger Zone
               </h2>
               <p className="text-[10px] font-bold text-slate-400 mt-1.5 leading-relaxed">Permanently delete this application, its entire build history, and all associated configurations. This action cannot be undone.</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="relative z-10 w-full inline-flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-red-600 hover:text-white px-6 py-3.5 rounded-2xl font-bold transition-all shadow-sm hover:shadow-xl hover:shadow-red-600/20 active:scale-95 text-[11px] uppercase tracking-widest border border-red-200 hover:border-red-600"
            >
              <Trash2 size={16} />
              Delete App
            </button>
          </div>
        </div>

        {/* Right Column: Build History */}
        <div className="lg:col-span-2">
          <div className="bg-white p-6 sm:p-8 rounded-[40px] shadow-[0_8px_40px_-10px_rgba(0,0,0,0.04)] border border-slate-200/60 transition-all min-h-full">
            <div className="mb-6">
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">Build History</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-70">Audit trail of {builds.length} total builds</p>
            </div>
            
            <div className="space-y-4">
              {project.status === 'building' && project.buildId && (
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] text-white shadow-xl shadow-slate-900/10 mb-8 mt-2 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-emerald-400"></div>
                  <div className="flex items-start justify-between gap-4 relative z-10">
                     <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                          <Loader2 size={24} className="animate-spin" />
                        </div>
                        <div>
                          <h4 className="font-bold text-lg tracking-tight">Build In Progress</h4>
                          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-1 flex items-center gap-2">
                            {project.buildStatusDetails || 'INITIALIZING'}
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          </p>
                        </div>
                     </div>
                     <button
                        onClick={() => handleCancelBuild(project.buildId!)}
                        disabled={cancellingBuild === project.buildId}
                        className="text-[10px] font-bold text-red-400 hover:text-white bg-red-400/10 hover:bg-red-500/20 px-3 py-1.5 rounded-xl transition-colors border border-red-500/20"
                     >
                        {cancellingBuild === project.buildId ? 'CANCELLING...' : 'CANCEL BUILD'}
                     </button>
                  </div>
                  
                  {viewBuildLogs && (
                    <div className="mt-6">
                      <div className="bg-[#0A0A0A] rounded-xl p-4 sm:p-5 text-[10px] font-mono text-gray-300 h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all w-full shadow-inner border border-gray-800 leading-relaxed">
                        {buildLogsText || 'Attaching to builder log stream...'}
                      </div>
                      <div className="flex gap-4 items-center justify-end mt-4">
                        <button 
                          onClick={fetchBuildLogs}
                          className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-1"
                        >
                          <RefreshCw size={12} />
                          Refresh
                        </button>
                        <button 
                          onClick={() => setViewBuildLogs(false)}
                          className="text-[10px] font-bold text-slate-400 hover:text-white uppercase tracking-widest"
                        >
                          Hide Logs
                        </button>
                      </div>
                    </div>
                  )}
                  {!viewBuildLogs && (
                    <div className="flex justify-end mt-4">
                      <button 
                        onClick={() => setViewBuildLogs(true)}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 uppercase tracking-widest flex items-center gap-1 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <Terminal size={14} />
                        View Live Logs
                      </button>
                    </div>
                  )}
                </div>
              )}

              {builds.length === 0 && project.status !== 'building' ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200/60 rounded-[32px] p-12 text-center">
                  <Rocket className="mx-auto text-slate-300 mb-4" size={40} />
                  <p className="text-slate-500 font-bold text-sm">No builds found. Start your first build!</p>
                </div>
              ) : (
                <>
                  {/* Current Active Build if any - Only show pulse if the high-level project says building but the subcollection doc hasn't appeared yet */}
                  {project.status === 'building' && !project.buildId && (
                    <div className="bg-blue-50/50 border border-blue-200/50 p-5 rounded-[24px] animate-pulse flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20 flex items-center justify-center text-white">
                          <Loader2 size={24} className="animate-spin" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Versioning v{project.versionName} ({project.versionCode})</h4>
                          <p className="text-[11px] font-bold tracking-widest uppercase text-blue-800 mt-0.5">Initializing Build Environment...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {builds.map((build, index) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={build.id} 
                      className="bg-white p-5 rounded-[24px] border border-slate-200/60 shadow-sm hover:shadow-lg hover:shadow-slate-200/30 hover:border-slate-300 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-sm ${
                            build.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            build.status === 'failed' ? 'bg-red-50 text-red-600 border border-red-100' : 
                            'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {build.status === 'completed' ? <CheckCircle2 size={20} /> : 
                             build.status === 'failed' ? <AlertCircle size={20} /> : 
                             (project.status === 'building' && build.id === project.buildId) ? <Loader2 size={20} className="animate-spin" /> : <Clock size={20} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 text-sm">v{build.versionName}</h4>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold">
                                <Hash size={8} /> {build.versionCode}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5 uppercase tracking-widest">
                              <Calendar size={10} /> {build.createdAt?.toMillis ? new Date(build.createdAt.toMillis()).toLocaleString() : 'Just now'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {build.status === 'completed' && (
                            <button 
                              onClick={() => {
                                if (build.downloadUrl) {
                                  window.open(build.downloadUrl, '_blank');
                                } else {
                                  downloadApk(build);
                                }
                              }}
                              className="bg-blue-950 hover:bg-black text-white p-2.5 rounded-xl transition shadow-xl shadow-blue-950/10 active:scale-95 flex items-center gap-2 px-4 group/btn"
                            >
                              <Download size={16} className="transition-transform group-hover/btn:-translate-y-0.5" />
                              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">APK</span>
                            </button>
                          )}
                          <button 
                            onClick={() => downloadLog(build.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all shadow-sm active:scale-95 flex items-center gap-2 px-4 group/btn"
                            title="Download Build Log"
                          >
                            <FileDown size={16} className="transition-transform group-hover/btn:-translate-y-0.5" />
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Log</span>
                          </button>
                          {build.status === 'failed' && (
                             <div className="text-right">
                                <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">Build Failed</span>
                             </div>
                          )}
                        </div>
                      </div>
                      
                      {build.status === 'failed' && build.buildFailureReason && (
                         <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block mb-1">Error Details:</span>
                            <div className="text-[10px] text-red-400 font-mono whitespace-pre-wrap break-words">{build.buildFailureReason}</div>
                         </div>
                      )}
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Delete App?</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-8">
                This will permanently delete <span className="font-bold text-slate-900">{project.appName}</span> and all its build history and hosted APK files. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-3 px-4 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition border border-transparent hover:border-slate-200/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="py-3 px-4 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Delete App'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
