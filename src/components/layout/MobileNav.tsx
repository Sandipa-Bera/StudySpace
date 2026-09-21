import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, BookMarked, Search, Star, Sparkles, Clock, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/journal', label: 'Journal', icon: BookMarked },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/favorites', label: 'Favorites', icon: Star },
  { to: '/scratchpad', label: 'Scratchpad', icon: Sparkles },
  { to: '/activity', label: 'Activity', icon: Clock },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-items">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
