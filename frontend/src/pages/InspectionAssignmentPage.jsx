import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, UserRound, Search, ArrowLeft } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { assignmentsApi, reportsApi, adminApi } from '../api';
import RiskBadge from '../components/RiskBadge';
import LoadingSpinner from '../components/LoadingSpinner';

const RISK_ORDER = { critical: 0, high: 1, moderate: 2, low: 3, unscored: 4 };

export default function InspectionAssignmentPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [reports,     setReports]     = useState([]);
  const [verifiers,   setVerifiers]   = useState([]);
  const [reportSearch,setReportSearch]= useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [dataError,   setDataError]   = useState('');
  const [form, setForm] = useState({
    report_id:    params.get('reportId') || '',
    assigned_to:  '',
    priority:     'normal',
    instructions: '',
    due_date:     '',
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoadingData(true); setDataError('');
    Promise.all([
      reportsApi.list(token, '?limit=200'),
      adminApi.verifiers(token),   // uses /admin/verifiers — accessible to water_authority
    ]).then(([r, v]) => {
      // Sort: critical/high first, then by date
      const sorted = [...r].sort((a, b) => {
        const ra = RISK_ORDER[a.risk_category || 'unscored'];
        const rb = RISK_ORDER[b.risk_category || 'unscored'];
        if (ra !== rb) return ra - rb;
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setReports(sorted);
      setVerifiers(v);
    }).catch(e => setDataError(e.message))
    .finally(() => setLoadingData(false));
  }, [token]);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filteredReports = reports.filter(r => {
    if (!reportSearch) return true;
    const q = reportSearch.toLowerCase();
    return (
      String(r.id).includes(q) ||
      r.source_type.toLowerCase().includes(q) ||
      (r.risk_category || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q)
    );
  });

  async function submit(e) {
    e.preventDefault();
    if (!form.report_id) { setError('Please select a report.'); return; }
    if (!form.assigned_to) { setError('Please select a field verifier.'); return; }
    setBusy(true); setError('');
    try {
      await assignmentsApi.create({
        report_id:    parseInt(form.report_id),
        assigned_to:  parseInt(form.assigned_to),
        priority:     form.priority,
        instructions: form.instructions || null,
        due_date:     form.due_date ? new Date(form.due_date).toISOString() : null,
      }, token);
      navigate('/authority');
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (loadingData) return <LoadingSpinner message="Loading reports and verifiers…" />;

  const selectedReport = reports.find(r => String(r.id) === String(form.report_id));

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <Link to="/authority" className="back-link"><ArrowLeft size={14}/> Back to Dashboard</Link>
          <h1>Assign Field Inspection</h1>
          <p>Dispatch a field verifier to investigate a water-quality report.</p>
        </div>
      </div>

      {dataError && (
        <div className="notice error">
          <AlertCircle size={17}/>
          <span>Failed to load data: {dataError}. <button style={{background:'none',border:'none',color:'inherit',cursor:'pointer',textDecoration:'underline'}} onClick={() => window.location.reload()}>Retry</button></span>
        </div>
      )}
      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      <form onSubmit={submit} className="assignment-form">
        {/* Report selector */}
        <div className="form-panel">
          <div className="form-panel-header">
            <h3>1. Select Report</h3>
            <p>Choose the water-quality report to inspect. High-risk reports shown first.</p>
          </div>

          <div className="search-bar" style={{marginBottom:12}}>
            <Search size={15}/>
            <input
              type="text"
              placeholder="Search by ID, source type, risk level or status…"
              value={reportSearch}
              onChange={e => setReportSearch(e.target.value)}
            />
          </div>

          {filteredReports.length === 0 ? (
            <div className="empty-state">
              <AlertCircle size={26}/>
              <b>{reports.length === 0 ? 'No reports available' : 'No reports match your search'}</b>
              <span>{reports.length === 0 ? 'Citizen reports will appear here once submitted.' : 'Try a different search term.'}</span>
            </div>
          ) : (
            <div className="report-selector-list">
              {filteredReports.map(r => (
                <label key={r.id}
                  className={`report-selector-item ${String(form.report_id) === String(r.id) ? 'selected' : ''}`}>
                  <input type="radio" name="report_id" value={r.id}
                    checked={String(form.report_id) === String(r.id)}
                    onChange={() => u('report_id', r.id)}
                    style={{display:'none'}}/>
                  <div className="rsi-left">
                    <span className="rsi-id">#{r.id}</span>
                    <div>
                      <span className="rsi-source">{r.source_type.replace('_',' ')}</span>
                      <span className="rsi-date">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="rsi-right">
                    <RiskBadge category={r.risk_category} score={r.risk_score}/>
                    <span className={`status-pill status-${r.status}`}>{r.status.replace(/_/g,' ')}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {selectedReport && (
            <div className="selected-report-preview">
              <strong>Selected: Report #{selectedReport.id}</strong>
              <span>{selectedReport.source_type} · {selectedReport.appearance?.replace('_',' ')} · {selectedReport.odor} odor</span>
              {selectedReport.notes && <em>"{selectedReport.notes}"</em>}
            </div>
          )}
        </div>

        {/* Verifier */}
        <div className="form-panel">
          <div className="form-panel-header">
            <h3>2. Assign Field Verifier</h3>
            <p>Only approved field verifiers are listed.</p>
          </div>
          {verifiers.length === 0 ? (
            <div className="notice info">
              <UserRound size={15}/>
              <span>No approved field verifiers available. Ask the Admin to approve Field Verifier accounts first.</span>
            </div>
          ) : (
            <div className="verifier-selector-grid">
              {verifiers.map(v => (
                <label key={v.id}
                  className={`verifier-selector-card ${String(form.assigned_to) === String(v.id) ? 'selected' : ''}`}>
                  <input type="radio" name="assigned_to" value={v.id}
                    checked={String(form.assigned_to) === String(v.id)}
                    onChange={() => u('assigned_to', v.id)}
                    style={{display:'none'}}/>
                  <div className="vsc-avatar"><UserRound size={20}/></div>
                  <div className="vsc-info">
                    <strong>{v.full_name}</strong>
                    <span>{v.designation || 'Field Verifier'}</span>
                    <span style={{fontSize:10,color:'#8a9eaa'}}>{v.department || '—'}</span>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="form-panel">
          <div className="form-panel-header">
            <h3>3. Assignment Details</h3>
          </div>
          <div className="two-cols">
            <label className="field-label">Priority
              <select value={form.priority} onChange={e => u('priority', e.target.value)} className="field-input">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="field-label">Due Date <span className="optional">(optional)</span>
              <input type="date" value={form.due_date} onChange={e => u('due_date', e.target.value)} className="field-input"/>
            </label>
          </div>
          <label className="field-label">Instructions <span className="optional">(optional)</span>
            <textarea rows={4} value={form.instructions}
              onChange={e => u('instructions', e.target.value)} className="field-input"
              placeholder="What should the verifier check? Any specific areas of concern?"/>
          </label>
        </div>

        <div style={{display:'flex',gap:12}}>
          <Link to="/authority" className="btn-secondary" style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6,padding:'11px 18px',borderRadius:8,border:'1px solid #dce7ea',background:'#fff',color:'#385766',fontWeight:600,fontSize:12}}>
            Cancel
          </Link>
          <button className="btn-primary" type="submit" disabled={busy || verifiers.length === 0 || !form.report_id || !form.assigned_to}>
            {busy ? 'Creating Assignment…' : 'Create Assignment'} <ArrowRight size={16}/>
          </button>
        </div>
      </form>
    </div>
  );
}
