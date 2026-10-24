import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';

export const AdminStaffPage = () => {
  const [activeTab, setActiveTab] = useState('receptionists');
  const [receptionists, setReceptionists] = useState([]);
  const [labTechs, setLabTechs] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, labData, pharmData] = await Promise.all([
        adminService.getReceptionists().catch(() => []),
        adminService.getLabTechnicians().catch(() => []),
        adminService.getPharmacists().catch(() => [])
      ]);
      setReceptionists(Array.isArray(recData) ? recData : []);
      setLabTechs(Array.isArray(labData) ? labData : []);
      setPharmacists(Array.isArray(pharmData) ? pharmData : []);
    } catch (err) {
      console.error('Failed to load clinic staff:', err);
      setFeedback({ message: 'Could not load staff directory.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const columns = [
    {
      header: 'Staff ID',
      key: 'id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.receptionist_id || row.technician_id || row.pharmacist_id || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Full Name',
      key: 'full_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.full_name || `Staff #${row.id}`}</span>
    },
    {
      header: 'Email Address',
      key: 'email',
      render: (row) => <span>{row.email || '—'}</span>
    },
    {
      header: 'Qualification / Details',
      key: 'qualification',
      render: (row) => <span>{row.qualification || row.license_number || 'Standard Certification'}</span>
    }
  ];

  const currentData =
    activeTab === 'receptionists'
      ? receptionists
      : activeTab === 'labTechs'
      ? labTechs
      : pharmacists;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Support Staff Directory</h1>
          <p className="page-subtitle">Roster of operational staff across Reception, Diagnostic Laboratory, and Pharmacy.</p>
        </div>
        <button className="btn btn-outline" onClick={loadStaff}>
          🔄 Refresh Directory
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`btn ${activeTab === 'receptionists' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('receptionists')}
        >
          Receptionists ({receptionists.length})
        </button>
        <button
          className={`btn ${activeTab === 'labTechs' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('labTechs')}
        >
          Lab Technicians ({labTechs.length})
        </button>
        <button
          className={`btn ${activeTab === 'pharmacists' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('pharmacists')}
        >
          Pharmacists ({pharmacists.length})
        </button>
      </div>

      <DataTable
        columns={columns}
        data={currentData}
        loading={loading}
        emptyMessage={`No ${activeTab} registered in the system.`}
      />
    </div>
  );
};

export default AdminStaffPage;
