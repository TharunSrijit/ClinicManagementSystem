import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

export const AdminMedicinesPage = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const [form, setForm] = useState({
    medicine_name: '',
    generic_name: '',
    category: 'Analgesic',
    manufacturer: '',
    unit: 'Strip (10 tabs)',
    description: '',
    is_active: true
  });

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminService.getMedicines();
      setMedicines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load medicines:', err);
      showFeedback('Could not fetch medicines catalog.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const handleCreateMedicine = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createMedicine(form);
      showFeedback(`Medicine '${form.medicine_name}' registered in formulary!`);
      setIsModalOpen(false);
      setForm({
        medicine_name: '',
        generic_name: '',
        category: 'Analgesic',
        manufacturer: '',
        unit: 'Strip (10 tabs)',
        description: '',
        is_active: true
      });
      await loadMedicines();
    } catch (err) {
      console.error('Failed to register medicine:', err);
      showFeedback(err.message || 'Medicine creation failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.medicine_name?.toLowerCase().includes(term) ||
      m.generic_name?.toLowerCase().includes(term) ||
      m.category?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Brand Name',
      key: 'medicine_name',
      render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.medicine_name}</span>
    },
    {
      header: 'Generic Composition',
      key: 'generic_name',
      render: (row) => <span>{row.generic_name || '—'}</span>
    },
    {
      header: 'Therapeutic Category',
      key: 'category',
      render: (row) => (
        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
          {row.category || 'Pharmaceutical'}
        </span>
      )
    },
    {
      header: 'Manufacturer',
      key: 'manufacturer',
      render: (row) => <span>{row.manufacturer || 'Approved'}</span>
    },
    {
      header: 'Packaging / Unit',
      key: 'unit',
      render: (row) => <span>{row.unit || 'Strip'}</span>
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active ? '● Active' : '○ Inactive'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Medicine Catalog</h1>
          <p className="page-subtitle">Standardized clinic formulary, pharmaceutical categorization, and generic nomenclature.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          + Add New Medicine
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
              placeholder="Search by brand, generic, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="btn btn-outline btn-sm" onClick={loadMedicines}>
            🔄 Refresh Formulary
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredMedicines}
        loading={loading}
        emptyMessage="No medicines found in the master catalog."
      />

      {/* Add Medicine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Master Formulary Medicine"
      >
        <form onSubmit={handleCreateMedicine}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Brand Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.medicine_name}
                onChange={(e) => setForm({ ...form, medicine_name: e.target.value })}
                placeholder="e.g. Dolo 650"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Generic Name *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.generic_name}
                onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
                placeholder="e.g. Paracetamol"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Therapeutic Category *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Antipyretic, Antibiotic"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Packaging Unit</label>
              <input
                type="text"
                className="form-control"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g. Strip (10 tabs), Bottle (100ml)"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Manufacturer</label>
            <input
              type="text"
              className="form-control"
              value={form.manufacturer}
              onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              placeholder="e.g. Micro Labs Ltd"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Storage Guidelines</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Store in a cool, dry place away from sunlight..."
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
              {submitting ? 'Registering...' : 'Add Medicine to Formulary'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminMedicinesPage;
