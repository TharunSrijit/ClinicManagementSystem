import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export const AdminLabTestsPage = () => {
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const [form, setForm] = useState({
    test_code: '',
    test_name: '',
    description: '',
    normal_range: '',
    unit: '',
    price: 350,
    is_active: true
  });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadLabTests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getLabTests();
      setLabTests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load lab tests:', err);
      showFeedback('Could not fetch lab test catalog.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabTests();
  }, [loadLabTests]);

  const handleCreateLabTest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createLabTest({
        ...form,
        price: Number(form.price)
      });
      showFeedback(`Diagnostic test '${form.test_name}' registered successfully!`);
      setIsModalOpen(false);
      setForm({
        test_code: '',
        test_name: '',
        description: '',
        normal_range: '',
        unit: '',
        price: 350,
        is_active: true
      });
      await loadLabTests();
    } catch (err) {
      console.error('Failed to register lab test:', err);
      showFeedback(err.message || 'Lab test creation failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTests = labTests.filter((t) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      t.test_name?.toLowerCase().includes(term) ||
      t.test_code?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Code',
      key: 'test_code',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
          {row.test_code || `#${row.id}`}
        </span>
      )
    },
    {
      header: 'Test Name',
      key: 'test_name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.test_name}</span>
    },
    {
      header: 'Standard Reference Range',
      key: 'normal_range',
      render: (row) => <span>{row.normal_range ? `${row.normal_range} ${row.unit || ''}` : '—'}</span>
    },
    {
      header: 'Standard Tariff Price',
      key: 'price',
      render: (row) => (
        <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
          ₹{Number(row.price || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Clinical Indication',
      key: 'description',
      render: (row) => <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.description || 'Routine diagnostic protocol'}</span>
    },
    {
      header: 'Test Status',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active ? '● Available' : '○ Offline'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Diagnostic Lab Tests Master</h1>
          <p className="page-subtitle">Configure pathology tests, biological reference ranges, and billing tariffs.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add New Lab Test
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by test name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="btn btn-outline btn-sm" onClick={loadLabTests}>
            🔄 Refresh Test Master
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredTests}
        loading={loading}
        emptyMessage="No diagnostic tests found in the master index."
      />

      {/* Add Lab Test Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Diagnostic Laboratory Test"
      >
        <form onSubmit={handleCreateLabTest}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Test Code *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.test_code}
                onChange={(e) => setForm({ ...form, test_code: e.target.value })}
                placeholder="e.g. CBC01, LFT02"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Test Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.test_name}
                onChange={(e) => setForm({ ...form, test_name: e.target.value })}
                placeholder="e.g. Complete Blood Count (CBC)"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Reference Range</label>
              <input
                type="text"
                className="form-control"
                value={form.normal_range}
                onChange={(e) => setForm({ ...form, normal_range: e.target.value })}
                placeholder="e.g. 13.5 - 17.5"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input
                type="text"
                className="form-control"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g. g/dL, mg/dL"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tariff Price (₹) *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description / Specimen Protocol</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Requires 2ml EDTA whole blood sample. 8-hour fasting recommended."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Add Diagnostic Test'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminLabTestsPage;
