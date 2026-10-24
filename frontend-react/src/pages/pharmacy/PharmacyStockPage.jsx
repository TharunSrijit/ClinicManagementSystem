import React, { useState, useEffect, useCallback } from 'react';
import pharmacyService from '../../services/pharmacyService';
import DataTable from '../../components/DataTable';
import { formatDate } from '../../utils/formatters';

export const PharmacyStockPage = () => {
  const [stock, setStock] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ message: '', type: '' });

  const loadStock = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pharmacyService.getStock();
      setStock(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load pharmacy stock:', err);
      setFeedback({ message: 'Could not fetch inventory stock levels.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const filteredStock = stock.filter((item) => {
    const isLow = Number(item.quantity || 0) <= Number(item.reorder_level || 10);
    if (lowStockOnly && !isLow) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.medicine_name?.toLowerCase().includes(term) ||
      item.batch_number?.toLowerCase().includes(term)
    );
  });

  const columns = [
    {
      header: 'Medicine Name',
      key: 'medicine_name',
      render: (row) => (
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
            {row.medicine_name || `Medicine #${row.medicine}`}
          </span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Batch: {row.batch_number || 'Standard'}
          </div>
        </div>
      )
    },
    {
      header: 'Available Stock',
      key: 'quantity',
      render: (row) => {
        const qty = Number(row.quantity || 0);
        const reorder = Number(row.reorder_level || 10);
        const isLow = qty <= reorder;

        return (
          <span
            style={{
              fontWeight: 700,
              fontSize: '1rem',
              color: isLow ? 'var(--danger)' : 'var(--text-main)'
            }}
          >
            {qty} units
          </span>
        );
      }
    },
    {
      header: 'Reorder Threshold',
      key: 'reorder_level',
      render: (row) => <span>{row.reorder_level || 10} units</span>
    },
    {
      header: 'Unit Price',
      key: 'unit_price',
      render: (row) => (
        <span style={{ fontWeight: 600 }}>
          ₹{Number(row.unit_price || 0).toFixed(2)}
        </span>
      )
    },
    {
      header: 'Expiry Date',
      key: 'expiry_date',
      render: (row) => {
        const exp = row.expiry_date;
        const isExpired = exp && new Date(exp) < new Date();
        return (
          <span style={{ color: isExpired ? 'var(--danger)' : 'inherit', fontWeight: isExpired ? 600 : 'normal' }}>
            {formatDate(exp)} {isExpired && '⚠️ Expired'}
          </span>
        );
      }
    },
    {
      header: 'Stock Status',
      key: 'status',
      render: (row) => {
        const qty = Number(row.quantity || 0);
        const reorder = Number(row.reorder_level || 10);

        if (qty === 0) {
          return (
            <span style={{ color: 'var(--danger)', background: 'var(--danger-light)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
              Out of Stock
            </span>
          );
        }
        if (qty <= reorder) {
          return (
            <span style={{ color: 'var(--warning)', background: 'var(--warning-light)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.8rem' }}>
              Low Inventory
            </span>
          );
        }
        return (
          <span style={{ color: 'var(--success)', background: 'var(--success-light)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.8rem' }}>
            Adequate
          </span>
        );
      }
    }
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Pharmacy Medicine Stock & Inventory</h1>
          <p className="page-subtitle">Warehouse batches, current stock counts, expiry surveillance, and reorder levels.</p>
        </div>
        <button className="btn btn-outline" onClick={loadStock}>
          🔄 Refresh Stock
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
              placeholder="Search by drug name or batch number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group">
            <button
              className={`btn btn-sm ${lowStockOnly ? 'btn-danger' : 'btn-outline'}`}
              onClick={() => setLowStockOnly(!lowStockOnly)}
            >
              {lowStockOnly ? '✓ Showing Low Stock Only' : 'Filter Low Stock Warnings'}
            </button>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredStock}
        loading={loading}
        emptyMessage="No medicines found in pharmacy inventory matching filter."
      />
    </div>
  );
};

export default PharmacyStockPage;
