import React, { useState } from 'react';
import { LogIn, Mail, Lock, Sparkles, Loader2, UserPlus } from 'lucide-react';
import { supabase } from '../supabase';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Registration successful! You can now log in.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
      <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(99, 102, 241, 0.1)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
            <Sparkles size={32} className="primary-gradient-text animate-pulse-slow" style={{ color: 'var(--primary)' }} />
          </div>
          <h2 style={{ fontSize: '28px', marginBottom: '8px' }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            {isSignUp ? 'Sign up to start downloading videos' : 'Log in to access your downloads'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', color: '#fca5a5', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--success)', color: '#6ee7b7', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', fontSize: '14px' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="email"
                className="input-field"
                placeholder="Enter your email"
                style={{ paddingLeft: '42px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="password"
                className="input-field"
                placeholder={isSignUp ? "Create a password (min 6 chars)" : "Enter your password"}
                style={{ paddingLeft: '42px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px', padding: '14px', fontSize: '16px' }} disabled={loading}>
            {loading ? (
              <><Loader2 size={20} className="animate-spin-fast" /> Processing...</>
            ) : isSignUp ? (
              <><UserPlus size={20} /> Sign Up</>
            ) : (
              <><LogIn size={20} /> Sign In to Dashboard</>
            )}
          </button>
        </form>
        
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <button 
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
