import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Search, ScrollText } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const ACTION_LABELS = {
  application_approve:  'Account approved',
  application_reject:   'Account rejected',
  application_revoke:   'Access revoked',
  status_change_active:   'Account activated',
  status_change_revoked:  'Account suspended',
  status_change_rejected: 'Account rejected',
  station_created:      'Station created',
  station_activated:    'Station activated',
  station_deactivated:  'Station deactivated',
  station_updated:      'Station updated',
  settings_updated:     'Settings updated',
  obs_submitted:        'Observation submitted',
  iot_alert:            'IoT alert triggered',
};

const ACTION_COLOR = {
  application_approve:  '#22c55e',
  application_reject:   '#ef4444',
  application_revoke:   '#ef4444',
  status_change_active:   '#22c55e',
  status_change_revoked:  '#ef4444',
  station_created:      '#0d918d',
  station_activated:    '#22c55e',
  station_deactivated:  '#f59e0b',
  settings_updated:     '#6d28d9',
};

export default function AdminAuditLogs() {
  const { token } = useAuth();
  const [logs,    setLogs]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [typeF,   setTypeF]   = useState('all');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setLogs(await adminApi.logs(token)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const actionTypes = ['all', ...Array.from(new Set(logs.map(l => l.action)))];

  const filtered = logs.filter(l => {
    if (typeF !== 'all' && l.action !== typeF) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.action.toLowerCase().includes(q) && !(l.notes||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) return <LoadingSpinner message="Loading audit logs…"/>;

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">Audit Logs</h1>
          <p className="dash-sub">Read-only record of all administrative and security actions.</p>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}

      <div className="filter-toolbar">
        <div className="search-bar" style={{flex:1,maxWidth:320}}>
          <Search size={15}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search action or notes…"/>
        </div>
        <select className="field-input" style={{width:220}} value={typeF} onChange={e=>setTypeF(e.target.value)}>
          {actionTypes.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Action Types' : ACTION_LABELS[t] || t.replace(/_/g,' ')}</option>
          ))}
        </select>
        <span style={{fontSize:11,color:'#8fa5b0',whiteSpace:'nowrap'}}>{filtered.length} entries</span>
      </div>

      <div className="panel" style={{marginTop:12}}>
        {filtered.length === 0 ? (
          <div className="empty-card">
            <ScrollText size={36}/>
            <strong>No log entries found</strong>
            <span>Administrative actions will be recorded here automatically.</span>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead>
                <tr><th>Timestamp</th><th>Action</th><th>Target</th><th>Details</th></tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr key={l.id}>
                    <td style={{fontSize:11,whiteSpace:'nowrap',color:'#64748b'}}>{new Date(l.created_at).toLocaleString()}</td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{width:8,height:8,borderRadius:'50%',background:ACTION_COLOR[l.action]||'#94a3b8',flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:600}}>
                          {ACTION_LABELS[l.action] || l.action.replace(/_/g,' ')}
                        </span>
                      </div>
                    </td>
                    <td style={{fontSize:11}}>{l.target_user_id ? `User #${l.target_user_id}` : l.target_report_id ? `Report #${l.target_report_id}` : '—'}</td>
                    <td style={{fontSize:11,maxWidth:320,color:'#475569'}}>{l.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
