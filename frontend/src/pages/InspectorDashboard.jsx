import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, AlertCircle, ClipboardList } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { reportsApi, inspectionsApi } from '../api';
import ReportCard from '../components/ReportCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

export default function InspectorDashboard() {
  const { user, token } = useAuth();
  const [reports, setReports] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([reportsApi.list(token), inspectionsApi.list(token)])
      .then(([r, i]) => { setReports(r); setInspections(i); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner message="Loading dashboard…" />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1>Inspector Dashboard</h1><p>Welcome, {user.full_name.split(' ')[0]}. Manage your field inspections.</p></div>
        <Link to="/inspections/new" className="primary" style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:8}}>
          <PlusCircle size={17}/> New Inspection
        </Link>
      </div>
      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      <div className="stats-grid">
        {[
          ['Total Reports', reports.length],
          ['My Inspections', inspections.length],
          ['Pending Reports', reports.filter(r=>r.status==='pending_review').length],
          ['Requires Lab', inspections.filter(i=>i.outcome==='requires_lab').length],
        ].map(([l,v])=><div className="stat" key={l}><span>{l}</span><strong>{v}</strong></div>)}
      </div>

      <div className="section-card">
        <div className="section-heading"><h3>Available Reports</h3></div>
        {reports.length === 0
          ? <EmptyState icon={<ClipboardList size={30}/>} title="No reports available" body="Reports submitted by citizens will appear here." />
          : <div className="report-grid">{reports.slice(0,9).map(r=><ReportCard key={r.id} report={r}/>)}</div>}
      </div>
    </div>
  );
}
