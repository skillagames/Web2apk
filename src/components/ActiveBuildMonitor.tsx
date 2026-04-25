import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from 'firebase/auth';
import { 
  Loader2, Minimize2, AlertCircle, CheckCircle2, Package, 
  Cpu, X, Box, ExternalLink, HardDrive, Terminal, 
  ChevronDown, ChevronUp, Ban, Download, History,
  Info, Bug, Activity, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ActiveBuildMonitorProps {
  user: User;
}

interface BuildStep {
  name: string;
  status: string;
}

interface BuildLogs {
  [key: string]: string;
}

interface ProjectSteps {
  [key: string]: BuildStep[];
}

export default function ActiveBuildMonitor({ user }: ActiveBuildMonitorProps) {
  const [builds, setBuilds] = useState<any[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<BuildLogs>({});
  const [steps, setSteps] = useState<ProjectSteps>({});
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());
  const logPollIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const stepPollIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});

  useEffect(() => {
    const q = query(
      collection(db, 'projects'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const tenMinsAgo = now - 10 * 60 * 1000;
      
      const allProjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      
      const relevantBuilds = allProjects.filter(p => {
        if (p.status === 'building') return true;
        if (p.dismissedFromMonitor) return false;
        const updatedAt = p.updatedAt?.toMillis() || 0;
        return updatedAt > tenMinsAgo;
      }).sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));

      setBuilds(relevantBuilds);

      const currentBuildingIds = new Set(relevantBuilds.filter(b => b.status === 'building').map(b => b.id));
      for (const id of currentBuildingIds) {
        if (!prevIds.current.has(id)) {
           setIsMinimized(false);
        }
      }
      prevIds.current = currentBuildingIds;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'projects');
    });

    return () => unsubscribe();
  }, [user]);

  // Decouple polling lifecycle from re-renders
  useEffect(() => {
    const buildingProjects = builds.filter(b => b.status === 'building' && b.buildId);
    const activeProjectIds = new Set(buildingProjects.map(b => b.id));

    // Cleanup stale intervals
    Object.keys(stepPollIntervals.current).forEach(id => {
      if (!activeProjectIds.has(id)) {
        clearInterval(stepPollIntervals.current[id]);
        delete stepPollIntervals.current[id];
      }
    });
    Object.keys(logPollIntervals.current).forEach(id => {
      if (!activeProjectIds.has(id) || !expandedLogs.has(id)) {
        clearInterval(logPollIntervals.current[id]);
        delete logPollIntervals.current[id];
      }
    });

    // Start new intervals
    buildingProjects.forEach(project => {
      // Steps/Status Polling
      if (!stepPollIntervals.current[project.id]) {
        const pollSteps = async () => {
          try {
            const res = await fetch(`/api/build/${project.buildId}?projectId=${project.id}`);
            if (!res.ok) return;
            const data = await res.json();
            
            setSteps(prev => ({ ...prev, [project.id]: data.steps || [] }));

            // NO MORE FIRESTORE WRITES FROM THE FRONTEND MONITOR!
            // Status sync is now handled correctly by the backend server to save your quota.
            // We just update local state for the UI.
          } catch (e) {}
        };
        pollSteps();
        stepPollIntervals.current[project.id] = setInterval(pollSteps, 20000); // Very sparse 20s polling for UI only
      }

      // Logs Polling (only if user explicitly expanded the log view)
      if (expandedLogs.has(project.id) && !logPollIntervals.current[project.id]) {
        const pollLogs = async () => {
          try {
            const res = await fetch(`/api/logs/${project.buildId}`);
            if (res.ok) {
              const text = await res.text();
              setLogs(prev => ({ ...prev, [project.id]: text }));
            }
          } catch (e) {}
        };
        pollLogs();
        logPollIntervals.current[project.id] = setInterval(pollLogs, 30000); // 30s for logs (low priority)
      }
    });

    return () => {}; // Refs handle cleanup automatically via the top-level logic
  }, [builds, expandedLogs]);

  const handleDismiss = async (projectId: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        dismissedFromMonitor: true
      });
    } catch (e) {
      console.error("Failed to dismiss", e);
    }
  };

  const handleCancel = async (project: any) => {
    if (!project.buildId || cancellingIds.has(project.id)) return;
    
    setCancellingIds(prev => new Set(prev).add(project.id));
    try {
      const res = await fetch(`/api/build/${project.buildId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error("Failed to cancel");
      
      // Update local state temporarily
      await updateDoc(doc(db, 'projects', project.id), {
        status: 'failed',
        buildStatusDetails: 'CANCELLED',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      alert("Failed to cancel build. It might have already finished.");
    } finally {
      setCancellingIds(prev => {
        const next = new Set(prev);
        next.delete(project.id);
        return next;
      });
    }
  };

  const toggleLogs = async (projectId: string, buildId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
        if (logPollIntervals.current[projectId]) {
           clearInterval(logPollIntervals.current[projectId]);
           delete logPollIntervals.current[projectId];
        }
      } else {
        next.add(projectId);
      }
      return next;
    });

    if (!logs[projectId] && buildId) {
      try {
        const res = await fetch(`/api/logs/${buildId}`);
        if (res.ok) {
          const text = await res.text();
          setLogs(prev => ({ ...prev, [projectId]: text }));
        }
      } catch (e) {}
    }
  };

  const handleCopyLogs = (projectId: string) => {
    const text = logs[projectId];
    if (text) {
      navigator.clipboard.writeText(text);
      alert("Logs copied to clipboard");
    }
  };

  const formatLogs = (text: string) => {
    if (!text) return "Attaching to remote worker logs...";
    
    // Simple syntax highlighting for errors and warnings
    return text.split('\n').map((line, i) => {
      const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
      const isWarning = line.toLowerCase().includes('warn');
      const isSuccess = line.toLowerCase().includes('success') || line.toLowerCase().includes('complete');
      
      return (
        <div key={i} className={`
          ${isError ? 'text-red-400 font-bold' : ''}
          ${isWarning ? 'text-amber-400' : ''}
          ${isSuccess ? 'text-emerald-400' : ''}
        `}>
          {line}
        </div>
      );
    });
  };

  const LogContainer = ({ projectId }: { projectId: string }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const logVal = logs[projectId];

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [logVal]);

    return (
      <div 
        ref={scrollRef}
        className="p-4 font-mono text-[9px] leading-relaxed text-gray-300 h-64 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar selection:bg-blue-500/30"
      >
        {formatLogs(logVal)}
      </div>
    );
  };

  if (builds.length === 0) return null;

  const hasActiveBuilds = builds.some(b => b.status === 'building');

  return (
    <>
      <motion.button
        drag
        dragMomentum={false}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ 
           scale: isMinimized ? 1 : 0.8, 
           opacity: isMinimized ? 1 : 0,
           pointerEvents: isMinimized ? 'auto' : 'none'
        }}
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 left-6 z-50 group bg-[#0A0A0A] border border-gray-800 text-white shadow-2xl rounded-2xl p-4 flex items-center justify-center hover:bg-gray-900 transition-all duration-300 cursor-grab active:cursor-grabbing"
      >
        <div className="relative z-10">
          <Cpu size={24} className={hasActiveBuilds ? "text-blue-400" : "text-gray-400"} />
        </div>
        {hasActiveBuilds && (
           <div className="absolute inset-0 bg-blue-500/20 rounded-2xl animate-pulse" />
        )}
        {hasActiveBuilds && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-[#0A0A0A]" />
        )}
      </motion.button>

      <AnimatePresence>
        {!isMinimized && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="absolute inset-0 bg-blue-950/20 backdrop-blur-[4px] pointer-events-auto"
               onClick={() => setIsMinimized(true)}
            />
            <motion.div
              key="maximized"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white border border-gray-200 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] font-sans relative z-10 pointer-events-auto"
            >
              <div className="bg-[#0A0A0A] text-white px-6 py-5 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-xl border border-blue-400/30 shadow-lg shadow-blue-500/20">
                     <Activity size={18} className="text-white" />
                  </div>
                  <div>
                     <h3 className="font-bold text-base leading-tight text-white tracking-tight">Active Operations</h3>
                     <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">{builds.length} Monitorable Tasks</span>
                       {hasActiveBuilds && (
                         <span className="flex items-center gap-1 text-[10px] text-blue-400 font-bold uppercase animate-pulse">
                           <Loader2 size={10} className="animate-spin" /> Live update
                         </span>
                       )}
                     </div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 p-2 rounded-xl transition-all active:scale-90"
                >
                  <Minimize2 size={18} />
                </button>
              </div>
              
              <div className="overflow-y-auto p-4 space-y-4 bg-gray-50/50 flex-1 custom-scrollbar">
                {builds.map(build => (
                  <div key={build.id} className="border border-gray-200 rounded-2xl p-0 bg-white shadow-sm relative group transition-all hover:border-blue-200 overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 shadow-inner border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden relative">
                          {build.appIconBase64 ? (
                            <img src={build.appIconBase64} alt="icon" className="w-full h-full object-cover" />
                          ) : (
                            <Box className="text-gray-300" size={28} />
                          )}
                          {build.status === 'building' && (
                             <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                             <div>
                               <h4 className="font-bold text-gray-900 truncate text-sm tracking-tight">{build.appName || 'Untitled App'}</h4>
                               <p className="text-[10px] font-mono text-gray-400 uppercase tracking-tight mt-0.5">{build.packageName} v{build.versionName}</p>
                             </div>
                             
                             <div className="flex items-center gap-2">
                               {build.status === 'building' && (
                                 <button
                                   onClick={() => handleCancel(build)}
                                   disabled={cancellingIds.has(build.id)}
                                   className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                   title="Cancel Build"
                                 >
                                   <Ban size={16} />
                                 </button>
                               )}
                               <button 
                                 onClick={() => handleDismiss(build.id)}
                                 className={`${build.status === 'building' ? 'hidden group-hover:block' : 'block'} text-gray-300 hover:text-gray-500 transition-colors`}
                               >
                                 <X size={16} />
                               </button>
                             </div>
                          </div>
                          
                          <div className="mt-3 space-y-3">
                            {build.status === 'building' && (
                               <div className="space-y-2">
                                 <div className="flex items-center justify-between gap-2">
                                   <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-blue-100 shadow-sm">
                                     <Loader2 size={12} className="animate-spin" />
                                     {build.buildStatusDetails === 'QUEUED' ? 'Initializing Cloud Workers...' : 'Building Android Native App...'}
                                   </div>
                                 </div>
                                 <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden shadow-inner">
                                   <motion.div 
                                     initial={{ width: "10%" }}
                                     animate={{ width: "100%" }}
                                     transition={{ duration: 300, repeat: Infinity, ease: "linear" }}
                                     className="bg-blue-500 h-full rounded-full" 
                                   />
                                 </div>
                               </div>
                            )}

                            {build.status === 'failed' && (
                               <div className="space-y-2">
                                 <div className="flex items-center gap-2 text-red-700 bg-red-50 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-red-100">
                                   <AlertCircle size={12} className="text-red-500" />
                                   Build Pipeline Failed
                                 </div>
                                 <div className="bg-red-50/50 px-3 py-2 rounded-xl border border-red-100/50">
                                    <p className="text-[10px] font-mono text-red-600 line-clamp-2 leading-relaxed opacity-80">{build.buildFailureReason || build.buildStatusDetails}</p>
                                 </div>
                               </div>
                            )}

                            {build.status === 'completed' && (
                               <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl p-2.5">
                                 <div className="flex items-center gap-2 text-emerald-700 text-[11px] font-bold">
                                   <CheckCircle2 size={14} className="text-emerald-500" />
                                   Build Complete
                                 </div>
                                 {build.downloadUrl && (
                                   <a 
                                     href={build.downloadUrl}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                   >
                                     <Download size={12} />
                                     Download APK
                                   </a>
                                 )}
                               </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Active Steps */}
                      {steps[build.id] && steps[build.id].length > 0 && build.status === 'building' && (
                        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Activity size={10} /> Progress Steps
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {steps[build.id].map((step, idx) => (
                              <div key={idx} className={`text-[9px] font-bold px-2 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
                                step.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                step.status === 'WORKING' ? 'bg-blue-50 border-blue-100 text-blue-700 animate-pulse' :
                                step.status === 'FAILURE' ? 'bg-red-50 border-red-100 text-red-700' :
                                'bg-gray-50 border-gray-200 text-gray-400'
                              }`}>
                                {step.status === 'SUCCESS' && <CheckCircle2 size={8} />}
                                {step.status === 'WORKING' && <Loader2 size={8} className="animate-spin" />}
                                {step.name.includes('git') ? 'Source' : idx === 1 ? 'Deps' : idx === 2 ? 'Build' : idx === 3 ? 'Capacitor' : idx === 4 ? 'APK' : step.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Logs Section */}
                    <div className="border-t border-gray-100">
                       <button 
                         onClick={() => toggleLogs(build.id, build.buildId)}
                         className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors group/btn"
                       >
                         <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                           <Terminal size={12} className="group-hover/btn:text-blue-500" />
                           {expandedLogs.has(build.id) ? 'Hide Runtime Logs' : 'View Build Diagnostics'}
                         </div>
                         {expandedLogs.has(build.id) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                       </button>

                       <AnimatePresence>
                         {expandedLogs.has(build.id) && (
                           <motion.div
                             initial={{ height: 0, opacity: 0 }}
                             animate={{ height: "auto", opacity: 1 }}
                             exit={{ height: 0, opacity: 0 }}
                             className="bg-[#0A0A0A] overflow-hidden"
                           >
                             <LogContainer projectId={build.id} />
                             <div className="bg-black/50 px-4 py-2 flex items-center justify-between border-t border-gray-800/50">
                               <div className="flex gap-4">
                                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
                                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                     Live Connection
                                  </div>
                                  <button 
                                    onClick={() => handleCopyLogs(build.id)}
                                    className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-white font-bold uppercase transition-colors"
                                  >
                                    <History size={10} /> Copy Logs
                                  </button>
                               </div>
                               <div className="text-[9px] font-mono text-gray-600">ID: {build.buildId}</div>
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                   <Info size={12} /> Monitoring is persistent across sessions
                </p>
                <div className="flex items-center gap-4">
                   <button 
                     onClick={() => setIsMinimized(true)}
                     className="text-[10px] font-bold text-gray-900 uppercase tracking-widest hover:text-blue-600 transition-colors"
                   >
                     Minimize
                   </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb/hover {
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </>
  );
}
