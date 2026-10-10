import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, AlertCircle, Users, ShieldCheck,
  MapPin, ScrollText, Settings, ChevronRight, Activity,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const ACTION_LABELS = {
  application_approve: 'Account approved',
  application_reject:  'Account rejected',
  application_revoke:  'Access revoked',
  status_change_active:  'Account activated',
  status_change_revoked: 'Account suspended',
  status_change_rejected:'Account rejected',
  station_created:     'Station created',
  station_activated:   'Station activated',
  station_deactivated: 'Station deactivated',
  station_updated:     'Station updated',
  settings_updated:    'Settings updated',
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setSummary(await adminApi.summary(token)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner message="Loading dashboard…"/>;

  const kpis = [
    { label: 'Total Users',       value: summary?.total_users ?? '—',          color: 'blue',  to: '/admin/users' },
    { label: 'Pending Approvals', value: summary?.pending_approvals ?? '—',    color: summary?.pending_approvals > 0 ? 'amber' : 'green', to: '/admin/approvals' },
    { label: 'Active Officials',  value: summary?.active_officials ?? '—',     color: 'green', to: '/admin/users' },
    { label: 'Suspended',         value: summary?.suspended_accounts ?? '—',   color: 'red',   to: '/admin/users' },
    { label: 'Stations',          value: summary?.total_stations ?? '—',       color: 'teal',  to: '/admin/stations' },
    { label: 'Active Stations',   value: summary?.active_stations ?? '—',      color: 'green', to: '/admin/stations' },
  ];

  const quickLinks = [
    { to: '/admin/approvals', icon: <ShieldCheck size={20}/>, label: 'Approval Requests', sub: `${summary?.pending_approvals ?? 0} pending`, color: '#2563a8' },
    { to: '/admin/users',     icon: <Users size={20}/>,       label: 'User Management',   sub: `${summary?.total_users ?? 0} registered`, color: '#0d918d' },
    { to: '/admin/stations',  icon: <MapPin size={20}/>,      label: 'Stations',          sub: `${summary?.total_stations ?? 0} total`, color: '#6d28d9' },
    { to: '/admin/audit',     icon: <ScrollText size={20}/>,  label: 'Audit Logs',        sub: 'Recent activity', color: '#ea580c' },
    { to: '/admin/settings',  icon: <Settings size={20}/>,    label: 'System Settings',   sub: 'Platform configuration', color: '#64748b' },
  ];

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">Admin Overview</h1>
          <p className="dash-sub">Platform management — users, approvals, stations, and system settings.</p>
        </div>
        <button className="btn-icon" onClick={load} title="Refresh"><RefreshCw size={16}/></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}

      {summary?.pending_approvals > 0 && (
        <div className="alert-banner alert-info" style={{marginBottom:16}}>
          <ShieldCheck size={15}/>
          <span>
            <strong>{summary.pending_approvals} registration request{summary.pending_approvals > 1 ? 's' : ''}</strong> waiting for your review.
            <Link to="/admin/approvals" className="btn-link" style={{marginLeft:10}}>Review now →</Link>
          </span>
        </div>
      )}

      {/* KPI grid */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        {kpis.map(({ label, value, color, to }) => (
          <Link to={to} key={label} style={{textDecoration:'none'}}>
            <div className={`kpi-card kpi-${color} kpi-link`}>
              <span className="kpi-label">{label}</span>
              <strong className="kpi-value">{value}</strong>
            </div>
          </Link>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Quick links */}
        <div className="panel">
          <div className="panel-header"><h3>Quick Access</h3></div>
          {quickLinks.map(ql => (
            <Link to={ql.to} key={ql.to} className="ql-row">
              <div className="ql-icon" style={{background: ql.color + '18', color: ql.color}}>
                {ql.icon}
              </div>
              <div className="ql-info">
                <strong>{ql.label}</strong>
                <span>{ql.sub}</span>
              </div>
              <ChevronRight size={15} style={{color:'#c0ced3', flexShrink:0}}/>
            </Link>
          ))}
        </div>

        {/* Recent activity */}
        <div className="panel">
          <div className="panel-header">
            <h3>Recent Activity</h3>
            <Link to="/admin/audit" className="btn-link">View all →</Link>
          </div>
          {!summary?.recent_activity?.length ? (
            <div className="empty-card" style={{padding:'20px'}}>
              <Activity size={24}/>
              <strong>No activity yet</strong>
            </div>
          ) : (
            summary.recent_activity.map((a, i) => (
              <div key={i} className="activity-row">
                <div className="activity-dot"/>
                <div className="activity-body">
                  <strong>{ACTION_LABELS[a.action] || a.action.replace(/_/g,' ')}</strong>
                  {a.notes && <span>{a.notes}</span>}
                  <time>{new Date(a.created_at).toLocaleString()}</time>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Role breakdown */}
      <div className="panel" style={{marginTop:16}}>
        <div className="panel-header"><h3>User Breakdown</h3></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
          {[
            { label:'Citizens',        value: summary?.citizens ?? 0,  color:'#0d918d' },
            { label:'Water Analysts',  value: summary?.analysts ?? 0,  color:'#6d28d9' },
            { label:'Field Verifiers', value: summary?.verifiers ?? 0, color:'#ea580c' },
            { label:'Administrators',  value: summary?.admins ?? 0,    color:'#2563a8' },
          ].map(r => (
            <div key={r.label} className="role-breakdown-card" style={{'--rc':r.color}}>
              <span>{r.label}</span>
              <strong>{r.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
