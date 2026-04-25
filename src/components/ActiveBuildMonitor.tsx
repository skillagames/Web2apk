import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Loader2, Minimize2, AlertCircle, CheckCircle2, Package, Cpu, X, Box, ExternalLink, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ActiveBuildMonitorProps {
  user: User;
}

export default function ActiveBuildMonitor({ user }: ActiveBuildMonitorProps) {
  const [builds, setBuilds] = useState<any[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const prevIds = useRef<Set<string>>(new Set());

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

  const handleDismiss = async (projectId: string) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        dismissedFromMonitor: true
      });
    } catch (e) {
      console.error("Failed to dismiss", e);
    }
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
               className="absolute inset-0 bg-black/10 backdrop-blur-[2px] pointer-events-auto"
               onClick={() => setIsMinimized(true)}
            />
            <motion.div
              key="maximized"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="bg-white border border-gray-200 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] font-sans relative z-10 pointer-events-auto"
            >
              <div className="bg-[#0A0A0A] text-white px-5 py-4 flex items-center justify-between border-b border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="bg-blue-500/20 p-1.5 rounded-lg border border-blue-500/30">
                     <Cpu size={16} className="text-blue-400" />
                  </div>
                  <div>
                     <h3 className="font-semibold text-sm leading-tight text-white tracking-wide">Build Monitor</h3>
                     <span className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">Active Tasks: {builds.length}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 p-1.5 rounded-md transition-colors"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
              
              <div className="overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                {builds.map(build => (
                  <div key={build.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm relative group transition-all hover:border-gray-300">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-50 shadow-inner border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                        {build.appIconBase64 ? (
                          <img src={build.appIconBase64} alt="icon" className="w-full h-full object-cover" />
                        ) : (
                          <Box className="text-gray-400" size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                           <h4 className="font-semibold text-gray-900 truncate text-sm">{build.appName || 'Untitled App'}</h4>
                        </div>
                        
                        <a href={build.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 truncate mt-1 w-full transition-colors group/link">
                           <ExternalLink size={12} className="shrink-0 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                           <span className="truncate">{build.repoUrl.replace('https://github.com/', '')}</span>
                        </a>
                        
                        <div className="mt-3">
                          {build.status === 'building' && (
                             <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-2 text-blue-700 bg-blue-50/80 px-3 py-2 rounded-lg text-xs font-semibold border border-blue-100/50 shadow-inner">
                                 <Loader2 size={14} className="animate-spin text-blue-500" />
                                 {build.buildStatusDetails === 'QUEUED' ? 'Queued for build...' : 'Compiling APK...'}
                               </div>
                               <div className="w-full bg-blue-100/50 rounded-full h-1.5 overflow-hidden">
                                 <div className="bg-blue-500 h-1.5 rounded-full animate-pulse w-full"></div>
                               </div>
                             </div>
                          )}
                          {build.status === 'failed' && (
                             <div className="flex flex-col gap-2">
                               <div className="flex items-center gap-2 text-red-700 bg-red-50/80 px-3 py-2 rounded-lg text-xs font-semibold border border-red-100/50">
                                 <AlertCircle size={14} className="text-red-500" />
                                 Build Failed
                               </div>
                               <div className="bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                                  <p className="text-[11px] font-mono text-red-600 line-clamp-3 leading-relaxed">{build.buildFailureReason || build.buildStatusDetails}</p>
                               </div>
                             </div>
                          )}
                          {build.status === 'completed' && (
                             <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50/80 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-100/50">
                               <CheckCircle2 size={14} className="text-emerald-500" />
                               Ready to Download
                             </div>
                          )}
                        </div>

                        {build.permissions && build.permissions.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                               <HardDrive size={10} /> App Permissions
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {build.permissions.map((p: string) => (
                                <span key={p} className="text-[10px] font-mono bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-md text-gray-600 shadow-sm">
                                  {p.replace('ACCESS_', '').replace('RECORD_', '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {build.status !== 'building' && (
                      <button 
                        onClick={() => handleDismiss(build.id)}
                        className="absolute -top-2 -right-2 text-gray-400 hover:text-gray-700 bg-white shadow-md hover:shadow-lg border border-gray-200 rounded-full p-1.5 transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
