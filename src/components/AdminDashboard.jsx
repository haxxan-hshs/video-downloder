import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Shield, ShieldAlert, Users, Database, Video, Clock, LogOut, Loader2 } from 'lucide-react';

const AdminDashboard = () => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Dashboard Data State
  const [allDownloads, setAllDownloads] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hardcoded fallback credentials (used if Supabase admins table doesn't exist yet)
  const FALLBACK_USER = 'usermissing';
  const FALLBACK_PASS = 'whyfail';

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);

    try {
      // First try Supabase admins table
      const { data, error: fetchError } = await supabase
        .from('admins')
        .select('id, username')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (!fetchError && data) {
        // Supabase table found and credentials match
        setIsAdminLoggedIn(true);
        fetchAllDownloads();
      } else if (fetchError && (fetchError.code === '42P01' || fetchError.message?.includes('does not exist') || fetchError.message?.includes('relation'))) {
        // Table doesn't exist yet — use hardcoded fallback
        if (username === FALLBACK_USER && password === FALLBACK_PASS) {
          setIsAdminLoggedIn(true);
          fetchAllDownloads();
        } else {
          setError('Invalid Admin ID or Secret Key. Access denied.');
        }
      } else {
        // Table exists but credentials wrong
        // Also try fallback in case table is empty
        if (username === FALLBACK_USER && password === FALLBACK_PASS) {
          setIsAdminLoggedIn(true);
          fetchAllDownloads();
        } else {
          setError('Invalid Admin ID or Secret Key. Access denied.');
        }
      }
    } catch (err) {
      // Network/unexpected error — try fallback
      if (username === FALLBACK_USER && password === FALLBACK_PASS) {
        setIsAdminLoggedIn(true);
        fetchAllDownloads();
      } else {
        setError('Connection error. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchAllDownloads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('downloads')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAllDownloads(data);
    }
    setLoading(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date)) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric'
    }).format(date);
  };

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!isAdminLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
        <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px', border: '1px solid var(--error)' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
              <ShieldAlert size={32} color="var(--error)" className="animate-pulse-slow" />
            </div>
            <h2 style={{ fontSize: '24px', color: 'var(--error)' }}>Restricted Access</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Authorized Personnel Only</p>
          </div>

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Admin ID</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter Admin ID"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loginLoading}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>Secret Key</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter Secret Key"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loginLoading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ background: 'var(--error)', marginTop: '10px' }}
              disabled={loginLoading}
            >
              {loginLoading ? <><Loader2 size={18} className="animate-spin-fast" /> Verifying...</> : 'Authenticate'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin Panel ─────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Shield size={28} color="var(--error)" />
            Admin Control Panel
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Global monitoring and system oversight.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { setIsAdminLoggedIn(false); setUsername(''); setPassword(''); }}>
          <LogOut size={16} /> End Session
        </button>
      </header>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <Database size={24} color="var(--primary)" />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Total Downloads</p>
            <h3 style={{ fontSize: '24px' }}>{allDownloads.length}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <Users size={24} color="var(--success)" />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Unique Users</p>
            <h3 style={{ fontSize: '24px' }}>{new Set(allDownloads.map(d => d.username)).size}</h3>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '16px', borderRadius: '12px' }}>
            <Clock size={24} color="#f59e0b" />
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Today's Downloads</p>
            <h3 style={{ fontSize: '24px' }}>
              {allDownloads.filter(d => {
                const today = new Date();
                const dl = new Date(d.created_at);
                return dl.toDateString() === today.toDateString();
              }).length}
            </h3>
          </div>
        </div>
      </div>

      {/* Global Activity Table */}
      <div className="glass-panel" style={{ padding: '32px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={20} style={{ color: 'var(--primary)' }} /> Global Download Activity
          </h3>
          <button className="btn btn-secondary" style={{ fontSize: '12px', padding: '6px 14px' }} onClick={fetchAllDownloads}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
            <Loader2 size={18} className="animate-spin-fast" /> Loading data...
          </div>
        ) : allDownloads.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No download activity recorded yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px' }}>#</th>
                <th style={{ padding: '12px 16px' }}>User / Email</th>
                <th style={{ padding: '12px 16px' }}>Video URL</th>
                <th style={{ padding: '12px 16px' }}>Quality / Format</th>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {allDownloads.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px' }}>{index + 1}</td>
                  <td style={{ padding: '16px', fontWeight: 500 }}>{item.username || 'Unknown'}</td>
                  <td style={{ padding: '16px', maxWidth: '260px' }}>
                    <a href={item.url} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none', wordBreak: 'break-all', fontSize: '12px' }}>
                      {item.url}
                    </a>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ padding: '4px 8px', background: 'var(--surface-hover)', borderRadius: '4px', fontSize: '12px' }}>
                      {item.quality} • {item.format?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {formatDate(item.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
