import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const ReceptionistPatientsPage = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadPatients = useCallback(async (search = '') => {
    setLoading(true);
    try {
      const data = await receptionistService.getPatients(search);
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load patients:', err);
      setFeedback({ message: 'Could not load patient directory from server.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadPatients(searchTerm);
  };

  const columns = [
    {
      header: 'Patient ID',
      key: 'patient_id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.patient_id || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Full Name',
      key: 'first_name',
      render: (row) => (
        <div>
          <Link
            to={`/receptionist/patients/${row.id}`}
            style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'underline' }}
          >
            {row.first_name} {row.last_name}
          </Link>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.gender} • DOB: {formatDate(row.date_of_birth)}
          </div>
        </div>
      )
    },
    {
      header: 'Phone & Email',
      key: 'phone',
      render: (row) => (
        <div>
          <div>{row.phone || '—'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.email || '—'}</div>
        </div>
      )
    },
    {
      header: 'Blood Group',
      key: 'blood_group',
      render: (row) => (
        <span style={{ fontWeight: 600, color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
          {row.blood_group || 'Unknown'}
        </span>
      )
    },
    {
      header: 'Emergency Contact',
      key: 'emergency_contact_name',
      render: (row) => (
        <div>
          <div>{row.emergency_contact_name || '—'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.emergency_contact_phone || ''}</div>
        </div>
      )
    },
    {
      header: 'Registered',
      key: 'created_at',
      render: (row) => <span>{formatDate(row.created_at)}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate(`/receptionist/patients/${row.id}`)}
          >
            View Profile
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/receptionist/appointments/book?patient=${row.id}`)}
          >
            Book Appt
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Directory</h1>
          <p className="page-subtitle">Search registered patients, review profiles, or enroll new visitors.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/receptionist/patients/register')}
        >
          + Register New Patient
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Search Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <form onSubmit={handleSearch} className="filter-toolbar" style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '500px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by patient name, phone number, or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {searchTerm && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchTerm('');
                  loadPatients('');
                }}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => loadPatients(searchTerm)}
          >
            🔄 Refresh
          </button>
        </form>
      </div>

      <DataTable
        columns={columns}
        data={patients}
        loading={loading}
        emptyMessage="No patients found matching your search criteria."
      />
    </div>
  );
};

export default ReceptionistPatientsPage;
