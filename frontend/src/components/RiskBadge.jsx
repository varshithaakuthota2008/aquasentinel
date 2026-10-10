import React from 'react';

const MAP = {
  low:      { label: 'Low Risk',      cls: 'risk-low' },
  moderate: { label: 'Moderate Risk', cls: 'risk-moderate' },
  high:     { label: 'High Risk',     cls: 'risk-high' },
  critical: { label: 'Critical',      cls: 'risk-critical' },
};

export default function RiskBadge({ category, score }) {
  if (!category) return <span className="risk-badge risk-unknown">Unscored</span>;
  const { label, cls } = MAP[category] || { label: category, cls: 'risk-unknown' };
  return (
    <span className={`risk-badge ${cls}`}>
      {label}{score != null ? ` · ${score}` : ''}
    </span>
  );
}
