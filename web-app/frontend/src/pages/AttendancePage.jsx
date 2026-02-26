import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ClipboardCheck, Search, Edit2, Trash2, X, ChevronLeft, ChevronRight,
    Calendar, Filter, Loader, Download
} from 'lucide-react';
import { attendanceAPI, reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './AttendancePage.css';

export default function AttendancePage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterDate, setFilterDate] = useState('');
    const [filterName, setFilterName] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editRecord, setEditRecord] = useState(null);
    const [editStatus, setEditStatus] = useState('');
    const [saving, setSaving] = useState(false);
    const toast = useToast();

    const loadRecords = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, per_page: 15 };
            if (filterDate) params.date = filterDate;
            if (filterName) params.name = filterName;
            if (filterStatus) params.status = filterStatus;
            const res = await attendanceAPI.getAll(params);
            setRecords(res.data.records);
            setTotalPages(res.data.total_pages);
        } catch (err) {
            toast.error('Failed to load attendance records');
        } finally {
            setLoading(false);
        }
    }, [page, filterDate, filterName, filterStatus, toast]);

    useEffect(() => { loadRecords(); }, [page, filterDate, filterStatus]);

    const handleSearch = () => { setPage(1); loadRecords(); };

    const openEdit = (record) => {
        setEditRecord(record);
        setEditStatus(record.status);
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        setSaving(true);
        try {
            await attendanceAPI.edit(editRecord.rid, { status: editStatus });
            toast.success('Attendance updated');
            setShowEditModal(false);
            loadRecords();
        } catch (err) {
            toast.error('Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this attendance record?')) return;
        try {
            await attendanceAPI.delete(id);
            toast.success('Record deleted');
            loadRecords();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const handleExport = async () => {
        try {
            const params = {};
            if (filterDate) params.date = filterDate;
            const res = await reportsAPI.exportCSV('daily', params);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `attendance_${filterDate || 'all'}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report downloaded');
        } catch (err) {
            toast.error('Failed to export');
        }
    };

    const clearFilters = () => {
        setFilterDate('');
        setFilterName('');
        setFilterStatus('');
        setPage(1);
    };

    const statusColors = {
        Present: 'success',
        Absent: 'error',
        Late: 'warning',
        Excused: 'info',
    };

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title"><span className="gradient-text">Attendance</span></h1>
                        <p className="page-subtitle">View, edit, and manage attendance records</p>
                    </div>
                    <motion.button className="btn btn-secondary" onClick={handleExport} whileHover={{ scale: 1.03 }}>
                        <Download size={18} /> Export CSV
                    </motion.button>
                </div>

                {/* Filters */}
                <div className="filters-bar glass-card-static">
                    <div className="filter-group">
                        <Calendar size={16} />
                        <input type="date" className="input-field filter-input" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setPage(1); }} />
                    </div>
                    <div className="filter-group">
                        <Search size={16} />
                        <input type="text" className="input-field filter-input" placeholder="Search by name..." value={filterName} onChange={(e) => setFilterName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
                    </div>
                    <div className="filter-group">
                        <Filter size={16} />
                        <select className="select-field filter-input" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
                            <option value="">All Status</option>
                            <option value="Present">Present</option>
                            <option value="Absent">Absent</option>
                            <option value="Late">Late</option>
                            <option value="Excused">Excused</option>
                        </select>
                    </div>
                    {(filterDate || filterName || filterStatus) && (
                        <button className="btn btn-ghost btn-sm" onClick={clearFilters}><X size={14} /> Clear</button>
                    )}
                </div>

                {/* Table */}
                <div className="glass-card-static data-table-container" style={{ marginTop: 16 }}>
                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : records.length === 0 ? (
                        <div className="empty-state"><ClipboardCheck size={48} /><h3>No records found</h3><p>Adjust your filters or take attendance first</p></div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr><th>ID</th><th>Name</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {records.map((r, i) => (
                                    <motion.tr key={r.rid || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                                        <td>{r.id}</td>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</td>
                                        <td>{r.date}</td>
                                        <td>{r.time}</td>
                                        <td><span className={`badge badge-${statusColors[r.status] || 'info'}`}>{r.status}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(r)} title="Edit"><Edit2 size={15} /></button>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(r.rid)} title="Delete" style={{ color: 'var(--error)' }}><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                        {[...Array(Math.min(totalPages, 7))].map((_, i) => (
                            <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                        ))}
                        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                    </div>
                )}

                {/* Edit Modal */}
                <AnimatePresence>
                    {showEditModal && editRecord && (
                        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)}>
                            <motion.div className="modal-content" style={{ maxWidth: 400 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2 className="modal-title">Edit Attendance</h2>
                                    <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={18} /></button>
                                </div>
                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                        <strong>{editRecord.name}</strong> — {editRecord.date}
                                    </p>
                                </div>
                                <div className="input-group">
                                    <label>Status</label>
                                    <select className="select-field" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                                        <option value="Present">Present</option>
                                        <option value="Absent">Absent</option>
                                        <option value="Late">Late</option>
                                        <option value="Excused">Excused</option>
                                    </select>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                                    <motion.button className="btn btn-primary" onClick={handleEditSave} disabled={saving} whileHover={{ scale: 1.02 }}>
                                        {saving ? <><Loader size={16} className="spinning" /> Saving...</> : 'Save Changes'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
