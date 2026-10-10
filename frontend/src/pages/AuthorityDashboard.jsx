import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { reportsApi, locationsApi, dashboardApi } from '../api';
import ReportCard from '../components/ReportCard';
import MapView from '../components/MapView';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthorityDashboard() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [locations, setLocations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    Promise.all([reportsApi.list(token), locationsApi.list(), dashboardApi.summary(token)])
      .then(([r, l, s]) => { setReports(r); setLocations(l); setSummary(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [token]);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1>Water Authority Dashboard</h1><p>Review submitted reports and monitor water sources.</p></div>
        <button className="secondary" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>
      {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}

      <div className="stats-grid">
        {[
          ['Total Reports', summary?.total_reports ?? reports.length],
          ['Pending Review', summary?.pending_reports ?? reports.filter(r=>r.status==='pending_review').length],
          ['Under Review', summary?.under_review_reports ?? reports.filter(r=>r.status==='under_review').length],
          ['High / Critical', (summary?.high_risk_reports ?? 0) + (summary?.critical_risk_reports ?? 0)],
        ].map(([l,v]) => <div className="stat" key={l}><span>{l}</span><strong>{v}</strong></div>)}
      </div>

      <div className="section-card">
        <h3>All Reports Map</h3>
        <MapView locations={locations} reports={reports} height="360px" />
      </div>

      <div className="section-card">
        <div className="section-heading"><h3>Recent Submissions</h3></div>
        <div className="report-grid">
          {reports.slice(0,8).map(r => <ReportCard key={r.id} report={r} />)}
        </div>
        {reports.length > 8 && <p style={{fontSize:11,color:'#7a8d95',marginTop:12}}>Showing 8 of {reports.length} reports.</p>}
      </div>
    </div>
  );
}
