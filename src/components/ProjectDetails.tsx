import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, deleteDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Clock, CheckCircle2, AlertCircle, FileCode2, 
  Trash2, Download, Rocket, Loader2, Calendar, 
  ChevronRight, RefreshCw, Hash, LogOut
} from 'lucide-react';

interface Build {
  id: string;
  status: 'building' | 'completed' | 'failed';
  buildStatusDetails?: string;
  buildFailureReason?: string;
  versionName: string;
  versionCode: string;
  logUrl?: string;
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
  const [rebuilding, setRebuilding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    // Project data
    const unsubProject = onSnapshot(doc(db, 'projects', projectId), (docSnap) => {
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() } as Project);
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}`);
    });

    // Build history
    const buildsRef = collection(db, 'projects', projectId, 'builds');
    const q = query(
      buildsRef, 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubBuilds = onSnapshot(q, (snapshot) => {
      const buildData: Build[] = [];
      snapshot.forEach((d) => {
        buildData.push({ id: d.id, ...d.data() } as Build);
      });
      setBuilds(buildData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/builds`);
    });

    // Polling for active builds
    const pollInterval = setInterval(async () => {
      const activeBuilds = builds.filter(b => b.status === 'building' || b.status === 'QUEUED');
      if (activeBuilds.length === 0 && project?.status !== 'building') return;

      // If project status is building, we should poll the project's buildId
      const bIdToPoll = project?.buildId || (activeBuilds.length > 0 ? activeBuilds[0].id : null);
      if (!bIdToPoll) return;

      try {
        const res = await fetch(`/api/build/${bIdToPoll}`);
        if (res.ok) {
          const data = await res.json();
          const newStatus = data.status === 'SUCCESS' ? 'completed' : 
                           (data.status === 'FAILURE' || data.status === 'CANCELLED' || data.status === 'TIMEOUT') ? 'failed' : 
                           'building';
          
          if (newStatus !== 'building') {
            // Update the build doc in subcollection
            await setDoc(doc(db, 'projects', projectId, 'builds', bIdToPoll), {
              status: newStatus,
              buildFailureReason: data.failureInfo || '',
              logUrl: data.logUrl,
              updatedAt: serverTimestamp()
            }, { merge: true });

            // Also update main project if this was the latest build
            if (project?.buildId === bIdToPoll) {
              await setDoc(doc(db, 'projects', projectId), {
                status: newStatus,
                buildStatusDetails: data.status,
                updatedAt: serverTimestamp()
              }, { merge: true });
            }
          } else {
             // Just update the status details for the progress bar
             if (project?.buildId === bIdToPoll && project.buildStatusDetails !== data.status) {
                await setDoc(doc(db, 'projects', projectId), {
                   buildStatusDetails: data.status,
                   updatedAt: serverTimestamp()
                }, { merge: true });
             }
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);

    return () => {
      unsubProject();
      unsubBuilds();
      clearInterval(pollInterval);
    };
  }, [projectId, navigate, project?.buildId, builds]);

  const handleRebuild = async () => {
    if (!project || rebuilding) return;
    setRebuilding(true);

    try {
      // Auto-increment version code
      const nextVersionCode = (parseInt(project.versionCode) + 1).toString();
      
      // Update project with next version code
      await setDoc(doc(db, 'projects', project.id), {
        versionCode: nextVersionCode,
        status: 'building',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Trigger build
      const res = await fetch('/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          repoUrl: project.repoUrl,
          appName: project.appName,
          packageName: project.packageName,
          versionName: project.versionName,
          versionCode: nextVersionCode,
          orientation: project.orientation,
          fullscreen: project.fullscreen,
          allowCleartext: project.allowCleartext,
          permissions: project.permissions,
          doubleTapToExit: project.doubleTapToExit,
          askNotificationsOnLaunch: project.askNotificationsOnLaunch,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start build');
      }

      if (data.success && data.buildId) {
        const bId = data.buildId;
        // Update project with buildId
        await setDoc(doc(db, 'projects', project.id), {
          buildId: bId,
          versionCode: nextVersionCode,
          status: 'building',
          buildStatusDetails: 'QUEUED',
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Create record in builds subcollection
        const buildDocRef = doc(collection(db, 'projects', project.id, 'builds'), bId);
        await setDoc(buildDocRef, {
          id: bId,
          userId: user.uid,
          status: 'building',
          versionName: project.versionName,
          versionCode: nextVersionCode,
          createdAt: serverTimestamp()
        });
      }
      
    } catch (err: any) {
      alert(`Rebuild failed: ${err.message}`);
    } finally {
      setRebuilding(false);
    }
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
      const buildsSnap = await getDocs(buildsRef);
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
        window.open(data.url, '_blank');
      } else {
        alert(data.error || 'Failed to get download URL');
      }
    } catch (e) {
      alert('Download error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-gray-500 font-medium italic">Loading project details...</p>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-4">
          <Link 
            to="/" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition tracking-widest uppercase bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm"
          >
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              {project.appName}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">
              {project.packageName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleRebuild}
            disabled={rebuilding || project.status === 'building'}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
          >
            {rebuilding || project.status === 'building' ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            Build New Version
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Stats & Config */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Project Configuration</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Repository</span>
                  <span className="font-medium text-gray-900 truncate max-w-[120px]">{project.repoUrl.split('/').pop()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Current Version</span>
                  <span className="font-mono text-blue-600 font-bold">v{project.versionName} ({project.versionCode})</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Orientation</span>
                  <span className="capitalize font-medium text-gray-900">{project.orientation}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Enabled Permissions</h3>
              <div className="flex flex-wrap gap-2">
                {project.permissions.map(p => (
                  <span key={p} className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg font-mono text-[10px] text-gray-600">{p}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Build History */}
        <div className="lg:col-span-2">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Build History</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 opacity-70">Audit trail of {builds.length} total builds</p>
          </div>
          
          <div className="space-y-4">
            {builds.length === 0 && project.status !== 'building' ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center">
                <Rocket className="mx-auto text-gray-300 mb-4" size={40} />
                <p className="text-gray-500 font-medium">No builds found. Start your first build!</p>
              </div>
            ) : (
              <>
                {/* Current Active Build if any */}
                {(project.status === 'building' || (builds[0]?.status === 'building')) && (
                  <div className="bg-blue-50 border border-blue-200 p-5 rounded-3xl animate-pulse flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white">
                        <Clock size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-blue-900 text-sm">Versioning v{project.versionName} ({project.versionCode})</h4>
                        <p className="text-xs text-blue-700 font-medium">Current Build in Progress...</p>
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
                    className="bg-white p-5 rounded-3xl border border-gray-200 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] hover:border-gray-300 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
                          build.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                          build.status === 'failed' ? 'bg-red-50 text-red-600' : 
                          'bg-blue-50 text-blue-600'
                        }`}>
                          {build.status === 'completed' ? <CheckCircle2 size={20} /> : 
                           build.status === 'failed' ? <AlertCircle size={20} /> : 
                           <Clock size={20} className="animate-spin" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-sm">v{build.versionName}</h4>
                            <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">CODE_{build.versionCode}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                            <Calendar size={10} /> {build.createdAt?.toMillis ? new Date(build.createdAt.toMillis()).toLocaleString() : 'Just now'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {build.status === 'completed' && (
                          <button 
                            onClick={() => downloadApk(build)}
                            className="bg-gray-900 hover:bg-gray-800 text-white p-2.5 rounded-xl transition shadow-xl shadow-gray-900/10 active:scale-95 flex items-center gap-2 px-4"
                          >
                            <Download size={16} />
                            <span className="text-xs font-bold">APK</span>
                          </button>
                        )}
                        {build.status === 'failed' && (
                           <div className="text-right">
                              <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider block">Build Failed</span>
                              {build.buildFailureReason && (
                                <span className="text-[10px] text-gray-400 truncate max-w-[150px] block" title={build.buildFailureReason}>
                                  {build.buildFailureReason}
                                </span>
                              )}
                           </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete App?</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                This will permanently delete <span className="font-bold text-gray-900">{project.appName}</span> and all its build history and hosted APK files. This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition"
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
