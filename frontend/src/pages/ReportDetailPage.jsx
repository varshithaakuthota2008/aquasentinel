import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { reportsApi, photoUrl } from '../api';
import RiskBadge from '../components/RiskBadge';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ReportDetailPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    reportsApi.get(id, token)
      .then(r => { setReport(r); setNewStatus(r.status); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function updateStatus() {
    setSaving(true); setSaveMsg('');
    try {
      const r = await reportsApi.updateStatus(id, newStatus, token);
      setReport(r); setSaveMsg('Status updated.');
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingSpinner message="Loading report…" />;
  if (error)   return <div className="page-content"><div className="notice error"><AlertCircle size={17}/><span>{error}</span></div></div>;
  if (!report) return null;

  const factors = (() => { try { return JSON.parse(report.risk_factors || '[]'); } catch { return []; } })();
  const canChangeStatus = user && ['admin','water_authority'].includes(user.role) && user.account_status === 'active';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <Link to="/citizen" className="back-link"><ArrowLeft size={14}/> Back</Link>
          <h1>Report #{report.id}</h1>
          <p>Submitted {new Date(report.created_at).toLocaleString()}</p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {/* Observation Details */}
      <div className="section-card">
        <h3>Observation Details</h3>
        <div className="details-grid">
          <div><small>Source Type</small><b>{report.source_type}</b></div>
          <div><small>Appearance</small><b>{report.appearance.replace('_',' ')}</b></div>
          <div><small>Odor</small><b>{report.odor}</b></div>
          <div><small>Visible Waste</small><b>{report.visible_waste ? 'Yes' : 'No'}</b></div>
          <div><small>Suspected Contamination</small><b>{report.suspected_contamination ? 'Yes' : 'No'}</b></div>
          <div><small>Observed</small><b>{new Date(report.observation_date).toLocaleString()}</b></div>
          {report.latitude!=null && <div><small>Coordinates</small><b>{report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</b></div>}
        </div>
        {report.notes && <p style={{fontSize:12,color:'#607987',marginTop:8}}>{report.notes}</p>}
        {report.photo_filename && (
          <div style={{marginTop:12}}>
            <img src={photoUrl(report.photo_filename)} alt="Report photo"
              style={{maxWidth:'100%',maxHeight:300,borderRadius:10,border:'1px solid #e0eaee'}} />
          </div>
        )}
      </div>

      {/* Risk Assessment */}
      <div className="section-card risk-section">
        <div className="risk-disclaimer">
          <ShieldAlert size={18}/>
          <span>PRELIMINARY SCREENING ASSESSMENT — NOT A LABORATORY-CONFIRMED WATER-QUALITY RESULT. This score is generated from citizen-reported observations using rule-based logic only.</span>
        </div>
        <h3>Risk Assessment</h3>
        <div className="risk-score-row">
          <div className="risk-score-number">{report.risk_score ?? '—'}<span>/100</span></div>
          <RiskBadge category={report.risk_category} score={report.risk_score} />
        </div>
        {report.risk_score != null && (
          <div className="risk-bar-wrap">
            <div className="risk-bar" style={{width:`${report.risk_score}%`, background: report.risk_category==='critical'?'#c53030':report.risk_category==='high'?'#e07b39':report.risk_category==='moderate'?'#d4a017':'#21724f'}}/>
          </div>
        )}
        {factors.length > 0 && (
          <div style={{marginTop:14}}>
            <small style={{fontWeight:700,color:'#345464'}}>Contributing factors:</small>
            <ul className="factor-list">{factors.map((f,i)=><li key={i}>{f}</li>)}</ul>
          </div>
        )}
      </div>

      {/* Status update for authority/admin */}
      {canChangeStatus && (
        <div className="section-card">
          <h3>Update Status</h3>
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <select value={newStatus} onChange={e=>setNewStatus(e.target.value)}>
              <option value="pending_review">Pending Review</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
            </select>
            <button className="primary" onClick={updateStatus} disabled={saving}>{saving?'Saving…':'Save Status'}</button>
            {saveMsg && <span style={{fontSize:11,color:'#21724f'}}>{saveMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
