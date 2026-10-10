import React from 'react';
import { Link } from 'react-router-dom';
import { Droplets, MapPin, Calendar } from 'lucide-react';
import RiskBadge from './RiskBadge';
import StatusBadge from './StatusBadge';

export default function ReportCard({ report }) {
  const date = new Date(report.observation_date).toLocaleDateString();
  return (
    <Link to={`/reports/${report.id}`} className="report-card">
      <div className="report-card-top">
        <span className="report-type-icon"><Droplets size={16} /></span>
        <div className="report-card-meta">
          <span className="report-source">{report.source_type.replace('_', ' ')}</span>
          <span className="report-id">#{report.id}</span>
        </div>
        <StatusBadge status={report.status} />
      </div>
      <div className="report-card-body">
        <span><Calendar size={13} /> {date}</span>
        {(report.latitude != null && report.longitude != null) && (
          <span><MapPin size={13} /> {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
        )}
        <span>Appearance: {report.appearance.replace('_', ' ')}</span>
      </div>
      <div className="report-card-foot">
        <RiskBadge category={report.risk_category} score={report.risk_score} />
      </div>
    </Link>
  );
}
