import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router';
import { Plus, CheckCircle2, Clock, AlertCircle, FileCode2, Trash2, Copy, Check, Loader2, ChevronRight, ChevronDown, ChevronUp, Settings, Terminal, Shield, Package, Folder } from 'lucide-react';
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
  createdAt: any;
}

export default function Projects({ user }: DashboardProps) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [viewLogsId, setViewLogsId] = useState<string | null>(null);
  const [logsText, setLogsText] = useState<string>('Loading logs...');
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  
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
    // Global polling is now handled by ActiveBuildMonitor to optimize Firebase quota
  }, []);

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
        const failureReason = (project as any).buildFailureReason || project.buildStatusDetails;
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-tight max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap border border-red-100/50" title={failureReason}>
            <AlertCircle className="shrink-0" size={12} strokeWidth={2.5}/> FAILED {failureReason ? `(${failureReason})` : ''}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 slide-in-from-bottom-4 relative">
      <div className="sticky top-[72px] z-30 bg-slate-50/90 backdrop-blur-md py-3 md:py-4 px-2 sm:px-4 border-b border-slate-200/80 mb-8 flex items-center justify-between -mx-2 sm:-mx-4">
        <div className="min-w-0 flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-b from-slate-800 to-blue-950 shadow-md shadow-slate-900/10 border border-slate-900/50 flex items-center justify-center shrink-0 overflow-hidden text-white">
            <div className="absolute -bottom-4 w-[150%] h-8 bg-blue-500/50 blur-md rounded-full"></div>
            <Folder size={24} strokeWidth={2.5} className="relative z-10 drop-shadow-sm" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-900 tracking-tight leading-none mb-0.5">Your Projects</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Manage Applications</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="animate-pulse bg-white border border-slate-100 rounded-[32px] h-48 shadow-sm"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[40px] border-2 border-slate-100 border-dashed shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-slate-50 text-slate-400 mb-4 border border-slate-100 shadow-inner">
            <FileCode2 size={24} className="stroke-[1.5px]" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Start Building</h2>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-2 mb-6 max-w-xs mx-auto opacity-70">Convert your web app into a high-performance native Android experience</p>
          <Link 
            to="/new" 
            className="inline-flex items-center gap-2 bg-blue-950 hover:bg-black text-white px-6 py-3 rounded-2xl font-bold transition shadow-2xl shadow-blue-950/20 active:scale-95 text-sm"
          >
            <Plus size={18} /> New Application
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <div className="mb-4">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden shadow-inner">
                      <div className={`bg-blue-500 h-full transition-all duration-1000 ease-in-out ${project.buildStatusDetails === 'QUEUED' ? 'w-1/4' : project.buildStatusDetails === 'WORKING' ? 'w-2/3 animate-pulse' : 'w-full animate-pulse'}`}></div>
                    </div>
                  </div>
                )}
                
                <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors group-hover:text-slate-500">
                      <Clock size={10} strokeWidth={3} className="text-slate-300" /> {project.createdAt?.toMillis ? new Date(project.createdAt.toMillis()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-slate-100 group-hover:text-blue-500 transform group-hover:translate-x-1 transition-all">
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

    </div>
  );
}