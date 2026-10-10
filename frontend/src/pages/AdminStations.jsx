import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Plus, MapPin, Check, Pencil } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const BLANK = { name:'', source_type:'river', latitude:'', longitude:'', district:'', state:'', description:'', is_active:true };
const SOURCE_TYPES = ['river','lake','pond','borewell','tap','other'];

export default function AdminStations() {
  const { token } = useAuth();
  const [stations, setStations] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [msg,      setMsg]      = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null); // station id being edited
  const [form,     setForm]     = useState(BLANK);
  const [busy,     setBusy]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setStations(await adminApi.stations(token)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const u = (k,v) => setForm(f => ({...f, [k]: v}));

  function startEdit(s) {
    setEditing(s.id);
    setForm({ name:s.name, source_type:s.source_type, latitude:s.latitude??'', longitude:s.longitude??'',
      district:s.district??'', state:s.state??'', description:s.description??'', is_active:s.is_active });
    setShowForm(true);
  }

  function startAdd() { setEditing(null); setForm(BLANK); setShowForm(true); }

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setMsg('');
    try {
      const payload = {
        ...form,
        latitude:  form.latitude  !== '' ? parseFloat(form.latitude)  : null,
        longitude: form.longitude !== '' ? parseFloat(form.longitude) : null,
      };
      if (editing) {
        await adminApi.updateStation(editing, payload, token);
        setMsg('Station updated.');
      } else {
        await adminApi.createStation(payload, token);
        setMsg('Station created.');
      }
      setShowForm(false); setEditing(null); load();
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggleStatus(id, current) {
    try {
      await adminApi.toggleStation(id, !current, token);
      setStations(ss => ss.map(s => s.id === id ? {...s, is_active: !current} : s));
      setMsg(`Station ${!current ? 'activated' : 'deactivated'}.`);
    } catch(e) { setError(e.message); }
  }

  if (loading) return <LoadingSpinner message="Loading stations…"/>;

  const mapLocations = stations.filter(s => s.latitude && s.longitude).map(s => ({
    id: s.id, name: s.name, source_type: s.source_type,
    latitude: s.latitude, longitude: s.longitude, is_active: s.is_active,
  }));

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">Location & Station Management</h1>
          <p className="dash-sub">Manage water-monitoring locations and station configuration.</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn-primary" onClick={startAdd}><Plus size={15}/> Add Station</button>
          <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
        </div>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
      {msg   && <div className="alert-banner alert-success"><Check size={16}/><span>{msg}</span></div>}

      {/* Add/Edit form */}
      {showForm && (
        <div className="panel" style={{marginBottom:16,borderColor:'#0d918d'}}>
          <div className="panel-header">
            <h3>{editing ? 'Edit Station' : 'Add New Station'}</h3>
            <button className="btn-secondary btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <form onSubmit={submit}>
            <div className="two-cols">
              <label className="field-label">Station Name *
                <input required className="field-input" value={form.name} onChange={e=>u('name',e.target.value)} placeholder="e.g. Mula River — Pune Bridge"/>
              </label>
              <label className="field-label">Source Type *
                <select required className="field-input" value={form.source_type} onChange={e=>u('source_type',e.target.value)}>
                  {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </label>
            </div>
            <div className="two-cols">
              <label className="field-label">Latitude <span className="optional">(optional)</span>
                <input type="number" step="any" min="-90" max="90" className="field-input" value={form.latitude} onChange={e=>u('latitude',e.target.value)} placeholder="e.g. 18.5204"/>
              </label>
              <label className="field-label">Longitude <span className="optional">(optional)</span>
                <input type="number" step="any" min="-180" max="180" className="field-input" value={form.longitude} onChange={e=>u('longitude',e.target.value)} placeholder="e.g. 73.8567"/>
              </label>
            </div>
            <div className="two-cols">
              <label className="field-label">District
                <input className="field-input" value={form.district} onChange={e=>u('district',e.target.value)} placeholder="e.g. Pune"/>
              </label>
              <label className="field-label">State
                <input className="field-input" value={form.state} onChange={e=>u('state',e.target.value)} placeholder="e.g. Maharashtra"/>
              </label>
            </div>
            <label className="field-label">Description <span className="optional">(optional)</span>
              <textarea className="field-input" rows={2} value={form.description} onChange={e=>u('description',e.target.value)} placeholder="Brief description of this station…"/>
            </label>
            <label className="checkbox-label" style={{marginBottom:12}}>
              <input type="checkbox" checked={form.is_active} onChange={e=>u('is_active',e.target.checked)}/>
              Station is active
            </label>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : (editing ? 'Update Station' : 'Create Station')}
            </button>
          </form>
        </div>
      )}

      {/* Map */}
      {mapLocations.length > 0 && (
        <div className="panel" style={{marginBottom:16}}>
          <div className="panel-header"><h3>Station Map ({mapLocations.length} with coordinates)</h3></div>
          <MapView locations={mapLocations} reports={[]} height="300px"/>
        </div>
      )}

      {/* Station table */}
      <div className="panel">
        <div className="panel-header"><h3>All Stations ({stations.length})</h3></div>
        {stations.length === 0 ? (
          <EmptyState icon={<MapPin size={28}/>} title="No stations yet" body="Add the first monitoring station using the button above."/>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th>Measurements</th><th>Last Reading</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {stations.map(s => (
                  <tr key={s.id}>
                    <td style={{color:'#8fa5b0'}}>{s.id}</td>
                    <td style={{fontWeight:600,fontSize:12}}>{s.name}</td>
                    <td style={{textTransform:'capitalize',fontSize:11}}>{s.source_type}</td>
                    <td style={{fontSize:11}}>{[s.district,s.state].filter(Boolean).join(', ') || (s.latitude ? `${s.latitude.toFixed(3)}, ${s.longitude.toFixed(3)}` : '—')}</td>
                    <td>
                      <span className={`status-pill ${s.is_active ? 'status-completed' : 'status-returned'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{fontSize:11}}>{s.measurement_count}</td>
                    <td style={{fontSize:11}}>{s.latest_measurement ? new Date(s.latest_measurement).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{display:'flex',gap:6}}>
                        <button className="tbl-action-sm" onClick={() => startEdit(s)}><Pencil size={11}/> Edit</button>
                        <button className={`tbl-action-sm ${s.is_active ? 'tbl-danger' : 'tbl-success'}`}
                          onClick={() => toggleStatus(s.id, s.is_active)}>
                          {s.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
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
