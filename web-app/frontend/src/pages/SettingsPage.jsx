import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Database, Cpu, Lock, Save, Loader, CheckCircle, XCircle } from 'lucide-react';
import { authAPI, recognitionAPI, healthAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './SettingsPage.css';

export default function SettingsPage() {
    const [oldPassword, setOldPassword] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [modelStatus, setModelStatus] = useState(null);
    const [serverStatus, setServerStatus] = useState(null);
    const toast = useToast();

    useEffect(() => {
        checkModelStatus();
        checkServerStatus();
    }, []);

    const checkModelStatus = async () => {
        try {
            const res = await recognitionAPI.getModelStatus();
            setModelStatus(res.data);
        } catch { setModelStatus(null); }
    };

    const checkServerStatus = async () => {
        try {
            const res = await healthAPI.check();
            setServerStatus(res.data);
        } catch { setServerStatus(null); }
    };

    const handlePasswordChange = async () => {
        if (!oldPassword || !newUsername || !newPassword) {
            toast.error('All fields are required');
            return;
        }
        setSaving(true);
        try {
            await authAPI.changePassword(oldPassword, newUsername, newPassword);
            toast.success('Credentials updated successfully');
            setOldPassword('');
            setNewUsername('');
            setNewPassword('');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const StatusDot = ({ ok }) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {ok ? <CheckCircle size={16} style={{ color: 'var(--success)' }} /> : <XCircle size={16} style={{ color: 'var(--error)' }} />}
            <span style={{ color: ok ? 'var(--success)' : 'var(--error)', fontSize: '0.85rem', fontWeight: 600 }}>
                {ok ? 'Loaded' : 'Not Found'}
            </span>
        </span>
    );

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title"><span className="gradient-text">Settings</span></h1>
                        <p className="page-subtitle">Manage your account and system configuration</p>
                    </div>
                </div>

                <div className="settings-grid">
                    {/* Password Change */}
                    <motion.div className="glass-card-static settings-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="settings-card-header">
                            <Lock size={20} style={{ color: 'var(--primary)' }} />
                            <h3>Change Credentials</h3>
                        </div>
                        <div className="settings-form">
                            <div className="input-group">
                                <label>Old Password</label>
                                <input type="password" className="input-field" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Enter current password" />
                            </div>
                            <div className="input-group">
                                <label>New Username</label>
                                <input type="text" className="input-field" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Enter new username" />
                            </div>
                            <div className="input-group">
                                <label>New Password</label>
                                <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
                            </div>
                            <motion.button className="btn btn-primary" onClick={handlePasswordChange} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                {saving ? <><Loader size={16} className="spinning" /> Saving...</> : <><Save size={16} /> Update Credentials</>}
                            </motion.button>
                        </div>
                    </motion.div>

                    {/* Model Status */}
                    <motion.div className="glass-card-static settings-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                        <div className="settings-card-header">
                            <Cpu size={20} style={{ color: 'var(--secondary)' }} />
                            <h3>Model Status</h3>
                        </div>
                        {modelStatus ? (
                            <div className="status-list">
                                <div className="status-item"><span>Face Cascade</span><StatusDot ok={modelStatus.face_cascade} /></div>
                                <div className="status-item"><span>Recognizer</span><StatusDot ok={modelStatus.recognizer} /></div>
                                <div className="status-item"><span>Embeddings</span><StatusDot ok={modelStatus.embeddings} /></div>
                                <div className="status-item"><span>FaceNet ONNX</span><StatusDot ok={modelStatus.facenet_onnx} /></div>
                                <div className="status-item"><span>FaceNet H5</span><StatusDot ok={modelStatus.facenet_h5} /></div>
                                <div className="status-item"><span>Registered Faces</span><span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.9rem' }}>{modelStatus.staff_loaded}</span></div>
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>Could not connect to server</p>
                        )}
                    </motion.div>

                    {/* Server Status */}
                    <motion.div className="glass-card-static settings-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        <div className="settings-card-header">
                            <Database size={20} style={{ color: 'var(--accent)' }} />
                            <h3>Server Status</h3>
                        </div>
                        <div className="status-list">
                            <div className="status-item">
                                <span>API Server</span>
                                <StatusDot ok={!!serverStatus} />
                            </div>
                            <div className="status-item">
                                <span>Status</span>
                                <span style={{ color: serverStatus ? 'var(--success)' : 'var(--error)', fontSize: '0.85rem', fontWeight: 600 }}>
                                    {serverStatus ? serverStatus.message : 'Offline'}
                                </span>
                            </div>
                        </div>
                        <motion.button className="btn btn-secondary btn-sm" onClick={() => { checkModelStatus(); checkServerStatus(); }} style={{ marginTop: 16 }} whileHover={{ scale: 1.02 }}>
                            Refresh Status
                        </motion.button>
                    </motion.div>

                    {/* About */}
                    <motion.div className="glass-card-static settings-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                        <div className="settings-card-header">
                            <Shield size={20} style={{ color: '#FFD600' }} />
                            <h3>About FaceTally</h3>
                        </div>
                        <div className="about-info">
                            <p><strong>Version:</strong> 2.0 (Web)</p>
                            <p><strong>Framework:</strong> React + Flask</p>
                            <p><strong>AI Engine:</strong> FaceNet + Anti-Spoofing</p>
                            <p><strong>Database:</strong> MySQL</p>
                            <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                Built with ❤️ for facial recognition based attendance management
                            </p>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
