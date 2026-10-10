import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock3, ShieldCheck, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() { logout(); navigate('/login'); }

  return (
    <div className="page-center">
      <div className="pending-card">
        <div className="pending-icon"><Clock3 size={36} /></div>
        <h2>Account Pending Review</h2>
        <p>
          Your official account registration has been received. An administrator will
          review your credentials and approve or reject your access.
        </p>
        <div className="pending-details">
          <div><small>Name</small><b>{user?.full_name}</b></div>
          <div><small>Email</small><b>{user?.email}</b></div>
          <div><small>Role</small><b>{user?.role?.replace('_', ' ')}</b></div>
          {user?.department && <div><small>Department</small><b>{user.department}</b></div>}
          {user?.designation && <div><small>Designation</small><b>{user.designation}</b></div>}
        </div>
        <div className="notice info" style={{ marginTop: 20 }}>
          <ShieldCheck size={17} />
          <span>You will be notified once your account is approved. Until then, privileged features are restricted.</span>
        </div>
        <div className="pending-actions">
          <a href="mailto:admin@aquasentinel.local" className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <Mail size={15} /> Contact Administrator
          </a>
          <button className="secondary" onClick={handleLogout}><LogOut size={15} /> Log out</button>
        </div>
      </div>
    </div>
  );
}
