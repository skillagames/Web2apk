import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import ProjectForm from './components/ProjectForm';
import ProjectDetails from './components/ProjectDetails';
import { Layout } from './components/Layout';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex bg-slate-50 min-h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout user={user} />}>
        <Route 
          index 
          element={user ? <Dashboard user={user} /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="projects" 
          element={user ? <Projects user={user} /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="new" 
          element={user ? <ProjectForm user={user} /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="project/:projectId" 
          element={user ? <ProjectDetails user={user} /> : <Navigate to="/auth" replace />} 
        />
        <Route 
          path="auth" 
          element={!user ? <AuthScreen /> : <Navigate to="/" replace />} 
        />
      </Route>
    </Routes>
  );
}
