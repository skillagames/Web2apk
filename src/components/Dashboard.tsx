import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router';
import { Plus, CheckCircle2, Clock, AlertCircle, FileCode2, Trash2, Copy, Check, Loader2, ChevronRight, ChevronDown, ChevronUp, Settings, Terminal, Shield, Package } from 'lucide-react';
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
  createdAt: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [isCloudBuildConfigured, setIsCloudBuildConfigured] = useState<boolean>(true); // Default true to avoid flicker
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState<string>('Loading logs...');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  
  const [setupBuilderLoading, setSetupBuilderLoading] = useState(false);
  const [setupBuilderSuccess, setSetupBuilderSuccess] = useState<string | null>(null);
  const [setupBuilderId, setSetupBuilderId] = useState<string | null>(null);
  const [setupBuilderStatus, setSetupBuilderStatus] = useState<string | null>(null);
  const [setupLogsText, setSetupLogsText] = useState<string>('');
  const [viewSetupLogs, setViewSetupLogs] = useState(false);
  const [builderExists, setBuilderExists] = useState<boolean | null>(null);
  const [checkingBuilder, setCheckingBuilder] = useState(false);
  const [builderCheckError, setBuilderCheckError] = useState<string | null>(null);
  const [isBuildEngineOpen, setIsBuildEngineOpen] = useState(false);

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
           
        if (viewSetupLogs) {
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
        }
      } catch (err: any) {
         if (err.message !== 'Failed to fetch') {
           console.error("Error polling builder status", err);
         }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [setupBuilderId, setupBuilderStatus, viewSetupLogs]);


  useEffect(() => {
    let mounted = true;

    const checkHealth = () => {
      fetch('/api/health')
        .then(res => {
          if (!res.ok) throw new Error("Health check returned " + res.status);
          return res.json();
        })
        .then(data => {
          if (!mounted) return;
          if (typeof data.isCloudBuildReady === 'boolean') {
            setIsCloudBuildConfigured(data.isCloudBuildReady);
            if (data.isCloudBuildReady) {
              setCheckingBuilder(true);
              fetch('/api/builder-image-status')
                .then(res => {
                  if (!res.ok) throw new Error("Builder check returned " + res.status);
                  return res.json();
                })
                .then(builderData => {
                  if (!mounted) return;
                  setBuilderExists(builderData.exists);
                  if (builderData.error) setBuilderCheckError(builderData.error);
                  else setBuilderCheckError(null);
                })
                .catch(err => {
                  if (!mounted) return;
                  console.warn("Builder status check failed, retrying...", err.message);
                  setTimeout(checkHealth, 3000);
                })
                .finally(() => {
                  if (mounted) setCheckingBuilder(false);
                });
            }
          }
        })
        .catch(e => {
          if (!mounted) return;
          console.warn("Health check failed, retrying in 3s...", e.message);
          setTimeout(checkHealth, 3000);
        });
    };

    checkHealth();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // Only subscribe when user is authenticated
    if (!user.uid) return;

    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projData: Project[] = [];
      snapshot.forEach((doc) => {
        projData.push({ id: doc.id, ...doc.data() } as Project);
      });
      // Sort in frontend since we don't have composite index set up yet
      projData.sort((a, b) => {
        const aMillis = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const bMillis = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return bMillis - aMillis;
      });
      
      setProjects(projData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!viewLogsId) return;
    
    const fetchLogs = async () => {
      const project = projects.find(p => p.id === viewLogsId);
      if (!project?.buildId) {
        setLogsText("No build ID found for this project.");
        return;
      }
      try {
        const res = await fetch(`/api/logs/${project.buildId}`);
        if (!res.ok) {
           const err = await res.json();
           setLogsText(err.error || "Failed to fetch logs.");
        } else {
           const text = await res.text();
           setLogsText(text || "No logs available yet.");
        }
      } catch (err) {
        setLogsText("Error fetching logs.");
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Check every 5s for updates
    return () => clearInterval(interval);
  }, [viewLogsId, projects]);

  useEffect(() => {
    // Poll building projects
    const buildingProjects = projects.filter(p => p.status === 'building' && p.buildId);
    if (buildingProjects.length === 0) return;

    const interval = setInterval(() => {
      buildingProjects.forEach(async (project) => {
        try {
          const res = await fetch(`/api/build/${project.buildId}`);
          const data = await res.json();
          if (res.ok && data.status) {
            let nextStatus = project.status;
            if (data.status === 'SUCCESS') nextStatus = 'completed';
            else if (['FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'].includes(data.status)) nextStatus = 'failed';
            
            if (nextStatus !== project.status || data.status !== project.buildStatusDetails) {
              const projectRef = doc(db, 'projects', project.id);
              const updateData: any = { 
                status: nextStatus,
                buildStatusDetails: data.status,
                updatedAt: serverTimestamp()
              };
              if (nextStatus === 'failed' && data.failureInfo) {
                let reason = data.failureInfo?.detail || data.failureInfo?.type || data.failureInfo;
                if (typeof reason !== 'string') reason = typeof reason === 'object' ? JSON.stringify(reason) : String(reason);
                if (reason.length > 1900) reason = reason.substring(0, 1900) + '...';
                updateData.buildFailureReason = reason;
              }
              if (data.logUrl) updateData.logUrl = data.logUrl;
              await setDoc(projectRef, updateData, { merge: true });

              // Also sync to builds subcollection if buildId exists
              if (project.buildId) {
                const buildRef = doc(db, 'projects', project.id, 'builds', project.buildId);
                await setDoc(buildRef, {
                  status: nextStatus,
                  buildFailureReason: updateData.buildFailureReason || '',
                  logUrl: data.logUrl || '',
                  updatedAt: serverTimestamp()
                }, { merge: true });
              }
            }
          }
        } catch (e: any) {
          if (e.message !== 'Failed to fetch') {
            console.error("Failed to poll build status", e);
          }
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
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap animate-pulse border border-indigo-100"><Clock size={12} strokeWidth={2.5}/> {msg.toUpperCase()}</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-tight whitespace-nowrap border border-emerald-100/50"><CheckCircle2 size={12} strokeWidth={2.5}/> COMPLETED</span>;
      case 'failed':
        const failureReason = (project as any).buildFailureReason || project.buildStatusDetails;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-tight max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap border border-red-100/50" title={failureReason}>
            <AlertCircle className="shrink-0" size={12} strokeWidth={2.5}/> FAILED {failureReason ? `(${failureReason})` : ''}
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

        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 px-4 sm:px-5">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard</h1>
          </div>
          
          {isCloudBuildConfigured && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">Build Engine:</span>
              {checkingBuilder ? (
                <span className="text-[9px] font-bold text-indigo-500 uppercase flex items-center gap-1 animate-pulse whitespace-nowrap">
                  <Clock size={10} /> Syncing
                </span>
              ) : builderExists ? (
                <span className="text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1 whitespace-nowrap">
                  <CheckCircle2 size={10} /> Active
                </span>
              ) : (
                <span className="text-[9px] font-bold text-amber-500 uppercase flex items-center gap-1 whitespace-nowrap">
                  <AlertCircle size={10} /> Action Required
                </span>
              )}
            </div>
          )}
        </div>
      </>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse bg-white border border-slate-100 rounded-[32px] h-48 shadow-sm"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[48px] border-2 border-slate-100 border-dashed shadow-sm">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-slate-50 text-slate-400 mb-6 border border-slate-100 shadow-inner">
            <FileCode2 size={32} className="stroke-[1.5px]" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Start Building</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-8 max-w-xs mx-auto opacity-70">Convert your web app into a high-performance native Android experience</p>
          <Link 
            to="/new" 
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-bold transition shadow-2xl shadow-slate-900/20 active:scale-95 text-base"
          >
            <Plus size={20} /> New Application
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <Link 
            to="/new" 
            className="group relative block overflow-hidden bg-white border border-slate-200/60 p-4 sm:p-5 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-indigo-600/5 hover:border-indigo-200 transition-all duration-500 active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:rotate-3 transition-all duration-500 shadow-inner border border-indigo-100/50">
                  <Plus size={20} strokeWidth={3} />
                </div>
                <div className="text-left min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight whitespace-nowrap">Create New Project</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-70 whitespace-nowrap">Start a new build</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center group-hover:bg-indigo-600 transition-all duration-500 shadow-lg shadow-slate-900/10 shrink-0">
                <Package size={18} strokeWidth={2} />
              </div>
            </div>
            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-indigo-50/20 rounded-full blur-3xl group-hover:bg-indigo-100/40 transition-colors" />
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
                className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-indigo-600/5 hover:border-indigo-200 transition-all duration-500 cursor-pointer h-full flex flex-col"
              >
                <div className="flex justify-between items-start mb-4 gap-4">
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-sm text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors uppercase leading-tight truncate">{project.appName}</h3>
                     <span className="text-[10px] font-mono text-slate-400 truncate block mt-1 group-hover:text-slate-500 transition-colors tracking-tight">
                       {project.repoUrl.replace('https://github.com/', '').replace(/\/$/, '')}
                     </span>
                   </div>
                   <div className="shrink-0 -mt-0.5">
                     <StatusBadge project={project} />
                   </div>
                </div>

                {project.status === 'building' && (
                  <div className="mb-4">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden shadow-inner">
                      <div className={`bg-indigo-500 h-full transition-all duration-1000 ease-in-out ${project.buildStatusDetails === 'QUEUED' ? 'w-1/4' : project.buildStatusDetails === 'WORKING' ? 'w-2/3 animate-pulse' : 'w-full animate-pulse'}`}></div>
                    </div>
                  </div>
                )}
                
                <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors group-hover:text-slate-500">
                      <Clock size={10} strokeWidth={3} className="text-slate-300" /> {project.createdAt?.toMillis ? new Date(project.createdAt.toMillis()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all">
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              {/* Delete button positioned absolute to not interfere with card click */}
              <div className="absolute right-2 bottom-2 flex justify-end">
                {confirmDeleteId === project.id ? (
                  <div className="bg-white shadow-xl shadow-red-900/10 border border-red-100 p-1 rounded-xl flex items-center gap-1 z-20 animate-in slide-in-from-right-2">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          // Trigger cleanup API
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
                      className="text-[9px] font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1.5 rounded-lg transition"
                    >
                      DEL
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      className="text-[9px] font-bold text-gray-500 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(project.id); }}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete App"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                )}
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
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isBuildEngineOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white text-slate-400 border border-slate-200 group-hover:text-amber-500 group-hover:bg-amber-50'}`}>
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
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
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
                     <div className="whitespace-nowrap px-6 py-2.5 font-mono text-[10px] font-bold text-indigo-400 flex items-center gap-2 animate-pulse bg-indigo-50/50 rounded-xl tracking-widest">
                        <Clock size={14} /> CHECKING_STATUS
                     </div>
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
                          disabled={setupBuilderLoading}
                          className="whitespace-nowrap inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/10 text-xs disabled:opacity-50 active:scale-95"
                       >
                         {setupBuilderLoading ? <Loader2 size={16} className="animate-spin text-white/50" /> : <Plus size={16} />}
                         {setupBuilderLoading ? 'Provisioning...' : 'Provision Builder'}
                       </button>
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
                
                {setupBuilderId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Execution Logs</span>
                      <button 
                        onClick={() => setViewSetupLogs(!viewSetupLogs)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
                      >
                        {viewSetupLogs ? 'Hide Logs' : 'View Logs'}
                      </button>
                    </div>
                    {viewSetupLogs && (
                      <div className="bg-[#0A0A0A] rounded-xl p-4 sm:p-5 text-[10px] font-mono text-gray-300 h-64 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all w-full shadow-inner border border-gray-800 leading-relaxed">
                        {setupLogsText || 'Attaching to builder log stream...'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
