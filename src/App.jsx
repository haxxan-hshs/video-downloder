import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import { DownloadCloud } from 'lucide-react';
import { supabase } from './supabase';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setIsLoggedIn(true);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white' }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <nav style={{ padding: '20px 0', borderBottom: '1px solid var(--border)', background: 'rgba(15, 17, 26, 0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="container flex-between nav-bar">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} className="flex-center" style={{ gap: '12px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))', padding: '8px', borderRadius: '10px' }}>
              <DownloadCloud size={24} color="white" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'white' }}>
              Nexus<span className="primary-gradient-text">Downloader</span>
            </h1>
          </Link>
          {isLoggedIn && (
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </nav>
      
      <main style={{ padding: '40px 0', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={!isLoggedIn ? <Login /> : <Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={isLoggedIn ? <Dashboard user={user} /> : <Navigate to="/" />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>

      <footer style={{ padding: '24px 0', borderTop: '1px solid var(--border)', marginTop: 'auto', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
        <div className="container">
          <p>© {new Date().getFullYear()} NexusDownloader. Premium SaaS Video Management.</p>
        </div>
      </footer>
    </BrowserRouter>
  );
}

export default App;
