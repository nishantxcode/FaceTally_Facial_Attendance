import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import {
    Users, Plus, Search, Edit2, Trash2, X, Camera,
    ChevronLeft, ChevronRight, Mail, Phone, User, BookOpen, Loader
} from 'lucide-react';
import { studentsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './StudentsPage.css';

const emptyForm = { department: '', fname: '', gender: '', contact_no: '', email_address: '' };

export default function StudentsPage() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [showCapture, setShowCapture] = useState(false);
    const [captureStudentId, setCaptureStudentId] = useState(null);
    const [capturedPhotos, setCapturedPhotos] = useState([]);
    const [capturing, setCapturing] = useState(false);
    const webcamRef = useRef(null);
    const toast = useToast();
    const searchTimeout = useRef(null);

    const loadStudents = useCallback(async (p = page, s = search) => {
        setLoading(true);
        try {
            const res = await studentsAPI.getAll({ page: p, search: s, per_page: 10 });
            setStudents(res.data.students);
            setTotalPages(res.data.total_pages);
        } catch (err) {
            toast.error('Failed to load students');
        } finally {
            setLoading(false);
        }
    }, [page, search, toast]);

    useEffect(() => { loadStudents(); }, [page]);

    const handleSearch = (val) => {
        setSearch(val);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setPage(1);
            loadStudents(1, val);
        }, 400);
    };

    const openAddModal = () => {
        setEditingId(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEditModal = (student) => {
        setEditingId(student.eid);
        setForm({
            department: student.department || '',
            fname: student.fname || '',
            gender: student.gender || '',
            contact_no: student.contact_no || '',
            email_address: student.email_address || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.fname || !form.department || !form.gender || !form.contact_no || !form.email_address) {
            toast.error('All fields are required');
            return;
        }
        setSaving(true);
        try {
            if (editingId) {
                await studentsAPI.update(editingId, form);
                toast.success('Student updated successfully');
            } else {
                const res = await studentsAPI.create(form);
                toast.success('Student added! Now capture face photos.');
                setCaptureStudentId(res.data.student_id);
                setShowCapture(true);
            }
            setShowModal(false);
            loadStudents();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Delete student "${name}"? This cannot be undone.`)) return;
        try {
            await studentsAPI.delete(id);
            toast.success('Student deleted');
            loadStudents();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    // Photo capture
    const capturePhoto = useCallback(() => {
        if (!webcamRef.current || capturedPhotos.length >= 50) return;
        const img = webcamRef.current.getScreenshot();
        if (img) setCapturedPhotos(prev => [...prev, img]);
    }, [capturedPhotos]);

    const startAutoCapture = () => {
        setCapturing(true);
        setCapturedPhotos([]);
        let count = 0;
        const interval = setInterval(() => {
            if (count >= 50 || !webcamRef.current) {
                clearInterval(interval);
                setCapturing(false);
                return;
            }
            const img = webcamRef.current?.getScreenshot();
            if (img) {
                setCapturedPhotos(prev => {
                    if (prev.length >= 50) { clearInterval(interval); setCapturing(false); return prev; }
                    return [...prev, img];
                });
                count++;
            }
        }, 200);
    };

    const savePhotos = async () => {
        if (capturedPhotos.length === 0) { toast.error('No photos captured'); return; }
        try {
            const res = await studentsAPI.savePhotos(captureStudentId, capturedPhotos);
            const training = res.data.training;
            if (training?.trained) {
                toast.success(`${capturedPhotos.length} photos saved and face model trained`);
            } else {
                toast.warning(training?.message || `${capturedPhotos.length} photos saved, but model was not trained`);
            }
            setShowCapture(false);
            setCapturedPhotos([]);
            setCaptureStudentId(null);
        } catch (err) {
            toast.error('Failed to save photos');
        }
    };

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title"><span className="gradient-text">Students</span></h1>
                        <p className="page-subtitle">Manage student records and face data</p>
                    </div>
                    <motion.button className="btn btn-primary" onClick={openAddModal} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <Plus size={18} /> Add Student
                    </motion.button>
                </div>

                {/* Search */}
                <div className="search-bar glass-card-static">
                    <Search size={18} className="search-icon" />
                    <input type="text" className="search-input" placeholder="Search by name, email, or contact..." value={search} onChange={(e) => handleSearch(e.target.value)} />
                    {search && <button className="btn-ghost btn-icon" onClick={() => handleSearch('')}><X size={16} /></button>}
                </div>

                {/* Table */}
                <div className="glass-card-static data-table-container" style={{ marginTop: 16 }}>
                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /><p style={{ marginTop: 12, color: 'var(--text-muted)' }}>Loading students...</p></div>
                    ) : students.length === 0 ? (
                        <div className="empty-state"><Users size={48} /><h3>No students found</h3><p>{search ? 'Try a different search term' : 'Add your first student to get started'}</p></div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th><th>Name</th><th>Subject</th><th>Gender</th><th>Contact</th><th>Email</th><th>Joined</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s, i) => (
                                    <motion.tr key={s.eid} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                                        <td>{s.eid}</td>
                                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div className="table-avatar">{s.fname?.[0]?.toUpperCase()}</div>
                                                {s.fname}
                                            </div>
                                        </td>
                                        <td><span className="badge badge-info">{s.department}</span></td>
                                        <td>{s.gender}</td>
                                        <td>{s.contact_no}</td>
                                        <td>{s.email_address}</td>
                                        <td>{s.date_of_join}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEditModal(s)} title="Edit"><Edit2 size={15} /></button>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setCaptureStudentId(s.eid); setShowCapture(true); setCapturedPhotos([]); }} title="Capture Photos"><Camera size={15} /></button>
                                                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(s.eid, s.fname)} title="Delete" style={{ color: 'var(--error)' }}><Trash2 size={15} /></button>
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
                        {[...Array(totalPages)].map((_, i) => (
                            <button key={i} className={`pagination-btn ${page === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                        ))}
                        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                    </div>
                )}

                {/* Add/Edit Modal */}
                <AnimatePresence>
                    {showModal && (
                        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)}>
                            <motion.div className="modal-content" initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2 className="modal-title">{editingId ? 'Edit Student' : 'Add New Student'}</h2>
                                    <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                                </div>
                                <div className="form-grid">
                                    <div className="input-group"><label><User size={14} style={{ marginRight: 4 }} />Full Name</label><input className="input-field" value={form.fname} onChange={(e) => setForm({ ...form, fname: e.target.value })} placeholder="Enter full name" /></div>
                                    <div className="input-group"><label><BookOpen size={14} style={{ marginRight: 4 }} />Subject / Department</label><input className="input-field" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="e.g. Computer Science" /></div>
                                    <div className="input-group"><label>Gender</label><select className="select-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}><option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Others">Others</option></select></div>
                                    <div className="input-group"><label><Phone size={14} style={{ marginRight: 4 }} />Contact Number</label><input className="input-field" value={form.contact_no} onChange={(e) => setForm({ ...form, contact_no: e.target.value })} placeholder="e.g. 09876543210" /></div>
                                    <div className="input-group" style={{ gridColumn: '1 / -1' }}><label><Mail size={14} style={{ marginRight: 4 }} />Email Address</label><input className="input-field" value={form.email_address} onChange={(e) => setForm({ ...form, email_address: e.target.value })} placeholder="e.g. student@example.com" /></div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                    <motion.button className="btn btn-primary" onClick={handleSave} disabled={saving} whileHover={{ scale: 1.02 }}>
                                        {saving ? <><Loader size={16} className="spinning" />Saving...</> : editingId ? 'Update Student' : 'Add Student'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Photo Capture Modal */}
                <AnimatePresence>
                    {showCapture && (
                        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <motion.div className="modal-content" style={{ maxWidth: 640 }} initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h2 className="modal-title">Capture Face Photos</h2>
                                    <button className="modal-close" onClick={() => { setShowCapture(false); setCapturedPhotos([]); }}><X size={18} /></button>
                                </div>
                                <div className="capture-webcam">
                                    <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg" screenshotQuality={0.8} videoConstraints={{ width: 320, height: 240, facingMode: 'user' }} style={{ width: '100%', borderRadius: 12 }} />
                                </div>
                                <div className="capture-info">
                                    <p><strong>{capturedPhotos.length}</strong> / 50 photos captured</p>
                                    <div className="capture-progress-bar">
                                        <motion.div className="capture-progress-fill" animate={{ width: `${(capturedPhotos.length / 50) * 100}%` }} />
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={capturePhoto} disabled={capturedPhotos.length >= 50 || capturing}>Capture One</button>
                                    <motion.button className="btn btn-primary" onClick={startAutoCapture} disabled={capturing || capturedPhotos.length >= 50} whileHover={{ scale: 1.02 }}>
                                        {capturing ? <><Loader size={16} className="spinning" />Capturing...</> : 'Auto Capture (50)'}
                                    </motion.button>
                                    {capturedPhotos.length > 0 && (
                                        <motion.button className="btn btn-success" onClick={savePhotos} whileHover={{ scale: 1.02 }}>Save Photos</motion.button>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
