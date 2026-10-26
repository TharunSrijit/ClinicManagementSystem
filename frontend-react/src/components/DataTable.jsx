import React from 'react';
import { Inbox } from 'lucide-react';

export const DataTable = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  onRowClick
}) => {
  if (loading) {
    return (
      <div className="table-responsive" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid var(--border-subtle)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
        <div style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading records...</div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-responsive" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px', color: 'var(--text-muted)' }}>
          <Inbox size={38} strokeWidth={1.5} />
        </div>
        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>{emptyMessage}</div>
        <div style={{ fontSize: '0.85rem', marginTop: '4px' }}>There are currently no items to display.</div>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={col.key || idx} style={col.headerStyle || {}}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={row.id || rowIdx}
              onClick={() => onRowClick && onRowClick(row)}
              style={onRowClick ? { cursor: 'pointer' } : {}}
            >
              {columns.map((col, colIdx) => (
                <td key={col.key || colIdx} style={col.cellStyle || {}}>
                  {col.render ? col.render(row, rowIdx) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
