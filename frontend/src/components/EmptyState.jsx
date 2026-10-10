import React from 'react';

export default function EmptyState({ icon, title, body, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <strong>{title}</strong>
      {body && <span>{body}</span>}
      {action}
    </div>
  );
}
