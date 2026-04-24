import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { Link } from 'react-router';
import { Plus, CheckCircle2, Clock, AlertCircle, FileCode2 } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  user: User;
}

interface Project {
  id: string;
  appName: string;
  repoUrl: string;
  status: 'draft' | 'building' | 'completed' | 'failed';
  createdAt: string;
}

export default function Dashboard({ user }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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
      projData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setProjects(projData);
      setLoading(false);
    }, (error) => {
      console.error("Dashboard list error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const StatusBadge = ({ status }: { status: Project['status'] }) => {
    switch(status) {
      case 'draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700"><Clock size={12}/> Draft</span>;
      case 'building':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 animate-pulse"><Clock size={12}/> Building...</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 size={12}/> Completed</span>;
      case 'failed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle size={12}/> Failed</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Your Apps</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your web-to-APK transformations.</p>
        </div>
        <Link 
          to="/new" 
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition shadow-sm text-sm"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">New App</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse flex p-4 sm:p-5 rounded-2xl bg-white border border-slate-100 h-24"></div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 border-dashed">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 text-slate-400 mb-4">
            <FileCode2 size={24} />
          </div>
          <h3 className="text-lg font-medium text-slate-800">No apps yet</h3>
          <p className="text-slate-500 mt-1 mb-6 max-w-sm mx-auto text-sm">Create your first project to convert your Google AI Studio app to a native Android APK.</p>
          <Link 
            to="/new" 
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-medium transition text-sm"
          >
            <Plus size={18} /> Get Started
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              key={project.id} 
              className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-100 transition"
            >
              <div>
                <h3 className="font-semibold text-lg text-slate-800 group-hover:text-blue-600 transition">{project.appName}</h3>
                <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-sm text-slate-500 hover:underline hover:text-slate-700 truncate block max-w-xs sm:max-w-sm mt-0.5">
                  {project.repoUrl.replace('https://github.com/', '')}
                </a>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-50">
                <StatusBadge status={project.status} />
                {project.status === 'completed' && (
                  <button className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                    Download APK
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
