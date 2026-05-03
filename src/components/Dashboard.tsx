import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router';
import { Plus, CheckCircle2, Clock, AlertCircle, FileCode2, Trash2, Copy, Check, Loader2, ChevronRight, ChevronDown, ChevronUp, Settings, Terminal, Shield, Package, Folder, LayoutDashboard, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  user: User;
}

interface Project {
  id: string;
  appName: string;
  repoUrl: string;
  status: 'draft' | 'building' | 'completed' | 'failed';
  buildId?: string;
  buildStatusDetails?: string;
  logUrl?: string;
  appIconUrl?: string;
  appIconBase64?: string;
  packageName?: string;
  versionName?: string;
  versionCode?: string;
  settingsVersion?: number;
  createdAt: any;
}

// Global cache to ensure check only happens once per session
let globalHealthData: {
  isCloudBuildConfigured: boolean;
  builderExists: boolean | null;
  builderCheckError: string | null;
} | null = null;
let isCurrentlyChecking = false;

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [quotaError, setQuotaError] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [isCloudBuildConfigured, setIsCloudBuildConfigured] = useState<boolean>(globalHealthData?.isCloudBuildConfigured ?? true);
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState<string>('Loading logs...');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  
  const [setupBuilderLoading, setSetupBuilderLoading] = useState(false);
  const [setupBuilderSuccess, setSetupBuilderSuccess] = useState<string | null>(null);
  const [setupBuilderId, setSetupBuilderId] = useState<string | null>(null);
  const [setupBuilderStatus, setSetupBuilderStatus] = useState<string | null>(null);
  const [setupLogsText, setSetupLogsText] = useState<string>('');
  const [viewSetupLogs, setViewSetupLogs] = useState(false);
  const [builderExists, setBuilderExists] = useState<boolean | null>(globalHealthData?.builderExists ?? null);
  const [checkingBuilder, setCheckingBuilder] = useState(false);
  const [builderCheckError, setBuilderCheckError] = useState<string | null>(globalHealthData?.builderCheckError ?? null);
  const [isBuildEngineOpen, setIsBuildEngineOpen] = useState(false);
  const [isProvisionedToolsOpen, setIsProvisionedToolsOpen] = useState(false);

  const handleSetupBuilder = async () => {
    setSetupBuilderLoading(true);
    setSetupBuilderSuccess(null);
    setSetupBuilderId(null);
    setSetupBuilderStatus(null);
    setSetupLogsText('Starting...');
    setViewSetupLogs(true);
    try {
      const res = await fetch('/api/setup-builder', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger build');
      }
      setSetupBuilderId(data.buildId);
      setSetupBuilderStatus('WORKING');
    } catch (err: any) {
      alert(`Error setting up builder: ${err.message}`);
    } finally {
      setSetupBuilderLoading(false);
    }
  };

  useEffect(() => {
    if (!setupBuilderId || (setupBuilderStatus !== 'WORKING' && setupBuilderStatus !== 'QUEUED')) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/build/${setupBuilderId}`);
        const data = await res.json();
        setSetupBuilderStatus(data.status);
        
        if (data.status === 'SUCCESS' || data.status === 'FAILURE' || data.status === 'TIMEOUT') {
           setSetupBuilderSuccess(data.status === 'SUCCESS' ? 'Builder image provisioned successfully.' : `Builder failed with status: ${data.status}`);
           if (data.status === 'SUCCESS') setBuilderExists(true);
        }
      } catch (err: any) {
         if (err.message !== 'Failed to fetch') {
           console.error("Error polling builder status", err);
         }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [setupBuilderId, setupBuilderStatus]);

  const fetchSetupLogs = async () => {
    if (!setupBuilderId) return;
    setSetupLogsText("Fetching logs...");
    try {
      const logsRes = await fetch(`/api/logs/${setupBuilderId}`);
      if (!logsRes.ok) {
        try {
          const err = await logsRes.json();
          setSetupLogsText(err.error || "Failed to fetch logs");
        } catch(e) {
          setSetupLogsText("Failed to fetch logs");
        }
      } else {
        const text = await logsRes.text();
        setSetupLogsText(text || "No logs available yet");
      }
    } catch (err) {
      setSetupLogsText("Network error fetching logs");
    }
  };

  useEffect(() => {
    if (viewSetupLogs && setupBuilderId) {
      if (!setupLogsText || setupLogsText === 'Starting...') {
        fetchSetupLogs();
      }
    }
  }, [viewSetupLogs, setupBuilderId]);

  useEffect(() => {
    if (viewLogsId) {
      const fetchLogs = async () => {
         setLogsText("Fetching logs...");
         try {
           const res = await fetch(`/api/logs/${viewLogsId}`);
           if (res.ok) {
             setLogsText((await res.text()) || "No logs available yet");
           } else {
             setLogsText("Failed to fetch logs");
           }
         } catch(e) {
           setLogsText("Error connecting to log stream");
         }
      };
      fetchLogs();
    }
  }, [viewLogsId]);

  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);

  const handleWipeData = async () => {
    setIsWiping(true);
    setQuotaError(false);
    try {
      const { getDocs, deleteDoc, doc, collection, query, where } = await import('firebase/firestore');
      const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
      const projectsSnap = await getDocs(q);
      
      for (const pDoc of projectsSnap.docs) {
         try {
           const buildsQ = query(collection(db, 'projects', pDoc.id, 'builds'));
           const buildsSnap = await getDocs(buildsQ);
           for (const bDoc of buildsSnap.docs) {
              await deleteDoc(doc(db, 'projects', pDoc.id, 'builds', bDoc.id));
           }
         } catch (e) {
           console.error("Error deleting builds", e);
         }
         await deleteDoc(doc(db, 'projects', pDoc.id));
      }
      
      setShowWipeConfirm(false);
      fetchProjects();
    } catch(err: any) {
      console.error(err);
    } finally {
      setIsWiping(false);
    }
  };

  const handleCheckBuilderStatus = async () => {
    setCheckingBuilder(true);
    setBuilderCheckError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error("Health check failed");
      const data = await res.json();
      
      let bExists = null;
      let bError = null;

      if (typeof data.isCloudBuildReady === 'boolean') {
        setIsCloudBuildConfigured(data.isCloudBuildReady);
        
        if (data.isCloudBuildReady) {
          try {
            const bRes = await fetch('/api/builder-image-status');
            if (bRes.ok) {
              const bData = await bRes.json();
              bExists = bData.exists;
              bError = bData.error || null;
              setBuilderExists(bExists);
              setBuilderCheckError(bError);
            }
          } catch (err) {
            console.warn("Builder status check failed", err);
            setBuilderCheckError("Check failed");
          }
        }
      }

      globalHealthData = {
        isCloudBuildConfigured: data.isCloudBuildReady,
        builderExists: bExists,
        builderCheckError: bError
      };
    } catch (e) {
      console.warn("Health check failed", e);
    } finally {
      setCheckingBuilder(false);
    }
  };

  useEffect(() => {
    if (globalHealthData === null) {
      handleCheckBuilderStatus();
    }
  }, []);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingBuild, setCancellingBuild] = useState<string | null>(null);

  const handleCancelBuild = async (projectId: string, buildId: string) => {
    if (!window.confirm("Are you sure you want to cancel this build?")) return;
    setCancellingBuild(projectId);
    try {
      const res = await fetch(`/api/build/${buildId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId })
      });
      if (res.ok) {
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const projectRef = doc(db, 'projects', projectId);
          await updateDoc(projectRef, {
            status: 'failed',
            buildStatusDetails: 'CANCELLED',
            updatedAt: serverTimestamp(),
            buildFailureReason: 'Build cancelled by user.'
          });
          const buildRef = doc(db, 'projects', projectId, 'builds', buildId);
          await updateDoc(buildRef, {
            status: 'failed',
            updatedAt: serverTimestamp(),
            buildFailureReason: 'Build cancelled by user.'
          });
        } catch(e) {
           console.error("Cancel sync failed", e);
        }
        
        // optimistically mark project as failed/cancelled immediately to break loop
        setProjects(projects.map(p => p.id === projectId ? { ...p, status: 'failed', buildStatusDetails: 'CANCELLED', buildFailureReason: 'Build cancelled by user.' } : p));
        fetchProjects();
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

  const fetchProjects = async () => {
    if (!user.uid) return;
    setIsRefreshing(true);
    setQuotaError(false);

    try {
      const { getDocs } = await import('firebase/firestore');
      const q = query(
        collection(db, 'projects'),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(q);
      const projData: Project[] = [];
      
      const { doc: fDoc, setDoc, updateDoc, deleteField } = await import('firebase/firestore');
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let needsMigration = false;
        
        if (data.appIconBase64 || data.googleServicesJsonBase64 || data.notificationIconBase64) {
           needsMigration = true;
           try {
             const projDocRef = fDoc(db, 'projects', docSnap.id);
             
             // Optionally you could move them to an assets subcollection if needed
             // For now, we rely on the Cloud Storage bucket which already has them.
             
             await updateDoc(projDocRef, {
               appIconBase64: deleteField(),
               googleServicesJsonBase64: deleteField(),
               notificationIconBase64: deleteField()
             });
             
             delete data.appIconBase64;
             delete data.googleServicesJsonBase64;
             delete data.notificationIconBase64;
           } catch (e) {
             console.error("Migration failed", e);
           }
        }
        
        const pData = { id: docSnap.id, ...data } as Project;
        
        // Dynamically set appIconUrl to use our backend proxy to avoid 500kb base64 fetching
        pData.appIconUrl = `/api/icon/${docSnap.id}`;
        
        projData.push(pData);
      }
      // Sort in frontend since we don't have composite index set up yet
      projData.sort((a, b) => {
        const aMillis = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const bMillis = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return bMillis - aMillis;
      });
      
      setProjects(projData);
    } catch (error: any) {
      if (error?.message?.includes('Quota limit exceeded')) {
        setQuotaError(true);
      } else {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user.uid]);



  useEffect(() => {
    // Poll our backend for any active builds to save Firebase reads
    const activeProjects = projects.filter(p => p.status === 'building' && p.buildId);
    if (activeProjects.length === 0) return;

    const interval = setInterval(() => {
      let changed = false;
      let newProjState = [...projects];

      Promise.all(activeProjects.map(async (p) => {
        try {
          const res = await fetch(`/api/build/${p.buildId}?projectId=${p.id}&appName=${encodeURIComponent(p.appName)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status && data.status !== p.buildStatusDetails) {
               changed = true;
               // Optimistically update the UI to show 'WORKING' without doing a full DB sync
               const index = newProjState.findIndex(proj => proj.id === p.id);
               if (index !== -1) {
                 newProjState[index] = { ...newProjState[index], buildStatusDetails: data.status };
                 // If terminal, we sync it here!
                 if (['SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'].includes(data.status)) {
                    try {
                      const nextStatus = data.status === 'SUCCESS' ? 'completed' : 'failed';
                      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
                      const projectRef = doc(db, 'projects', p.id);
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
                      
                      const buildRef = doc(db, 'projects', p.id, 'builds', p.buildId!);
                      await updateDoc(buildRef, buildUpdateData);
                      
                      // Also push this real sync to our immediate state model to avoid extra read!
                      newProjState[index].status = nextStatus;
                      if (data.downloadUrl) newProjState[index].downloadUrl = data.downloadUrl;
                      if (reason) newProjState[index].buildFailureReason = reason.substring(0, 1900);
                      
                    } catch (dbErr) {
                       console.error("Frontend db sync failed", dbErr);
                    }
                 }
               }
            }
          }
        } catch (e) {
          // ignore network errors
        }
      })).then(() => {
        if (changed) {
           setProjects(newProjState);
        }
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [projects]);

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(logsText);
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2000);
    } catch (err) {
       console.error("Failed to copy logs");
    }
  };

  const StatusBadge = ({ project }: { project: Project }) => {
    switch(project.status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100/80 text-slate-600 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border border-slate-200/50"><Clock size={12} strokeWidth={2.5}/> DRAFT</span>;
      case 'building':
        let msg = 'Building...';
        if (project.buildStatusDetails === 'QUEUED') msg = 'Queued...';
        if (project.buildStatusDetails === 'WORKING') msg = 'In Progress...';
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap animate-pulse border border-blue-100"><Loader2 size={12} className="animate-spin" strokeWidth={2.5}/> {msg.toUpperCase()}</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border border-emerald-100/50"><CheckCircle2 size={12} strokeWidth={2.5}/> COMPLETED</span>;
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-tight border border-red-100/50">
            <AlertCircle className="shrink-0" size={12} strokeWidth={2.5}/> FAILED
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Settings / System status cards */}
      <>
        {!isCloudBuildConfigured && (
          <div className="bg-amber-50/50 border border-amber-100 text-amber-900 p-6 rounded-[32px] shadow-sm text-sm backdrop-blur-sm mb-6">
            <h4 className="font-display font-bold mb-2 flex items-center gap-2 text-base">
               <AlertCircle size={20} className="text-amber-500" /> Cloud Build Integration Required
            </h4>
            <p className="mt-1 text-amber-800/80 leading-relaxed">
              To enable live Capacitor APK compilation via Google Cloud Build, open the <strong>Settings (gear icon)</strong>. Set <code className="bg-amber-100/50 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">GCP_PROJECT_ID</code> and <code className="bg-amber-100/50 px-1.5 py-0.5 rounded text-amber-900 font-mono text-xs">GCP_CREDENTIALS_JSON</code> using a Service Account JSON key.
            </p>
          </div>
        )}

        <div className="sticky top-[72px] z-30 bg-slate-50/90 backdrop-blur-md py-3 md:py-4 px-2 sm:px-4 border-b border-slate-200/80 mb-8 flex items-center justify-between -mx-2 sm:-mx-4">
          <div className="min-w-0 flex items-center gap-4">
            <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-800 to-blue-950 shadow-md shadow-slate-900/10 border border-slate-900/50 flex items-center justify-center shrink-0 overflow-hidden text-white">
              <div className="absolute -bottom-4 w-[150%] h-8 bg-blue-500/50 blur-md rounded-full"></div>
              <LayoutDashboard size={24} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight leading-none mb-0.5">Dashboard</h1>
                <button 
                  onClick={fetchProjects}
                  disabled={isRefreshing || loading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  title="Refresh Projects"
                >
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin text-blue-500" : ""} />
                </button>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">System Overview</p>
            </div>
          </div>
          
          {isCloudBuildConfigured && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">Build Engine:</span>
              {checkingBuilder ? (
                <span className="text-[9px] font-bold text-blue-500 uppercase flex items-center gap-1 animate-pulse whitespace-nowrap">
                  <Clock size={10} /> Syncing
                </span>
              ) : builderExists ? (
                <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={10} /> Active
                </span>
              ) : (
                <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 whitespace-nowrap">
                  <AlertCircle size={10} /> Update
                </span>
              )}
            </div>
          )}
        </div>
      </>

      {quotaError && (
        <div className="bg-red-50/50 border border-red-100 text-red-900 p-8 rounded-[32px] shadow-sm text-center backdrop-blur-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[24px] bg-red-100/50 text-red-600 mb-4 border border-red-200/50">
             <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-display font-black text-slate-900 tracking-tight mb-2">Firebase Quota Reached</h2>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest max-w-sm mx-auto leading-relaxed">
            Your free daily Firestore read/write quota has been exceeded. 
            The system dashboard will resume full functionality once the quota resets (usually at midnight Pacific Time).
          </p>
        </div>
      )}

      {loading && !quotaError ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse bg-white border border-slate-100 rounded-[32px] h-48 shadow-sm"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-indigo-50/30 rounded-[40px] border-2 border-indigo-100 border-dashed shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-white text-indigo-500 mb-4 border border-indigo-100 shadow-sm">
            <FileCode2 size={24} className="stroke-[1.5px]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Start Building</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-6 max-w-xs mx-auto opacity-70">Convert your web app into a high-performance native Android experience</p>
          <Link 
            to="/new" 
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white px-7 py-3.5 rounded-2xl font-bold transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-sm hover:-translate-y-0.5"
          >
            <Plus size={18} strokeWidth={3} /> New Application
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <Link 
            to="/new" 
            className="group relative block overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50/50 border border-indigo-100/80 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-900/10 hover:border-indigo-300 transition-all duration-500 active:scale-[0.99] hover:-translate-y-1"
          >
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-white text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-sm border border-indigo-100/50">
                  <Plus size={20} strokeWidth={3} />
                </div>
                <div className="text-left min-w-0">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight whitespace-nowrap">Create New Project</h3>
                  <p className="text-[9px] font-bold text-indigo-500/80 uppercase tracking-widest mt-0.5 whitespace-nowrap group-hover:text-indigo-600 transition-colors">Start a new build</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center group-hover:from-indigo-600 group-hover:to-violet-600 transition-all duration-500 shadow-md shadow-indigo-500/20 shrink-0 group-hover:scale-110">
                <Package size={18} strokeWidth={2.5} />
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-indigo-200/20 rounded-full blur-3xl group-hover:bg-indigo-300/30 transition-colors duration-700" />
            <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-32 h-32 bg-blue-200/20 rounded-full blur-3xl group-hover:bg-blue-300/30 transition-colors duration-700" />
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {projects.map((project) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              key={project.id} 
              className="group relative"
            >
              <div 
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 transition-all duration-500 cursor-pointer h-full flex flex-col"
              >
                 <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="shrink-0">
                      {project.appIconBase64 ? (
                        <img src={project.appIconBase64} alt="" className="w-10 h-10 rounded-xl shadow-sm border border-slate-200/60 object-cover" />
                      ) : project.appIconUrl ? (
                         <img src={project.appIconUrl} alt="" className="w-10 h-10 rounded-xl shadow-sm border border-slate-200/60 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/50">
                          <Package size={20} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 tracking-tight group-hover:text-slate-900 transition-colors uppercase leading-tight truncate">{project.appName}</h3>
                      <span className="text-[10px] font-mono text-slate-400 truncate block mt-1 group-hover:text-slate-500 transition-colors tracking-tight">
                        {project.repoUrl.replace('https://github.com/', '').replace(/\/$/, '')}
                      </span>
                    </div>
                    <div className="shrink-0 -mt-0.5">
                      <StatusBadge project={project} />
                    </div>
                 </div>

                {project.status === 'building' && (
                  <div className="mb-4 space-y-2">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden shadow-inner flex-1">
                      <div className={`bg-blue-500 h-full transition-all duration-1000 ease-in-out ${project.buildStatusDetails === 'QUEUED' ? 'w-1/4' : project.buildStatusDetails === 'WORKING' ? 'w-2/3 animate-pulse' : 'w-full animate-pulse'}`}></div>
                    </div>
                    {project.buildId && (
                      <div className="flex gap-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                        <button 
                           onClick={(e) => { e.stopPropagation(); handleCancelBuild(project.id, project.buildId!); }}
                           disabled={cancellingBuild === project.id}
                           className="text-[9px] hover:text-red-600 px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-red-200 transition-colors inline-block bg-white"
                        >
                           {cancellingBuild === project.id ? 'CANCELLING...' : 'CANCEL BUILD'}
                        </button>
                        <button 
                           onClick={(e) => { 
                              e.stopPropagation(); 
                              setViewLogsId(viewLogsId === project.buildId ? null : project.buildId!); 
                           }}
                           className="text-[9px] hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:border-blue-200 transition-colors inline-block bg-white"
                        >
                           {viewLogsId === project.buildId ? 'HIDE LOGS' : 'VIEW LOGS'}
                        </button>
                      </div>
                    )}
                    
                    {viewLogsId === project.buildId && (
                      <div className="mt-2 relative z-10" onClick={(e) => e.stopPropagation()}>
                        <div className="bg-[#0A0A0A] rounded-xl p-3 text-[9px] font-mono text-gray-300 h-40 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all w-full shadow-inner border border-gray-800 leading-relaxed cursor-text select-text">
                          {logsText || 'Attaching to builder log stream...'}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const fetchLogs = async () => {
                               setLogsText("Fetching...");
                               try {
                                 const res = await fetch(`/api/logs/${viewLogsId}`);
                                 setLogsText(res.ok ? (await res.text()) || "No logs available" : "Failed");
                               } catch(e) { setLogsText("Error fetching logs"); }
                            };
                            fetchLogs();
                          }}
                          className="absolute top-3 right-3 text-[9px] font-bold text-slate-500 hover:text-white uppercase flex items-center gap-1 bg-black/50 px-2 py-1 rounded border border-gray-700 backdrop-blur-md"
                        >
                          <RefreshCw size={10} /> REFRESH
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {project.status === 'failed' && (project as any).buildFailureReason && (
                   <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <span className="text-[9px] text-red-500 font-bold uppercase tracking-wider block mb-1">Build Failed</span>
                      <div className="text-[10px] text-red-400 font-mono whitespace-pre-wrap break-words">{(project as any).buildFailureReason}</div>
                   </div>
                )}
                
                <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors group-hover:text-slate-500">
                      <Clock size={10} strokeWidth={3} className="text-slate-300" /> {project.createdAt?.toMillis ? new Date(project.createdAt.toMillis()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* Delete Action Wrapper */}
                    <div className="relative flex items-center">
                      {confirmDeleteId === project.id ? (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, x: 10 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          className="absolute right-0 flex items-center gap-1 z-30"
                        >
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await fetch('/api/delete-project', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ projectId: project.id })
                                });
                                await deleteDoc(doc(db, 'projects', project.id));
                                setConfirmDeleteId(null);
                              } catch (e) {
                                console.error('Failed to delete:', e);
                              }
                            }}
                            className="text-[10px] font-bold bg-rose-50/90 backdrop-blur-sm text-rose-600 hover:bg-rose-100 border border-rose-100 px-4 py-2 rounded-xl transition-all uppercase tracking-wider active:scale-95 whitespace-nowrap"
                          >
                            Delete App
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-colors shadow-sm bg-white/50 border border-slate-100"
                          >
                            <Plus size={16} className="rotate-45" strokeWidth={3} />
                          </button>
                        </motion.div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                          className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                          title="Delete App"
                        >
                          <Trash2 size={13} strokeWidth={2.5} />
                        </button>
                      )}
                    </div>

                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-100 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all">
                      <ChevronRight size={14} strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )}

      {/* Dev Tools / Build Engine Collapsible at bottom */}
      {isCloudBuildConfigured && (
        <div className="pt-12 border-t border-slate-100">
          <div className={`bg-slate-50/50 border border-slate-200/60 rounded-[32px] overflow-hidden transition-all duration-500 ${isBuildEngineOpen ? 'shadow-xl shadow-slate-200/20' : ''}`}>
            <button 
              onClick={() => setIsBuildEngineOpen(!isBuildEngineOpen)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-100/50 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isBuildEngineOpen ? 'bg-blue-950 text-white shadow-lg shadow-blue-950/20' : 'bg-white text-slate-400 border border-slate-200 group-hover:text-amber-500 group-hover:bg-amber-50'}`}>
                  <Terminal size={18} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-tight">System Infrastructure</h4>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Admin & Dev Tools</p>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isBuildEngineOpen ? 'bg-slate-200 text-slate-600' : 'bg-white text-slate-300 border border-slate-100 group-hover:border-slate-200 group-hover:text-slate-500'}`}>
                {isBuildEngineOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {isBuildEngineOpen && (
              <div className="p-6 pt-0 space-y-6 animate-in slide-in-from-top-2 duration-300">
                <div className="bg-white border border-slate-200/60 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
                      <FileCode2 size={24} />
                    </div>
                    <div>
                       <h4 className="font-bold text-slate-900 text-base tracking-tight">Build Engine</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                         SDK & Container Registry Status
                       </p>
                    </div>
                  </div>
                  
                  {checkingBuilder ? (
                     <div className="whitespace-nowrap px-6 py-2.5 font-mono text-[10px] font-bold text-blue-400 flex items-center gap-2 animate-pulse bg-slate-100/50 rounded-xl tracking-widest">
                        <Clock size={14} /> CHECKING_STATUS
                     </div>
                  ) : builderExists === null ? (
                     <button
                        onClick={handleCheckBuilderStatus}
                        className="whitespace-nowrap inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold transition shadow-sm text-xs active:scale-95 border border-slate-200/60"
                     >
                        <AlertCircle size={16} className="text-slate-500" /> Check Status
                     </button>
                  ) : builderExists ? (
                     <div className="whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-100 px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        ENGINE_READY
                     </div>
                  ) : (
                     <div className="flex flex-col items-end gap-3 shrink-0">
                       {builderCheckError ? (
                         <div className="text-[10px] font-bold text-red-500 max-w-xs text-right mb-1 tracking-tight">
                           {builderCheckError}
                         </div>
                       ) : builderExists === false && (
                         <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                           Action Needed
                         </div>
                       )}
                       <button 
                          onClick={handleSetupBuilder} 
                          disabled={setupBuilderLoading || setupBuilderStatus === 'WORKING' || setupBuilderStatus === 'QUEUED'}
                          className="whitespace-nowrap inline-flex items-center justify-center gap-2 bg-blue-950 hover:bg-black text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-950/10 text-xs disabled:opacity-50 active:scale-95"
                       >
                         {(setupBuilderLoading || setupBuilderStatus === 'WORKING' || setupBuilderStatus === 'QUEUED') ? <Loader2 size={16} className="animate-spin text-white/50" /> : <Plus size={16} />}
                         {setupBuilderLoading ? 'Starting...' : (setupBuilderStatus === 'WORKING' || setupBuilderStatus === 'QUEUED') ? 'Provisioning...' : 'Provision Builder'}
                       </button>
                     </div>
                  )}
                </div>

                {/* Provisioned Build Environment Info Panel */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
                  <button 
                    onClick={() => setIsProvisionedToolsOpen(!isProvisionedToolsOpen)}
                    className="w-full flex items-center justify-between p-6 hover:bg-slate-100/50 transition-colors text-left"
                  >
                    <h4 className="text-[13px] font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <Package size={16} className="text-slate-500" /> PROVISIONED TOOLS & PACKAGES
                    </h4>
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!checkingBuilder) handleCheckBuilderStatus();
                        }}
                        className={`p-2 bg-white hover:bg-slate-200 text-slate-600 rounded-lg shadow-sm border border-slate-200 transition-colors ${checkingBuilder ? 'opacity-50 pointer-events-none' : ''}`}
                        title="Refresh status"
                      >
                        <RefreshCw size={14} className={checkingBuilder ? "animate-spin text-blue-500" : ""} />
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-slate-400 border border-slate-200 shadow-sm transition-colors hover:text-slate-600">
                        {isProvisionedToolsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>
                  
                  {isProvisionedToolsOpen && (
                    <div className="p-6 pt-0 border-t border-slate-200/60 animate-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                           <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Core Environment</div>
                       <ul className="space-y-2 text-slate-700 font-mono text-[11px]">
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span> Ubuntu 24.04
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span> Java JDK 21 (OpenJDK)
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></span> Node.js 20.x
                         </li>
                       </ul>
                    </div>
                    <div>
                       <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Android Build SDK</div>
                       <ul className="space-y-2 text-slate-700 font-mono text-[11px]">
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span> SDK CmdLine Tools (11076708)
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span> Target Platforms: 34, 35, 36
                         </li>
                         <li className="flex items-center gap-2">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span> Build Tools: 34.0.0, 35.0.0
                         </li>
                       </ul>
                    </div>
                    <div>
                       <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Capacitor Pre-cached</div>
                       <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-x-auto">
                         <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] items-center font-mono text-slate-300">
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> @capacitor/core</div>
                           <div className="text-right text-emerald-400">v7.x</div>
                           
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> @capacitor/cli</div>
                           <div className="text-right text-emerald-400">v7.x</div>
                           
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> @capacitor/android</div>
                           <div className="text-right text-emerald-400">v7.x</div>
                           
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70"></span> @capacitor/camera</div>
                           <div className="text-right text-emerald-400 opacity-70">v7.x</div>
                           
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70"></span> @capacitor/geolocation</div>
                           <div className="text-right text-emerald-400 opacity-70">v7.x</div>
                           
                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70"></span> @capacitor/filesystem</div>
                           <div className="text-right text-emerald-400 opacity-70">v7.x</div>

                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70"></span> @capacitor/local-notifications</div>
                           <div className="text-right text-emerald-400 opacity-70">v7.x</div>

                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 opacity-70"></span> @capacitor/voice-recorder</div>
                           <div className="text-right text-emerald-400 opacity-70">v7.x</div>

                           <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span> @capacitor/assets</div>
                           <div className="text-right text-violet-300 opacity-90">latest</div>
                         </div>
                       </div>
                    </div>
                  </div>
                 </div>
                )}
                </div>

                {setupBuilderSuccess && (
                  <div className={`border p-4 rounded-xl text-sm flex gap-3 items-center animate-in zoom-in-95 ${
                    (setupBuilderStatus === 'FAILURE' || setupBuilderStatus === 'TIMEOUT') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <Shield size={18} className={`shrink-0 ${(setupBuilderStatus === 'FAILURE' || setupBuilderStatus === 'TIMEOUT') ? 'text-red-500' : 'text-emerald-500'}`}/>
                    <p className="font-bold text-[11px] uppercase tracking-tight">{setupBuilderSuccess}</p>
                  </div>
                )}
                
                {(setupBuilderId || setupBuilderLoading) && (
                  <div className="space-y-3 mt-6">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Logs</span>
                      <div className="flex gap-4 items-center">
                        {viewSetupLogs && (
                          <button 
                            onClick={fetchSetupLogs}
                            className="text-[10px] font-bold text-slate-900 hover:text-blue-950 uppercase tracking-widest flex items-center gap-1"
                          >
                            <RefreshCw size={12} />
                            Refresh
                          </button>
                        )}
                        <button 
                          onClick={() => setViewSetupLogs(!viewSetupLogs)}
                          className="text-[10px] font-bold text-slate-900 hover:text-blue-950 uppercase tracking-widest"
                        >
                          {viewSetupLogs ? 'Hide Logs' : 'View Logs'}
                        </button>
                      </div>
                    </div>
                    {viewSetupLogs && (
                      <div className="relative">
                        <div className="bg-[#0A0A0A] rounded-xl p-4 sm:p-5 text-[10px] font-mono text-gray-300 h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all w-full shadow-inner border border-gray-800 leading-relaxed">
                          {setupLogsText || 'Attaching to builder log stream...'}
                        </div>
                        <button 
                          onClick={fetchSetupLogs}
                          className="absolute top-3 right-3 text-[10px] font-bold text-slate-500 hover:text-white uppercase flex items-center gap-1 bg-black/50 px-2 py-1 rounded border border-gray-700 backdrop-blur-md"
                        >
                          <RefreshCw size={12} /> REFRESH LOGS
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Danger Zone moved inside System Infrastructure */}
                <div className="pt-4">
                  <div className="bg-red-50 border border-red-200 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white text-red-600 flex items-center justify-center shrink-0 border border-red-200 shadow-sm">
                        <Trash2 size={24} />
                      </div>
                      <div>
                         <h4 className="font-bold text-red-900 text-base tracking-tight">Database Cleanup</h4>
                         <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mt-0.5 max-w-sm leading-relaxed">
                           Permanently wipe all projects and build history from your database
                         </p>
                      </div>
                    </div>
                    <button 
                       onClick={() => setShowWipeConfirm(true)} 
                       className="whitespace-nowrap inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-red-900/10 text-xs active:scale-95"
                    >
                      <Trash2 size={16} />
                      Wipe Database
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wipe Confirmation Modal */}
      {showWipeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-red-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Wipe All Data?</h3>
            <p className="text-slate-500 text-sm mb-6">
              This action cannot be undone. All your connected projects and build histories will be permanently deleted from the database.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowWipeConfirm(false)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                disabled={isWiping}
              >
                Cancel
              </button>
              <button 
                onClick={handleWipeData}
                disabled={isWiping}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isWiping ? (
                  <><Loader2 size={16} className="animate-spin" /> Wiping...</>
                ) : (
                  'Yes, Wipe Data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}