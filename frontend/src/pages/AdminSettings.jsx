import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Check, Settings, Info } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const SECTIONS = [
  {
    title: 'Platform',
    keys: ['platform_name', 'default_timezone'],
  },
  {
    title: 'Risk Score Thresholds',
    keys: ['risk_score_high', 'risk_score_critical'],
    note: 'Preliminary screening only — not laboratory-confirmed results. Adjust with care.',
  },
  {
    title: 'Auto-Alert Thresholds (WHO / IS 10500 defaults)',
    keys: ['alert_threshold_ph_min', 'alert_threshold_ph_max', 'alert_threshold_turbidity', 'alert_threshold_tds'],
    note: 'Readings outside these ranges trigger automatic alerts. Based on WHO 2017 Drinking Water Guidelines and IS 10500:2012.',
  },
  {
    title: 'Notifications',
    keys: ['notification_email_enabled', 'notification_email_from'],
    note: 'Email notifications require SMTP configuration on the server. Set notification_email_enabled to "true" only after SMTP is configured.',
  },
];

export default function AdminSettings() {
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [draft,    setDraft]    = useState({});
  const [loading,  setLoading]  = useState(true);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState('');
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const s = await adminApi.settings(token);
      setSettings(s);
      setDraft(Object.fromEntries(Object.entries(s).map(([k,v]) => [k, v.value])));
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function save(keys) {
    setBusy(true); setMsg(''); setError('');
    const updates = Object.fromEntries(keys.map(k => [k, draft[k]]));
    try {
      await adminApi.saveSettings(updates, token);
      setMsg('Settings saved.');
      load();
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  if (loading) return <LoadingSpinner message="Loading settings…"/>;

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">System Settings</h1>
          <p className="dash-sub">Platform-level configuration. Changes are persisted to the database.</p>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
      {msg   && <div className="alert-banner alert-success"><Check size={16}/><span>{msg}</span></div>}

      {SECTIONS.map(sec => (
        <div className="panel" key={sec.title} style={{marginBottom:16}}>
          <div className="panel-header"><h3>{sec.title}</h3></div>
          {sec.note && (
            <div className="alert-banner alert-info" style={{marginBottom:14}}>
              <Info size={14}/><span>{sec.note}</span>
            </div>
          )}
          {sec.keys.map(key => {
            const s = settings?.[key];
            if (!s) return null;
            const isDefault = s.is_default;
            return (
              <div key={key} style={{marginBottom:14}}>
                <label className="field-label">
                  <span>
                    {key.replace(/_/g,' ')}
                    {isDefault && <span style={{fontSize:9,background:'#f1f5f9',color:'#94a3b8',borderRadius:4,padding:'1px 6px',marginLeft:8,verticalAlign:'middle'}}>default</span>}
                  </span>
                  {key === 'notification_email_enabled' ? (
                    <select className="field-input" style={{maxWidth:200}}
                      value={draft[key] || 'false'}
                      onChange={e => setDraft(d => ({...d, [key]: e.target.value}))}>
                      <option value="false">Disabled</option>
                      <option value="true">Enabled (requires SMTP config)</option>
                    </select>
                  ) : (
                    <input className="field-input" style={{maxWidth:400}}
                      value={draft[key] || ''}
                      onChange={e => setDraft(d => ({...d, [key]: e.target.value}))}
                      placeholder={s.value}/>
                  )}
                  {s.description && <span style={{fontSize:10,color:'#94a3b8',marginTop:2}}>{s.description}</span>}
                </label>
              </div>
            );
          })}
          <button className="btn-primary" disabled={busy} onClick={() => save(sec.keys)} style={{marginTop:4}}>
            {busy ? 'Saving…' : `Save ${sec.title}`}
          </button>
        </div>
      ))}
    </div>
  );
}
