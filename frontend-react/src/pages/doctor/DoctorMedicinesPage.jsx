import React, { useState, useEffect, useCallback } from 'react';
import doctorService from '../../services/doctorService';
import DataTable from '../../components/DataTable';

export const DoctorMedicinesPage = () => {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await doctorService.getMedicines(searchTerm, categoryFilter);
      setMedicines(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load medicines:', err);
      setFeedback({ message: 'Could not load medicines catalog.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    loadMedicines();
  }, [loadMedicines]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadMedicines();
  };

  const columns = [
    {
      header: 'Medicine Name',
      key: 'medicine_name',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.medicine_name}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{row.generic_name || '—'}</div>
        </div>
      )
    },
    {
      header: 'Category',
      key: 'category',
      render: (row) => (
        <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
          {row.category || 'Pharmaceutical'}
        </span>
      )
    },
    {
      header: 'Unit / Packaging',
      key: 'unit',
      render: (row) => <span>{row.unit || 'Strip / Bottle'}</span>
    },
    {
      header: 'Manufacturer',
      key: 'manufacturer',
      render: (row) => <span>{row.manufacturer || 'Approved Formulary'}</span>
    },
    {
      header: 'Clinical Remarks',
      key: 'description',
      render: (row) => <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.description || 'Standard therapeutic guidelines'}</span>
    },
    {
      header: 'Formulary Status',
      key: 'is_active',
      render: (row) => (
        <span style={{ color: row.is_active !== false ? 'var(--success)' : 'var(--danger)', fontWeight: 600, fontSize: '0.82rem' }}>
          {row.is_active !== false ? '● Active' : '○ Discontinued'}
        </span>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reference Medicines Formulary</h1>
          <p className="page-subtitle">Standardized clinical pharmacopoeia and clinic-approved drug index.</p>
        </div>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {/* Search Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <form onSubmit={handleSearch} className="filter-toolbar" style={{ margin: 0 }}>
          <div style={{ display: 'flex', gap: '12px', flex: 1, maxWidth: '600px', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="form-control"
              style={{ flex: 1, minWidth: '200px' }}
              placeholder="Search by brand name or generic compound..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <input
              type="text"
              className="form-control"
              style={{ width: '180px' }}
              placeholder="Filter by Category..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {(searchTerm || categoryFilter) && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('');
                }}
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadMedicines}
          >
            🔄 Refresh
          </button>
        </form>
      </div>

      <DataTable
        columns={columns}
        data={medicines}
        loading={loading}
        emptyMessage="No medicines found matching the search criteria."
      />
    </div>
  );
};

export default DoctorMedicinesPage;
