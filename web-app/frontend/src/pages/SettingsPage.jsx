import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Loader, Save, UserRound } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './SettingsPage.css';

export default function SettingsPage() {
    const { user } = useAuth();
    const [oldPassword, setOldPassword] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const toast = useToast();

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

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title"><span className="gradient-text">Settings</span></h1>
                        <p className="page-subtitle">Manage your account credentials</p>
                    </div>
                </div>

                <div className="settings-grid">
                    <motion.div className="glass-card-static settings-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="settings-card-header">
                            <UserRound size={20} style={{ color: 'var(--secondary)' }} />
                            <h3>Account</h3>
                        </div>
                        <div className="account-summary">
                            <div className="account-avatar">
                                {user?.username?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div>
                                <span className="account-label">Username</span>
                                <strong className="account-username">{user?.username || 'admin'}</strong>
                            </div>
                        </div>
                    </motion.div>

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
                </div>
            </motion.div>
        </div>
    );
}
