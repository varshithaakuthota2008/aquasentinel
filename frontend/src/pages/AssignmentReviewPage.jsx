import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, ThumbsUp, RotateCcw, TestTubes, MessageSquare } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { assignmentsApi, reportsApi, fieldObsApi, analystNotesApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import RiskBadge from '../components/RiskBadge';

export default function AssignmentReviewPage() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [report,     setReport]     = useState(null);
  const [obs,        setObs]        = useState([]);
  const [notes,      setNotes]      = useState([]);
  const [form, setForm] = useState({ analyst_decision: 'accepted', analyst_notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', recommendation: '' });
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    async function load() {
      try {
        const a = await assignmentsApi.get(parseInt(id), token);
        setAssignment(a);
        const [r, o, n] = await Promise.all([
          reportsApi.get(a.report_id, token),
          fieldObsApi.list(token, a.id),
          analystNotesApi.list(token, { assignment_id: a.id }),
        ]);
        setReport(r); setObs(o); setNotes(n);
      } catch(e) { setError(e.message); }
      finally { setLoading(false); }
    }
    load();
  }, [id, token]);

  async function submitReview(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await assignmentsApi.review(parseInt(id), form, token);
      setMsg(`Decision recorded: ${form.analyst_decision.replace('_',' ')}.`);
      const a = await assignmentsApi.get(parseInt(id), token);
      setAssignment(a);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function addNote(e) {
    e.preventDefault(); setBusy(true);
    try {
      await analystNotesApi.create({ ...noteForm, assignment_id: parseInt(id), report_id: assignment?.report_id }, token);
      setNoteForm({ note: '', recommendation: '' });
      const n = await analystNotesApi.list(token, { assignment_id: parseInt(id) });
      setNotes(n);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingSpinner message="Loading assignment…" />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <Link to="/authority" style={{fontSize:11,color:'#6d8992',textDecoration:'none'}}>← Back</Link>
          <h1>Assignment #{assignment?.id} Review</h1>
          <p>Review the submitted field observation and record your decision.</p>
        </div>
      </div>

      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
      {msg   && <div className="notice success"><span>{msg}</span></div>}

      {/* Assignment details */}
      <div className="section-card">
        <h3>Assignment Details</h3>
        <div className="details-grid">
          <div><small>Report</small>
            <b><Link to={`/reports/${assignment?.report_id}`} style={{color:'#0d918d'}}>#{assignment?.report_id}</Link></b>
          </div>
          <div><small>Priority</small><b className={`priority-badge priority-${assignment?.priority}`}>{assignment?.priority}</b></div>
          <div><small>Status</small><b>{assignment?.status?.replace('_',' ')}</b></div>
          <div><small>Due</small><b>{assignment?.due_date ? new Date(assignment.due_date).toLocaleDateString() : '—'}</b></div>
          {assignment?.instructions && <div style={{gridColumn:'1/-1'}}><small>Instructions</small><b>{assignment.instructions}</b></div>}
        </div>
        {report && (
          <div style={{marginTop:12}}>
            <small style={{fontWeight:700,color:'#345464'}}>Linked Report:</small>
            <div className="details-grid" style={{marginTop:6}}>
              <div><small>Source</small><b>{report.source_type}</b></div>
              <div><small>Appearance</small><b>{report.appearance?.replace('_',' ')}</b></div>
              <div><small>Odor</small><b>{report.odor}</b></div>
              <div><small>Risk</small><b><RiskBadge category={report.risk_category} score={report.risk_score}/></b></div>
            </div>
          </div>
        )}
      </div>

      {/* Field observations */}
      <div className="section-card">
        <h3>Submitted Field Observations ({obs.length})</h3>
        {obs.length === 0
          ? <p style={{color:'#7a8d95',fontSize:12}}>No observations submitted yet.</p>
          : obs.map(o => (
            <div key={o.id} className="obs-card">
              <div className="details-grid">
                <div><small>Outcome</small><b style={{textTransform:'capitalize'}}>{o.outcome?.replace('_',' ') || '—'}</b></div>
                <div><small>Problem Observed</small><b>{o.problem_observable === null ? '—' : o.problem_observable ? 'Yes' : 'No'}</b></div>
                <div><small>Pollution Visible</small><b>{o.pollution_sources_visible === null ? '—' : o.pollution_sources_visible ? 'Yes' : 'No'}</b></div>
                <div><small>Location Match</small><b>{o.location_matches_report === null ? '—' : o.location_matches_report ? 'Yes' : 'No'}</b></div>
                {o.actual_latitude && <div><small>GPS</small><b>{o.actual_latitude.toFixed(5)}, {o.actual_longitude.toFixed(5)}</b></div>}
                {o.ph && <div><small>pH</small><b>{o.ph}</b></div>}
                {o.turbidity && <div><small>Turbidity</small><b>{o.turbidity} NTU</b></div>}
                {o.dissolved_oxygen && <div><small>DO</small><b>{o.dissolved_oxygen} mg/L</b></div>}
                <div><small>Lab Needed</small><b>{o.lab_testing_needed ? 'Yes' : 'No'}</b></div>
                <div><small>Status</small><b>{o.status}</b></div>
              </div>
              {o.field_notes && <p style={{fontSize:12,color:'#607987',marginTop:8}}>{o.field_notes}</p>}
              {o.outcome_notes && <p style={{fontSize:12,color:'#607987'}}><em>Outcome notes: {o.outcome_notes}</em></p>}
            </div>
          ))
        }
      </div>

      {/* Review decision */}
      {assignment?.status === 'submitted' && user?.role !== 'field_inspector' && (
        <div className="section-card">
          <h3>Record Review Decision</h3>
          <form onSubmit={submitReview} style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {[
                { v:'accepted',              icon:<ThumbsUp size={15}/>,  label:'Accept' },
                { v:'corrections_requested', icon:<RotateCcw size={15}/>, label:'Request Corrections' },
                { v:'further_testing',       icon:<TestTubes size={15}/>, label:'Further Testing' },
              ].map(opt => (
                <button key={opt.v} type="button"
                  className={form.analyst_decision === opt.v ? 'primary' : 'secondary'}
                  onClick={() => setForm(f => ({...f, analyst_decision: opt.v}))}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:11,fontWeight:700,color:'#345464'}}>
              Notes for field verifier
              <textarea rows={3} value={form.analyst_notes}
                onChange={e => setForm(f=>({...f,analyst_notes:e.target.value}))}
                placeholder="Explain your decision or what corrections are needed…"/>
            </label>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Submit Decision'}
            </button>
          </form>
        </div>
      )}

      {/* Analyst notes */}
      <div className="section-card">
        <h3>Analyst Notes</h3>
        {notes.map(n => (
          <div key={n.id} className="analyst-note-item">
            <p>{n.note}</p>
            {n.recommendation && <span className="recommendation-tag">→ {n.recommendation}</span>}
            <small>{new Date(n.created_at).toLocaleString()}</small>
          </div>
        ))}
        {user?.role !== 'field_inspector' && (
          <form onSubmit={addNote} style={{marginTop:14,display:'flex',flexDirection:'column',gap:10}}>
            <textarea rows={2} placeholder="Add a note or recommendation…"
              value={noteForm.note} onChange={e => setNoteForm(f=>({...f,note:e.target.value}))}
              style={{border:'1px solid #dce6ea',borderRadius:9,padding:'10px 12px',fontSize:12,fontFamily:'inherit'}}/>
            <input placeholder="Recommendation (optional)"
              value={noteForm.recommendation} onChange={e => setNoteForm(f=>({...f,recommendation:e.target.value}))}
              style={{border:'1px solid #dce6ea',borderRadius:9,padding:'10px 12px',fontSize:12,fontFamily:'inherit'}}/>
            <button className="secondary" type="submit" disabled={busy || !noteForm.note.trim()}>
              <MessageSquare size={14}/> Add Note
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
