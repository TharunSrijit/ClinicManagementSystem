import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import receptionistService from '../../services/receptionistService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatDate, formatTime } from '../../utils/formatters';

export const ReceptionistDashboard = () => {
  const [appointments, setAppointments] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [apptsData, tokensData, patientsData, docsData] = await Promise.all([
        receptionistService.getAppointments().catch(() => []),
        receptionistService.getTokens().catch(() => []),
        receptionistService.getPatients().catch(() => []),
        receptionistService.getDoctors().catch(() => [])
      ]);
      setAppointments(Array.isArray(apptsData) ? apptsData : []);
      setTokens(Array.isArray(tokensData) ? tokensData : []);
      setPatients(Array.isArray(patientsData) ? patientsData : []);
      setDoctors(Array.isArray(docsData) ? docsData : []);
    } catch (err) {
      console.error('Failed to load receptionist dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const activeTokens = tokens.filter(t => ['WAITING', 'IN_CONSULTATION'].includes(String(t.status).toUpperCase())).length;

  const recentApptColumns = [
    {
      header: 'Appt #',
      key: 'id',
      render: (r) => <span style={{ fontWeight: 600 }}>#{r.id}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.patient_name || `Patient #${r.patient}`}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.appointment_type || 'STANDARD'}</div>
        </div>
      )
    },
    {
      header: 'Doctor',
      key: 'doctor_name',
      render: (r) => r.doctor_name || `Doctor #${r.doctor}`
    },
    {
      header: 'Date & Time',
      key: 'appointment_date',
      render: (r) => (
        <div>
          <div>{formatDate(r.appointment_date)}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatTime(r.appointment_time)}</div>
        </div>
      )
    },
    {
      header: 'Status',
      key: 'status',
      render: (r) => <Badge status={r.status} />
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reception Operations Dashboard</h1>
          <p className="page-subtitle">Front desk overview, today's schedule telemetry, and immediate patient actions.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/receptionist/appointments/book" className="btn btn-primary">
            📅 Book Appointment
          </Link>
          <Link to="/receptionist/patients/register" className="btn btn-outline">
            👤 Register Patient
          </Link>
          <button onClick={loadDashboardData} className="btn btn-outline" title="Refresh">
            🔄
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid-stats">
        <StatCard
          title="Total Scheduled"
          value={appointments.length}
          subtitle="All active appointments"
          icon="📅"
          color="primary"
        />
        <StatCard
          title="Active Tokens"
          value={activeTokens}
          subtitle="Waiting in reception"
          icon="🎫"
          color="warning"
        />
        <StatCard
          title="Patients Enrolled"
          value={patients.length}
          subtitle="Registered clinic members"
          icon="👥"
          color="info"
        />
        <StatCard
          title="On-Duty Doctors"
          value={doctors.length}
          subtitle="Available for consultation"
          icon="🩺"
          color="success"
        />
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <Link to="/receptionist/appointments" className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
          <div style={{ fontSize: '1.8rem', background: 'var(--primary-light)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>📅</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Appointment Desk</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>View & filter all bookings</div>
          </div>
        </Link>

        <Link to="/receptionist/tokens" className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
          <div style={{ fontSize: '1.8rem', background: 'var(--warning-light)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>🎫</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Live Token Queue</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage patient order & check-ins</div>
          </div>
        </Link>

        <Link to="/receptionist/patients" className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
          <div style={{ fontSize: '1.8rem', background: 'var(--info-light)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>👥</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Patients Directory</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Search records & histories</div>
          </div>
        </Link>

        <Link to="/receptionist/billing" className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
          <div style={{ fontSize: '1.8rem', background: 'var(--success-light)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>🧾</div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>Billing & Cashier</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Invoices & payment records</div>
          </div>
        </Link>
      </div>

      {/* Recent Appointments Preview */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Recent Patient Appointments</h2>
          <Link to="/receptionist/appointments" className="btn btn-outline" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
            View Full List →
          </Link>
        </div>

        <DataTable
          columns={recentApptColumns}
          data={appointments.slice(0, 6)}
          loading={loading}
          emptyMessage="No scheduled appointments on record."
        />
      </div>
    </div>
  );
};

export default ReceptionistDashboard;
