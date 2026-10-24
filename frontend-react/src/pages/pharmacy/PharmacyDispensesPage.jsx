import React, { useState, useEffect, useCallback } from 'react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import Badge from '../../components/Badge';
import { formatDate } from '../../utils/formatters';

export const PharmacyDispensesPage = () => {
  const [dispenses, setDispenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadDispenses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getDispenses(statusFilter === 'ALL' ? null : statusFilter);
      setDispenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load dispenses:', err);
      showFeedback('Could not load dispense history.', 'danger');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDispenses();
  }, [loadDispenses]);

  const handleConfirmDispense = async (id) => {
    setActionLoading(id);
    try {
      await pharmacyService.dispenseOrder(id);
      showFeedback('Dispensation marked as completed.');
      await loadDispenses();
    } catch (err) {
      showFeedback(`Dispensation confirmation failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelDispense = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this dispense record?')) return;
    setActionLoading(id);
    try {
      await pharmacyService.cancelDispense(id);
      showFeedback('Dispense record cancelled.');
      await loadDispenses();
    } catch (err) {
      showFeedback(`Cancellation failed: ${err.message}`, 'danger');
    } finally {
      setActionLoading(null);
    }
  };

  const columns = [
    {
      header: 'Dispense #',
      key: 'dispense_number',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
          {row.dispense_number || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Prescription Ref',
      key: 'prescription',
      render: (row) => <span>Rx #{row.prescription}</span>
    },
    {
      header: 'Patient Name',
      key: 'patient_name',
      render: (row) => <span style={{ fontWeight: 600 }}>{row.patient_name || `Patient #${row.patient}`}</span>
    },
    {
      header: 'Dispensed Date',
      key: 'dispensed_at',
      render: (row) => <span>{formatDate(row.dispensed_at || row.created_at)}</span>
    },
    {
      header: 'Notes / Remarks',
      key: 'notes',
      render: (row) => <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.notes || '—'}</span>
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => <Badge status={row.status} />
    },
    {
      header: 'Actions',
      key: 'actions',
      render: (row) => {
        if (row.status === 'PENDING') {
          return (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleConfirmDispense(row.id)}
                disabled={actionLoading === row.id}
              >
                Confirm
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ color: 'var(--danger)' }}
                onClick={() => handleCancelDispense(row.id)}
                disabled={actionLoading === row.id}
              >
                Cancel
              </button>
            </div>
          );
        }
        return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>;
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dispense History & Audit Log</h1>
          <p className="page-subtitle">Historical records of pharmaceutical fulfillments and inventory deductions.</p>
        </div>
        <button className="btn btn-outline" onClick={loadDispenses}>
          🔄 Refresh
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-select"
                style={{ width: '180px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All Dispenses</option>
                <option value="PENDING">Pending</option>
                <option value="DISPENSED">Dispensed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Showing {dispenses.length} records
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={dispenses}
        loading={loading}
        emptyMessage="No medication dispenses logged."
      />
    </div>
  );
};

export default PharmacyDispensesPage;
