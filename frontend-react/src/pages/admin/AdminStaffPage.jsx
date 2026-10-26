import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const AdminStaffPage = () => {
  const [activeTab, setActiveTab] = useState('receptionists');
  const [receptionists, setReceptionists] = useState([]);
  const [labTechs, setLabTechs] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffModalMode, setStaffModalMode] = useState('view');
  const [staffDetailsForm, setStaffDetailsForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, labData, pharmData, userData] = await Promise.all([
        adminService.getReceptionists().catch(() => []),
        adminService.getLabTechnicians().catch(() => []),
        adminService.getPharmacists().catch(() => []),
        adminService.getUsers()
      ]);
      setReceptionists(Array.isArray(recData) ? recData : []);
      setLabTechs(Array.isArray(labData) ? labData : []);
      setPharmacists(Array.isArray(pharmData) ? pharmData : []);
      setUsers(Array.isArray(userData) ? userData : []);
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

  const tabConfig = {
    receptionists: { role: 'RECEPTIONIST', label: 'Receptionist', profiles: receptionists },
    labTechs: { role: 'LAB_TECHNICIAN', label: 'Lab Technician', profiles: labTechs },
    pharmacists: { role: 'PHARMACIST', label: 'Pharmacist', profiles: pharmacists }
  };
  const selectedStaffType = tabConfig[activeTab] || tabConfig.receptionists;
  const usersById = new Map(users.map((user) => [Number(user.id), user]));

  const openStaffModal = (profile, mode) => {
    const user = usersById.get(Number(profile.user)) || {};
    setSelectedStaff(profile);
    setStaffModalMode(mode);
    setStaffDetailsForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: profile.phone || '',
      qualification: profile.qualification || '',
      date_of_joining: profile.date_of_joining || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveStaff = async (event) => {
    event.preventDefault();
    if (!selectedStaff) return;

    setSubmitting(true);
    try {
      const profile = {
        phone: staffDetailsForm.phone,
        date_of_joining: staffDetailsForm.date_of_joining || null,
        qualification: staffDetailsForm.qualification
      };
      await adminService.updateStaffProfile(selectedStaff.user, {
        user: {
          first_name: staffDetailsForm.first_name,
          last_name: staffDetailsForm.last_name,
          email: staffDetailsForm.email
        },
        profile
      });
      setFeedback({ message: `${selectedStaffType.label} details updated.`, type: 'success' });
      setIsModalOpen(false);
      setSelectedStaff(null);
      await loadStaff();
    } catch (err) {
      console.error('Failed to update staff profile:', err);
      setFeedback({ message: err.message || 'Staff details could not be updated.', type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStaffActive = async (profile) => {
    const user = usersById.get(Number(profile.user));
    if (!user) {
      setFeedback({ message: 'Could not find the staff user account.', type: 'danger' });
      return;
    }

    setActionUserId(user.id);
    try {
      await adminService.setUserActive(user.id, !user.is_active);
      setFeedback({
        message: user.is_active ? 'Account deactivated.' : 'Account activated.',
        type: 'success'
      });
      await loadStaff();
    } catch (err) {
      console.error('Failed to update staff account status:', err);
      setFeedback({ message: err.message || 'Staff account status could not be updated.', type: 'danger' });
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteStaff = async (profile) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) {
      return;
    }

    setActionUserId(profile.user);
    try {
      await adminService.deleteStaffProfile(profile.user);
      setFeedback({
        message: 'Staff profile deleted. The user account was not deleted.',
        type: 'success'
      });
      await loadStaff();
    } catch (err) {
      console.error('Failed to delete staff profile:', err);
      setFeedback({ message: err.message || 'Staff profile could not be deleted.', type: 'danger' });
    } finally {
      setActionUserId(null);
    }
  };

  const columns = [
    {
      header: 'Staff ID',
      key: 'id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.employee_id || row.receptionist_id || row.technician_id || row.pharmacist_id || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Full Name',
      key: 'full_name',
      render: (row) => {
        const user = usersById.get(Number(row.user));
        return (
          <span style={{ fontWeight: 600 }}>
            {row.full_name || (user && `${user.first_name} ${user.last_name}`.trim()) || `Staff #${row.id}`}
          </span>
        );
      }
    },
    {
      header: 'Email Address',
      key: 'email',
      render: (row) => {
        const user = usersById.get(Number(row.user));
        return <span>{row.email || user?.email || '—'}</span>;
      }
    },
    {
      header: 'Contact Number',
      key: 'contact_number',
      render: (row) => {
        const user = usersById.get(Number(row.user));
        return <span>{row.contact_number || row.phone || user?.phone || '—'}</span>;
      }
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => {
        const isActive = usersById.get(Number(row.user))?.is_active;
        return (
          <span style={{ color: isActive ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        );
      }
    },
    {
      header: 'Qualification',
      key: 'qualification',
      render: (row) => <span>{row.qualification || '—'}</span>
    },
    {
      header: 'Date of Joining',
      key: 'date_of_joining',
      render: (row) => <span>{row.date_of_joining || '—'}</span>
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '310px' },
      render: (row) => {
        const user = usersById.get(Number(row.user));
        return (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openStaffModal(row, 'view')}>
              View
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openStaffModal(row, 'edit')}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleToggleStaffActive(row)}
              disabled={actionUserId === row.user || !user}
            >
              {user?.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleDeleteStaff(row)}
              disabled={actionUserId === row.user}
            >
              Delete
            </button>
          </div>
        );
      }
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
          <h1 className="page-title">Clinic Staff Directory</h1>
          <p className="page-subtitle">Roster of support staff across the clinic.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={loadStaff}>
            Refresh Directory
          </button>
        </div>
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
        emptyMessage={`No ${selectedStaffType.label.toLowerCase()} profiles registered in the system.`}
      />

      <Modal
        isOpen={isModalOpen && Boolean(selectedStaff)}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStaff(null);
        }}
        title={`${staffModalMode === 'edit' ? 'Edit' : 'View'} ${selectedStaffType.label}`}
      >
        {selectedStaff && (
          staffModalMode === 'view' ? (
            <div>
              {[
                ['Name', `${staffDetailsForm.first_name} ${staffDetailsForm.last_name}`.trim() || '—'],
                ['Email', staffDetailsForm.email || '—'],
                ['Contact Number', staffDetailsForm.phone || '—'],
                ['Qualification', staffDetailsForm.qualification || '—'],
                ['Date of Joining', staffDetailsForm.date_of_joining || '—'],
                ['Status', usersById.get(Number(selectedStaff.user))?.is_active ? 'Active' : 'Inactive']
              ].map(([label, value]) => (
                <p key={label}><strong>{label}:</strong> {value}</p>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveStaff}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-control" pattern="[A-Za-z ]+" title="Use letters and spaces only." value={staffDetailsForm.first_name} onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, first_name: event.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" pattern="[A-Za-z ]+" title="Use letters and spaces only." value={staffDetailsForm.last_name} onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, last_name: event.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={staffDetailsForm.email} onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, email: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input type="tel" className="form-control" inputMode="numeric" pattern="[6-9][0-9]{9}" minLength="10" maxLength="10" title="Enter exactly 10 digits, starting with 6, 7, 8, or 9." value={staffDetailsForm.phone} onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, phone: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Qualification</label>
                <input className="form-control" pattern="[A-Za-z. ]+" title="Qualification may contain letters, spaces, and periods only." value={staffDetailsForm.qualification} onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, qualification: event.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Joining</label>
                <input
                  type="date"
                  className="form-control"
                  max={getTodayDate()}
                  value={staffDetailsForm.date_of_joining}
                  onChange={(event) => setStaffDetailsForm({ ...staffDetailsForm, date_of_joining: event.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )
        )}
      </Modal>
    </div>
  );
};

export default AdminStaffPage;
