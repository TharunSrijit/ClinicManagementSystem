// import React, { useState, useEffect, useCallback } from 'react';
// import adminService from '../../services/adminService';
// import DataTable from '../../components/DataTable';
// import Modal from '../../components/Modal';

// const stockFormDefaults = {
//   batch_number: '',
//   expiry_date: '',
//   quantity: '',
//   purchase_price: '',
//   selling_price: ''
// };

// const medicineFormDefaults = {
//   medicine_name: '',
//   generic_name: '',
//   category: 'Analgesic',
//   manufacturer: '',
//   unit: 'Strip (10 tabs)',
//   description: '',
//   reorder_level: 10,
//   is_active: true,
//   initial_stock: { ...stockFormDefaults }
// };

// const getDaysUntilExpiry = (expiryDate) => {
//   if (!expiryDate) return null;
//   const [year, month, day] = expiryDate.split('-').map(Number);
//   if (!year || !month || !day) return null;
//   const expiryUtc = Date.UTC(year, month - 1, day);
//   const now = new Date();
//   const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
//   return Math.ceil((expiryUtc - todayUtc) / (24 * 60 * 60 * 1000));
// };

// export const AdminMedicinesPage = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [stock, setStock] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [editingMedicine, setEditingMedicine] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [actionId, setActionId] = useState(null);
//   const [feedback, setFeedback] = useState({ message: '', type: '' });
//   const [form, setForm] = useState(medicineFormDefaults);

//   const showFeedback = (message, type = 'success') => {
//     setFeedback({ message, type });
//     setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
//   };

//   const loadMedicines = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [data, stockData] = await Promise.all([
//         adminService.getMedicines(),
//         adminService.getStock()
//       ]);
//       setMedicines(Array.isArray(data) ? data : []);
//       setStock(Array.isArray(stockData) ? stockData : []);
//     } catch (err) {
//       console.error('Failed to load medicines:', err);
//       showFeedback('Could not fetch medicines catalog.', 'danger');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadMedicines();
//   }, [loadMedicines]);

//   const handleSaveMedicine = async (e) => {
//     e.preventDefault();
//     setSubmitting(true);
//     try {
//       if (editingMedicine) {
//         const { initial_stock, ...medicineData } = form;
//         const hasInitialStockData = Object.entries(initial_stock)
//           .some(([key, value]) => key !== 'id' && value !== '' && value !== null && value !== undefined);
//         const hasCompleteInitialStock = initial_stock.batch_number
//           && initial_stock.expiry_date
//           && initial_stock.quantity !== ''
//           && initial_stock.purchase_price !== ''
//           && initial_stock.selling_price !== '';
//         if (hasInitialStockData && !hasCompleteInitialStock) {
//           showFeedback('Complete all initial stock batch fields to save the expiry date.', 'danger');
//           setSubmitting(false);
//           return;
//         }
//         await adminService.updateMedicine(editingMedicine.id, medicineData);
//         if (initial_stock.id) {
//           const { id, ...batchData } = initial_stock;
//           await adminService.updateStock(id, {
//             ...batchData,
//             medicine: editingMedicine.id,
//             quantity: Number(batchData.quantity),
//             purchase_price: Number(batchData.purchase_price),
//             selling_price: Number(batchData.selling_price)
//           });
//         } else if (hasCompleteInitialStock) {
//           await adminService.createStock({
//             ...initial_stock,
//             medicine: editingMedicine.id,
//             quantity: Number(initial_stock.quantity),
//             purchase_price: Number(initial_stock.purchase_price),
//             selling_price: Number(initial_stock.selling_price)
//           });
//         }
//         showFeedback(`Medicine '${form.medicine_name}' updated.`);
//       } else {
//         if (
//           !form.initial_stock.batch_number
//           || !form.initial_stock.expiry_date
//           || form.initial_stock.quantity === ''
//           || form.initial_stock.purchase_price === ''
//           || form.initial_stock.selling_price === ''
//         ) {
//           showFeedback('Complete all initial stock batch fields, including expiry date.', 'danger');
//           setSubmitting(false);
//           return;
//         }
//         await adminService.createMedicine({
//           ...form,
//           initial_stock: {
//             ...form.initial_stock,
//             quantity: Number(form.initial_stock.quantity),
//             purchase_price: Number(form.initial_stock.purchase_price),
//             selling_price: Number(form.initial_stock.selling_price)
//           }
//         });
//         showFeedback(`Medicine '${form.medicine_name}' registered in formulary!`);
//       }
//       setIsModalOpen(false);
//       setEditingMedicine(null);
//       setForm(medicineFormDefaults);
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to register medicine:', err);
//       showFeedback(err.message || 'Medicine creation failed.', 'danger');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const openEditMedicine = (medicine) => {
//     const existingBatch = stock.find((batch) => Number(batch.medicine) === Number(medicine.id));
//     setEditingMedicine(medicine);
//     setForm({
//       medicine_name: medicine.medicine_name || '',
//       generic_name: medicine.generic_name || '',
//       category: medicine.category || '',
//       manufacturer: medicine.manufacturer || '',
//       unit: medicine.unit || '',
//       description: medicine.description || '',
//       reorder_level: medicine.reorder_level ?? 10,
//       is_active: medicine.is_active,
//       initial_stock: existingBatch
//         ? {
//             id: existingBatch.id,
//             batch_number: existingBatch.batch_number,
//             expiry_date: existingBatch.expiry_date,
//             quantity: existingBatch.quantity,
//             purchase_price: existingBatch.purchase_price,
//             selling_price: existingBatch.selling_price
//           }
//         : { ...stockFormDefaults }
//     });
//     setIsModalOpen(true);
//   };

//   const handleToggleMedicine = async (medicine) => {
//     setActionId(medicine.id);
//     try {
//       await adminService.updateMedicine(medicine.id, { is_active: !medicine.is_active });
//       showFeedback(medicine.is_active ? 'Medicine deactivated.' : 'Medicine activated.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to update medicine status:', err);
//       showFeedback(err.message || 'Medicine status could not be updated.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const handleDeleteMedicine = async (medicine) => {
//     if (!window.confirm('Are you sure you want to delete this medicine?')) return;
//     setActionId(medicine.id);
//     try {
//       await adminService.deleteMedicine(medicine.id);
//       showFeedback('Medicine deleted.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to delete medicine:', err);
//       showFeedback(err.message || 'Medicine could not be deleted.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const handleDeleteStock = async (batch) => {
//     if (!window.confirm(`Delete batch ${batch.batch_number}?`)) return;
//     setActionId(`stock-${batch.id}`);
//     try {
//       await adminService.deleteStock(batch.id);
//       if (Number(form.initial_stock.id) === Number(batch.id)) {
//         setForm((current) => ({
//           ...current,
//           initial_stock: { ...stockFormDefaults }
//         }));
//       }
//       showFeedback('Stock batch deleted.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to delete stock batch:', err);
//       showFeedback(err.message || 'Stock batch could not be deleted.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const filteredMedicines = medicines.filter((m) => {
//     if (!searchTerm) return true;
//     const term = searchTerm.toLowerCase();
//     return (
//       m.medicine_name?.toLowerCase().includes(term) ||
//       m.generic_name?.toLowerCase().includes(term) ||
//       m.category?.toLowerCase().includes(term)
//     );
//   });

//   const getExpiryDetails = (medicine) => {
//     const batches = stock.filter((batch) => Number(batch.medicine) === Number(medicine.id));
//     const batchExpiries = batches.map((batch) => ({
//       expiryDate: batch.expiry_date,
//       daysUntilExpiry: getDaysUntilExpiry(batch.expiry_date)
//     }));
//     const expiries = batchExpiries.length
//       ? batchExpiries
//       : [{
//           expiryDate: medicine.expiry_date,
//           daysUntilExpiry: getDaysUntilExpiry(medicine.expiry_date)
//         }];
//     const expiredBatchCount = expiries.filter((batch) => batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 0).length;
//     const nextExpiry = expiries
//       .filter((batch) => batch.expiryDate)
//       .sort((first, second) => first.expiryDate.localeCompare(second.expiryDate))[0];

//     return {
//       expiredBatchCount,
//       totalBatchCount: batches.length || (medicine.expiry_date ? 1 : 0),
//       nextExpiry
//     };
//   };

//   const columns = [
//     {
//       header: 'ID',
//       key: 'id',
//       render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
//     },
//     {
//       header: 'Brand Name',
//       key: 'medicine_name',
//       render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.medicine_name || '—'}</span>
//     },
//     {
//       header: 'Medicine Name',
//       key: 'generic_name',
//       render: (row) => <span>{row.generic_name || '—'}</span>
//     },
//     {
//       header: 'Therapeutic Category',
//       key: 'category',
//       render: (row) => (
//         <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
//           {row.category || 'Pharmaceutical'}
//         </span>
//       )
//     },
//     {
//       header: 'Manufacturer',
//       key: 'manufacturer',
//       render: (row) => <span>{row.manufacturer || 'Approved'}</span>
//     },
//     {
//       header: 'Packaging / Unit',
//       key: 'unit',
//       render: (row) => <span>{row.unit || 'Strip'}</span>
//     },
//     {
//       header: 'Stock Level',
//       key: 'stock_level',
//       render: (row) => (
//         <span style={{ color: row.stock_level <= row.reorder_level ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
//           {row.stock_level}
//         </span>
//       )
//     },
//     {
//       header: 'Reorder Level',
//       key: 'reorder_level',
//       render: (row) => <span>{row.reorder_level}</span>
//     },
//     {
//       header: 'Expiry Date',
//       key: 'expiry_date',
//       render: (row) => {
//         const { expiredBatchCount, totalBatchCount, nextExpiry } = getExpiryDetails(row);
//         const isExpiringSoon = nextExpiry?.daysUntilExpiry > 0 && nextExpiry.daysUntilExpiry <= 20;
//         return (
//           <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
//             <span style={{
//               color: expiredBatchCount ? 'var(--danger)' : 'inherit',
//               fontWeight: expiredBatchCount ? 600 : 'normal'
//             }}>
//               {nextExpiry?.expiryDate || '—'}
//             </span>
//             {expiredBatchCount > 0 && (
//               <span style={{
//                 color: 'var(--danger)',
//                 background: 'var(--danger-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 {expiredBatchCount === totalBatchCount
//                   ? 'Expired'
//                   : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
//               </span>
//             )}
//             {!expiredBatchCount && isExpiringSoon && (
//               <span style={{
//                 color: 'var(--warning)',
//                 background: 'var(--warning-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 Expires in {nextExpiry.daysUntilExpiry} {nextExpiry.daysUntilExpiry === 1 ? 'day' : 'days'}
//               </span>
//             )}
//           </div>
//         );
//       }
//     },
//     {
//       header: 'Status',
//       key: 'is_active',
//       render: (row) => {
//         const { expiredBatchCount, totalBatchCount } = getExpiryDetails(row);
//         return (
//           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
//             {!expiredBatchCount && (
//               <span style={{
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 gap: '6px',
//                 whiteSpace: 'nowrap',
//                 color: row.is_active ? 'var(--success)' : 'var(--danger)',
//                 fontWeight: 600,
//                 fontSize: '0.82rem'
//               }}>
//                 <span aria-hidden="true">{row.is_active ? '●' : '○'}</span>
//                 <span>{row.is_active ? 'Active' : 'Inactive'}</span>
//               </span>
//             )}
//             {expiredBatchCount > 0 && (
//               <span style={{
//                 color: 'var(--danger)',
//                 background: 'var(--danger-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 {expiredBatchCount === totalBatchCount
//                   ? 'Expired'
//                   : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
//               </span>
//             )}
//           </div>
//         );
//       }
//     },
//     {
//       header: 'Actions',
//       key: 'actions',
//       headerStyle: { minWidth: '330px' },
//       render: (row) => (
//         <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
//           <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditMedicine(row)}>
//             Edit
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleToggleMedicine(row)}
//             disabled={actionId === row.id}
//           >
//             {row.is_active ? 'Deactivate' : 'Activate'}
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleDeleteMedicine(row)}
//             disabled={actionId === row.id}
//           >
//             Delete
//           </button>
//         </div>
//       )
//     }
//   ];

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <h1 className="page-title">Master Medicine Catalog</h1>
//           <p className="page-subtitle">Standardized clinic formulary, pharmaceutical categorization, and generic nomenclature.</p>
//         </div>
//         <button
//           className="btn btn-primary"
//           onClick={() => {
//             setEditingMedicine(null);
//             setForm(medicineFormDefaults);
//             setIsModalOpen(true);
//           }}
//         >
//           + Add New Medicine
//         </button>
//       </div>

//       {feedback.message && (
//         <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
//       )}

//       {/* Filter Toolbar */}
//       <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
//         <div className="filter-toolbar" style={{ margin: 0 }}>
//           <div style={{ flex: 1, maxWidth: '400px' }}>
//             <input
//               type="text"
//               className="form-control"
//               placeholder="Search by brand, generic, or category..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//           </div>

//           <button className="btn btn-outline btn-sm" onClick={loadMedicines}>
//             🔄 Refresh Formulary
//           </button>
//         </div>
//       </div>

//       <DataTable
//         columns={columns}
//         data={filteredMedicines}
//         loading={loading}
//         emptyMessage="No medicines found in the master catalog."
//       />

//       <Modal
//         isOpen={isModalOpen}
//         onClose={() => {
//           setIsModalOpen(false);
//           setEditingMedicine(null);
//         }}
//         title={editingMedicine ? 'Edit Medicine' : 'Register Master Formulary Medicine'}
//       >
//         <form onSubmit={handleSaveMedicine}>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Brand Name</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 value={form.medicine_name}
//                 onChange={(e) => setForm({ ...form, medicine_name: e.target.value })}
//                 placeholder="e.g. Dolo 650"
//               />
//             </div>

//             <div className="form-group">
//               <label className="form-label">Medicine Name *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 pattern="[^0-9].*"
//                 title="Medicine name must not start with a number."
//                 value={form.generic_name}
//                 onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
//                 placeholder="e.g. Paracetamol"
//               />
//             </div>
//           </div>

//           <div className="form-group">
//             <label className="form-label">Reorder Level *</label>
//             <input
//               type="number"
//               min="0"
//               className="form-control"
//               required
//               value={form.reorder_level}
//               onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
//             />
//           </div>

//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Therapeutic Category *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 value={form.category}
//                 onChange={(e) => setForm({ ...form, category: e.target.value })}
//                 placeholder="e.g. Antipyretic, Antibiotic"
//               />
//             </div>

//             <div className="form-group">
//               <label className="form-label">Packaging Unit</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 value={form.unit}
//                 onChange={(e) => setForm({ ...form, unit: e.target.value })}
//                 placeholder="e.g. Strip (10 tabs), Bottle (100ml)"
//               />
//             </div>
//           </div>

//           <div className="form-group">
//             <label className="form-label">Manufacturer (optional)</label>
//             <input
//               type="text"
//               className="form-control"
//               value={form.manufacturer}
//               onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
//               placeholder="e.g. Micro Labs Ltd"
//             />
//           </div>

//           <div className="form-group">
//             <label className="form-label">Description / Storage Guidelines</label>
//             <textarea
//               className="form-control"
//               rows="2"
//               value={form.description}
//               onChange={(e) => setForm({ ...form, description: e.target.value })}
//               placeholder="Store in a cool, dry place away from sunlight..."
//             />
//           </div>

//           {editingMedicine && (
//             <section style={{ marginTop: '20px' }}>
//               <h3>Existing Stock Batches</h3>
//               <DataTable
//                 columns={[
//                   { header: 'Batch', key: 'batch_number' },
//                   { header: 'Stock Level', key: 'quantity' },
//                   { header: 'Expiry Date', key: 'expiry_date' },
//                   {
//                     header: 'Actions',
//                     key: 'actions',
//                     render: (batch) => (
//                       <div style={{ display: 'flex', gap: '6px' }}>
//                         <button
//                           type="button"
//                           className="btn btn-outline btn-sm"
//                           onClick={() => setForm((current) => ({
//                             ...current,
//                             initial_stock: {
//                               id: batch.id,
//                               batch_number: batch.batch_number,
//                               expiry_date: batch.expiry_date,
//                               quantity: batch.quantity,
//                               purchase_price: batch.purchase_price,
//                               selling_price: batch.selling_price
//                             }
//                           }))}
//                         >
//                           Edit Batch
//                         </button>
//                         <button
//                           type="button"
//                           className="btn btn-outline btn-sm"
//                           onClick={() => handleDeleteStock(batch)}
//                           disabled={actionId === `stock-${batch.id}`}
//                         >
//                           Delete Batch
//                         </button>
//                       </div>
//                     )
//                   }
//                 ]}
//                 data={stock.filter((batch) => Number(batch.medicine) === Number(editingMedicine.id))}
//                 loading={loading}
//                 emptyMessage="No stock batches recorded for this medicine."
//               />
//               <button
//                 type="button"
//                 className="btn btn-outline btn-sm"
//                 style={{ marginTop: '12px' }}
//                 onClick={() => setForm((current) => ({
//                   ...current,
//                   initial_stock: { ...stockFormDefaults }
//                 }))}
//               >
//                 + Add Stock Batch
//               </button>
//             </section>
//           )}

//           <h3>{editingMedicine ? 'Stock Batch / Expiry Details' : 'Initial Stock Batch'}</h3>
//           <p style={{ color: 'var(--text-muted)' }}>
//             {form.initial_stock.id
//               ? 'Update the selected batch below.'
//               : 'Enter a batch to record its stock level and expiry date.'}
//           </p>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Batch Number{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.batch_number}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, batch_number: event.target.value }
//                 })}
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Expiry Date{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="date"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.expiry_date}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, expiry_date: event.target.value }
//                 })}
//               />
//             </div>
//           </div>
//           <div className="form-group">
//             <label className="form-label">Stock Level{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//             <input
//               type="number"
//               min="0"
//               className="form-control"
//               required={!editingMedicine || Boolean(form.initial_stock.id)}
//               value={form.initial_stock.quantity}
//               onChange={(event) => setForm({
//                 ...form,
//                 initial_stock: { ...form.initial_stock, quantity: event.target.value }
//               })}
//             />
//           </div>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Purchase Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.purchase_price}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, purchase_price: event.target.value }
//                 })}
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Selling Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.selling_price}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, selling_price: event.target.value }
//                 })}
//               />
//             </div>
//           </div>

//           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
//             <button
//               type="button"
//               className="btn btn-outline"
//               onClick={() => setIsModalOpen(false)}
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               className="btn btn-primary"
//               disabled={submitting}
//             >
//               {submitting ? 'Saving...' : editingMedicine ? 'Save Changes' : 'Add Medicine to Formulary'}
//             </button>
//           </div>
//         </form>
//       </Modal>

//     </div>
//   );
// };

// export default AdminMedicinesPage;


// import React, { useState, useEffect, useCallback } from 'react';
// import adminService from '../../services/adminService';
// import DataTable from '../../components/DataTable';
// import Modal from '../../components/Modal';

// const stockFormDefaults = {
//   batch_number: '',
//   expiry_date: '',
//   quantity: '',
//   purchase_price: '',
//   selling_price: ''
// };

// const medicineFormDefaults = {
//   generic_name: '',
//   category: 'Analgesic',
//   manufacturer: '',
//   unit: 'Strip (10 tabs)',
//   description: '',
//   reorder_level: 10,
//   is_active: true,
//   initial_stock: { ...stockFormDefaults }
// };

// const getDaysUntilExpiry = (expiryDate) => {
//   if (!expiryDate) return null;
//   const [year, month, day] = expiryDate.split('-').map(Number);
//   if (!year || !month || !day) return null;
//   const expiryUtc = Date.UTC(year, month - 1, day);
//   const now = new Date();
//   const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
//   return Math.ceil((expiryUtc - todayUtc) / (24 * 60 * 60 * 1000));
// };

// export const AdminMedicinesPage = () => {
//   const [medicines, setMedicines] = useState([]);
//   const [stock, setStock] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [editingMedicine, setEditingMedicine] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [actionId, setActionId] = useState(null);
//   const [feedback, setFeedback] = useState({ message: '', type: '' });
//   const [form, setForm] = useState(medicineFormDefaults);

//   const showFeedback = (message, type = 'success') => {
//     setFeedback({ message, type });
//     setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
//   };

//   const loadMedicines = useCallback(async () => {
//     setLoading(true);
//     try {
//       const [data, stockData] = await Promise.all([
//         adminService.getMedicines(),
//         adminService.getStock()
//       ]);
//       setMedicines(Array.isArray(data) ? data : []);
//       setStock(Array.isArray(stockData) ? stockData : []);
//     } catch (err) {
//       console.error('Failed to load medicines:', err);
//       showFeedback('Could not fetch medicines catalog.', 'danger');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadMedicines();
//   }, [loadMedicines]);

//   const handleSaveMedicine = async (e) => {
//     e.preventDefault();
//     setSubmitting(true);

//     // Brand Name field was removed. medicine_name is kept in sync with the
//     // Medicine Name so the Doctor and Pharmacy pages still show a name.
//     const payload = {
//       ...form,
//       generic_name: form.generic_name.trim(),
//       medicine_name: form.generic_name.trim()
//     };

//     try {
//       if (editingMedicine) {
//         const { initial_stock, ...medicineData } = payload;
//         const hasInitialStockData = Object.entries(initial_stock)
//           .some(([key, value]) => key !== 'id' && value !== '' && value !== null && value !== undefined);
//         const hasCompleteInitialStock = initial_stock.batch_number
//           && initial_stock.expiry_date
//           && initial_stock.quantity !== ''
//           && initial_stock.purchase_price !== ''
//           && initial_stock.selling_price !== '';
//         if (hasInitialStockData && !hasCompleteInitialStock) {
//           showFeedback('Complete all initial stock batch fields to save the expiry date.', 'danger');
//           setSubmitting(false);
//           return;
//         }
//         await adminService.updateMedicine(editingMedicine.id, medicineData);
//         if (initial_stock.id) {
//           const { id, ...batchData } = initial_stock;
//           await adminService.updateStock(id, {
//             ...batchData,
//             medicine: editingMedicine.id,
//             quantity: Number(batchData.quantity),
//             purchase_price: Number(batchData.purchase_price),
//             selling_price: Number(batchData.selling_price)
//           });
//         } else if (hasCompleteInitialStock) {
//           await adminService.createStock({
//             ...initial_stock,
//             medicine: editingMedicine.id,
//             quantity: Number(initial_stock.quantity),
//             purchase_price: Number(initial_stock.purchase_price),
//             selling_price: Number(initial_stock.selling_price)
//           });
//         }
//         showFeedback(`Medicine '${payload.generic_name}' updated.`);
//       } else {
//         if (
//           !payload.initial_stock.batch_number
//           || !payload.initial_stock.expiry_date
//           || payload.initial_stock.quantity === ''
//           || payload.initial_stock.purchase_price === ''
//           || payload.initial_stock.selling_price === ''
//         ) {
//           showFeedback('Complete all initial stock batch fields, including expiry date.', 'danger');
//           setSubmitting(false);
//           return;
//         }
//         await adminService.createMedicine({
//           ...payload,
//           initial_stock: {
//             ...payload.initial_stock,
//             quantity: Number(payload.initial_stock.quantity),
//             purchase_price: Number(payload.initial_stock.purchase_price),
//             selling_price: Number(payload.initial_stock.selling_price)
//           }
//         });
//         showFeedback(`Medicine '${payload.generic_name}' registered in formulary!`);
//       }
//       setIsModalOpen(false);
//       setEditingMedicine(null);
//       setForm(medicineFormDefaults);
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to register medicine:', err);
//       showFeedback(err.message || 'Medicine creation failed.', 'danger');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const openEditMedicine = (medicine) => {
//     const existingBatch = stock.find((batch) => Number(batch.medicine) === Number(medicine.id));
//     setEditingMedicine(medicine);
//     setForm({
//       generic_name: medicine.generic_name || medicine.medicine_name || '',
//       category: medicine.category || '',
//       manufacturer: medicine.manufacturer || '',
//       unit: medicine.unit || '',
//       description: medicine.description || '',
//       reorder_level: medicine.reorder_level ?? 10,
//       is_active: medicine.is_active,
//       initial_stock: existingBatch
//         ? {
//             id: existingBatch.id,
//             batch_number: existingBatch.batch_number,
//             expiry_date: existingBatch.expiry_date,
//             quantity: existingBatch.quantity,
//             purchase_price: existingBatch.purchase_price,
//             selling_price: existingBatch.selling_price
//           }
//         : { ...stockFormDefaults }
//     });
//     setIsModalOpen(true);
//   };

//   const handleToggleMedicine = async (medicine) => {
//     setActionId(medicine.id);
//     try {
//       await adminService.updateMedicine(medicine.id, { is_active: !medicine.is_active });
//       showFeedback(medicine.is_active ? 'Medicine deactivated.' : 'Medicine activated.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to update medicine status:', err);
//       showFeedback(err.message || 'Medicine status could not be updated.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const handleDeleteMedicine = async (medicine) => {
//     if (!window.confirm('Are you sure you want to delete this medicine?')) return;
//     setActionId(medicine.id);
//     try {
//       await adminService.deleteMedicine(medicine.id);
//       showFeedback('Medicine deleted.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to delete medicine:', err);
//       showFeedback(err.message || 'Medicine could not be deleted.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const handleDeleteStock = async (batch) => {
//     if (!window.confirm(`Delete batch ${batch.batch_number}?`)) return;
//     setActionId(`stock-${batch.id}`);
//     try {
//       await adminService.deleteStock(batch.id);
//       if (Number(form.initial_stock.id) === Number(batch.id)) {
//         setForm((current) => ({
//           ...current,
//           initial_stock: { ...stockFormDefaults }
//         }));
//       }
//       showFeedback('Stock batch deleted.');
//       await loadMedicines();
//     } catch (err) {
//       console.error('Failed to delete stock batch:', err);
//       showFeedback(err.message || 'Stock batch could not be deleted.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const filteredMedicines = medicines.filter((m) => {
//     if (!searchTerm) return true;
//     const term = searchTerm.toLowerCase();
//     return (
//       m.medicine_name?.toLowerCase().includes(term) ||
//       m.generic_name?.toLowerCase().includes(term) ||
//       m.category?.toLowerCase().includes(term)
//     );
//   });

//   const getExpiryDetails = (medicine) => {
//     const batches = stock.filter((batch) => Number(batch.medicine) === Number(medicine.id));
//     const batchExpiries = batches.map((batch) => ({
//       expiryDate: batch.expiry_date,
//       daysUntilExpiry: getDaysUntilExpiry(batch.expiry_date)
//     }));
//     const expiries = batchExpiries.length
//       ? batchExpiries
//       : [{
//           expiryDate: medicine.expiry_date,
//           daysUntilExpiry: getDaysUntilExpiry(medicine.expiry_date)
//         }];
//     const expiredBatchCount = expiries.filter((batch) => batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 0).length;
//     const nextExpiry = expiries
//       .filter((batch) => batch.expiryDate)
//       .sort((first, second) => first.expiryDate.localeCompare(second.expiryDate))[0];

//     return {
//       expiredBatchCount,
//       totalBatchCount: batches.length || (medicine.expiry_date ? 1 : 0),
//       nextExpiry
//     };
//   };

//   const columns = [
//     {
//       header: 'ID',
//       key: 'id',
//       render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
//     },
//     {
//       header: 'Medicine Name',
//       key: 'generic_name',
//       render: (row) => (
//         <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
//           {row.generic_name || row.medicine_name || '—'}
//         </span>
//       )
//     },
//     {
//       header: 'Category',
//       key: 'category',
//       render: (row) => (
//         <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500 }}>
//           {row.category || 'Pharmaceutical'}
//         </span>
//       )
//     },
//     {
//       header: 'Manufacturer',
//       key: 'manufacturer',
//       render: (row) => <span>{row.manufacturer || 'Approved'}</span>
//     },
//     {
//       header: 'Packaging / Unit',
//       key: 'unit',
//       render: (row) => <span>{row.unit || 'Strip'}</span>
//     },
//     {
//       header: 'Stock Level',
//       key: 'stock_level',
//       render: (row) => (
//         <span style={{ color: row.stock_level <= row.reorder_level ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
//           {row.stock_level}
//         </span>
//       )
//     },
//     {
//       header: 'Reorder Level',
//       key: 'reorder_level',
//       render: (row) => <span>{row.reorder_level}</span>
//     },
//     {
//       header: 'Expiry Date',
//       key: 'expiry_date',
//       render: (row) => {
//         const { expiredBatchCount, totalBatchCount, nextExpiry } = getExpiryDetails(row);
//         const isExpiringSoon = nextExpiry?.daysUntilExpiry > 0 && nextExpiry.daysUntilExpiry <= 20;
//         return (
//           <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
//             <span style={{
//               color: expiredBatchCount ? 'var(--danger)' : 'inherit',
//               fontWeight: expiredBatchCount ? 600 : 'normal'
//             }}>
//               {nextExpiry?.expiryDate || '—'}
//             </span>
//             {expiredBatchCount > 0 && (
//               <span style={{
//                 color: 'var(--danger)',
//                 background: 'var(--danger-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 {expiredBatchCount === totalBatchCount
//                   ? 'Expired'
//                   : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
//               </span>
//             )}
//             {!expiredBatchCount && isExpiringSoon && (
//               <span style={{
//                 color: 'var(--warning)',
//                 background: 'var(--warning-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 Expires in {nextExpiry.daysUntilExpiry} {nextExpiry.daysUntilExpiry === 1 ? 'day' : 'days'}
//               </span>
//             )}
//           </div>
//         );
//       }
//     },
//     {
//       header: 'Status',
//       key: 'is_active',
//       render: (row) => {
//         const { expiredBatchCount, totalBatchCount } = getExpiryDetails(row);
//         return (
//           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
//             {!expiredBatchCount && (
//               <span style={{
//                 display: 'inline-flex',
//                 alignItems: 'center',
//                 gap: '6px',
//                 whiteSpace: 'nowrap',
//                 color: row.is_active ? 'var(--success)' : 'var(--danger)',
//                 fontWeight: 600,
//                 fontSize: '0.82rem'
//               }}>
//                 <span aria-hidden="true">{row.is_active ? '●' : '○'}</span>
//                 <span>{row.is_active ? 'Active' : 'Inactive'}</span>
//               </span>
//             )}
//             {expiredBatchCount > 0 && (
//               <span style={{
//                 color: 'var(--danger)',
//                 background: 'var(--danger-light)',
//                 padding: '2px 8px',
//                 borderRadius: '4px',
//                 fontWeight: 700,
//                 fontSize: '0.8rem'
//               }}>
//                 {expiredBatchCount === totalBatchCount
//                   ? 'Expired'
//                   : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
//               </span>
//             )}
//           </div>
//         );
//       }
//     },
//     {
//       header: 'Actions',
//       key: 'actions',
//       headerStyle: { minWidth: '330px' },
//       render: (row) => (
//         <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
//           <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditMedicine(row)}>
//             Edit
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleToggleMedicine(row)}
//             disabled={actionId === row.id}
//           >
//             {row.is_active ? 'Deactivate' : 'Activate'}
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleDeleteMedicine(row)}
//             disabled={actionId === row.id}
//           >
//             Delete
//           </button>
//         </div>
//       )
//     }
//   ];

//   return (
//     <div>
//       <div className="page-header">
//         <div>
//           <h1 className="page-title">Master Medicine Catalog</h1>
//           <p className="page-subtitle">Standardized clinic formulary, pharmaceutical categorization, and generic nomenclature.</p>
//         </div>
//         <button
//           className="btn btn-primary"
//           onClick={() => {
//             setEditingMedicine(null);
//             setForm(medicineFormDefaults);
//             setIsModalOpen(true);
//           }}
//         >
//           + Add New Medicine
//         </button>
//       </div>

//       {feedback.message && (
//         <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
//       )}

//       {/* Filter Toolbar */}
//       <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
//         <div className="filter-toolbar" style={{ margin: 0 }}>
//           <div style={{ flex: 1, maxWidth: '400px' }}>
//             <input
//               type="text"
//               className="form-control"
//               placeholder="Search by medicine name or category..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//           </div>

//           <button className="btn btn-outline btn-sm" onClick={loadMedicines}>
//             🔄 Refresh Formulary
//           </button>
//         </div>
//       </div>

//       <DataTable
//         columns={columns}
//         data={filteredMedicines}
//         loading={loading}
//         emptyMessage="No medicines found in the master catalog."
//       />

//       <Modal
//         isOpen={isModalOpen}
//         onClose={() => {
//           setIsModalOpen(false);
//           setEditingMedicine(null);
//         }}
//         title={editingMedicine ? 'Edit Medicine' : 'Register Master Formulary Medicine'}
//       >
//         <form onSubmit={handleSaveMedicine}>
//           <div className="form-group">
//             <label className="form-label">Medicine Name *</label>
//             <input
//               type="text"
//               className="form-control"
//               required
//               pattern="[A-Za-z]+( [A-Za-z]+)*( ?[0-9]+)?"
//               title="Medicine name must start with letters, optionally followed by numbers (for example, Paracetamol 500)."
//               value={form.generic_name}
//               onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
//               placeholder="e.g. Paracetamol 500"
//             />
//           </div>

//           <div className="form-group">
//             <label className="form-label">Reorder Level *</label>
//             <input
//               type="number"
//               min="0"
//               className="form-control"
//               required
//               value={form.reorder_level}
//               onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
//             />
//           </div>

//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Category *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 pattern="[A-Za-z]+( [A-Za-z]+)*"
//                 title="Category must contain letters only."
//                 value={form.category}
//                 onChange={(e) => setForm({ ...form, category: e.target.value })}
//                 placeholder="e.g. Antibiotic"
//               />
//             </div>

//             <div className="form-group">
//               <label className="form-label">Packaging Unit</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 value={form.unit}
//                 onChange={(e) => setForm({ ...form, unit: e.target.value })}
//                 placeholder="e.g. Strip (10 tabs), Bottle (100ml)"
//               />
//             </div>
//           </div>

//           <div className="form-group">
//             <label className="form-label">Manufacturer (optional)</label>
//             <input
//               type="text"
//               className="form-control"
//               pattern="[A-Za-z]+( [A-Za-z]+)*"
//               title="Manufacturer must contain letters only."
//               value={form.manufacturer}
//               onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
//               placeholder="e.g. Micro Labs Ltd"
//             />
//           </div>

//           <div className="form-group">
//             <label className="form-label">Description / Storage Guidelines</label>
//             <textarea
//               className="form-control"
//               rows="2"
//               value={form.description}
//               onChange={(e) => setForm({ ...form, description: e.target.value })}
//               placeholder="Store in a cool, dry place away from sunlight..."
//             />
//           </div>

//           {editingMedicine && (
//             <section style={{ marginTop: '20px' }}>
//               <h3>Existing Stock Batches</h3>
//               <DataTable
//                 columns={[
//                   { header: 'Batch', key: 'batch_number' },
//                   { header: 'Stock Level', key: 'quantity' },
//                   { header: 'Expiry Date', key: 'expiry_date' },
//                   {
//                     header: 'Actions',
//                     key: 'actions',
//                     render: (batch) => (
//                       <div style={{ display: 'flex', gap: '6px' }}>
//                         <button
//                           type="button"
//                           className="btn btn-outline btn-sm"
//                           onClick={() => setForm((current) => ({
//                             ...current,
//                             initial_stock: {
//                               id: batch.id,
//                               batch_number: batch.batch_number,
//                               expiry_date: batch.expiry_date,
//                               quantity: batch.quantity,
//                               purchase_price: batch.purchase_price,
//                               selling_price: batch.selling_price
//                             }
//                           }))}
//                         >
//                           Edit Batch
//                         </button>
//                         <button
//                           type="button"
//                           className="btn btn-outline btn-sm"
//                           onClick={() => handleDeleteStock(batch)}
//                           disabled={actionId === `stock-${batch.id}`}
//                         >
//                           Delete Batch
//                         </button>
//                       </div>
//                     )
//                   }
//                 ]}
//                 data={stock.filter((batch) => Number(batch.medicine) === Number(editingMedicine.id))}
//                 loading={loading}
//                 emptyMessage="No stock batches recorded for this medicine."
//               />
//               <button
//                 type="button"
//                 className="btn btn-outline btn-sm"
//                 style={{ marginTop: '12px' }}
//                 onClick={() => setForm((current) => ({
//                   ...current,
//                   initial_stock: { ...stockFormDefaults }
//                 }))}
//               >
//                 + Add Stock Batch
//               </button>
//             </section>
//           )}

//           <h3>{editingMedicine ? 'Stock Batch / Expiry Details' : 'Initial Stock Batch'}</h3>
//           <p style={{ color: 'var(--text-muted)' }}>
//             {form.initial_stock.id
//               ? 'Update the selected batch below.'
//               : 'Enter a batch to record its stock level and expiry date.'}
//           </p>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Batch Number{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 pattern="[A-Za-z]+[0-9]+"
//                 title="Batch number must be letters followed by numbers (for example, BN1234)."
//                 value={form.initial_stock.batch_number}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, batch_number: event.target.value }
//                 })}
//                 placeholder="e.g. BN1234"
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Expiry Date{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="date"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.expiry_date}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, expiry_date: event.target.value }
//                 })}
//               />
//             </div>
//           </div>
//           <div className="form-group">
//             <label className="form-label">Stock Level{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//             <input
//               type="number"
//               min="0"
//               className="form-control"
//               required={!editingMedicine || Boolean(form.initial_stock.id)}
//               value={form.initial_stock.quantity}
//               onChange={(event) => setForm({
//                 ...form,
//                 initial_stock: { ...form.initial_stock, quantity: event.target.value }
//               })}
//             />
//           </div>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Purchase Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.purchase_price}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, purchase_price: event.target.value }
//                 })}
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Selling Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 className="form-control"
//                 required={!editingMedicine || Boolean(form.initial_stock.id)}
//                 value={form.initial_stock.selling_price}
//                 onChange={(event) => setForm({
//                   ...form,
//                   initial_stock: { ...form.initial_stock, selling_price: event.target.value }
//                 })}
//               />
//             </div>
//           </div>

//           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
//             <button
//               type="button"
//               className="btn btn-outline"
//               onClick={() => setIsModalOpen(false)}
//             >
//               Cancel
//             </button>
//             <button
//               type="submit"
//               className="btn btn-primary"
//               disabled={submitting}
//             >
//               {submitting ? 'Saving...' : editingMedicine ? 'Save Changes' : 'Add Medicine to Formulary'}
//             </button>
//           </div>
//         </form>
//       </Modal>

//     </div>
//   );
// };

// export default AdminMedicinesPage;


import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const stockFormDefaults = {
  batch_number: '',
  expiry_date: '',
  quantity: '',
  purchase_price: '',
  selling_price: ''
};

const medicineFormDefaults = {
  generic_name: '',
  category: 'Analgesic',
  manufacturer: '',
  unit: 'Strip (10 tabs)',
  description: '',
  reorder_level: 10,
  is_active: true,
  initial_stock: { ...stockFormDefaults }
};

const getDaysUntilExpiry = (expiryDate) => {
  if (!expiryDate) return null;
  const [year, month, day] = expiryDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  const expiryUtc = Date.UTC(year, month - 1, day);
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiryUtc - todayUtc) / (24 * 60 * 60 * 1000));
};

export const AdminMedicinesPage = () => {
  const [medicines, setMedicines] = useState([]);
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [form, setForm] = useState(medicineFormDefaults);

  const showFeedback = (message, type = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
  };

  const loadMedicines = useCallback(async () => {
    setLoading(true);
    try {
      const [data, stockData] = await Promise.all([
        adminService.getMedicines(),
        adminService.getStock()
      ]);
      setMedicines(Array.isArray(data) ? data : []);
      setStock(Array.isArray(stockData) ? stockData : []);
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

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    // Brand Name field was removed. medicine_name is kept in sync with the
    // Medicine Name so the Doctor and Pharmacy pages still show a name.
    const payload = {
      ...form,
      generic_name: form.generic_name.trim(),
      medicine_name: form.generic_name.trim()
    };

    try {
      if (editingMedicine) {
        const { initial_stock, ...medicineData } = payload;
        const hasInitialStockData = Object.entries(initial_stock)
          .some(([key, value]) => key !== 'id' && value !== '' && value !== null && value !== undefined);
        const hasCompleteInitialStock = initial_stock.batch_number
          && initial_stock.expiry_date
          && initial_stock.quantity !== ''
          && initial_stock.purchase_price !== ''
          && initial_stock.selling_price !== '';
        if (hasInitialStockData && !hasCompleteInitialStock) {
          showFeedback('Complete all initial stock batch fields to save the expiry date.', 'danger');
          setSubmitting(false);
          return;
        }
        await adminService.updateMedicine(editingMedicine.id, medicineData);
        if (initial_stock.id) {
          const { id, ...batchData } = initial_stock;
          await adminService.updateStock(id, {
            ...batchData,
            medicine: editingMedicine.id,
            quantity: Number(batchData.quantity),
            purchase_price: Number(batchData.purchase_price),
            selling_price: Number(batchData.selling_price)
          });
        } else if (hasCompleteInitialStock) {
          await adminService.createStock({
            ...initial_stock,
            medicine: editingMedicine.id,
            quantity: Number(initial_stock.quantity),
            purchase_price: Number(initial_stock.purchase_price),
            selling_price: Number(initial_stock.selling_price)
          });
        }
        showFeedback(`Medicine '${payload.generic_name}' updated.`);
      } else {
        if (
          !payload.initial_stock.batch_number
          || !payload.initial_stock.expiry_date
          || payload.initial_stock.quantity === ''
          || payload.initial_stock.purchase_price === ''
          || payload.initial_stock.selling_price === ''
        ) {
          showFeedback('Complete all initial stock batch fields, including expiry date.', 'danger');
          setSubmitting(false);
          return;
        }
        await adminService.createMedicine({
          ...payload,
          initial_stock: {
            ...payload.initial_stock,
            quantity: Number(payload.initial_stock.quantity),
            purchase_price: Number(payload.initial_stock.purchase_price),
            selling_price: Number(payload.initial_stock.selling_price)
          }
        });
        showFeedback(`Medicine '${payload.generic_name}' registered in formulary!`);
      }
      setIsModalOpen(false);
      setEditingMedicine(null);
      setForm(medicineFormDefaults);
      await loadMedicines();
    } catch (err) {
      console.error('Failed to register medicine:', err);
      showFeedback(err.message || 'Medicine creation failed.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditMedicine = (medicine) => {
    const existingBatch = stock.find((batch) => Number(batch.medicine) === Number(medicine.id));
    setEditingMedicine(medicine);
    setForm({
      generic_name: medicine.generic_name || medicine.medicine_name || '',
      category: medicine.category || '',
      manufacturer: medicine.manufacturer || '',
      unit: medicine.unit || '',
      description: medicine.description || '',
      reorder_level: medicine.reorder_level ?? 10,
      is_active: medicine.is_active,
      initial_stock: existingBatch
        ? {
            id: existingBatch.id,
            batch_number: existingBatch.batch_number,
            expiry_date: existingBatch.expiry_date,
            quantity: existingBatch.quantity,
            purchase_price: existingBatch.purchase_price,
            selling_price: existingBatch.selling_price
          }
        : { ...stockFormDefaults }
    });
    setIsModalOpen(true);
  };

  const handleToggleMedicine = async (medicine) => {
    setActionId(medicine.id);
    try {
      await adminService.updateMedicine(medicine.id, { is_active: !medicine.is_active });
      showFeedback(medicine.is_active ? 'Medicine deactivated.' : 'Medicine activated.');
      await loadMedicines();
    } catch (err) {
      console.error('Failed to update medicine status:', err);
      showFeedback(err.message || 'Medicine status could not be updated.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteMedicine = async (medicine) => {
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    setActionId(medicine.id);
    try {
      await adminService.deleteMedicine(medicine.id);
      showFeedback('Medicine deleted.');
      await loadMedicines();
    } catch (err) {
      console.error('Failed to delete medicine:', err);
      showFeedback(err.message || 'Medicine could not be deleted.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteStock = async (batch) => {
    if (!window.confirm(`Delete batch ${batch.batch_number}?`)) return;
    setActionId(`stock-${batch.id}`);
    try {
      await adminService.deleteStock(batch.id);
      if (Number(form.initial_stock.id) === Number(batch.id)) {
        setForm((current) => ({
          ...current,
          initial_stock: { ...stockFormDefaults }
        }));
      }
      showFeedback('Stock batch deleted.');
      await loadMedicines();
    } catch (err) {
      console.error('Failed to delete stock batch:', err);
      showFeedback(err.message || 'Stock batch could not be deleted.', 'danger');
    } finally {
      setActionId(null);
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

  // Active medicines whose stock level is at or below the reorder level
  const lowStockCount = medicines.filter(
    (m) => m.is_active && Number(m.stock_level) <= Number(m.reorder_level)
  ).length;

  const getExpiryDetails = (medicine) => {
    const batches = stock.filter((batch) => Number(batch.medicine) === Number(medicine.id));
    const batchExpiries = batches.map((batch) => ({
      expiryDate: batch.expiry_date,
      daysUntilExpiry: getDaysUntilExpiry(batch.expiry_date)
    }));
    const expiries = batchExpiries.length
      ? batchExpiries
      : [{
          expiryDate: medicine.expiry_date,
          daysUntilExpiry: getDaysUntilExpiry(medicine.expiry_date)
        }];
    const expiredBatchCount = expiries.filter((batch) => batch.daysUntilExpiry !== null && batch.daysUntilExpiry <= 0).length;
    const nextExpiry = expiries
      .filter((batch) => batch.expiryDate)
      .sort((first, second) => first.expiryDate.localeCompare(second.expiryDate))[0];

    return {
      expiredBatchCount,
      totalBatchCount: batches.length || (medicine.expiry_date ? 1 : 0),
      nextExpiry
    };
  };

  const columns = [
    {
      header: 'ID',
      key: 'id',
      render: (row) => <span style={{ fontWeight: 600 }}>#{row.id}</span>
    },
    {
      header: 'Medicine Name',
      key: 'generic_name',
      render: (row) => (
        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
          {row.generic_name || row.medicine_name || '—'}
        </span>
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
      header: 'Manufacturer',
      key: 'manufacturer',
      render: (row) => <span>{row.manufacturer || '—'}</span>
    },
    {
      header: 'Packaging / Unit',
      key: 'unit',
      render: (row) => <span>{row.unit || 'Strip'}</span>
    },
    {
      header: 'Stock Level',
      key: 'stock_level',
      render: (row) => {
        const stockLevel = Number(row.stock_level);
        const isOutOfStock = stockLevel === 0;
        const isLowStock = stockLevel <= Number(row.reorder_level);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            <span style={{ color: isLowStock ? 'var(--danger)' : 'inherit', fontWeight: 600 }}>
              {row.stock_level}
            </span>
            {isLowStock && (
              <span style={{
                color: isOutOfStock ? 'var(--danger)' : 'var(--warning)',
                background: isOutOfStock ? 'var(--danger-light)' : 'var(--warning-light)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.8rem',
                whiteSpace: 'nowrap'
              }}>
                {isOutOfStock ? 'Out of Stock' : 'Low Stock'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Reorder Level',
      key: 'reorder_level',
      render: (row) => <span>{row.reorder_level}</span>
    },
    {
      header: 'Expiry Date',
      key: 'expiry_date',
      render: (row) => {
        const { expiredBatchCount, totalBatchCount, nextExpiry } = getExpiryDetails(row);
        const isExpiringSoon = nextExpiry?.daysUntilExpiry > 0 && nextExpiry.daysUntilExpiry <= 20;
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <span style={{
              color: expiredBatchCount ? 'var(--danger)' : 'inherit',
              fontWeight: expiredBatchCount ? 600 : 'normal'
            }}>
              {nextExpiry?.expiryDate || '—'}
            </span>
            {expiredBatchCount > 0 && (
              <span style={{
                color: 'var(--danger)',
                background: 'var(--danger-light)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}>
                {expiredBatchCount === totalBatchCount
                  ? 'Expired'
                  : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
              </span>
            )}
            {!expiredBatchCount && isExpiringSoon && (
              <span style={{
                color: 'var(--warning)',
                background: 'var(--warning-light)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}>
                Expires in {nextExpiry.daysUntilExpiry} {nextExpiry.daysUntilExpiry === 1 ? 'day' : 'days'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Status',
      key: 'is_active',
      render: (row) => {
        const { expiredBatchCount, totalBatchCount } = getExpiryDetails(row);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
            {!expiredBatchCount && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                color: row.is_active ? 'var(--success)' : 'var(--danger)',
                fontWeight: 600,
                fontSize: '0.82rem'
              }}>
                <span aria-hidden="true">{row.is_active ? '●' : '○'}</span>
                <span>{row.is_active ? 'Active' : 'Inactive'}</span>
              </span>
            )}
            {expiredBatchCount > 0 && (
              <span style={{
                color: 'var(--danger)',
                background: 'var(--danger-light)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
                fontSize: '0.8rem'
              }}>
                {expiredBatchCount === totalBatchCount
                  ? 'Expired'
                  : `${expiredBatchCount} expired ${expiredBatchCount === 1 ? 'batch' : 'batches'}`}
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '330px' },
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditMedicine(row)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleToggleMedicine(row)}
            disabled={actionId === row.id}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleDeleteMedicine(row)}
            disabled={actionId === row.id}
          >
            Delete
          </button>
        </div>
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
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingMedicine(null);
            setForm(medicineFormDefaults);
            setIsModalOpen(true);
          }}
        >
          + Add New Medicine
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      {lowStockCount > 0 && (
        <div className="alert alert-warning">
          ⚠️ Low Stock Alert: {lowStockCount} {lowStockCount === 1 ? 'medicine is' : 'medicines are'} at or below the reorder level.
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by medicine name or category..."
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMedicine(null);
        }}
        title={editingMedicine ? 'Edit Medicine' : 'Register Master Formulary Medicine'}
      >
        <form onSubmit={handleSaveMedicine}>
          <div className="form-group">
            <label className="form-label">Medicine Name *</label>
            <input
              type="text"
              className="form-control"
              required
              pattern="[A-Za-z]+( [A-Za-z]+)*( ?[0-9]+)?"
              title="Medicine name must start with letters, optionally followed by numbers (for example, Paracetamol 500)."
              value={form.generic_name}
              onChange={(e) => setForm({ ...form, generic_name: e.target.value })}
              placeholder="e.g. Paracetamol 500"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reorder Level *</label>
            <input
              type="number"
              min="0"
              className="form-control"
              required
              value={form.reorder_level}
              onChange={(e) => setForm({ ...form, reorder_level: Number(e.target.value) })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z]+( [A-Za-z]+)*"
                title="Category must contain letters only."
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Antibiotic"
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
            <label className="form-label">Manufacturer (optional)</label>
            <input
              type="text"
              className="form-control"
              pattern="[A-Za-z]+( [A-Za-z]+)*"
              title="Manufacturer must contain letters only."
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

          {editingMedicine && (
            <section style={{ marginTop: '20px' }}>
              <h3>Existing Stock Batches</h3>
              <DataTable
                columns={[
                  { header: 'Batch', key: 'batch_number' },
                  { header: 'Stock Level', key: 'quantity' },
                  { header: 'Expiry Date', key: 'expiry_date' },
                  {
                    header: 'Actions',
                    key: 'actions',
                    render: (batch) => (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setForm((current) => ({
                            ...current,
                            initial_stock: {
                              id: batch.id,
                              batch_number: batch.batch_number,
                              expiry_date: batch.expiry_date,
                              quantity: batch.quantity,
                              purchase_price: batch.purchase_price,
                              selling_price: batch.selling_price
                            }
                          }))}
                        >
                          Edit Batch
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDeleteStock(batch)}
                          disabled={actionId === `stock-${batch.id}`}
                        >
                          Delete Batch
                        </button>
                      </div>
                    )
                  }
                ]}
                data={stock.filter((batch) => Number(batch.medicine) === Number(editingMedicine.id))}
                loading={loading}
                emptyMessage="No stock batches recorded for this medicine."
              />
              <button
                type="button"
                className="btn btn-outline btn-sm"
                style={{ marginTop: '12px' }}
                onClick={() => setForm((current) => ({
                  ...current,
                  initial_stock: { ...stockFormDefaults }
                }))}
              >
                + Add Stock Batch
              </button>
            </section>
          )}

          <h3>{editingMedicine ? 'Stock Batch / Expiry Details' : 'Initial Stock Batch'}</h3>
          <p style={{ color: 'var(--text-muted)' }}>
            {form.initial_stock.id
              ? 'Update the selected batch below.'
              : 'Enter a batch to record its stock level and expiry date.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Batch Number{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
              <input
                className="form-control"
                required={!editingMedicine || Boolean(form.initial_stock.id)}
                pattern="[A-Za-z]+[0-9]+"
                title="Batch number must be letters followed by numbers (for example, BN1234)."
                value={form.initial_stock.batch_number}
                onChange={(event) => setForm({
                  ...form,
                  initial_stock: { ...form.initial_stock, batch_number: event.target.value }
                })}
                placeholder="e.g. BN1234"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
              <input
                type="date"
                className="form-control"
                required={!editingMedicine || Boolean(form.initial_stock.id)}
                value={form.initial_stock.expiry_date}
                onChange={(event) => setForm({
                  ...form,
                  initial_stock: { ...form.initial_stock, expiry_date: event.target.value }
                })}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Stock Level{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
            <input
              type="number"
              min="0"
              className="form-control"
              required={!editingMedicine || Boolean(form.initial_stock.id)}
              value={form.initial_stock.quantity}
              onChange={(event) => setForm({
                ...form,
                initial_stock: { ...form.initial_stock, quantity: event.target.value }
              })}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Purchase Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                required={!editingMedicine || Boolean(form.initial_stock.id)}
                value={form.initial_stock.purchase_price}
                onChange={(event) => setForm({
                  ...form,
                  initial_stock: { ...form.initial_stock, purchase_price: event.target.value }
                })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Selling Price{!editingMedicine || Boolean(form.initial_stock.id) ? ' *' : ''}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                required={!editingMedicine || Boolean(form.initial_stock.id)}
                value={form.initial_stock.selling_price}
                onChange={(event) => setForm({
                  ...form,
                  initial_stock: { ...form.initial_stock, selling_price: event.target.value }
                })}
              />
            </div>
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
              {submitting ? 'Saving...' : editingMedicine ? 'Save Changes' : 'Add Medicine to Formulary'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default AdminMedicinesPage;