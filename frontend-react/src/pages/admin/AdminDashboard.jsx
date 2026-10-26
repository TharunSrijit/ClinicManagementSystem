import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UsersRound,
  Stethoscope,
  CreditCard
} from 'lucide-react';
import adminService from '../../services/adminService';
import StatCard from '../../components/StatCard';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, usersData, docsData] = await Promise.all([
        adminService.getDashboardStats().catch(() => null),
        adminService.getUsers().catch(() => []),
        adminService.getDoctors().catch(() => [])
      ]);
      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDoctors(Array.isArray(docsData) ? docsData : []);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setFeedback({ message: 'Could not fetch clinic metrics.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const recentUsersColumns = [
    {
      header: 'ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Username',
      key: 'username',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.username}</span>
    },
    {
      header: 'Full Name',
      key: 'first_name',
      render: (row) => <span>{row.first_name || row.last_name ? `${row.first_name || ''} ${row.last_name || ''}`.trim() : '—'}</span>
    },
    {
      header: 'Role',
      key: 'role',
      render: (row) => <Badge status={row.role} />
    },
    {
      header: 'Email',
      key: 'email',
      render: (row) => <span>{row.email || '—'}</span>
    },
    {
      header: 'Active',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active ? 'Active' : 'Suspended'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Administration Overview</h1>
          <p className="page-subtitle">Platform health, staff directories, billing volume, and operational metrics.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-outline" onClick={loadStats}>
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/admin/users')}>
            + Manage Users
          </button>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* KPI Stats */}
      <div className="grid-stats">
        <StatCard
          title="Total User Accounts"
          value={stats?.total_users ?? users.length}
          icon={UsersRound}
          subtitle="System operators"
        />
        <StatCard
          title="Active Doctors"
          value={stats?.total_doctors ?? doctors.length}
          icon={Stethoscope}
          subtitle="Consulting physicians"
        />
        <StatCard
          title="Registered Patients"
          value={stats?.total_patients ?? '—'}
          icon={UsersRound}
          subtitle="Lifetime enrolled"
        />
        <StatCard
          title="Consultation Revenue"
          value={formatCurrency(stats?.consultation_revenue ?? stats?.revenue_this_month?.consultation ?? 0)}
          icon={CreditCard}
          subtitle="Recorded receipts"
        />
      </div>

      {/* Recent User Accounts Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
              System User Directory ({users.length})
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Recently active accounts with authorized access permissions.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/admin/users')}
          >
            Manage All Users →
          </button>
        </div>

        <DataTable
          columns={recentUsersColumns}
          data={users.slice(0, 8)}
          loading={loading}
          emptyMessage="No system users logged."
        />
      </div>
    </div>
  );
};

export default AdminDashboard;
