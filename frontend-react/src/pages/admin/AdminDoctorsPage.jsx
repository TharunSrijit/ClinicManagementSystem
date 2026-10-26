import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Stethoscope,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Trash2,
  AlertCircle,
  UserCheck,
  Search
} from 'lucide-react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';
import StatCard from '../../components/StatCard';
import { formatCurrency } from '../../utils/formatters';

const getTodayDate = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun'
};
const FULL_DAY_LABELS = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday'
};

const formatScheduleHours = (from, to) => {
  if (!from && !to) return 'Hours not set';
  const f = from ? from.slice(0, 5) : '00:00';
  const t = to ? to.slice(0, 5) : '00:00';
  return `${f}–${t}`;
};

const formatScheduleDays = (days) => {
  if (!days || days.length === 0) return 'No days set';
  const validDays = DAY_ORDER.filter((d) => days.includes(d));
  if (validDays.length === 7) return 'Mon–Sun (Every day)';
  if (
    validDays.length === 5 &&
    ['MON', 'TUE', 'WED', 'THU', 'FRI'].every((d) => validDays.includes(d))
  ) {
    return 'Mon–Fri';
  }
  if (
    validDays.length === 6 &&
    ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].every((d) => validDays.includes(d))
  ) {
    return 'Mon–Sat';
  }
  return validDays.map((d) => DAY_LABELS[d] || d).join(', ');
};

const getScheduleTooltip = (doctor) => {
  const hours = formatScheduleHours(doctor.available_from, doctor.available_to);
  const days =
    (doctor.available_days || [])
      .map((d) => FULL_DAY_LABELS[d] || d)
      .join(', ') || 'None';
  const slot = doctor.slot_minutes ? `\nSlot duration: ${doctor.slot_minutes} mins` : '';
  return `Hours: ${hours}\nDays: ${days}${slot}`;
};

const DoctorActionMenu = ({ doctor, onEdit, onDelete, onToggleActive, isActionBusy }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="doctor-actions-cell" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => onEdit(doctor)}
        disabled={isActionBusy}
        style={{ padding: '6px 14px', fontSize: '0.82rem' }}
      >
        Edit
      </button>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isActionBusy}
        title="More actions"
        aria-label="More actions"
        style={{ padding: '6px 10px', fontSize: '1rem', lineHeight: 1 }}
      >
        ⋮
      </button>

      {isOpen && (
        <div className="action-menu-dropdown" role="menu">
          <button
            type="button"
            className="action-menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onToggleActive(doctor);
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              {doctor.is_active ? <Pause size={14} /> : <Play size={14} />}
            </span>
            {doctor.is_active ? 'Deactivate Doctor' : 'Activate Doctor'}
          </button>
          <button
            type="button"
            className="action-menu-item danger-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onDelete(doctor);
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              <Trash2 size={14} />
            </span>
            Delete Doctor
          </button>
        </div>
      )}
    </div>
  );
};

export const AdminDoctorsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [actionDoctorId, setActionDoctorId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  // Dynamic Specializations state
  const [specializationsList, setSpecializationsList] = useState([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const createFormDefaults = {
    user: '',
    specialization: '',
    qualification: 'MBBS, MD',
    contact_number: '',
    date_of_joining: getTodayDate(),
    registration_number: '',
    consultation_fee: 500,
    available_from: '09:00:00',
    available_to: '17:00:00',
    available_days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    slot_minutes: 15
  };
  const [form, setForm] = useState(createFormDefaults);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingDoctor(null);
    setForm(createFormDefaults);
    setFieldErrors({});
  };

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [docsData, usersData] = await Promise.all([
        adminService.getDoctors(),
        adminService.getUsers().catch(() => [])
      ]);
      setDoctors(Array.isArray(docsData) ? docsData : []);
      const linkedUserIds = new Set(
        (Array.isArray(docsData) ? docsData : []).map((doctor) => Number(doctor.user))
      );
      setUsers(
        Array.isArray(usersData)
          ? usersData.filter(
              (user) => user.role === 'DOCTOR' && !linkedUserIds.has(Number(user.id))
            )
          : []
      );
    } catch (err) {
      console.error('Failed to load doctors:', err);
      setLoadError(err.message || 'Could not load doctor profiles.');
      showFeedback('Could not load doctor profiles.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSpecializations = useCallback(async () => {
    try {
      const data = await adminService.getSpecializations();
      setSpecializationsList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load specializations:', err);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
    loadSpecializations();
  }, [loadDoctors, loadSpecializations]);

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.specialization || !form.specialization.trim()) {
      errors.specialization = 'Please select a specialization.';
    } else if (!/^[A-Za-z &,-]+$/.test(form.specialization.trim())) {
      errors.specialization = 'Specialization contains letters only.';
    }
    if (!/^[A-Za-z]+(( ?, ?| )[A-Za-z]+)*$/.test(form.qualification.trim())) {
      errors.qualification =
        'Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD).';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const doctorData = {
        user: Number(form.user),
        specialization: form.specialization,
        qualification: form.qualification,
        contact_number: form.contact_number,
        date_of_joining: form.date_of_joining || null,
        registration_number: form.registration_number,
        consultation_fee: Number(form.consultation_fee),
        available_from: form.available_from,
        available_to: form.available_to,
        available_days: form.available_days,
        slot_minutes: Number(form.slot_minutes)
      };
      if (editingDoctor) {
        await adminService.updateDoctor(editingDoctor.id, doctorData);
        showFeedback('Doctor profile updated successfully!');
      } else {
        await adminService.createDoctor(doctorData);
        showFeedback('Doctor profile registered successfully!');
      }
      closeModal();
      await loadDoctors();
    } catch (err) {
      console.error('Failed to save doctor profile:', err);
      const apiErrors = err.data || {};
      const nextFieldErrors = {};
      if (apiErrors.specialization) {
        nextFieldErrors.specialization = 'Specialization contains letters only.';
      }
      if (apiErrors.qualification) {
        nextFieldErrors.qualification =
          'Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD).';
      }
      if (Object.keys(nextFieldErrors).length) {
        setFieldErrors(nextFieldErrors);
      } else {
        showFeedback(err.message || 'Doctor profile could not be saved.', 'danger');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDoctor = (doctor) => {
    setEditingDoctor(doctor);
    setFieldErrors({});
    setForm({
      user: String(doctor.user),
      specialization: doctor.specialization || '',
      qualification: doctor.qualification || '',
      contact_number: doctor.contact_number || '',
      date_of_joining: doctor.date_of_joining || '',
      registration_number: doctor.registration_number || '',
      consultation_fee: doctor.consultation_fee ?? 0,
      available_from: doctor.available_from || '',
      available_to: doctor.available_to || '',
      available_days: doctor.available_days || ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      slot_minutes: doctor.slot_minutes || 15
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const doctorId = Number(searchParams.get('edit'));
    if (loading || !doctorId) return;

    const doctor = doctors.find((item) => Number(item.id) === doctorId);
    if (doctor) openEditDoctor(doctor);
    navigate('/admin/doctors', { replace: true });
  }, [doctors, loading, navigate, searchParams]);

  const handleDeleteDoctor = async (doctor) => {
    if (
      !window.confirm(
        `Delete Dr. ${doctor.full_name || doctor.doctor_id}'s profile? Their user account will remain.`
      )
    ) {
      return;
    }

    setActionDoctorId(doctor.id);
    try {
      await adminService.deleteDoctor(doctor.id);
      showFeedback('Doctor profile deleted. The user account was not deleted.');
      await loadDoctors();
    } catch (err) {
      console.error('Failed to delete doctor profile:', err);
      showFeedback(err.message || 'Doctor profile could not be deleted.', 'danger');
    } finally {
      setActionDoctorId(null);
    }
  };

  const handleToggleDoctorActive = async (doctor) => {
    setActionDoctorId(doctor.id);
    try {
      await adminService.setDoctorActive(doctor.user, !doctor.is_active);
      showFeedback(
        doctor.is_active ? 'Doctor account deactivated.' : 'Doctor account activated.'
      );
      await loadDoctors();
    } catch (err) {
      console.error('Failed to update doctor account status:', err);
      showFeedback(err.message || 'Doctor account status could not be updated.', 'danger');
    } finally {
      setActionDoctorId(null);
    }
  };

  // Dynamic specializations list from backend catalog & active doctor records
  const specializations = useMemo(() => {
    const set = new Set();
    specializationsList.forEach((s) => {
      if (s.name && (s.is_active || form.specialization === s.name)) {
        set.add(s.name.trim());
      }
    });
    doctors.forEach((d) => {
      if (d.specialization && d.specialization.trim()) {
        set.add(d.specialization.trim());
      }
    });
    if (form.specialization && form.specialization.trim()) {
      set.add(form.specialization.trim());
    }
    return Array.from(set).sort();
  }, [specializationsList, doctors, form.specialization]);


  // Combined filtering logic
  const filteredDoctors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return doctors.filter((doctor) => {
      // 1. Search filter across 5 fields
      if (query) {
        const matches = [
          doctor.full_name,
          doctor.doctor_id,
          doctor.email,
          doctor.specialization,
          doctor.registration_number
        ].some((val) => val && String(val).toLowerCase().includes(query));

        if (!matches) return false;
      }

      // 2. Specialization filter
      if (selectedSpecialization !== 'ALL') {
        if (doctor.specialization?.trim() !== selectedSpecialization) {
          return false;
        }
      }

      // 3. Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'ACTIVE' && !doctor.is_active) return false;
        if (selectedStatus === 'INACTIVE' && doctor.is_active) return false;
      }

      return true;
    });
  }, [doctors, searchTerm, selectedSpecialization, selectedStatus]);

  // Summary counts calculated from actual API data
  const totalCount = doctors.length;
  const activeCount = useMemo(
    () => doctors.filter((d) => Boolean(d.is_active)).length,
    [doctors]
  );
  const inactiveCount = useMemo(
    () => doctors.filter((d) => !d.is_active).length,
    [doctors]
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSpecialization('ALL');
    setSelectedStatus('ALL');
  };

  const renderStatusBadge = (isActive) => {
    if (isActive) {
      return <span className="badge badge-success">Active</span>;
    }
    return <span className="badge badge-neutral">Inactive</span>;
  };

  // 7-column table layout
  const columns = [
    {
      header: 'Doctor',
      key: 'doctor',
      headerStyle: { minWidth: '220px' },
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
            {row.full_name || `Dr. #${row.id}`}
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
              {row.doctor_id || `#${row.id}`}
            </span>
            {row.email && <span>• {row.email}</span>}
          </div>
        </div>
      )
    },
    {
      header: 'Specialization',
      key: 'specialization',
      headerStyle: { minWidth: '180px' },
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.specialization || '—'}
          </div>
          {row.qualification && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {row.qualification}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Medical Registration',
      key: 'registration_number',
      headerStyle: { minWidth: '160px' },
      render: (row) => (
        <span style={{ fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
          {row.registration_number || '—'}
        </span>
      )
    },
    {
      header: 'Consultation Fee',
      key: 'consultation_fee',
      headerStyle: { minWidth: '140px' },
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          {formatCurrency(row.consultation_fee)}
        </span>
      )
    },
    {
      header: 'Schedule',
      key: 'schedule',
      headerStyle: { minWidth: '160px' },
      render: (row) => (
        <div title={getScheduleTooltip(row)}>
          <div style={{ fontWeight: 500, color: 'var(--text-main)', fontSize: '0.86rem' }}>
            {formatScheduleHours(row.available_from, row.available_to)}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {formatScheduleDays(row.available_days)}
          </div>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'is_active',
      headerStyle: { minWidth: '90px' },
      render: (row) => renderStatusBadge(row.is_active)
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { width: '130px', minWidth: '120px' },
      render: (row) => (
        <DoctorActionMenu
          doctor={row}
          onEdit={openEditDoctor}
          onDelete={handleDeleteDoctor}
          onToggleActive={handleToggleDoctorActive}
          isActionBusy={actionDoctorId === row.id}
        />
      )
    }
  ];

  return (
    <div>
      {/* 2. Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Registry & Credentials</h1>
          <p className="page-subtitle">
            Manage doctor profiles, qualifications, consultation fees, and availability.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingDoctor(null);
            setForm(createFormDefaults);
            setFieldErrors({});
            setIsModalOpen(true);
          }}
        >
          + Register Doctor
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* 3. Summary Cards */}
      <div
        className="grid-stats"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          marginBottom: '24px'
        }}
      >
        <StatCard
          title="Total Doctors"
          value={totalCount}
          subtitle="Registered in clinic directory"
          icon={Stethoscope}
          color="primary"
        />
        <StatCard
          title="Active Doctors"
          value={activeCount}
          subtitle="Currently available for appointments"
          icon={CheckCircle2}
          color="success"
        />
        <StatCard
          title="Inactive Doctors"
          value={inactiveCount}
          subtitle="Profiles temporarily paused"
          icon={Clock}
          color="warning"
        />
      </div>

      {/* 4. Search Bar and Filter Toolbar */}
      <div className="registry-toolbar-card">
        <div className="registry-search-wrapper">
          <span className="registry-search-icon" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            className="registry-search-input"
            placeholder="Search by doctor name, ID, email, specialization, or registration number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="registry-filters-group">
          {/* Specialization Filter */}
          <select
            className="registry-filter-select"
            value={selectedSpecialization}
            onChange={(e) => setSelectedSpecialization(e.target.value)}
            aria-label="Filter by specialization"
          >
            <option value="ALL">All Specializations</option>
            {specializations.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="registry-filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {/* Reset Button */}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleResetFilters}
            style={{ padding: '9px 16px', height: '40px' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* 8. UI States: Loading / Error / Empty / No Results / Table */}
      {loading ? (
        <DataTable columns={columns} data={[]} loading={true} />
      ) : loadError ? (
        <div className="registry-state-card">
          <div className="registry-state-icon">
            <AlertCircle size={36} color="var(--danger)" strokeWidth={1.8} />
          </div>
          <div className="registry-state-title">Unable to Load Doctor Profiles</div>
          <div className="registry-state-desc">{loadError}</div>
          <button type="button" className="btn btn-primary" onClick={loadDoctors}>
            Retry
          </button>
        </div>
      ) : doctors.length === 0 ? (
        <div className="registry-state-card">
          <div className="registry-state-icon">
            <UserCheck size={36} color="var(--primary)" strokeWidth={1.8} />
          </div>
          <div className="registry-state-title">No doctors registered yet.</div>
          <div className="registry-state-desc">
            Get started by registering your clinic's first doctor practice profile.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setEditingDoctor(null);
              setForm(createFormDefaults);
              setFieldErrors({});
              setIsModalOpen(true);
            }}
          >
            + Register Doctor
          </button>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="registry-state-card">
          <div className="registry-state-icon">
            <Search size={36} color="var(--text-muted)" strokeWidth={1.8} />
          </div>
          <div className="registry-state-title">No doctors match your search.</div>
          <div className="registry-state-desc">
            No doctors matched your current search and filter combination. Try clearing your
            filters or modifying your search terms.
          </div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleResetFilters}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table View */}
          <div className="doctors-desktop-view">
            <DataTable columns={columns} data={filteredDoctors} loading={false} />
          </div>

          {/* Mobile Doctor Cards View */}
          <div className="doctors-mobile-view">
            {filteredDoctors.map((doc) => (
              <div key={doc.id} className="doctor-mobile-card">
                <div className="doctor-mobile-card-header">
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: 'var(--text-main)'
                      }}
                    >
                      {doc.full_name || `Dr. #${doc.id}`}
                    </div>
                    <div
                      style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        {doc.doctor_id || `#${doc.id}`}
                      </span>
                      {doc.email && ` • ${doc.email}`}
                    </div>
                  </div>
                  {renderStatusBadge(doc.is_active)}
                </div>

                <div className="doctor-mobile-grid">
                  <div className="doctor-mobile-meta-item">
                    <label>Specialization</label>
                    <div className="meta-val">{doc.specialization}</div>
                    {doc.qualification && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '2px'
                        }}
                      >
                        {doc.qualification}
                      </div>
                    )}
                  </div>
                  <div className="doctor-mobile-meta-item">
                    <label>Registration #</label>
                    <div className="meta-val">{doc.registration_number || '—'}</div>
                  </div>
                  <div className="doctor-mobile-meta-item">
                    <label>Consultation Fee</label>
                    <div
                      className="meta-val"
                      style={{ fontWeight: 700, color: 'var(--text-main)' }}
                    >
                      {formatCurrency(doc.consultation_fee)}
                    </div>
                  </div>
                  <div className="doctor-mobile-meta-item">
                    <label>Schedule</label>
                    <div className="meta-val">
                      {formatScheduleHours(doc.available_from, doc.available_to)}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px'
                      }}
                    >
                      {formatScheduleDays(doc.available_days)}
                    </div>
                  </div>
                </div>

                <div className="doctor-mobile-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEditDoctor(doc)}
                    disabled={actionDoctorId === doc.id}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleToggleDoctorActive(doc)}
                    disabled={actionDoctorId === doc.id}
                  >
                    {doc.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--border-subtle)' }}
                    onClick={() => handleDeleteDoctor(doc)}
                    disabled={actionDoctorId === doc.id}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Register / Edit Doctor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingDoctor ? 'Edit Doctor Practice Profile' : 'Register Doctor Practice Profile'
        }
      >
        <form onSubmit={handleCreateDoctor}>
          <div className="form-group">
            <label className="form-label">Associated User Account *</label>
            <select
              className="form-select"
              required
              value={form.user}
              disabled={Boolean(editingDoctor)}
              onChange={(e) => setForm({ ...form, user: e.target.value })}
            >
              <option value="">-- Select Doctor User Account --</option>
              {editingDoctor && (
                <option value={editingDoctor.user}>
                  {editingDoctor.full_name || editingDoctor.email || editingDoctor.doctor_id}
                </option>
              )}
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({u.first_name || ''} {u.last_name || ''} - {u.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Specialization *</label>
              <select
                className={`form-control${fieldErrors.specialization ? ' is-invalid' : ''}`}
                required
                aria-invalid={Boolean(fieldErrors.specialization)}
                aria-describedby={
                  fieldErrors.specialization ? 'doctor-specialization-error' : undefined
                }
                value={form.specialization}
                onChange={(e) => {
                  setForm({ ...form, specialization: e.target.value });
                  setFieldErrors({ ...fieldErrors, specialization: '' });
                }}
              >
                <option value="">Select Specialization</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
              {fieldErrors.specialization && (
                <small id="doctor-specialization-error" className="field-error" role="alert">
                  {fieldErrors.specialization}
                </small>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Qualification *</label>
              <input
                type="text"
                className={`form-control${fieldErrors.qualification ? ' is-invalid' : ''}`}
                required
                pattern="[A-Za-z]+(( ?, ?| )[A-Za-z]+)*"
                title="Qualification must contain letters only, separated by spaces or commas (for example, MBBS, MD)."
                aria-invalid={Boolean(fieldErrors.qualification)}
                aria-describedby={
                  fieldErrors.qualification ? 'doctor-qualification-error' : undefined
                }
                value={form.qualification}
                onChange={(e) => {
                  setForm({ ...form, qualification: e.target.value });
                  setFieldErrors({ ...fieldErrors, qualification: '' });
                }}
                placeholder="e.g. MBBS, MD"
              />
              {fieldErrors.qualification && (
                <small id="doctor-qualification-error" className="field-error" role="alert">
                  {fieldErrors.qualification}
                </small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Contact Number</label>
            <input
              type="tel"
              inputMode="numeric"
              minLength="10"
              maxLength="10"
              pattern="[6-9][0-9]{9}"
              title="Enter exactly 10 digits, starting with 6, 7, 8, or 9."
              className="form-control"
              value={form.contact_number}
              onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
              placeholder="Doctor contact number"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date of Joining</label>
            <input
              type="date"
              className="form-control"
              max={getTodayDate()}
              value={form.date_of_joining}
              onChange={(e) => setForm({ ...form, date_of_joining: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Medical Registration # *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z]{3}-[0-9]+"
                title="Registration number must be 3 letters followed by a hyphen and numbers (for example, REG-1234)."
                value={form.registration_number}
                onChange={(e) =>
                  setForm({ ...form, registration_number: e.target.value })
                }
                placeholder="e.g. REG-1234"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Consultation Fee (₹) *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                required
                value={form.consultation_fee}
                onChange={(e) =>
                  setForm({ ...form, consultation_fee: e.target.value })
                }
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Available From</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={form.available_from}
                onChange={(e) => setForm({ ...form, available_from: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Available To</label>
              <input
                type="time"
                step="1"
                className="form-control"
                value={form.available_to}
                onChange={(e) => setForm({ ...form, available_to: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Slot Duration (Min)</label>
              <input
                type="number"
                min="5"
                max="60"
                className="form-control"
                value={form.slot_minutes}
                onChange={(e) => setForm({ ...form, slot_minutes: e.target.value })}
              />
            </div>
          </div>

          <fieldset className="form-group" style={{ border: 0, padding: 0, marginTop: '16px' }}>
            <legend className="form-label">Available Days *</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {[
                ['MON', 'Monday'],
                ['TUE', 'Tuesday'],
                ['WED', 'Wednesday'],
                ['THU', 'Thursday'],
                ['FRI', 'Friday'],
                ['SAT', 'Saturday'],
                ['SUN', 'Sunday']
              ].map(([day, label]) => (
                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={form.available_days.includes(day)}
                    onChange={(event) => {
                      const availableDays = event.target.checked
                        ? [...form.available_days, day]
                        : form.available_days.filter((selectedDay) => selectedDay !== day);
                      setForm({ ...form, available_days: availableDays });
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
            {form.available_days.length === 0 && (
              <small style={{ color: 'var(--danger)' }}>Select at least one available day.</small>
            )}
          </fieldset>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              marginTop: '24px'
            }}
          >
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || form.available_days.length === 0}
            >
              {submitting
                ? editingDoctor
                  ? 'Saving...'
                  : 'Registering...'
                : editingDoctor
                ? 'Save Changes'
                : 'Register Doctor Profile'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDoctorsPage;