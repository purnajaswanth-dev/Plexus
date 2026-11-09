import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Building2, ShieldCheck, Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const AuthPage = ({ initialMode = 'login', onAuthenticated }) => {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'forgot' | 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
        if (onAuthenticated) onAuthenticated();
      } else if (mode === 'signup') {
        const data = await signUp({
          email: email.trim(),
          password,
          displayName: displayName.trim()
        });
        if (data?.user && !data.session) {
          setMode('verify');
          setSuccessMessage('Registration successful! Please check your email inbox to verify your account before logging in.');
        } else {
          if (onAuthenticated) onAuthenticated();
        }
      } else if (mode === 'forgot') {
        await resetPassword(email.trim());
        setSuccessMessage('Password reset instructions have been sent to your email.');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F9F8F6',
      padding: '24px',
      fontFamily: 'inherit',
      color: '#39332E'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #D9CFC7',
        boxShadow: '0 8px 24px -4px rgba(57, 51, 46, 0.08), 0 2px 6px -1px rgba(57, 51, 46, 0.04)',
        padding: '36px 32px',
        boxSizing: 'border-box'
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: '#EFE9E3',
            color: '#39332E',
            border: '1px solid #D9CFC7',
            marginBottom: '12px'
          }}>
            <Building2 size={24} color="#7A5C38" />
          </div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 700,
            margin: '0 0 6px 0',
            letterSpacing: '-0.02em',
            color: '#39332E'
          }}>
            CodeCity Metropolis
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#62574E',
            margin: 0,
            lineHeight: 1.4
          }}>
            {mode === 'login' && 'Sign in to access your repository architecture workspace'}
            {mode === 'signup' && 'Create your account to index and visualize your software architecture'}
            {mode === 'forgot' && 'Reset your CodeCity workspace password'}
            {mode === 'verify' && 'Account confirmation required'}
          </p>
        </div>

        {/* Tab switch for Login / Signup */}
        {(mode === 'login' || mode === 'signup') && (
          <div style={{
            display: 'flex',
            background: '#EFE9E3',
            borderRadius: '8px',
            padding: '3px',
            marginBottom: '22px'
          }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: mode === 'login' ? '#FFFFFF' : 'transparent',
                color: mode === 'login' ? '#39332E' : '#81776F',
                boxShadow: mode === 'login' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(null); }}
              style={{
                flex: 1,
                padding: '7px 0',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: mode === 'signup' ? '#FFFFFF' : 'transparent',
                color: mode === 'signup' ? '#39332E' : '#81776F',
                boxShadow: mode === 'signup' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(183, 101, 93, 0.12)',
            border: '1px solid #B7655D',
            color: '#B7655D',
            fontSize: '12px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'rgba(100, 131, 107, 0.12)',
            border: '1px solid #64836B',
            color: '#64836B',
            fontSize: '12px',
            marginBottom: '18px'
          }}>
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            <div style={{ flex: 1, lineHeight: 1.4 }}>{successMessage}</div>
          </div>
        )}

        {/* Form View */}
        {mode !== 'verify' ? (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#62574E' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="#81776F" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px 9px 34px',
                      fontSize: '13px',
                      background: '#F9F8F6',
                      border: '1px solid #D9CFC7',
                      borderRadius: '6px',
                      outline: 'none',
                      color: '#39332E'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '5px', color: '#62574E' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#81776F" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="email"
                  required
                  placeholder="developer@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '9px 12px 9px 34px',
                    fontSize: '13px',
                    background: '#F9F8F6',
                    border: '1px solid #D9CFC7',
                    borderRadius: '6px',
                    outline: 'none',
                    color: '#39332E'
                  }}
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#62574E' }}>
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null); }}
                      style={{
                        border: 'none',
                        background: 'none',
                        color: '#7A5C38',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="#81776F" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '9px 12px 9px 34px',
                      fontSize: '13px',
                      background: '#F9F8F6',
                      border: '1px solid #D9CFC7',
                      borderRadius: '6px',
                      outline: 'none',
                      color: '#39332E'
                    }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                marginTop: '10px',
                padding: '10px 16px',
                background: '#C9B59C',
                border: '1px solid #B8A085',
                borderRadius: '6px',
                color: '#39332E',
                fontSize: '13px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 1px 2px rgba(57, 51, 46, 0.08)'
              }}
            >
              {loading ? 'Processing...' : (
                <>
                  <span>
                    {mode === 'login' && 'Sign In to Workspace'}
                    {mode === 'signup' && 'Create Developer Account'}
                    {mode === 'forgot' && 'Send Reset Instructions'}
                  </span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <div style={{ textAlign: 'center', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); }}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#62574E',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(null); setSuccessMessage(null); }}
              style={{
                padding: '9px 18px',
                background: '#C9B59C',
                border: '1px solid #B8A085',
                borderRadius: '6px',
                color: '#39332E',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Sign In
            </button>
          </div>
        )}

        {/* Security badge footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          marginTop: '28px',
          paddingTop: '16px',
          borderTop: '1px solid #EFE9E3',
          fontSize: '11px',
          color: '#81776F'
        }}>
          <ShieldCheck size={14} color="#64836B" />
          <span>Stateless JWT Authentication with Supabase & Neon</span>
        </div>
      </div>
    </div>
  );
};

