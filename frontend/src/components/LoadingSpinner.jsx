import React from 'react';

export default function LoadingSpinner({ message = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>{message}</span>
    </div>
  );
}
