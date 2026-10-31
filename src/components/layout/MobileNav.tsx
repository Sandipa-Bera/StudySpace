import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, BookMarked, Search, Settings, Timer, Trophy } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/ssc', label: 'SSC CGL', icon: Trophy },
  { to: '/pomodoro', label: 'Focus', icon: Timer },
  { to: '/journal', label: 'Journal', icon: BookMarked },
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
