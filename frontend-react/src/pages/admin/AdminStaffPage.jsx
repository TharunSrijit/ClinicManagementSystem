import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

export const AdminStaffPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('receptionists');
  const [receptionists, setReceptionists] = useState([]);
  const [labTechs, setLabTechs] = useState([]);
  const [pharmacists, setPharmacists] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffModalMode, setStaffModalMode] = useState('view');
  const [staffDetailsForm, setStaffDetailsForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);
  const [staffForm, setStaffForm] = useState({
    user: '',
    phone: '',
    qualification: '',
    date_of_joining: getTodayDate()
  });
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, labData, pharmData, doctorData, userData] = await Promise.all([
        adminService.getReceptionists().catch(() => []),
        adminService.getLabTechnicians().catch(() => []),
        adminService.getPharmacists().catch(() => []),
        adminService.getDoctors().catch(() => []),
        adminService.getUsers()
      ]);
      setReceptionists(Array.isArray(recData) ? recData : []);
      setLabTechs(Array.isArray(labData) ? labData : []);
      setPharmacists(Array.isArray(pharmData) ? pharmData : []);
      setDoctors(Array.isArray(doctorData) ? doctorData : []);
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
    pharmacists: { role: 'PHARMACIST', label: 'Pharmacist', profiles: pharmacists },
    doctors: { role: 'DOCTOR', label: 'Doctor', profiles: doctors }
  };
  const selectedStaffType = tabConfig[activeTab];
  const linkedUserIds = new Set(selectedStaffType.profiles.map((profile) => Number(profile.user)));
  const usersById = new Map(users.map((user) => [Number(user.id), user]));
  const availableUsers = users.filter(
    (user) => user.role === selectedStaffType.role && !linkedUserIds.has(Number(user.id))
  );

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
        date_of_joining: staffDetailsForm.date_of_joining || null
      };
      profile.qualification = staffDetailsForm.qualification;
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
      await adminService.setUserActive(user.id, !(activeTab === 'doctors' ? profile.is_active : user.is_active));
      setFeedback({
        message: (activeTab === 'doctors' ? profile.is_active : user.is_active)
          ? 'Account deactivated.'
          : 'Account activated.',
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
      if (activeTab === 'doctors') {
        await adminService.deleteDoctor(profile.id);
      } else {
        await adminService.deleteStaffProfile(profile.user);
      }
      setFeedback({
        message: `${activeTab === 'doctors' ? 'Doctor' : 'Staff'} profile deleted. The user account was not deleted.`,
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

  const handleAddStaff = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const profile = {
        phone: staffForm.phone,
        qualification: staffForm.qualification,
        date_of_joining: staffForm.date_of_joining || null
      };
      await adminService.createStaffProfile({
        role: selectedStaffType.role,
        existing_user: Number(staffForm.user),
        profile
      });
      setFeedback({ message: `${selectedStaffType.label} added to the staff directory.`, type: 'success' });
      setIsModalOpen(false);
      setStaffForm({
        user: '',
        phone: '',
        qualification: '',
        date_of_joining: getTodayDate()
      });
      await loadStaff();
    } catch (err) {
      console.error('Failed to add staff profile:', err);
      setFeedback({ message: err.message || 'Staff profile could not be created.', type: 'danger' });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      header: 'Staff ID',
      key: 'id',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.employee_id || row.receptionist_id || row.technician_id || row.pharmacist_id || row.doctor_id || `#${row.id}`}
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
      render: (row) => <span>{row.email || '—'}</span>
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
        const isActive = activeTab === 'doctors'
          ? row.is_active
          : usersById.get(Number(row.user))?.is_active;
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
      headerStyle: { minWidth: activeTab === 'doctors' ? '350px' : '310px' },
      render: (row) => {
        const user = usersById.get(Number(row.user));
        return (
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => openStaffModal(row, 'view')}>
              View
            </button>
            {activeTab === 'doctors' ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => navigate(`/admin/doctors?edit=${row.id}`)}
              >
                Edit
              </button>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => openStaffModal(row, 'edit')}>
                Edit
              </button>
            )}
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
      : activeTab === 'pharmacists'
      ? pharmacists
      : doctors;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Staff Directory</h1>
          <p className="page-subtitle">Roster of doctors and support staff across the clinic.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={loadStaff}>
            🔄 Refresh Directory
          </button>
          {activeTab === 'doctors' ? (
            <button className="btn btn-primary" onClick={() => navigate('/admin/doctors')}>
              + Register Doctor Profile
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                setStaffForm({
                  user: '',
                  phone: '',
                  qualification: '',
                  date_of_joining: getTodayDate()
                });
                setIsModalOpen(true);
              }}
            >
              + Add Staff Member
            </button>
          )}
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
        <button
          className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('doctors')}
        >
          Doctors ({doctors.length})
        </button>
      </div>

      <DataTable
        columns={columns}
        data={currentData}
        loading={loading}
        emptyMessage={`No ${selectedStaffType.label.toLowerCase()} profiles registered in the system.`}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStaff(null);
        }}
        title={selectedStaff ? `${staffModalMode === 'edit' ? 'Edit' : 'View'} ${selectedStaffType.label}` : `Add ${selectedStaffType.label}`}
      >
        {selectedStaff ? (
          staffModalMode === 'view' ? (
            <div>
              {[
                ['Name', `${staffDetailsForm.first_name} ${staffDetailsForm.last_name}`.trim() || '—'],
                ['Email', staffDetailsForm.email || '—'],
                ['Contact Number', activeTab === 'doctors'
                  ? selectedStaff.contact_number || usersById.get(Number(selectedStaff.user))?.phone || '—'
                  : staffDetailsForm.phone || '—'],
                ...(activeTab === 'doctors'
                  ? [
                      ['Specialization', selectedStaff.specialization || '—'],
                      ['Qualification', selectedStaff.qualification || '—'],
                      ['Date of Joining', selectedStaff.date_of_joining || '—'],
                      ['Medical Registration #', selectedStaff.registration_number || '—'],
                      ['Consultation Fee', `₹${Number(selectedStaff.consultation_fee || 0).toFixed(2)}`],
                      ['Available Days', (selectedStaff.available_days || []).join(', ') || '—'],
                      ['Practice Hours', `${selectedStaff.available_from?.slice(0, 5) || '—'} - ${selectedStaff.available_to?.slice(0, 5) || '—'}`]
                    ]
                  : [
                      ['Qualification', staffDetailsForm.qualification || '—'],
                      ['Date of Joining', staffDetailsForm.date_of_joining || '—']
                    ]),
                ['Status', (activeTab === 'doctors' ? selectedStaff.is_active : usersById.get(Number(selectedStaff.user))?.is_active) ? 'Active' : 'Inactive']
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
        ) : (
        <form onSubmit={handleAddStaff}>
          <p style={{ marginTop: 0, color: 'var(--text-muted)' }}>
            Select an existing {selectedStaffType.label.toLowerCase()} account to add it to this staff directory.
          </p>
          <div className="form-group">
            <label className="form-label">User Account *</label>
            <select
              className="form-select"
              required
              value={staffForm.user}
              onChange={(event) => setStaffForm({ ...staffForm, user: event.target.value })}
            >
              <option value="">-- Select an account --</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email})
                </option>
              ))}
            </select>
            {availableUsers.length === 0 && (
              <small style={{ color: 'var(--text-muted)' }}>
                No unlinked accounts with this role. Create one in{' '}
                <button
                  type="button"
                  onClick={() => navigate('/admin/users')}
                  style={{ padding: 0, border: 0, background: 'none', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  User Accounts
                </button>
                {' '}first.
              </small>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input
              className="form-control"
              type="tel"
              required
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              minLength="10"
              maxLength="10"
              title="Enter exactly 10 digits, starting with 6, 7, 8, or 9."
              value={staffForm.phone}
              onChange={(event) => setStaffForm({ ...staffForm, phone: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Joining</label>
            <input
              type="date"
              className="form-control"
              max={getTodayDate()}
              value={staffForm.date_of_joining}
              onChange={(event) => setStaffForm({ ...staffForm, date_of_joining: event.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Qualification {activeTab === 'receptionists' ? '(optional)' : '*'}
            </label>
            <input
              className="form-control"
              required={activeTab !== 'receptionists'}
              pattern="[A-Za-z. ]+"
              title="Qualification may contain letters, spaces, and periods only."
              value={staffForm.qualification}
              onChange={(event) => setStaffForm({ ...staffForm, qualification: event.target.value })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || availableUsers.length === 0}>
              {submitting ? 'Adding...' : 'Add to Staff'}
            </button>
          </div>
        </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminStaffPage;
