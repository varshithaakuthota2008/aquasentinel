import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Upload, MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { reportsApi, locationsApi, uploadApi } from '../api';
import MapView from '../components/MapView';

const BLANK = {
  location_id:'', source_type:'river', latitude:'', longitude:'',
  observation_date: new Date().toISOString().slice(0,16),
  appearance:'clear', odor:'normal', visible_waste:false, suspected_contamination:false,
  notes:'', photo_filename:'',
};

export default function ReportFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(BLANK);
  const [locations, setLocations] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { locationsApi.list().then(setLocations).catch(()=>{}); }, []);

  const u = (k,v) => setForm(f=>({...f,[k]:v}));

  function onLocationSelect(loc) {
    if (loc.latitude != null) { u('latitude', loc.latitude); u('longitude', loc.longitude); }
    u('location_id', loc.id);
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try {
      const res = await uploadApi.photo(file, token);
      u('photo_filename', res.filename);
      setPhotoFile(file.name);
    } catch(err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const payload = {
        ...form,
        location_id: form.location_id ? parseInt(form.location_id) : null,
        latitude: form.latitude !== '' ? parseFloat(form.latitude) : null,
        longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
        observation_date: new Date(form.observation_date).toISOString(),
        photo_filename: form.photo_filename || null,
      };
      const res = await reportsApi.create(payload, token);
      navigate(`/reports/${res.id}`);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1>Submit Water Quality Report</h1><p>Record your observation. All fields marked * are required.</p></div>
      </div>

      <div className="notice info" style={{marginBottom:20}}>
        <AlertCircle size={17}/>
        <span>Appearance and odor alone cannot confirm water safety. Submit only factual observations. This is not a laboratory test.</span>
      </div>

      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      <form onSubmit={submit} className="report-form">
        <div className="form-section">
          <h3>Water Source</h3>
          <div className="two-cols">
            <label>Source type *
              <select value={form.source_type} onChange={e=>u('source_type',e.target.value)}>
                {['river','lake','pond','borewell','tap','other'].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </label>
            <label>Monitoring location (optional)
              <select value={form.location_id} onChange={e=>u('location_id',e.target.value)}>
                <option value="">— Select a location —</option>
                {locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3>Location <span className="optional">(pin on map or enter manually)</span></h3>
          <MapView locations={locations} reports={[]} onLocationSelect={onLocationSelect} height="260px" />
          <div className="two-cols" style={{marginTop:12}}>
            <label>Latitude <span className="optional">(optional)</span>
              <input type="number" step="any" min="-90" max="90" value={form.latitude}
                onChange={e=>u('latitude',e.target.value)} placeholder="e.g. 18.5204" />
            </label>
            <label>Longitude <span className="optional">(optional)</span>
              <input type="number" step="any" min="-180" max="180" value={form.longitude}
                onChange={e=>u('longitude',e.target.value)} placeholder="e.g. 73.8567" />
            </label>
          </div>
        </div>

        <div className="form-section">
          <h3>Observation</h3>
          <label>Observation date & time *
            <input type="datetime-local" required value={form.observation_date} onChange={e=>u('observation_date',e.target.value)} />
          </label>
          <div className="two-cols">
            <label>Water appearance *
              <select value={form.appearance} onChange={e=>u('appearance',e.target.value)}>
                <option value="clear">Clear</option>
                <option value="cloudy">Cloudy / Murky</option>
                <option value="unusual_color">Unusual color</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Odor *
              <select value={form.odor} onChange={e=>u('odor',e.target.value)}>
                <option value="normal">Normal</option>
                <option value="unusual">Unusual</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
          </div>
          <div className="checkbox-group">
            <label className="checkbox-label">
              <input type="checkbox" checked={form.visible_waste} onChange={e=>u('visible_waste',e.target.checked)} />
              Visible waste or debris present
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.suspected_contamination} onChange={e=>u('suspected_contamination',e.target.checked)} />
              Suspected contamination
            </label>
          </div>
          <label>Additional notes <span className="optional">(optional)</span>
            <textarea rows={3} value={form.notes} onChange={e=>u('notes',e.target.value)}
              placeholder="Describe what you observed in detail." />
          </label>
        </div>

        <div className="form-section">
          <h3>Photo <span className="optional">(optional, max 5MB, JPEG/PNG/WebP)</span></h3>
          <label className="file-label">
            <Upload size={16}/> {photoFile || (uploading ? 'Uploading…' : 'Choose photo')}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhoto} style={{display:'none'}} />
          </label>
          {form.photo_filename && <p className="field-hint" style={{marginTop:6}}>✓ Photo uploaded: {form.photo_filename}</p>}
        </div>

        <button className="primary" type="submit" disabled={busy||uploading}>
          {busy ? 'Submitting…' : 'Submit Report'} <ArrowRight size={17}/>
        </button>
      </form>
    </div>
  );
}
