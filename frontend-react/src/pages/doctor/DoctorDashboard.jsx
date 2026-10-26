import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Stethoscope,
  UsersRound,
  TestTube,
  ListOrdered
} from 'lucide-react';
import doctorService from '../../services/doctorService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatTime, formatDate } from '../../utils/formatters';

export const DoctorDashboard = () => {
  const navigate = useNavigate();
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [appointments, setAppointments] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [patients, setPatients] = useState([]);
  const [labOrders, setLabOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [appts, consults, pts, labs] = await Promise.all([
        doctorService.getAppointments().catch(() => []),
        doctorService.getConsultations().catch(() => []),
        doctorService.getPatients().catch(() => []),
        doctorService.getLabOrders().catch(() => [])
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setConsultations(Array.isArray(consults) ? consults : []);
      setPatients(Array.isArray(pts) ? pts : []);
      setLabOrders(Array.isArray(labs) ? labs : []);
    } catch (err) {
      console.error('Failed to load doctor dashboard:', err);
      setFeedback({ message: 'Could not load clinical telemetry.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived metrics
  const todayAppts = appointments.filter(a => a.appointment_date === todayStr);
  const inQueueCount = todayAppts.filter(a => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS').length;
  const completedTodayCount = todayAppts.filter(a => a.status === 'COMPLETED').length;

  const upcomingQueueColumns = [
    {
      header: 'Token #',
      key: 'token_number',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
          #{row.token_number || row.id}
        </span>
      )
    },
    {
      header: 'Time',
      key: 'appointment_time',
      render: (row) => <span>{formatTime(row.appointment_time)}</span>
    },
    {
      header: 'Patient',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Type',
      key: 'appointment_type',
      render: (row) => (
        <span style={{ fontSize: '0.82rem', fontWeight: 500 }}>
          {row.appointment_type === 'WALK_IN' ? 'Walk-In' : 'Advance'}
        </span>
      )
    },
    {
      header: 'Reason',
      key: 'reason',
      render: (row) => <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.reason || 'Checkup'}</span>
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Action',
      key: 'action',
      render: (row) => (
        <button
          className="btn btn-primary btn-sm"
          onClick={() => navigate(`/doctor/consultations?appointment=${row.id}`)}
        >
          Consult Now
        </button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Clinical Dashboard</h1>
          <p className="page-subtitle">Welcome back, Doctor. Review your consultation schedule and patient queue.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-outline"
            onClick={loadDashboardData}
          >
            Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/doctor/consultations')}
          >
            + New Consultation
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* KPI Cards */}
      <div className="grid-stats">
        <StatCard
          title="Today's Appointments"
          value={todayAppts.length}
          icon={CalendarDays}
          subtitle="Scheduled for today"
        />
        <StatCard
          title="Patients in Queue"
          value={inQueueCount}
          icon={Clock}
          subtitle="Awaiting consultation"
          trend="Live Queue"
          trendType="neutral"
        />
        <StatCard
          title="Visits Completed Today"
          value={completedTodayCount}
          icon={CheckCircle2}
          subtitle="Consulted and closed"
          trendType="positive"
        />
        <StatCard
          title="Consultations Logged"
          value={consultations.length}
          icon={Stethoscope}
          subtitle="Historical visits"
        />
        <StatCard
          title="Patient Roster"
          value={patients.length}
          icon={UsersRound}
          subtitle="Assigned to your care"
        />
        <StatCard
          title="Active Lab Orders"
          value={labOrders.filter(l => l.status !== 'COMPLETED').length}
          icon={TestTube}
          subtitle="Pending results"
        />
      </div>

      {/* Quick Access Action Shortcuts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/doctor/appointments')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <CalendarDays size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>My Appointments</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Full appointment calendar</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/doctor/queue')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <ListOrdered size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Today's Queue</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Manage patient queue tokens</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/doctor/consultations')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <Stethoscope size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Consultations</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Clinical history & diagnoses</div>
        </div>

        <div
          className="card"
          style={{ cursor: 'pointer', textAlign: 'center', padding: '24px 20px' }}
          onClick={() => navigate('/doctor/lab-orders')}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', color: 'var(--primary)' }}>
            <TestTube size={28} strokeWidth={1.8} />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>Lab Orders</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Investigative test requests</div>
        </div>
      </div>

      {/* Today's Waiting Queue */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              Patients Waiting Today ({todayAppts.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Confirmed visits ready for clinical examination today ({formatDate(todayStr)}).
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/doctor/appointments')}
          >
            View All My Appointments →
          </button>
        </div>

        <DataTable
          columns={upcomingQueueColumns}
          data={todayAppts}
          loading={loading}
          emptyMessage="No appointments scheduled for today."
        />
      </div>
    </div>
  );
};

export default DoctorDashboard;
