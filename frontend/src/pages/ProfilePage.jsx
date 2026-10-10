import React from 'react';
import { useAuth } from '../AuthContext';
import { UserRound, Mail, Phone, Building2, BadgeCheck } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  const fields = [
    { icon: <Mail size={15} />,      label: 'Email',       value: user.email },
    { icon: <Phone size={15} />,     label: 'Phone',       value: user.phone || '—' },
    { icon: <Building2 size={15} />, label: 'Department',  value: user.department || '—' },
    { icon: <BadgeCheck size={15} />,label: 'Designation', value: user.designation || '—' },
    { icon: <BadgeCheck size={15} />,label: 'Employee ID', value: user.employee_id || '—' },
  ];

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Your account information and status.</p>
      </div>
      <div className="profile-page-card">
        <div className="profile-avatar-lg"><UserRound size={36} /></div>
        <div className="profile-info-main">
          <h2>{user.full_name}</h2>
          <div className="profile-badges">
            <span className="role-badge">{user.role.replace('_', ' ')}</span>
            <StatusBadge status={user.account_status} />
          </div>
        </div>
        <div className="profile-fields">
          {fields.map(f => (
            <div className="profile-field" key={f.label}>
              <span className="profile-field-icon">{f.icon}</span>
              <div>
                <small>{f.label}</small>
                <b>{f.value}</b>
              </div>
            </div>
          ))}
        </div>
        {user.review_reason && (
          <div className="notice info" style={{ marginTop: 16 }}>
            <span>Review note: {user.review_reason}</span>
          </div>
        )}
        <p className="privacy-note" style={{ marginTop: 16 }}>
          To update your account details, contact the administrator. Password changes are not yet available in this version.
        </p>
      </div>
    </div>
  );
}
