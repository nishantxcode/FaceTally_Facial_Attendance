import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, UserX, Clock,
    Camera, UserPlus, FileText,
    TrendingUp, Activity
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './DashboardPage.css';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
};

function AnimatedCounter({ value, duration = 1.5 }) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = parseInt(value) || 0;
        if (start === end) { setCount(end); return; }
        const step = Math.ceil(end / (duration * 60));
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setCount(end); clearInterval(timer); return; }
            setCount(start);
        }, 1000 / 60);
        return () => clearInterval(timer);
    }, [value, duration]);
    return <span>{count}</span>;
}

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const res = await reportsAPI.getStats();
            setStats(res.data);
        } catch (err) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const statCards = stats ? [
        { label: 'Total Students', value: stats.total_students, icon: Users, color: '#6C63FF', bg: 'rgba(108,99,255,0.1)' },
        { label: 'Present Today', value: stats.present_today, icon: UserCheck, color: '#00E676', bg: 'rgba(0,230,118,0.1)' },
        { label: 'Absent Today', value: stats.absent_today, icon: UserX, color: '#FF5252', bg: 'rgba(255,82,82,0.1)' },
        { label: 'Attendance %', value: stats.attendance_percentage, icon: TrendingUp, color: '#FFD600', bg: 'rgba(255,214,0,0.1)', suffix: '%' },
    ] : [];

    const quickActions = [
        { label: 'Take Attendance', icon: Camera, color: '#6C63FF', path: '/recognition' },
        { label: 'Add Student', icon: UserPlus, color: '#00D4AA', path: '/students' },
        { label: 'View Reports', icon: FileText, color: '#FF6B6B', path: '/reports' },
    ];

    if (loading) {
        return (
            <div className="page-container">
                <div className="dashboard-loading">
                    <div className="spinner" />
                    <p>Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            <motion.div variants={container} initial="hidden" animate="show">
                {/* Header */}
                <motion.div variants={item} className="page-header">
                    <div>
                        <h1 className="page-title">
                            <span className="gradient-text">Dashboard</span>
                        </h1>
                        <p className="page-subtitle">Welcome back! Here's today's overview.</p>
                    </div>
                    <div className="dashboard-date">
                        <Clock size={16} />
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </motion.div>

                {/* Stat Cards */}
                <div className="grid-4" style={{ marginBottom: 'var(--space-xl)' }}>
                    {statCards.map((card, i) => (
                        <motion.div key={card.label} variants={item} className="stat-card glass-card">
                            <div className="stat-card-header">
                                <div className="stat-card-icon" style={{ background: card.bg, color: card.color }}>
                                    <card.icon size={20} />
                                </div>
                                <span className="stat-card-label">{card.label}</span>
                            </div>
                            <div className="stat-card-value" style={{ color: card.color }}>
                                <AnimatedCounter value={card.value} />
                                {card.suffix && <span className="stat-card-suffix">{card.suffix}</span>}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Quick Actions */}
                <motion.div variants={item} style={{ marginBottom: 'var(--space-xl)' }}>
                    <h3 className="section-title">Quick Actions</h3>
                    <div className="quick-actions">
                        {quickActions.map((action) => (
                            <motion.button
                                key={action.label}
                                className="quick-action-btn glass-card"
                                onClick={() => navigate(action.path)}
                                whileHover={{ scale: 1.03, y: -4 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <div className="quick-action-icon" style={{ background: action.color }}>
                                    <action.icon size={22} color="white" />
                                </div>
                                <span>{action.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Charts Row */}
                <div className="grid-2" style={{ marginBottom: 'var(--space-xl)' }}>
                    {/* Weekly Attendance Chart */}
                    <motion.div variants={item} className="glass-card-static chart-card">
                        <h3 className="section-title" style={{ padding: '20px 20px 0' }}>
                            <TrendingUp size={18} style={{ marginRight: 8 }} />
                            Weekly Attendance
                        </h3>
                        <div className="chart-wrapper">
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={stats?.weekly_data || []} margin={{ top: 20, right: 20, bottom: 0, left: 0 }}>
                                    <defs>
                                        <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" stroke="#6B6B80" fontSize={12} />
                                    <YAxis stroke="#6B6B80" fontSize={12} />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'rgba(18,18,42,0.95)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '12px',
                                            color: '#fff',
                                            fontSize: '0.85rem',
                                        }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={2} fill="url(#attendanceGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div variants={item} className="glass-card-static activity-card">
                        <h3 className="section-title" style={{ padding: '20px 20px 12px' }}>
                            <Activity size={18} style={{ marginRight: 8 }} />
                            Recent Activity
                        </h3>
                        <div className="activity-list">
                            {(stats?.recent_activity || []).length === 0 ? (
                                <div className="empty-state" style={{ padding: '40px 20px' }}>
                                    <Activity size={40} />
                                    <h3>No activity yet</h3>
                                    <p>Start taking attendance to see activity here</p>
                                </div>
                            ) : (
                                stats.recent_activity.map((record, i) => (
                                    <motion.div
                                        key={i}
                                        className="activity-item"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <div className="activity-avatar">
                                            {record.name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div className="activity-info">
                                            <span className="activity-name">{record.name}</span>
                                            <span className="activity-meta">{record.date} at {record.time}</span>
                                        </div>
                                        <span className={`badge badge-${record.status === 'Present' ? 'success' : record.status === 'Late' ? 'warning' : 'error'}`}>
                                            {record.status}
                                        </span>
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
