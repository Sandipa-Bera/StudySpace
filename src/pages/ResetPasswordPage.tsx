import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth.service';
import { useToast } from '../hooks/useToast';

/**
 * /reset-password
 *
 * Supabase sends the user here after they click the reset-password email link.
 * The URL contains a one-time token in the hash that Supabase detects via
 * `detectSessionInUrl: true` in the client config. We listen for the
 * PASSWORD_RECOVERY event to confirm the session before allowing the update.
 */
export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);   // true once PASSWORD_RECOVERY session is confirmed
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event that Supabase fires when the
    // one-time token in the URL is exchanged for a valid session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await authService.updatePassword(password);
      setDone(true);
      showToast('Password updated! Please sign in.');
      // Sign the user out so they must log in with the new password
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">StudySpace</div>
        <p className="auth-tagline">Set a new password</p>

        {done ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
            Password updated. Redirecting to sign-in…
          </p>
        ) : !ready ? (
          /* Waiting for the PASSWORD_RECOVERY event */
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
            Verifying your reset link…
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* New password */}
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute', right: '0.625rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    padding: '0.25rem', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Repeat your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  style={{ paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  onClick={() => setShowConfirm((v) => !v)}
                  style={{
                    position: 'absolute', right: '0.625rem', top: '50%',
                    transform: 'translateY(-50%)', background: 'none', border: 'none',
                    padding: '0.25rem', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
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
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
