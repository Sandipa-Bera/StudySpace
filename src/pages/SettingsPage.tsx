import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Palette, User, Sliders } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../hooks/useTheme';
import { themes } from '../themes';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    (user as { user_metadata?: { display_name?: string } } | null)?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'User';

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate('/auth');
    } catch {
      showToast('Failed to sign out', 'error');
      setSigningOut(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.2s ease', maxWidth: 560 }}>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize your StudySpace experience.</p>
      </div>

      {/* Appearance */}
      <div className="settings-section">
        <div className="settings-label">
          <Palette size={14} style={{ marginRight: '0.375rem', display: 'inline-block' }} />
          Appearance
        </div>
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.5rem', fontWeight: 500 }}>
              Theme
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {Object.values(themes).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: theme === t.id ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: theme === t.id ? t.colors.background : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (theme !== t.id) {
                      e.currentTarget.style.borderColor = t.colors.secondary;
                      e.currentTarget.style.background = t.colors.background;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (theme !== t.id) {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: t.colors.primary,
                      }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                      {t.name}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                    {theme === t.id ? '✓ Current' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="settings-section">
        <div className="settings-label">
          <User size={14} style={{ marginRight: '0.375rem', display: 'inline-block' }} />
          Account
        </div>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Name</div>
              <div style={{ fontWeight: 500, color: 'var(--text)' }}>{displayName}</div>
            </div>
            <div className="divider" style={{ margin: '0.5rem 0' }} />
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.15rem' }}>Email</div>
              <div style={{ color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="settings-section">
        <div className="settings-label">
          <Sliders size={14} style={{ marginRight: '0.375rem', display: 'inline-block' }} />
          Preferences
        </div>
        <div className="card">
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Additional preferences coming soon...
          </div>
        </div>
      </div>

      {/* About */}
      <div className="settings-section">
        <div className="settings-label">About</div>
        <div className="card">
          <div style={{ fontFamily: 'Lora, serif', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.375rem' }}>
            StudySpace
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
            Your personal study management and journaling application. Organize your subjects, 
            chapters, topics, track progress, and write your daily journal — all in one calm space.
          </p>
        </div>
      </div>

      {/* Sign out */}
      <div className="settings-section">
        <div className="settings-label">Session</div>
        <button
          className="btn btn-danger"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <LogOut size={15} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
