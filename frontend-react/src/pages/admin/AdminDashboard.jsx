import React, { useState, useEffect } from 'react';
import adminService from '../../services/adminService';
import StatCard from '../../components/StatCard';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import { formatCurrency } from '../../utils/formatters';

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, doctorsData, medsData] = await Promise.all([
        adminService.getDashboardStats().catch(() => ({})),
        adminService.getUsers().catch(() => []),
        adminService.getDoctors().catch(() => []),
        adminService.getMedicines().catch(() => [])
      ]);
      setStats(statsData || {});
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
      setMedicines(Array.isArray(medsData) ? medsData : []);
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalUsers = users.length || stats?.users?.total || 0;
  const activeUsers = users.filter(u => u.is_active !== false).length;
  const totalDoctors = doctors.length || stats?.staff?.doctors || 0;
  const totalMeds = medicines.length;

  const userColumns = [
    {
      header: 'User ID',
      key: 'id',
      render: (u) => <span style={{ fontWeight: 600 }}>#{u.id}</span>
    },
    {
      header: 'Username',
      key: 'username',
      render: (u) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {u.username}
        </span>
      )
    },
    {
      header: 'Full Name',
      key: 'full_name',
      render: (u) => u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || '-'
    },
    {
      header: 'Role',
      key: 'role',
      render: (u) => <Badge status={u.role}>{u.role}</Badge>
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (u) => (
        <Badge variant={u.is_active !== false ? 'success' : 'danger'}>
          {u.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clinic Administration Portal</h1>
          <p className="page-subtitle">Master overview of healthcare professionals, clinic staff, master catalogs, and platform audit.</p>
        </div>
        <button onClick={loadData} className="btn btn-outline">
          🔄 Refresh
        </button>
      </div>

      <div className="grid-stats">
        <StatCard
          title="Active Doctors"
          value={totalDoctors}
          subtitle="Specialists registered"
          icon="👨‍⚕️"
          color="primary"
        />
        <StatCard
          title="System Staff"
          value={totalUsers}
          subtitle={`${activeUsers} active accounts`}
          icon="👥"
          color="info"
        />
        <StatCard
          title="Medicines Master"
          value={totalMeds}
          subtitle="Pharmaceutical catalog"
          icon="💊"
          color="warning"
        />
        <StatCard
          title="Pending Invoices"
          value={stats?.invoices?.pending_count ?? 0}
          subtitle={`Total revenue: ${formatCurrency(stats?.invoices?.total_revenue || 0)}`}
          icon="💰"
          color="success"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Active User Accounts</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{users.length} total</span>
          </div>
          <DataTable
            columns={userColumns}
            data={users.slice(0, 8)}
            loading={loading}
            emptyMessage="No registered users found"
          />
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Doctors Directory</h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{doctors.length} doctors</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading doctors...</div>
            ) : doctors.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No doctors found.</div>
            ) : (
              doctors.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-page)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      🩺
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                        {doc.full_name || doc.name || `Dr. #${doc.id}`}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {doc.specialization || 'General Physician'} • Room {doc.room_number || '101'}
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">Available</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
