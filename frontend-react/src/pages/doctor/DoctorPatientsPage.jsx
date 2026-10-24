import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const DoctorPatientsPage = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadPatients = useCallback(async (name = '') => {
    setLoading(true);
    try {
      const data = await doctorService.getPatients(name);
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load doctor patients:', err);
      setFeedback({ message: 'Could not load patient roster.', type: 'danger' });
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
          <span
            style={{ fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigate(`/doctor/patients/${row.id}`)}
          >
            {row.first_name} {row.last_name}
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {row.gender} • DOB: {formatDate(row.date_of_birth)}
          </div>
        </div>
      )
    },
    {
      header: 'Contact Phone',
      key: 'phone',
      render: (row) => <span>{row.phone || '—'}</span>
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
      header: 'Enrolled Date',
      key: 'created_at',
      render: (row) => <span>{formatDate(row.created_at)}</span>
    },
    {
      header: 'Clinical Action',
      key: 'action',
      render: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/doctor/patients/${row.id}`)}
          >
            Medical History
          </button>
        </div>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Patient Records</h1>
          <p className="page-subtitle">Access clinical demographic profiles and historical medical backgrounds.</p>
        </div>
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
              placeholder="Search patients by name..."
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
        emptyMessage="No patient records found matching your query."
      />
    </div>
  );
};

export default DoctorPatientsPage;
