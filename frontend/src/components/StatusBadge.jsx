import React from 'react';

const MAP = {
  pending_review: { label: 'Pending Review', cls: 'status pending' },
  under_review:   { label: 'Under Review',   cls: 'status under-review' },
  resolved:       { label: 'Resolved',        cls: 'status resolved' },
  pending:        { label: 'Pending',         cls: 'status pending' },
  active:         { label: 'Active',          cls: 'status active' },
  rejected:       { label: 'Rejected',        cls: 'status rejected' },
  revoked:        { label: 'Revoked',         cls: 'status revoked' },
};

export default function StatusBadge({ status }) {
  const { label, cls } = MAP[status] || { label: status, cls: 'status' };
  return <span className={cls}>{label}</span>;
}
