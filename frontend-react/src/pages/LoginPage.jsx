import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import useAuth from '../hooks/useAuth';
import { ROLE_DASHBOARDS, ROLES } from '../utils/constants';

const DEMO_USERS = [
  { label: 'Admin', username: 'admin', role: ROLES.ADMIN },
  { label: 'Doctor', username: 'doctor', role: ROLES.DOCTOR },
  { label: 'Receptionist', username: 'reception', role: ROLES.RECEPTIONIST },
  { label: 'Lab Tech', username: 'lab', role: ROLES.LAB_TECHNICIAN },
  { label: 'Pharmacist', username: 'pharmacy', role: ROLES.PHARMACIST }
];

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      const targetDashboard = ROLE_DASHBOARDS[user.role] || '/';
      navigate(targetDashboard, { replace: true });
    } catch (err) {
      console.error('Login error', err);
      setErrorMessage(err.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (demoUser) => {
    setUsername(demoUser.username);
    setPassword('DemoPassword123!');
    setErrorMessage('');
  };

  return (
    <div className="card" style={{ padding: '32px', boxShadow: 'var(--shadow-lg)' }}>
      <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)', textAlign: 'left' }}>
        Sign In
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px', textAlign: 'left' }}>
        Enter your staff credentials to access your dashboard.
      </p>

      {errorMessage && (
        <div
          style={{
            background: 'var(--danger-light)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.88rem',
            marginBottom: '20px',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
            Username
          </label>
          <input
            type="text"
            className="input-control"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. admin or dr_sharma"
            disabled={isSubmitting}
            required
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              outline: 'none',
              background: '#f8fafc',
              fontSize: '0.95rem'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' }}>
            Password
          </label>
          <input
            type="password"
            className="input-control"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            disabled={isSubmitting}
            required
            style={{
              width: '100%',
              padding: '11px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              outline: 'none',
              background: '#f8fafc',
              fontSize: '0.95rem'
            }}
          />
        </div>

        <button
          id="signin-btn"
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '12px 20px',
            marginTop: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            color: '#ffffff',
            backgroundColor: 'var(--primary, #0284c7)',
            border: 'none',
            borderRadius: 'var(--radius-sm, 6px)',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.75 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
            transition: 'all 0.15s ease'
          }}
        >
          {isSubmitting ? (
            <>
              <span>Verifying credentials...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>&rarr;</span>
            </>
          )}
        </button>
      </form>

      <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Quick Demo Login:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {DEMO_USERS.map((demo) => (
            <button
              key={demo.username}
              type="button"
              onClick={() => handleQuickFill(demo)}
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                background: '#f8fafc',
                color: 'var(--text-muted)',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {demo.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
