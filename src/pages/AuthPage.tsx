import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useToast } from '../hooks/useToast';

// ─── Forgot-password inline form ────────────────────────────
function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.requestPasswordReset(email);
      // Always show success – never reveal whether the email is registered
      setSubmitted(true);
    } catch {
      // Show a generic error so we don't expose server details
      setError('Unable to send the reset link right now. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📬</div>
        <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: '0.5rem' }}>
          Check your inbox
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          If an account exists for <strong>{email}</strong>, you'll receive a password-reset link
          shortly.
        </p>
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onBack}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        Enter your email and we'll send you a reset link.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="fp-email">Email</label>
          <input
            id="fp-email"
            type="email"
            className="form-input"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '0.25rem' }}
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="auth-switch" style={{ marginTop: '1rem' }}>
        <button onClick={onBack}>← Back to sign in</button>
      </p>
    </>
  );
}

// ─── Main Auth Page ──────────────────────────────────────────
export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { showToast } = useToast();

  const switchMode = (next: 'login' | 'signup' | 'forgot') => {
    setMode(next);
    setError('');
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Please enter your name.');
          setLoading(false);
          return;
        }
        await authService.signUp(email, password, displayName);
        showToast('Account created! Welcome to StudySpace.');
      } else {
        await authService.signIn(email, password);
        showToast('Welcome back!');
      }
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const tagline =
    mode === 'login'
      ? 'Welcome back. Ready to study?'
      : mode === 'signup'
        ? 'Your personal study notebook awaits.'
        : 'Reset your password';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">StudySpace</div>
        <p className="auth-tagline">{tagline}</p>

        {/* ── Forgot password sub-form ── */}
        {mode === 'forgot' && <ForgotPasswordView onBack={() => switchMode('login')} />}

        {/* ── Login / Signup form ── */}
        {mode !== 'forgot' && (
          <>
            <form onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="display-name">Your name</label>
                  <input
                    id="display-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sandipa"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={mode === 'login'}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label" htmlFor="password">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                {/* Password field with show/hide toggle */}
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: '0.625rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: '0.25rem',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && <p className="form-error">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading
                  ? mode === 'login' ? 'Signing in…' : 'Creating account…'
                  : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
