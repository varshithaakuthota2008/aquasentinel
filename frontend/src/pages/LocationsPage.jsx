import React, { useEffect, useState } from 'react';
import { MapPin, AlertCircle } from 'lucide-react';
import { locationsApi } from '../api';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const SOURCE_TYPES = ['all','river','lake','pond','borewell','tap','other'];

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    locationsApi.list()
      .then(setLocations)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? locations : locations.filter(l => l.source_type === filter);

  if (loading) return <LoadingSpinner message="Loading locations…" />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1>Monitoring Locations</h1><p>Water sources and active monitoring points.</p></div>
      </div>
      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      <div className="filter-bar">
        {SOURCE_TYPES.map(t => (
          <button key={t} className={`filter-btn ${filter===t?'active':''}`} onClick={()=>setFilter(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      <MapView locations={filtered} reports={[]} onLocationSelect={setSelected} height="420px" />

      {selected && (
        <div className="section-card" style={{marginTop:16}}>
          <h3>{selected.name}</h3>
          <div className="details-grid">
            <div><small>Type</small><b>{selected.source_type}</b></div>
            <div><small>District</small><b>{selected.district||'—'}</b></div>
            <div><small>State</small><b>{selected.state||'—'}</b></div>
            <div><small>Status</small><b>{selected.is_active?'Active':'Inactive'}</b></div>
            {selected.latitude!=null && <div><small>Coordinates</small><b>{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</b></div>}
          </div>
          {selected.description && <p style={{fontSize:12,color:'#607987',marginTop:8}}>{selected.description}</p>}
          <button className="secondary" style={{marginTop:8}} onClick={()=>setSelected(null)}>Close</button>
        </div>
      )}

      <div className="section-card">
        <div className="section-heading"><h3>Location List ({filtered.length})</h3></div>
        {filtered.length === 0
          ? <EmptyState icon={<MapPin size={28}/>} title="No locations found" body="No monitoring locations match the selected filter." />
          : <div className="location-list">
              {filtered.map(l => (
                <div className="location-item" key={l.id} onClick={()=>setSelected(l)}>
                  <div className="location-icon"><MapPin size={18}/></div>
                  <div className="location-info">
                    <b>{l.name}</b>
                    <span>{l.source_type} · {l.district||'Unknown district'}{l.state ? `, ${l.state}` : ''}</span>
                  </div>
                  <span className={`status ${l.is_active?'active':'revoked'}`}>{l.is_active?'Active':'Inactive'}</span>
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
