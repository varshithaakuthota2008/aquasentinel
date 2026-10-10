import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, AlertCircle, PlusCircle, ChevronRight,
  MapPin, FlaskConical, ClipboardList, BarChart2, Activity,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '../AuthContext';
import { reportsApi, locationsApi, measurementsApi, analyticsApi, assignmentsApi } from '../api';
import MapView        from '../components/MapView';
import RiskBadge      from '../components/RiskBadge';
import StatusBadge    from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState     from '../components/EmptyState';

const RISK_COLORS = { low:'#3da35d', moderate:'#d4a017', high:'#e07b39', critical:'#c53030', unscored:'#a0b4bc' };

const TABS = [
  { id:'overview',    label:'Overview',    icon:<BarChart2 size={14}/> },
  { id:'reports',     label:'Reports',     icon:<ClipboardList size={14}/> },
  { id:'map',         label:'Risk Map',    icon:<MapPin size={14}/> },
  { id:'analytics',   label:'Analytics',   icon:<Activity size={14}/> },
  { id:'assignments', label:'Assignments', icon:<FlaskConical size={14}/> },
];

export default function WaterAnalystDashboard() {
  const { token } = useAuth();
  const [reports,     setReports]     = useState([]);
  const [locations,   setLocations]   = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [timeSeries,  setTimeSeries]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [tab,         setTab]         = useState('overview');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [r, l, a, ts] = await Promise.all([
        reportsApi.list(token, '?limit=100'),
        locationsApi.list(),
        assignmentsApi.list(token),
        analyticsApi.timeSeries(token, '?days=30'),
      ]);
      setReports(r); setLocations(l); setAssignments(a);
      setTimeSeries(ts.series || []);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner message="Loading analyst dashboard…"/>;

  const critical  = reports.filter(r => r.risk_category === 'critical');
  const high      = reports.filter(r => r.risk_category === 'high');
  const pending   = reports.filter(r => r.status === 'pending_review');
  const needsReview = assignments.filter(a => a.status === 'submitted');

  const riskDist = ['low','moderate','high','critical','unscored'].map(c => ({
    cat: c,
    count: reports.filter(r => (r.risk_category || 'unscored') === c).length,
  }));

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill analyst-pill">WATER ANALYST</div>
          <h1 className="dash-title">Water Quality Dashboard</h1>
          <p className="dash-sub">Monitor water sources, assess risks, and manage field inspections.</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <Link to="/analyst/assign" className="btn-primary" style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:7}}>
            <PlusCircle size={15}/> Assign Inspection
          </Link>
          <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}

      {/* KPIs */}
      <div className="kpi-grid">
        {[
          { label:'Total Reports',     value: reports.length,        color:'blue' },
          { label:'Critical Risk',     value: critical.length,       color: critical.length > 0 ? 'red':'green' },
          { label:'High Risk',         value: high.length,           color: high.length > 0 ? 'amber':'green' },
          { label:'Pending Review',    value: pending.length,        color: pending.length > 0 ? 'amber':'green' },
          { label:'Assignments',       value: assignments.length,    color:'teal' },
          { label:'Awaiting Review',   value: needsReview.length,    color: needsReview.length > 0 ? 'amber':'green' },
        ].map(({ label, value, color }) => (
          <div className={`kpi-card kpi-${color}`} key={label}>
            <span className="kpi-label">{label}</span>
            <strong className="kpi-value">{value}</strong>
          </div>
        ))}
      </div>

      {/* Critical alert banner */}
      {critical.length > 0 && (
        <div className="alert-banner alert-critical" style={{marginBottom:16}}>
          <AlertCircle size={16}/>
          <span>
            <strong>{critical.length} critical-risk report{critical.length > 1 ? 's' : ''}</strong> require immediate attention.
            Preliminary scores only — laboratory confirmation required.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <>
          {/* Risk distribution */}
          <div className="panel">
            <div className="panel-header"><h3>Risk Distribution</h3></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={riskDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                  <XAxis dataKey="cat" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:10}} allowDecimals={false}/>
                  <Tooltip/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {riskDist.map(d => <Cell key={d.cat} fill={RISK_COLORS[d.cat]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="risk-summary-list">
                {riskDist.filter(d=>d.count>0).map(d => (
                  <div className="risk-summary-row" key={d.cat}>
                    <span className="risk-dot" style={{background:RISK_COLORS[d.cat]}}/>
                    <span style={{textTransform:'capitalize',flex:1}}>{d.cat}</span>
                    <strong>{d.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* High-risk reports queue */}
          <div className="panel">
            <div className="panel-header">
              <h3>Priority Reports</h3>
              <Link to="/analyst/assign" className="btn-link">Assign Inspection →</Link>
            </div>
            {critical.length + high.length === 0
              ? <EmptyState title="No high-risk reports" body="All reports are currently low or moderate risk."/>
              : [...critical, ...high].slice(0,6).map(r => (
                <Link to={`/reports/${r.id}`} key={r.id} className="priority-row">
                  <RiskBadge category={r.risk_category} score={r.risk_score}/>
                  <div className="priority-row-info">
                    <span>#{r.id} · {r.source_type.replace('_',' ')}</span>
                    <small>{new Date(r.created_at).toLocaleDateString()}</small>
                  </div>
                  <StatusBadge status={r.status}/>
                  <ChevronRight size={15} style={{color:'#c0ced3'}}/>
                </Link>
              ))
            }
          </div>

          {/* Assignments needing review */}
          {needsReview.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h3>Submitted Inspections — Awaiting Review</h3></div>
              {needsReview.slice(0,5).map(a => (
                <Link to={`/analyst/assignments/${a.id}`} key={a.id} className="priority-row">
                  <span className={`priority-tag priority-${a.priority}`}>{a.priority}</span>
                  <div className="priority-row-info">
                    <span>Assignment #{a.id} — Report #{a.report_id}</span>
                    <small>{new Date(a.updated_at).toLocaleDateString()}</small>
                  </div>
                  <span className="status-pill status-submitted">Review Needed</span>
                  <ChevronRight size={15} style={{color:'#c0ced3'}}/>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── REPORTS ──────────────────────────────────────────────── */}
      {tab === 'reports' && (
        <div className="panel">
          <div className="panel-header">
            <h3>All Reports ({reports.length})</h3>
            <Link to="/analyst/assign" className="btn-link">Assign Inspection →</Link>
          </div>
          {reports.length === 0
            ? <EmptyState title="No reports yet" body="Citizen reports will appear here."/>
            : <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr>
                    <th>#</th><th>Source</th><th>Appearance</th><th>Risk</th>
                    <th>Status</th><th>Date</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id}>
                        <td style={{fontWeight:600}}>#{r.id}</td>
                        <td style={{textTransform:'capitalize'}}>{r.source_type}</td>
                        <td style={{textTransform:'capitalize'}}>{r.appearance?.replace('_',' ')}</td>
                        <td><RiskBadge category={r.risk_category} score={r.risk_score}/></td>
                        <td><StatusBadge status={r.status}/></td>
                        <td style={{fontSize:11}}>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td style={{display:'flex',gap:6}}>
                          <Link to={`/reports/${r.id}`} className="tbl-action-sm">View</Link>
                          <Link to={`/analyst/assign?reportId=${r.id}`} className="tbl-action-sm tbl-primary">Assign</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      )}

      {/* ── MAP ──────────────────────────────────────────────────── */}
      {tab === 'map' && (
        <div className="panel">
          <div className="panel-header">
            <h3>Risk Map</h3>
            <p style={{fontSize:11,color:'#607987',margin:0}}>Markers coloured by risk category. Only reports with coordinates shown.</p>
          </div>
          <MapView locations={locations} reports={reports} height="500px"/>
          <p className="disclaimer-text">
            PRELIMINARY SCREENING ASSESSMENT — not laboratory-confirmed. Clearly distinguish suspected incidents from confirmed findings.
          </p>
        </div>
      )}

      {/* ── ANALYTICS ────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <>
          <div className="panel">
            <div className="panel-header"><h3>Reports Over Time <span className="badge-muted">Last 30 days</span></h3></div>
            {timeSeries.every(d=>d.total===0)
              ? <EmptyState title="No data in this period"/>
              : <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                    <XAxis dataKey="date" tick={{fontSize:10}} tickFormatter={d=>d.slice(5)}/>
                    <YAxis tick={{fontSize:10}} allowDecimals={false}/>
                    <Tooltip/>
                    <Line type="monotone" dataKey="total" name="Total" stroke="#0d918d" strokeWidth={2} dot={false}/>
                    <Line type="monotone" dataKey="high_risk" name="High/Critical" stroke="#c53030" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
            }
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div className="panel">
              <div className="panel-header"><h3>By Risk Category</h3></div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={riskDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                  <XAxis dataKey="cat" tick={{fontSize:10}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:10}}/>
                  <Tooltip/>
                  <Bar dataKey="count">
                    {riskDist.map(d=><Cell key={d.cat} fill={RISK_COLORS[d.cat]}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="panel">
              <div className="panel-header"><h3>By Source Type</h3></div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={Object.entries(
                  reports.reduce((a,r)=>{a[r.source_type]=(a[r.source_type]||0)+1;return a},{})
                ).map(([k,v])=>({src:k,count:v}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                  <XAxis dataKey="src" tick={{fontSize:10}}/>
                  <YAxis allowDecimals={false} tick={{fontSize:10}}/>
                  <Tooltip/>
                  <Bar dataKey="count" fill="#0d918d" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* ── ASSIGNMENTS ──────────────────────────────────────────── */}
      {tab === 'assignments' && (
        <div className="panel">
          <div className="panel-header">
            <h3>Inspection Assignments ({assignments.length})</h3>
            <Link to="/analyst/assign" className="btn-primary" style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,fontSize:12}}>
              <PlusCircle size={14}/> New
            </Link>
          </div>
          {assignments.length === 0
            ? <EmptyState icon={<ClipboardList size={28}/>} title="No assignments yet" body="Create an assignment to dispatch a field verifier."/>
            : <table className="data-table">
                <thead><tr>
                  <th>#</th><th>Report</th><th>Verifier</th><th>Priority</th>
                  <th>Status</th><th>Due</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td><Link to={`/reports/${a.report_id}`} className="tbl-link">#{a.report_id}</Link></td>
                      <td>User #{a.assigned_to}</td>
                      <td><span className={`priority-tag priority-${a.priority}`}>{a.priority}</span></td>
                      <td><span className="status-pill">{a.status.replace(/_/g,' ')}</span></td>
                      <td style={{fontSize:11}}>{a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}</td>
                      <td>
                        <Link to={`/analyst/assignments/${a.id}`} className="tbl-action-sm">
                          {a.status === 'submitted' ? '⚑ Review' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      )}
    </div>
  );
}
