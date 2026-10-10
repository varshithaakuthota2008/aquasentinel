import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, AlertCircle, CheckCircle2, Clock,
  ChevronRight, FlaskConical, Navigation, MapPin,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { assignmentsApi, reportsApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const STATUS_LABEL = {
  new: 'New', accepted: 'Accepted', in_progress: 'In Progress',
  submitted: 'Submitted', reviewed: 'Reviewed', completed: 'Completed',
  returned: 'Corrections Needed', overdue: 'Overdue',
};
const STATUS_CLS = {
  new: 'status-pill status-new', accepted: 'status-pill status-accepted',
  in_progress: 'status-pill status-inprog', submitted: 'status-pill status-submitted',
  reviewed: 'status-pill status-reviewed', completed: 'status-pill status-completed',
  returned: 'status-pill status-returned', overdue: 'status-pill status-overdue',
};

const FILTER_OPTIONS = ['all', 'new', 'accepted', 'in_progress', 'submitted', 'returned', 'overdue'];

export default function FieldVerifierDashboard() {
  const { user, token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [reports,     setReports]     = useState([]);
  const [filter,      setFilter]      = useState('all');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [actionBusy,  setActionBusy]  = useState({});
  const [msg,         setMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [a, r] = await Promise.all([
        assignmentsApi.list(token),
        reportsApi.list(token, '?limit=50'),
      ]);
      setAssignments(a); setReports(r);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function accept(id) {
    setActionBusy(b => ({ ...b, [id]: true }));
    try {
      await assignmentsApi.updateStatus(id, 'accepted', token);
      setAssignments(a => a.map(x => x.id === id ? { ...x, status: 'accepted' } : x));
      setMsg(`Assignment #${id} accepted.`);
    } catch(e) { setError(e.message); }
    finally { setActionBusy(b => ({ ...b, [id]: false })); }
  }

  if (loading) return <LoadingSpinner message="Loading your assignments…" />;

  const displayed = filter === 'all' ? assignments : assignments.filter(a => a.status === filter);
  const counts = FILTER_OPTIONS.reduce((acc, s) => {
    acc[s] = s === 'all' ? assignments.length : assignments.filter(a => a.status === s).length;
    return acc;
  }, {});

  const newCount      = counts.new || 0;
  const returnedCount = counts.returned || 0;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="dash-header">
        <div>
          <div className="role-pill verifier-pill">FIELD VERIFIER</div>
          <h1 className="dash-title">My Assignments</h1>
          <p className="dash-sub">Welcome back, {user.full_name.split(' ')[0]}. Manage your field inspections.</p>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={16} /></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16} /><span>{error}</span></div>}
      {msg   && <div className="alert-banner alert-success"><CheckCircle2 size={16} /><span>{msg}</span></div>}

      {/* Banners */}
      {newCount > 0 && (
        <div className="alert-banner alert-info">
          <Clock size={15} />
          <span><strong>{newCount} new assignment{newCount > 1 ? 's' : ''}</strong> awaiting your acceptance.</span>
        </div>
      )}
      {returnedCount > 0 && (
        <div className="alert-banner alert-error">
          <AlertCircle size={15} />
          <span><strong>{returnedCount} assignment{returnedCount > 1 ? 's' : ''}</strong> returned — corrections required.</span>
        </div>
      )}

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
        {[
          { label: 'New',         value: counts.new || 0,         color: 'blue' },
          { label: 'Accepted',    value: counts.accepted || 0,    color: 'teal' },
          { label: 'In Progress', value: counts.in_progress || 0, color: 'amber' },
          { label: 'Submitted',   value: counts.submitted || 0,   color: 'teal' },
          { label: 'Returned',    value: counts.returned || 0,    color: 'red' },
          { label: 'Completed',   value: counts.completed || 0,   color: 'green' },
        ].map(({ label, value, color }) => (
          <div className={`kpi-card kpi-${color}`} key={label}>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="filter-strip">
        {FILTER_OPTIONS.map(s => (
          <button key={s}
            className={`filter-chip ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : STATUS_LABEL[s] || s}
            {s !== 'all' && counts[s] > 0 && <span className="chip-count">{counts[s]}</span>}
          </button>
        ))}
      </div>

      {/* Assignment cards */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={32} style={{ color: '#a0b4bc' }} />}
          title={filter === 'all' ? 'No assignments yet' : `No ${STATUS_LABEL[filter] || filter} assignments`}
          body="New assignments from analysts will appear here."
        />
      ) : (
        <div className="verifier-card-list">
          {displayed.map(a => {
            const report = reports.find(r => r.id === a.report_id);
            const isOverdue = a.due_date && new Date(a.due_date) < new Date() && !['completed','reviewed'].includes(a.status);
            return (
              <div className={`verifier-assignment-card ${isOverdue ? 'card-overdue' : ''}`} key={a.id}>
                {/* Card header */}
                <div className="vac-header">
                  <div className="vac-meta">
                    <span className={`priority-tag priority-${a.priority}`}>{a.priority}</span>
                    <span className="vac-id">Assignment #{a.id}</span>
                    <span className={STATUS_CLS[a.status] || 'status-pill'}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                    {isOverdue && <span className="status-pill status-overdue">Overdue</span>}
                  </div>
                  <div className="vac-actions">
                    {a.status === 'new' && (
                      <button className="btn-approve" disabled={actionBusy[a.id]} onClick={() => accept(a.id)}>
                        {actionBusy[a.id] ? 'Accepting…' : <><CheckCircle2 size={13} /> Accept</>}
                      </button>
                    )}
                    <Link
                      to={`/verifier/observations/new?assignmentId=${a.id}`}
                      className="btn-secondary btn-sm"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <FlaskConical size={12} /> Submit Observation
                    </Link>
                  </div>
                </div>

                {/* Card body */}
                <div className="vac-body">
                  <div className="vac-detail-row">
                    <div>
                      <small>Report</small>
                      <b><Link to={`/reports/${a.report_id}`} className="tbl-link">#{a.report_id}</Link>
                      {report && ` · ${report.source_type}`}</b>
                    </div>
                    {a.due_date && (
                      <div>
                        <small>Due</small>
                        <b style={{ color: isOverdue ? 'var(--red)' : 'inherit' }}>
                          {new Date(a.due_date).toLocaleDateString()}
                        </b>
                      </div>
                    )}
                    <div>
                      <small>Assigned</small>
                      <b>{new Date(a.created_at).toLocaleDateString()}</b>
                    </div>
                    {a.analyst_decision && (
                      <div>
                        <small>Analyst Decision</small>
                        <b style={{ color: a.analyst_decision === 'accepted' ? 'var(--green)' : 'var(--orange)' }}>
                          {a.analyst_decision.replace(/_/g, ' ')}
                        </b>
                      </div>
                    )}
                  </div>

                  {a.instructions && (
                    <div className="vac-instructions">
                      <small>Instructions</small>
                      <p>{a.instructions}</p>
                    </div>
                  )}

                  {a.analyst_notes && (
                    <div className="vac-feedback">
                      <small>Analyst Feedback</small>
                      <p>{a.analyst_notes}</p>
                    </div>
                  )}

                  {report?.latitude && (
                    <div className="vac-location">
                      <MapPin size={13} />
                      <span>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</span>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="tbl-action-sm" style={{ marginLeft: 8 }}>
                        <Navigation size={11} /> Directions
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
