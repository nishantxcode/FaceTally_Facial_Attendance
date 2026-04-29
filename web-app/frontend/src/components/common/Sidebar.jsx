import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Camera,
    Users,
    ClipboardCheck,
    BarChart3,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ScanFace,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/recognition', icon: Camera, label: 'Face Recognition' },
    { path: '/students', icon: Users, label: 'Students' },
    { path: '/attendance', icon: ClipboardCheck, label: 'Attendance' },
    { path: '/reports', icon: BarChart3, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const { logout, user } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <motion.aside
            className={`sidebar ${collapsed ? 'collapsed' : ''}`}
            animate={{ width: collapsed ? 72 : 260 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <ScanFace size={24} />
                </div>
                <AnimatePresence>
                    {!collapsed && (
                        <motion.span
                            className="sidebar-logo-text"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            FaceTally
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar-nav-item ${isActive ? 'active' : ''}`
                        }
                        end={item.path === '/'}
                    >
                        <item.icon size={20} className="sidebar-nav-icon" />
                        <AnimatePresence>
                            {!collapsed && (
                                <motion.span
                                    className="sidebar-nav-label"
                                    initial={{ opacity: 0, width: 0 }}
                                    animate={{ opacity: 1, width: 'auto' }}
                                    exit={{ opacity: 0, width: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {item.label}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        {!collapsed && (
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                className="sidebar-nav-indicator"
                            />
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="sidebar-footer">
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div
                            className="sidebar-user"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="sidebar-user-avatar">
                                {user?.username?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="sidebar-user-info">
                                <span className="sidebar-user-name">{user?.username || 'Admin'}</span>
                                <span className="sidebar-user-role">Administrator</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button className="sidebar-nav-item logout-btn" onClick={handleLogout}>
                    <LogOut size={20} className="sidebar-nav-icon" />
                    {!collapsed && <span className="sidebar-nav-label">Logout</span>}
                </button>

                <button
                    className="sidebar-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>
        </motion.aside>
    );
}
