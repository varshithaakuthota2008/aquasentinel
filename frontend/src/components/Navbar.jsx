import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Droplets, LogOut, Menu, X, UserRound, Bell } from 'lucide-react';
import { useAuth } from '../AuthContext';
import NotificationBell from './NotificationBell';

const ROLE_LABELS = {
  citizen:        'Citizen',
  water_authority:'Water Analyst',
  field_inspector:'Field Verifier',
  admin:          'Administrator',
};

const ROLE_COLORS = {
  citizen:        '#0d918d',
  water_authority:'#6d28d9',
  field_inspector:'#ea580c',
  admin:          '#2563a8',
};

export default function Navbar({ onMenuToggle, menuOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="topnav">
      <div className="topnav-left">
        {user && (
          <button className="topnav-hamburger" onClick={onMenuToggle} aria-label="Toggle navigation">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}
        <Link to={user ? '/dashboard' : '/login'} className="topnav-brand">
          <span className="brand-icon"><Droplets size={20} /></span>
          <span className="brand-text">
            <strong>AquaSentinel</strong>
            <span className="brand-sub">SDG 6 · Water Quality</span>
          </span>
        </Link>
      </div>

      <div className="topnav-right">
        {user ? (
          <>
            <NotificationBell />
            <div className="topnav-user">
              <div className="topnav-avatar" style={{ background: ROLE_COLORS[user.role] + '20', color: ROLE_COLORS[user.role] }}>
                <UserRound size={16} />
              </div>
              <div className="topnav-info">
                <span className="topnav-name">{user.full_name}</span>
                <span className="topnav-role" style={{ color: ROLE_COLORS[user.role] }}>
                  {ROLE_LABELS[user.role] || user.role}
                </span>
              </div>
              <button className="topnav-logout" onClick={handleLogout} title="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          </>
        ) : (
          <span className="topnav-sdg">SDG 6 · Clean Water</span>
        )}
      </div>
    </header>
  );
}
