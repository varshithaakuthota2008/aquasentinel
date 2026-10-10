import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Upload, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { inspectionsApi, reportsApi, uploadApi } from '../api';

export default function InspectionFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({
    report_id:'', inspection_notes:'', outcome:'inconclusive',
    follow_up_required:false, follow_up_notes:'', evidence_photo_filename:'',
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { reportsApi.list(token).then(setReports).catch(()=>{}); }, [token]);

  const u = (k,v) => setForm(f=>({...f,[k]:v}));

  async function handlePhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const r = await uploadApi.photo(file, token); u('evidence_photo_filename', r.filename); setPhotoFile(file.name); }
    catch(err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const payload = { ...form, report_id: parseInt(form.report_id), evidence_photo_filename: form.evidence_photo_filename || null };
      const r = await inspectionsApi.create(payload, token);
      navigate(`/reports/${r.report_id}`);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header"><div><h1>Submit Inspection</h1><p>Record your field inspection findings.</p></div></div>
      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      <form onSubmit={submit} className="report-form">
        <div className="form-section">
          <h3>Report</h3>
          <label>Select report to inspect *
            <select required value={form.report_id} onChange={e=>u('report_id',e.target.value)}>
              <option value="">— Select a report —</option>
              {reports.map(r=><option key={r.id} value={r.id}>#{r.id} — {r.source_type} ({new Date(r.observation_date).toLocaleDateString()})</option>)}
            </select>
          </label>
        </div>

        <div className="form-section">
          <h3>Findings</h3>
          <label>Inspection notes * (min 10 characters)
            <textarea required minLength={10} rows={4} value={form.inspection_notes}
              onChange={e=>u('inspection_notes',e.target.value)} placeholder="Describe your field observations in detail…" />
          </label>
          <label>Outcome *
            <select value={form.outcome} onChange={e=>u('outcome',e.target.value)}>
              <option value="safe">Safe</option>
              <option value="unsafe">Unsafe</option>
              <option value="inconclusive">Inconclusive</option>
              <option value="requires_lab">Requires Laboratory Testing</option>
            </select>
          </label>
          <label className="checkbox-label" style={{marginTop:8}}>
            <input type="checkbox" checked={form.follow_up_required} onChange={e=>u('follow_up_required',e.target.checked)} />
            Follow-up required
          </label>
          {form.follow_up_required && (
            <label>Follow-up notes
              <textarea rows={2} value={form.follow_up_notes} onChange={e=>u('follow_up_notes',e.target.value)} placeholder="Describe required follow-up actions…" />
            </label>
          )}
        </div>

        <div className="form-section">
          <h3>Evidence Photo <span className="optional">(optional)</span></h3>
          <label className="file-label">
            <Upload size={16}/> {photoFile || (uploading?'Uploading…':'Choose photo')}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{display:'none'}}/>
          </label>
        </div>

        <button className="primary" type="submit" disabled={busy||uploading}>
          {busy?'Submitting…':'Submit Inspection'} <ArrowRight size={17}/>
        </button>
      </form>
    </div>
  );
}
