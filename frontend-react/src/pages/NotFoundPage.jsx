import React from 'react';
import { Link } from 'react-router-dom';
import { FileSearch } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-muted)' }}>
        <FileSearch size={48} strokeWidth={1.5} />
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
        Page Not Found
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '12px auto 28px' }}>
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Go Back Home
      </Link>
    </div>
  );
};

export default NotFoundPage;
