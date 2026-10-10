import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Check, X, UserRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const ROLE_LABEL = { water_authority: 'Water Analyst', field_inspector: 'Field Verifier' };

export default function AdminApprovals() {
  const { token } = useAuth();
  const [pending,  setPending]  = useState([]);
  const [reasons,  setReasons]  = useState({});
  const [busy,     setBusy]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [msg,      setMsg]      = useState('');
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setPending(await adminApi.pending(token)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function review(userId, decision) {
    setBusy(b => ({...b, [userId]: decision}));
    setMsg(''); setError('');
    try {
      const updated = await adminApi.review(userId, { decision, reason: reasons[userId] || null }, token);
      setPending(p => p.filter(u => u.id !== userId));
      setMsg(`${updated.full_name} ${decision === 'approve' ? 'approved ✓' : 'rejected'}.`);
      setReasons(r => { const c = {...r}; delete c[userId]; return c; });
    } catch(e) { setError(e.message); }
    finally { setBusy(b => ({...b, [userId]: null})); }
  }

  if (loading) return <LoadingSpinner message="Loading approval requests…"/>;

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">Approval Requests</h1>
          <p className="dash-sub">Review and approve Water Analyst and Field Verifier registrations.</p>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
      {msg   && <div className="alert-banner alert-success"><Check size={16}/><span>{msg}</span></div>}

      {pending.length === 0 ? (
        <div className="panel">
          <div className="empty-card">
            <ShieldCheck size={40} style={{color:'#22c55e'}}/>
            <strong>No pending approvals</strong>
            <span>All Water Analyst and Field Verifier registrations have been processed.</span>
          </div>
        </div>
      ) : (
        <div className="approval-list">
          {pending.map(u => (
            <div className="approval-card" key={u.id}>
              <div className="approval-top">
                <div className="user-avatar"><UserRound size={20}/></div>
                <div className="user-info">
                  <strong>{u.full_name}</strong>
                  <span>{u.email}</span>
                </div>
                <span className={`role-tag role-${u.role}`}>{ROLE_LABEL[u.role] || u.role}</span>
                <StatusBadge status={u.account_status}/>
              </div>

              <div className="detail-grid">
                <div><small>Department</small><b>{u.department || '—'}</b></div>
                <div><small>Designation</small><b>{u.designation || '—'}</b></div>
                <div><small>Employee ID</small><b>{u.employee_id || '—'}</b></div>
                <div><small>Phone</small><b>{u.phone || '—'}</b></div>
                <div><small>Registered</small><b>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</b></div>
                <div><small>Credential Note</small><b style={{wordBreak:'break-word'}}>{u.credential_note || 'Not provided'}</b></div>
              </div>

              {u.review_reason && (
                <div className="review-note-banner">Previous decision: {u.review_reason}</div>
              )}

              <div className="approval-actions">
                <label className="field-label" style={{flex:1,marginBottom:0}}>
                  <span style={{fontSize:10,fontWeight:700,color:'#64748b'}}>Review note (optional)</span>
                  <input className="field-input"
                    value={reasons[u.id] || ''}
                    onChange={e => setReasons(r => ({...r, [u.id]: e.target.value}))}
                    placeholder="Internal note or reason for decision…"/>
                </label>
                <button className="btn-approve" disabled={!!busy[u.id]}
                  onClick={() => review(u.id, 'approve')}>
                  {busy[u.id] === 'approve' ? 'Approving…' : <><Check size={14}/> Approve</>}
                </button>
                <button className="btn-reject" disabled={!!busy[u.id]}
                  onClick={() => review(u.id, 'reject')}>
                  {busy[u.id] === 'reject' ? 'Rejecting…' : <><X size={14}/> Reject</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
