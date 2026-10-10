import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon paths broken by Vite bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const locationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const reportIcon = (category) => {
  const colorMap = { low: 'green', moderate: 'orange', high: 'red', critical: 'violet' };
  const color = colorMap[category] || 'grey';
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
  });
};

function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center]);
  return null;
}

export default function MapView({
  locations = [],
  reports = [],
  onLocationSelect,
  height = '420px',
  center = [20.5937, 78.9629], // India default
  zoom = 5,
}) {
  const validLocations = locations.filter(l => l.latitude != null && l.longitude != null);
  const validReports = reports.filter(r => r.latitude != null && r.longitude != null);

  return (
    <div className="map-wrap">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: '100%', borderRadius: '12px' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {validLocations.map(loc => (
          <Marker
            key={`loc-${loc.id}`}
            position={[loc.latitude, loc.longitude]}
            icon={locationIcon}
            eventHandlers={onLocationSelect ? { click: () => onLocationSelect(loc) } : {}}
          >
            <Popup>
              <strong>{loc.name}</strong><br />
              Type: {loc.source_type}<br />
              {loc.district && <>District: {loc.district}<br /></>}
              {loc.state && <>State: {loc.state}<br /></>}
              <span className={`map-status ${loc.is_active ? 'active' : ''}`}>
                {loc.is_active ? 'Active' : 'Inactive'}
              </span>
            </Popup>
          </Marker>
        ))}

        {validReports.map(rep => (
          <Marker
            key={`rep-${rep.id}`}
            position={[rep.latitude, rep.longitude]}
            icon={reportIcon(rep.risk_category)}
          >
            <Popup>
              <strong>Report #{rep.id}</strong><br />
              Source: {rep.source_type}<br />
              Status: {rep.status.replace('_', ' ')}<br />
              {rep.risk_category && <>Risk: {rep.risk_category}<br /></>}
              {new Date(rep.observation_date).toLocaleDateString()}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="map-legend">
        <span><span className="legend-dot blue" /> Monitoring Location</span>
        <span><span className="legend-dot green" /> Low Risk Report</span>
        <span><span className="legend-dot orange" /> Moderate Risk</span>
        <span><span className="legend-dot red" /> High Risk</span>
        <span><span className="legend-dot violet" /> Critical</span>
      </div>
    </div>
  );
}
