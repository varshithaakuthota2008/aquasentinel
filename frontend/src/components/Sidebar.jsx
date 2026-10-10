import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MapPin, Users, UserRound,
  PlusCircle, BarChart2, FlaskConical, Upload,
  ClipboardList, Activity, ShieldCheck, ScrollText,
  Megaphone, FileText, Settings,
} from 'lucide-react';
import { useAuth } from '../AuthContext';

const NAV = {
  citizen: [
    { to: '/citizen',     icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/reports/new', icon: <PlusCircle size={16} />,      label: 'Report Issue' },
    { to: '/locations',   icon: <MapPin size={16} />,          label: 'Water Sources' },
    { to: '/profile',     icon: <UserRound size={16} />,       label: 'My Profile' },
  ],
  water_authority: [
    { to: '/authority',      icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/monitoring',     icon: <Activity size={16} />,        label: 'Monitoring' },
    { to: '/import',         icon: <Upload size={16} />,          label: 'Import Data' },
    { to: '/analyst/assign', icon: <ClipboardList size={16} />,   label: 'Assign Inspection' },
    { to: '/locations',      icon: <MapPin size={16} />,          label: 'Locations' },
    { to: '/analytics',      icon: <BarChart2 size={16} />,       label: 'Analytics' },
    { to: '/profile',        icon: <UserRound size={16} />,       label: 'My Profile' },
  ],
  field_inspector: [
    { to: '/inspector',                 icon: <LayoutDashboard size={16} />, label: 'My Assignments' },
    { to: '/verifier/observations/new', icon: <FlaskConical size={16} />,    label: 'Submit Observation' },
    { to: '/inspections/new',           icon: <PlusCircle size={16} />,      label: 'New Inspection' },
    { to: '/locations',                 icon: <MapPin size={16} />,          label: 'Locations' },
    { to: '/profile',                   icon: <UserRound size={16} />,       label: 'My Profile' },
  ],
  admin: [
    { to: '/admin',              icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { to: '/admin/users',        icon: <Users size={16} />,           label: 'User Management' },
    { to: '/admin/approvals',    icon: <ShieldCheck size={16} />,     label: 'Approval Requests' },
    { to: '/admin/stations',     icon: <MapPin size={16} />,          label: 'Stations' },
    { to: '/admin/audit',        icon: <ScrollText size={16} />,      label: 'Audit Logs' },
    { to: '/admin/settings',     icon: <Settings size={16} />,        label: 'System Settings' },
    { to: '/profile',            icon: <UserRound size={16} />,       label: 'My Profile' },
  ],
};

const ROLE_DISPLAY = {
  citizen:         { label: 'Citizen',        color: '#0d918d' },
  water_authority: { label: 'Water Analyst',  color: '#6d28d9' },
  field_inspector: { label: 'Field Verifier', color: '#ea580c' },
  admin:           { label: 'Administrator',  color: '#2563a8' },
};

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  if (!user) return null;
  const links = NAV[user.role] || [];
  const rd = ROLE_DISPLAY[user.role] || { label: user.role, color: '#0d918d' };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Role badge */}
        <div className="sidebar-role" style={{ borderLeftColor: rd.color }}>
          <span style={{ color: rd.color, fontWeight: 800, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            {rd.label}
          </span>
        </div>

        <nav className="sidebar-nav">
          {links.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>Team Garuda · TS-015</span>
          <span>SDG 6.3</span>
        </div>
      </aside>
    </>
  );
}
