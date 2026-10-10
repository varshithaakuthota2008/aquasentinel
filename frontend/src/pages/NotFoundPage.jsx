import React from 'react';
import { Link } from 'react-router-dom';
import { Droplets } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="page-center">
      <div className="pending-card" style={{ textAlign: 'center' }}>
        <div className="pending-icon"><Droplets size={36} /></div>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard" className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 16, textDecoration: 'none' }}>
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
