import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Target,
  RefreshCw,
  BarChart2,
  ClipboardList,
  Calendar,
  Settings,
} from 'lucide-react';

const SSC_NAV = [
  { to: '/ssc',            label: 'Overview',    icon: LayoutDashboard, end: true },
  { to: '/ssc/syllabus',   label: 'Syllabus',    icon: BookOpen },
  { to: '/ssc/priority',   label: 'Priority',    icon: Target },
  { to: '/ssc/revision',   label: 'Revision',    icon: RefreshCw },
  { to: '/ssc/practice',   label: 'Practice',    icon: BarChart2 },
  { to: '/ssc/mock-tests', label: 'Mock Tests',  icon: ClipboardList },
  { to: '/ssc/calendar',   label: 'Calendar',    icon: Calendar },
  { to: '/ssc/settings',   label: 'Settings',    icon: Settings },
];

export function SscNav() {
  return (
    <nav className="ssc-subnav" aria-label="SSC CGL sections">
      {SSC_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `ssc-subnav-item${isActive ? ' active' : ''}`
          }
        >
          <Icon size={14} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
