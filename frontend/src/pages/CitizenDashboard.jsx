import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle, AlertCircle, MapPin, CheckCircle2,
  Megaphone, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { reportsApi, locationsApi, advisoriesApi, caseEventsApi } from '../api';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const SEV_STYLE = {
  info:     { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af' },
  warning:  { bg: '#fffbeb', border: '#fde68a', color: '#92400e' },
  critical: { bg: '#fef2f2', border: '#fecaca', color: '#991b1b' },
};

function Timeline({ reportId, token }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    caseEventsApi.list(reportId, token).then(setEvents).catch(() => {});
  }, [reportId, token]);
  if (!events.length) return <p style={{ fontSize: 11, color: '#8fa5b0', marginTop: 6 }}>No status updates yet.</p>;
  return (
    <div className="timeline">
      {events.map(e => (
        <div className="tl-item" key={e.id}>
          <div className="tl-dot" />
          <div className="tl-body">
            <strong>{e.to_status.replace(/_/g, ' ')}</strong>
            {e.comment && <p>{e.comment}</p>}
            <time>{new Date(e.created_at).toLocaleString()}</time>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CitizenDashboard() {
  const { user, token } = useAuth();
  const [reports,    setReports]    = useState([]);
  const [locations,  setLocations]  = useState([]);
  const [advisories, setAdvisories] = useState([]);
  const [expanded,   setExpanded]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  useEffect(() => {
    Promise.all([
      reportsApi.list(token),
      locationsApi.list(),
      advisoriesApi.list(),
    ]).then(([r, l, a]) => {
      setReports(r); setLocations(l); setAdvisories(a);
    }).catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner message="Loading your dashboard…" />;

  const resolved = reports.filter(r => r.status === 'resolved').length;
  const pending  = reports.filter(r => r.status === 'pending_review').length;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="dash-header">
        <div>
          <div className="role-pill citizen-pill">CITIZEN</div>
          <h1 className="dash-title">Welcome, {user.full_name.split(' ')[0]}</h1>
          <p className="dash-sub">Report water-quality concerns and track your submissions.</p>
        </div>
        <Link to="/reports/new" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <PlusCircle size={15} /> Report Issue
        </Link>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16} /><span>{error}</span></div>}

      {/* Public advisories */}
      {advisories.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Megaphone size={16} style={{ color: '#ea580c' }} />
              <h3>Public Advisories</h3>
            </div>
          </div>
          {advisories.map(a => {
            const s = SEV_STYLE[a.severity] || SEV_STYLE.info;
            return (
              <div key={a.id} style={{
                background: s.bg, border: `1px solid ${s.border}`,
                borderRadius: 8, padding: '12px 14px', marginBottom: 10,
              }}>
                <strong style={{ color: s.color, display: 'block', marginBottom: 4 }}>{a.title}</strong>
                <p style={{ fontSize: 12, margin: 0, color: '#374151', lineHeight: 1.55 }}>{a.body}</p>
                <time style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, display: 'block' }}>
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        {[
          { label: 'My Reports',   value: reports.length, color: 'blue' },
          { label: 'Pending',      value: pending,        color: pending > 0 ? 'amber' : 'green' },
          { label: 'Resolved',     value: resolved,       color: 'green' },
          { label: 'Under Review', value: reports.filter(r => r.status === 'under_review').length, color: 'teal' },
        ].map(({ label, value, color }) => (
          <div className={`kpi-card kpi-${color}`} key={label}>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="panel">
        <div className="panel-header"><h3>Water Sources Near You</h3></div>
        <MapView locations={locations} reports={reports} height="280px" />
      </div>

      {/* My reports */}
      <div className="panel">
        <div className="panel-header">
          <h3>My Reports ({reports.length})</h3>
          <Link to="/reports/new" className="btn-link">+ New Report</Link>
        </div>

        {reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            body="Submit your first water-quality observation to get started."
            action={
              <Link to="/reports/new" className="btn-primary"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12 }}>
                <PlusCircle size={14} /> Report an Issue
              </Link>
            }
          />
        ) : (
          reports.map(r => (
            <div key={r.id} className="citizen-report-item">
              <div
                className="cri-header"
                onClick={() => setExpanded(e => e === r.id ? null : r.id)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setExpanded(x => x === r.id ? null : r.id)}>
                <div className="cri-left">
                  <span className="tracking-id">AQ-{String(r.id).padStart(5, '0')}</span>
                  <span className="cri-source">{r.source_type.replace('_', ' ')}</span>
                </div>
                <div className="cri-right">
                  <span className={`status-pill status-${r.status === 'resolved' ? 'completed' : r.status === 'under_review' ? 'accepted' : 'new'}`}>
                    {r.status.replace(/_/g, ' ')}
                  </span>
                  <span className="cri-date">{new Date(r.created_at).toLocaleDateString()}</span>
                  {expanded === r.id ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />}
                </div>
              </div>

              {expanded === r.id && (
                <div className="cri-body">
                  <div className="detail-grid">
                    <div><small>Appearance</small><b>{r.appearance?.replace('_', ' ')}</b></div>
                    <div><small>Odor</small><b>{r.odor}</b></div>
                    <div><small>Visible Waste</small><b>{r.visible_waste ? 'Yes' : 'No'}</b></div>
                    <div><small>Risk Score</small><b>{r.risk_score !== null ? `${r.risk_score}/100` : '—'}</b></div>
                  </div>
                  {r.notes && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>{r.notes}</p>}
                  <div className="alert-banner alert-info" style={{ fontSize: 11, padding: '8px 10px', marginTop: 10 }}>
                    <AlertCircle size={13} />
                    <span>UNVERIFIED — preliminary community report. Laboratory confirmation required for official assessment.</span>
                  </div>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: '#374151', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Status Timeline
                  </h4>
                  <Timeline reportId={r.id} token={token} />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
