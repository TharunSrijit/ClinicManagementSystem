// import React, { useState, useEffect, useCallback } from 'react';
// import adminService from '../../services/adminService';
// import DataTable from '../../components/DataTable';
// import Modal from '../../components/Modal';

// const emptyForm = {
//   test_code: '',
//   test_name: '',
//   category: '',
//   description: '',
//   normal_range: '',
//   unit: '',
//   price: 350,
//   is_active: true
// };

// const labTestUnits = ['ng/mL', 'mg/L', 'mmol/L', 'cells/µL'];

// export const AdminLabTestsPage = () => {
//   const [labTests, setLabTests] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [editingLabTest, setEditingLabTest] = useState(null);
//   const [submitting, setSubmitting] = useState(false);
//   const [actionId, setActionId] = useState(null);
//   const [feedback, setFeedback] = useState({ message: '', type: '' });
//   const [form, setForm] = useState({ ...emptyForm });

//   const showFeedback = (message, type = 'success') => {
//     setFeedback({ message, type });
//     setTimeout(() => setFeedback({ message: '', type: '' }), 5000);
//   };

//   const loadLabTests = useCallback(async () => {
//     setLoading(true);
//     try {
//       const data = await adminService.getLabTests();
//       setLabTests(Array.isArray(data) ? data : []);
//     } catch (err) {
//       console.error('Failed to load lab tests:', err);
//       showFeedback(err.message || 'Could not fetch lab test catalog.', 'danger');
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadLabTests();
//   }, [loadLabTests]);

//   const closeModal = () => {
//     setIsModalOpen(false);
//     setEditingLabTest(null);
//     setForm({ ...emptyForm });
//   };

//   const openCreateModal = () => {
//     setEditingLabTest(null);
//     setForm({ ...emptyForm });
//     setIsModalOpen(true);
//   };

//   const openEditModal = (labTest) => {
//     setEditingLabTest(labTest);
//     setForm({
//       test_code: labTest.test_code || '',
//       test_name: labTest.test_name || '',
//       category: labTest.category || '',
//       description: labTest.description || '',
//       normal_range: labTest.normal_range || '',
//       unit: labTest.unit || '',
//       price: labTest.price ?? 0,
//       is_active: labTest.is_active
//     });
//     setIsModalOpen(true);
//   };

//   const handleSaveLabTest = async (event) => {
//     event.preventDefault();
//     setSubmitting(true);
//     try {
//       const labTestData = {
//         ...form,
//         test_code: form.test_code.trim(),
//         test_name: form.test_name.trim(),
//         category: form.category.trim(),
//         price: Number(form.price)
//       };
//       if (editingLabTest) {
//         await adminService.updateLabTest(editingLabTest.id, labTestData);
//         showFeedback(`Lab test '${labTestData.test_name}' updated.`);
//       } else {
//         await adminService.createLabTest(labTestData);
//         showFeedback(`Lab test '${labTestData.test_name}' added successfully.`);
//       }
//       closeModal();
//       await loadLabTests();
//     } catch (err) {
//       console.error('Failed to save lab test:', err);
//       showFeedback(err.message || 'Lab test could not be saved.', 'danger');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   const handleToggleLabTest = async (labTest) => {
//     setActionId(labTest.id);
//     try {
//       await adminService.updateLabTest(labTest.id, { is_active: !labTest.is_active });
//       showFeedback(labTest.is_active ? 'Lab test deactivated.' : 'Lab test activated.');
//       await loadLabTests();
//     } catch (err) {
//       console.error('Failed to update lab test status:', err);
//       showFeedback(err.message || 'Lab test status could not be updated.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const handleDeleteLabTest = async (labTest) => {
//     if (!window.confirm(`Delete lab test ${labTest.test_name}?`)) return;
//     setActionId(labTest.id);
//     try {
//       await adminService.deleteLabTest(labTest.id);
//       showFeedback('Lab test deleted.');
//       await loadLabTests();
//     } catch (err) {
//       console.error('Failed to delete lab test:', err);
//       showFeedback(err.message || 'Lab test could not be deleted.', 'danger');
//     } finally {
//       setActionId(null);
//     }
//   };

//   const filteredTests = labTests.filter((test) => {
//     if (!searchTerm) return true;
//     const term = searchTerm.toLowerCase();
//     return (
//       test.test_name?.toLowerCase().includes(term) ||
//       test.test_code?.toLowerCase().includes(term) ||
//       test.category?.toLowerCase().includes(term)
//     );
//   });

//   const columns = [
//     {
//       header: 'Code',
//       key: 'test_code',
//       render: (row) => (
//         <span style={{ fontWeight: 700, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
//           {row.test_code || `#${row.id}`}
//         </span>
//       )
//     },
//     {
//       header: 'Test Name',
//       key: 'test_name',
//       render: (row) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.test_name}</span>
//     },
//     {
//       header: 'Category',
//       key: 'category',
//       render: (row) => <span>{row.category || '—'}</span>
//     },
//     {
//       header: 'Standard Reference Range',
//       key: 'normal_range',
//       render: (row) => <span>{row.normal_range ? `${row.normal_range} ${row.unit || ''}` : '—'}</span>
//     },
//     {
//       header: 'Standard Tariff Price',
//       key: 'price',
//       render: (row) => (
//         <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
//           ₹{Number(row.price || 0).toFixed(2)}
//         </span>
//       )
//     },
//     {
//       header: 'Status',
//       key: 'is_active',
//       render: (row) => (
//         <span style={{
//           display: 'inline-flex',
//           alignItems: 'center',
//           gap: '6px',
//           whiteSpace: 'nowrap',
//           color: row.is_active ? 'var(--success)' : 'var(--danger)',
//           fontWeight: 600,
//           fontSize: '0.82rem'
//         }}>
//           <span aria-hidden="true">{row.is_active ? '●' : '○'}</span>
//           <span>{row.is_active ? 'Active' : 'Inactive'}</span>
//         </span>
//       )
//     },
//     {
//       header: 'Actions',
//       key: 'actions',
//       headerStyle: { minWidth: '250px' },
//       render: (row) => (
//         <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
//           <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(row)}>
//             Edit
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleToggleLabTest(row)}
//             disabled={actionId === row.id}
//           >
//             {row.is_active ? 'Deactivate' : 'Activate'}
//           </button>
//           <button
//             type="button"
//             className="btn btn-outline btn-sm"
//             onClick={() => handleDeleteLabTest(row)}
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
//           <h1 className="page-title">Diagnostic Lab Tests Master</h1>
//           <p className="page-subtitle">Configure pathology tests, categories, biological reference ranges, and billing tariffs.</p>
//         </div>
//         <button className="btn btn-primary" onClick={openCreateModal}>
//           + Add New Lab Test
//         </button>
//       </div>

//       {feedback.message && (
//         <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
//       )}

//       <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
//         <div className="filter-toolbar" style={{ margin: 0 }}>
//           <div style={{ flex: 1, maxWidth: '400px' }}>
//             <input
//               type="text"
//               className="form-control"
//               placeholder="Search by test name, code, or category..."
//               value={searchTerm}
//               onChange={(event) => setSearchTerm(event.target.value)}
//             />
//           </div>
//           <button className="btn btn-outline btn-sm" onClick={loadLabTests}>
//             🔄 Refresh Test Master
//           </button>
//         </div>
//       </div>

//       <DataTable
//         columns={columns}
//         data={filteredTests}
//         loading={loading}
//         emptyMessage="No diagnostic tests found in the master index."
//       />

//       <Modal
//         isOpen={isModalOpen}
//         onClose={closeModal}
//         title={editingLabTest ? 'Edit Diagnostic Laboratory Test' : 'Add Diagnostic Laboratory Test'}
//       >
//         <form onSubmit={handleSaveLabTest}>
//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Test Code *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 maxLength="5"
//                 pattern="[A-Za-z]{3}[0-9]{2}"
//                 title="Enter exactly three letters followed by two numbers, for example CBC01."
//                 value={form.test_code}
//                 onChange={(event) => setForm({ ...form, test_code: event.target.value })}
//                 placeholder="e.g. CBC01, LFT02"
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Test Name *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 pattern="[A-Za-z0-9]+( [A-Za-z0-9]+)*"
//                 title="Use letters, numbers, and spaces only."
//                 value={form.test_name}
//                 onChange={(event) => setForm({ ...form, test_name: event.target.value })}
//                 placeholder="e.g. Complete Blood Count CBC"
//               />
//             </div>
//           </div>

//           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
//             <div className="form-group">
//               <label className="form-label">Category *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 pattern="[A-Za-z0-9]+( [A-Za-z0-9]+)*"
//                 title="Use letters, numbers, and spaces only."
//                 value={form.category}
//                 onChange={(event) => setForm({ ...form, category: event.target.value })}
//                 placeholder="e.g. Hematology, Biochemistry"
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Unit of Measure *</label>
//               <input
//                 type="text"
//                 className="form-control"
//                 required
//                 pattern="ng/mL|mg/L|mmol/L|cells/µL"
//                 title="Enter ng/mL, mg/L, mmol/L, or cells/µL."
//                 value={form.unit}
//                 onChange={(event) => setForm({ ...form, unit: event.target.value })}
//                 placeholder="e.g. ng/mL"
//               />
//             </div>
//             <div className="form-group">
//               <label className="form-label">Tariff Price (₹) *</label>
//               <input
//                 type="number"
//                 min="0"
//                 step="0.01"
//                 className="form-control"
//                 required
//                 value={form.price}
//                 onChange={(event) => setForm({ ...form, price: event.target.value })}
//               />
//             </div>
//           </div>

//           <div className="form-group">
//             <label className="form-label">Reference Range</label>
//             <input
//               type="text"
//               className="form-control"
//               pattern="[0-9]+(\.[0-9]+)?( *- *[0-9]+(\.[0-9]+)?)?"
//               title="Enter numbers only, optionally as a decimal range such as 13.5 - 17.5."
//               value={form.normal_range}
//               onChange={(event) => setForm({ ...form, normal_range: event.target.value })}
//               placeholder="e.g. 13.5 - 17.5"
//             />
//           </div>

//           <div className="form-group">
//             <label className="form-label">Description / Specimen Protocol</label>
//             <textarea
//               className="form-control"
//               rows="2"
//               value={form.description}
//               onChange={(event) => setForm({ ...form, description: event.target.value })}
//               placeholder="Requires 2ml EDTA whole blood sample. 8-hour fasting recommended."
//             />
//           </div>

//           <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
//             <button type="button" className="btn btn-outline" onClick={closeModal}>
//               Cancel
//             </button>
//             <button type="submit" className="btn btn-primary" disabled={submitting}>
//               {submitting ? 'Saving...' : editingLabTest ? 'Save Changes' : 'Add Diagnostic Test'}
//             </button>
//           </div>
//         </form>
//       </Modal>
//     </div>
//   );
// };

// export default AdminLabTestsPage;


import React, { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/adminService';
import DataTable from '../../components/DataTable';
import Modal from '../../components/Modal';

const emptyForm = {
  test_code: '',
  test_name: '',
  category: '',
  description: '',
  normal_range: '',
  unit: '',
  price: 350,
  is_active: true
};

const labTestUnits = ['ng/mL', 'mg/L', 'mmol/L', 'cells/µL'];

export const AdminLabTestsPage = () => {
  const [labTests, setLabTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabTest, setEditingLabTest] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [form, setForm] = useState({ ...emptyForm });

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
      showFeedback(err.message || 'Could not fetch lab test catalog.', 'danger');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLabTests();
  }, [loadLabTests]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLabTest(null);
    setForm({ ...emptyForm });
  };

  const openCreateModal = () => {
    setEditingLabTest(null);
    setForm({ ...emptyForm });
    setIsModalOpen(true);
  };

  const openEditModal = (labTest) => {
    setEditingLabTest(labTest);
    setForm({
      test_code: labTest.test_code || '',
      test_name: labTest.test_name || '',
      category: labTest.category || '',
      description: labTest.description || '',
      normal_range: labTest.normal_range || '',
      unit: labTest.unit || '',
      price: labTest.price ?? 0,
      is_active: labTest.is_active
    });
    setIsModalOpen(true);
  };

  const handleSaveLabTest = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const labTestData = {
        ...form,
        test_code: form.test_code.trim(),
        test_name: form.test_name.trim(),
        category: form.category.trim(),
        price: Number(form.price)
      };
      if (editingLabTest) {
        await adminService.updateLabTest(editingLabTest.id, labTestData);
        showFeedback(`Lab test '${labTestData.test_name}' updated.`);
      } else {
        await adminService.createLabTest(labTestData);
        showFeedback(`Lab test '${labTestData.test_name}' added successfully.`);
      }
      closeModal();
      await loadLabTests();
    } catch (err) {
      console.error('Failed to save lab test:', err);
      showFeedback(err.message || 'Lab test could not be saved.', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLabTest = async (labTest) => {
    setActionId(labTest.id);
    try {
      await adminService.updateLabTest(labTest.id, { is_active: !labTest.is_active });
      showFeedback(labTest.is_active ? 'Lab test deactivated.' : 'Lab test activated.');
      await loadLabTests();
    } catch (err) {
      console.error('Failed to update lab test status:', err);
      showFeedback(err.message || 'Lab test status could not be updated.', 'danger');
    } finally {
      setActionId(null);
    }
  };

  const openDeleteModal = (labTest) => {
    setDeleteTarget(labTest);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteLabTest = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminService.deleteLabTest(deleteTarget.id);
      showFeedback(`Lab test '${deleteTarget.test_name}' deleted permanently.`);
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadLabTests();
    } catch (err) {
      console.error('Failed to delete lab test:', err);
      showFeedback(err.message || 'Lab test could not be deleted.', 'danger');
      setIsDeleteModalOpen(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredTests = labTests.filter((test) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      test.test_name?.toLowerCase().includes(term) ||
      test.test_code?.toLowerCase().includes(term) ||
      test.category?.toLowerCase().includes(term)
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
      header: 'Category',
      key: 'category',
      render: (row) => <span>{row.category || '—'}</span>
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
      header: 'Status',
      key: 'is_active',
      render: (row) => (
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
      )
    },
    {
      header: 'Actions',
      key: 'actions',
      headerStyle: { minWidth: '250px' },
      render: (row) => (
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '6px' }} onClick={(event) => event.stopPropagation()}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(row)}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => handleToggleLabTest(row)}
            disabled={actionId === row.id}
          >
            {row.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => openDeleteModal(row)}
            disabled={actionId === row.id}
            style={{ color: 'var(--danger)', borderColor: 'var(--danger-light)' }}
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
          <h1 className="page-title">Diagnostic Lab Tests Master</h1>
          <p className="page-subtitle">Configure pathology tests, categories, biological reference ranges, and billing tariffs.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add New Lab Test
        </button>
      </div>

      {feedback.message && (
        <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>
      )}

      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div className="filter-toolbar" style={{ margin: 0 }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by test name, code, or category..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingLabTest ? 'Edit Diagnostic Laboratory Test' : 'Add Diagnostic Laboratory Test'}
      >
        <form onSubmit={handleSaveLabTest}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Test Code *</label>
              <input
                type="text"
                className="form-control"
                required
                maxLength="30"
                pattern="[A-Za-z]+[0-9]+"
                title="Test code must be letters followed by numbers (for example, C12, CBC01 or LAB001)."
                value={form.test_code}
                onChange={(event) => setForm({ ...form, test_code: event.target.value })}
                placeholder="e.g. C12, CBC01, LAB001"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Test Name *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z0-9]+( [A-Za-z0-9]+)*"
                title="Use letters, numbers, and spaces only."
                value={form.test_name}
                onChange={(event) => setForm({ ...form, test_name: event.target.value })}
                placeholder="e.g. Complete Blood Count CBC"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Category *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="[A-Za-z]+( [A-Za-z]+)*"
                title="Category must contain letters only."
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="e.g. Hematology, Biochemistry"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure *</label>
              <input
                type="text"
                className="form-control"
                required
                pattern="ng/mL|mg/L|mmol/L|cells/µL"
                title="Enter ng/mL, mg/L, mmol/L, or cells/µL."
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="e.g. ng/mL"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tariff Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                required
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reference Range</label>
            <input
              type="text"
              className="form-control"
              pattern="[0-9]+(\.[0-9]+)?( *- *[0-9]+(\.[0-9]+)?)?"
              title="Enter numbers only, optionally as a decimal range such as 13.5 - 17.5."
              value={form.normal_range}
              onChange={(event) => setForm({ ...form, normal_range: event.target.value })}
              placeholder="e.g. 13.5 - 17.5"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Specimen Protocol</label>
            <textarea
              className="form-control"
              rows="2"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Requires 2ml EDTA whole blood sample. 8-hour fasting recommended."
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-outline" onClick={closeModal}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingLabTest ? 'Save Changes' : 'Add Diagnostic Test'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (!deleteLoading) {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        title="Confirm Lab Test Deletion"
      >
        <div>
          <p style={{ marginBottom: '16px', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Are you sure you want to permanently delete lab test{' '}
            <strong style={{ color: 'var(--danger)' }}>{deleteTarget?.test_name}</strong> ({deleteTarget?.test_code})?
          </p>
          <div style={{
            background: 'var(--warning-light)',
            color: '#854d0e',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            <strong>Important Safety Rule:</strong> If this test is referenced in historical lab orders, test results, or invoices, permanent deletion is strictly blocked to preserve medical diagnostics records. In such cases, please deactivate the test instead.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeleteTarget(null);
              }}
              disabled={deleteLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleConfirmDeleteLabTest}
              disabled={deleteLoading}
              style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}
            >
              {deleteLoading ? 'Deleting...' : 'Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AdminLabTestsPage;