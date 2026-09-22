import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  Search,
  Star,
  Sparkles,
  Clock,
  Settings,
  LogOut,
  Timer,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/journal', label: 'Journal', icon: BookMarked },
  { to: '/pandora-timer', label: 'Pandora Timer', icon: Timer },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { signOut } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch {
      showToast('Failed to sign out', 'error');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        Study<span>Space</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </button>
      </div>
    </aside>
  );
}
