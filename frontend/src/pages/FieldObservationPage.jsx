import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Navigation, Upload, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { fieldObsApi, assignmentsApi, uploadApi } from '../api';

const BLANK = {
  assignment_id: '',
  actual_latitude: '', actual_longitude: '', gps_accuracy_m: '', gps_captured_at: '',
  location_matches_report: null, location_note: '',
  problem_observable: null, pollution_sources_visible: null, field_notes: '',
  ph: '', turbidity: '', dissolved_oxygen: '', conductivity: '', temperature: '',
  measurements_collected: false, sampling_method: '', equipment_used: '',
  sample_handling_notes: '', lab_testing_needed: false,
  checklist_location_correct: null, checklist_problem_observed: null,
  checklist_sources_visible: null, checklist_measurements_done: null,
  checklist_lab_needed: null, checklist_photos_attached: null,
  checklist_all_fields_complete: null, checklist_notes: '',
  outcome: '', outcome_notes: '',
};

function BoolSelect({ value, onChange, label }) {
  return (
    <label>{label}
      <select value={value === null ? '' : value.toString()}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
        <option value="">— Not answered —</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}

export default function FieldObservationPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ ...BLANK, assignment_id: params.get('assignmentId') || '' });
  const [assignments, setAssignments] = useState([]);
  const [gpsStatus,   setGpsStatus]   = useState('');
  const [photoFile,   setPhotoFile]   = useState(null);
  const [uploadedPhoto, setUploadedPhoto] = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [busy,        setBusy]        = useState(false);
  const [saved,       setSaved]       = useState(null);  // saved observation id
  const [error,       setError]       = useState('');

  useEffect(() => {
    assignmentsApi.list(token).then(setAssignments).catch(() => {});
  }, [token]);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function captureGPS() {
    if (!navigator.geolocation) { setGpsStatus('GPS not supported by this browser.'); return; }
    setGpsStatus('Requesting location…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        u('actual_latitude',  pos.coords.latitude);
        u('actual_longitude', pos.coords.longitude);
        u('gps_accuracy_m',  pos.coords.accuracy);
        u('gps_captured_at', new Date().toISOString());
        setGpsStatus(`Captured: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} (±${pos.coords.accuracy.toFixed(0)} m)`);
      },
      err => setGpsStatus(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const r = await uploadApi.photo(file, token); setUploadedPhoto(r.filename); setPhotoFile(file.name); }
    catch(err) { setError(err.message); }
    finally { setUploading(false); }
  }

  function buildPayload() {
    const parse = v => v === '' ? null : parseFloat(v);
    return {
      assignment_id:           parseInt(form.assignment_id),
      actual_latitude:         parse(form.actual_latitude),
      actual_longitude:        parse(form.actual_longitude),
      gps_accuracy_m:          parse(form.gps_accuracy_m),
      gps_captured_at:         form.gps_captured_at || null,
      location_matches_report: form.location_matches_report,
      location_note:           form.location_note || null,
      problem_observable:      form.problem_observable,
      pollution_sources_visible: form.pollution_sources_visible,
      field_notes:             form.field_notes || null,
      ph:                      parse(form.ph),
      turbidity:               parse(form.turbidity),
      dissolved_oxygen:        parse(form.dissolved_oxygen),
      conductivity:            parse(form.conductivity),
      temperature:             parse(form.temperature),
      measurements_collected:  form.measurements_collected,
      sampling_method:         form.sampling_method || null,
      equipment_used:          form.equipment_used || null,
      sample_handling_notes:   form.sample_handling_notes || null,
      lab_testing_needed:      form.lab_testing_needed,
      checklist_location_correct:    form.checklist_location_correct,
      checklist_problem_observed:    form.checklist_problem_observed,
      checklist_sources_visible:     form.checklist_sources_visible,
      checklist_measurements_done:   form.checklist_measurements_done,
      checklist_lab_needed:          form.checklist_lab_needed,
      checklist_photos_attached:     form.checklist_photos_attached,
      checklist_all_fields_complete: form.checklist_all_fields_complete,
      checklist_notes:         form.checklist_notes || null,
      outcome:                 form.outcome || null,
      outcome_notes:           form.outcome_notes || null,
    };
  }

  async function saveDraft(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const obs = await fieldObsApi.create(buildPayload(), token);
      setSaved(obs.id);
      if (uploadedPhoto) await fieldObsApi.addEvidence(obs.id, uploadedPhoto, photoFile, token);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitFinal() {
    if (!saved) { setError('Save a draft first.'); return; }
    setBusy(true); setError('');
    try {
      await fieldObsApi.submit(saved, token);
      navigate('/inspector');
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1>Submit Field Observation</h1><p>Record your on-site findings for the assigned report.</p></div>
      </div>
      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
      {saved && <div className="notice success"><CheckCircle2 size={17}/><span>Draft saved (ID #{saved}). Complete all sections then submit.</span></div>}

      <form onSubmit={saveDraft} className="report-form">

        {/* Assignment */}
        <div className="form-section">
          <h3>Assignment</h3>
          <label>Select Assignment *
            <select required value={form.assignment_id} onChange={e => u('assignment_id', e.target.value)}>
              <option value="">— Select —</option>
              {assignments.map(a => (
                <option key={a.id} value={a.id}>
                  #{a.id} · Report #{a.report_id} · {a.priority} · {a.status}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* GPS */}
        <div className="form-section">
          <h3>Site Location</h3>
          <button type="button" className="secondary" onClick={captureGPS} style={{marginBottom:10}}>
            <Navigation size={15}/> Capture GPS Location
          </button>
          {gpsStatus && <p className="field-hint" style={{marginBottom:10}}>{gpsStatus}</p>}
          <div className="two-cols">
            <label>Actual Latitude <span className="optional">(captured or manual)</span>
              <input type="number" step="any" value={form.actual_latitude} onChange={e => u('actual_latitude', e.target.value)}/>
            </label>
            <label>Actual Longitude
              <input type="number" step="any" value={form.actual_longitude} onChange={e => u('actual_longitude', e.target.value)}/>
            </label>
          </div>
          <BoolSelect label="Does location match the reported location?" value={form.location_matches_report} onChange={v => u('location_matches_report', v)}/>
          <label>Location note <span className="optional">(if mismatch or site unreachable)</span>
            <textarea rows={2} value={form.location_note} onChange={e => u('location_note', e.target.value)} placeholder="Explain any location discrepancy or access issue…"/>
          </label>
        </div>

        {/* Observations */}
        <div className="form-section">
          <h3>Field Observations</h3>
          <BoolSelect label="Is the reported problem observable?" value={form.problem_observable} onChange={v => u('problem_observable', v)}/>
          <BoolSelect label="Are possible pollution sources visible?" value={form.pollution_sources_visible} onChange={v => u('pollution_sources_visible', v)}/>
          <label>Field notes
            <textarea rows={4} value={form.field_notes} onChange={e => u('field_notes', e.target.value)} placeholder="Describe what you observed at the site in detail…"/>
          </label>
        </div>

        {/* Measurements */}
        <div className="form-section">
          <h3>Measurements <span className="optional">(if collected on-site)</span></h3>
          <div className="notice info" style={{marginBottom:12}}>
            <CheckCircle2 size={14}/>
            <span>Leave unmeasured parameters blank. Do not enter zero unless zero was actually measured.</span>
          </div>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.measurements_collected} onChange={e => u('measurements_collected', e.target.checked)}/>
            Measurements were collected during this visit
          </label>
          {form.measurements_collected && <>
            <div className="two-cols" style={{marginTop:10}}>
              <label>pH (0–14)<input type="number" step="0.01" min="0" max="14" value={form.ph} onChange={e => u('ph', e.target.value)} placeholder="e.g. 7.2"/></label>
              <label>Turbidity (NTU)<input type="number" step="0.01" min="0" value={form.turbidity} onChange={e => u('turbidity', e.target.value)} placeholder="e.g. 3.5"/></label>
              <label>Dissolved Oxygen (mg/L)<input type="number" step="0.01" min="0" value={form.dissolved_oxygen} onChange={e => u('dissolved_oxygen', e.target.value)} placeholder="e.g. 6.8"/></label>
              <label>Conductivity (µS/cm)<input type="number" step="0.1" min="0" value={form.conductivity} onChange={e => u('conductivity', e.target.value)} placeholder="e.g. 420"/></label>
              <label>Temperature (°C)<input type="number" step="0.1" value={form.temperature} onChange={e => u('temperature', e.target.value)} placeholder="e.g. 24.5"/></label>
            </div>
            <label>Sampling method<input value={form.sampling_method} onChange={e => u('sampling_method', e.target.value)} placeholder="e.g. grab sample"/></label>
            <label>Equipment / testing kit used<input value={form.equipment_used} onChange={e => u('equipment_used', e.target.value)} placeholder="e.g. Hanna HI98193"/></label>
            <label>Sample handling notes<textarea rows={2} value={form.sample_handling_notes} onChange={e => u('sample_handling_notes', e.target.value)}/></label>
          </>}
          <label className="checkbox-label" style={{marginTop:8}}>
            <input type="checkbox" checked={form.lab_testing_needed} onChange={e => u('lab_testing_needed', e.target.checked)}/>
            Laboratory testing is needed
          </label>
        </div>

        {/* Checklist */}
        <div className="form-section">
          <h3>Inspection Checklist</h3>
          {[
            ['checklist_location_correct',    'Is the reported location correct?'],
            ['checklist_problem_observed',    'Is the reported problem observable?'],
            ['checklist_sources_visible',     'Are possible pollution sources visible?'],
            ['checklist_measurements_done',   'Were measurements collected?'],
            ['checklist_lab_needed',          'Is further laboratory testing needed?'],
            ['checklist_photos_attached',     'Are the required photographs attached?'],
            ['checklist_all_fields_complete', 'Are all required fields complete?'],
          ].map(([key, label]) => (
            <BoolSelect key={key} label={label} value={form[key]} onChange={v => u(key, v)}/>
          ))}
          <label>Checklist notes <span className="optional">(optional)</span>
            <textarea rows={2} value={form.checklist_notes} onChange={e => u('checklist_notes', e.target.value)}/>
          </label>
        </div>

        {/* Evidence photo */}
        <div className="form-section">
          <h3>Evidence Photo <span className="optional">(optional, max 5 MB)</span></h3>
          <p className="section-sub">Capture using device camera or upload an existing image.</p>
          <label className="file-label">
            <Upload size={15}/> {photoFile || (uploading ? 'Uploading…' : 'Choose or capture photo')}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{display:'none'}} capture="environment"/>
          </label>
          {uploadedPhoto && <p className="field-hint" style={{marginTop:6}}>✓ Photo uploaded: {uploadedPhoto}</p>}
        </div>

        {/* Outcome */}
        <div className="form-section">
          <h3>Inspection Outcome *</h3>
          <div className="notice info" style={{marginBottom:10}}>
            <AlertCircle size={14}/>
            <span>Do not certify water as safe based solely on appearance. Select "Further testing required" if in doubt.</span>
          </div>
          <label>Outcome
            <select required value={form.outcome} onChange={e => u('outcome', e.target.value)}>
              <option value="">— Select outcome —</option>
              <option value="verified">Verified — observations support the reported issue</option>
              <option value="not_verified">Not Verified — reported issue not confirmed during visit</option>
              <option value="further_testing">Further Testing Required — evidence insufficient</option>
            </select>
          </label>
          <label>Outcome notes
            <textarea rows={3} value={form.outcome_notes} onChange={e => u('outcome_notes', e.target.value)} placeholder="Explain your findings…"/>
          </label>
        </div>

        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button className="secondary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save Draft'}
          </button>
          {saved && (
            <button className="primary" type="button" onClick={submitFinal} disabled={busy}>
              Submit Final Observation <ArrowRight size={17}/>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
