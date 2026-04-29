import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3, Calendar, Download, Users, TrendingUp, AlertTriangle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { reportsAPI } from '../services/api';
import { useToast } from '../context/ToastContext';
import './ReportsPage.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PIE_COLORS = ['#00E676', '#FF5252', '#FFD600', '#448AFF'];

export default function ReportsPage() {
    const [reportType, setReportType] = useState('daily');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    const loadReport = async () => {
        setLoading(true);
        try {
            let res;
            if (reportType === 'daily') {
                res = await reportsAPI.getDaily(date);
            } else {
                res = await reportsAPI.getMonthly(month, year);
            }
            setReportData(res.data);
        } catch (err) {
            toast.error('Failed to load report');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadReport(); }, [reportType, date, month, year]);

    const handleExport = async () => {
        try {
            const params = reportType === 'daily' ? { date } : { month, year };
            const res = await reportsAPI.exportCSV(reportType, params);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `report_${reportType}_${reportType === 'daily' ? date : `${year}_${month}`}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Report exported!');
        } catch (err) {
            toast.error('Export failed');
        }
    };

    // Pie chart data for daily
    const pieData = reportData && reportType === 'daily' ? [
        { name: 'Present', value: reportData.present },
        { name: 'Absent', value: reportData.absent },
    ].filter(d => d.value > 0) : [];

    // Bar chart data for monthly
    const barData = reportData && reportType === 'monthly' ? (reportData.data || []).map(s => ({
        name: s.name?.length > 10 ? s.name.substring(0, 10) + '...' : s.name,
        days: s.days_present,
        percentage: s.percentage,
    })) : [];

    return (
        <div className="page-container">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="page-header">
                    <div>
                        <h1 className="page-title"><span className="gradient-text">Reports</span></h1>
                        <p className="page-subtitle">Generate and export attendance reports</p>
                    </div>
                    <motion.button className="btn btn-primary" onClick={handleExport} whileHover={{ scale: 1.03 }}>
                        <Download size={18} /> Export CSV
                    </motion.button>
                </div>

                {/* Report Type Tabs */}
                <div className="report-tabs">
                    <button className={`report-tab ${reportType === 'daily' ? 'active' : ''}`} onClick={() => setReportType('daily')}>
                        <Calendar size={16} /> Daily Report
                    </button>
                    <button className={`report-tab ${reportType === 'monthly' ? 'active' : ''}`} onClick={() => setReportType('monthly')}>
                        <BarChart3 size={16} /> Monthly Report
                    </button>
                </div>

                {/* Filters */}
                <div className="report-filters glass-card-static">
                    {reportType === 'daily' ? (
                        <div className="input-group" style={{ maxWidth: 250 }}>
                            <label>Select Date</label>
                            <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div className="input-group" style={{ minWidth: 160 }}>
                                <label>Month</label>
                                <select className="select-field" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
                                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                                </select>
                            </div>
                            <div className="input-group" style={{ minWidth: 100 }}>
                                <label>Year</label>
                                <select className="select-field" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div style={{ padding: 80, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : reportData ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid-4 report-summary">
                            <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <div className="stat-card-header">
                                    <div className="stat-card-icon" style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF' }}><Users size={20} /></div>
                                    <span className="stat-card-label">Total</span>
                                </div>
                                <div className="stat-card-value" style={{ color: '#6C63FF' }}>{reportData.total || reportData.total_students || 0}</div>
                            </motion.div>
                            {reportType === 'daily' && (
                                <>
                                    <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                        <div className="stat-card-header">
                                            <div className="stat-card-icon" style={{ background: 'rgba(0,230,118,0.1)', color: '#00E676' }}><TrendingUp size={20} /></div>
                                            <span className="stat-card-label">Present</span>
                                        </div>
                                        <div className="stat-card-value" style={{ color: '#00E676' }}>{reportData.present}</div>
                                    </motion.div>
                                    <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                        <div className="stat-card-header">
                                            <div className="stat-card-icon" style={{ background: 'rgba(255,82,82,0.1)', color: '#FF5252' }}><AlertTriangle size={20} /></div>
                                            <span className="stat-card-label">Absent</span>
                                        </div>
                                        <div className="stat-card-value" style={{ color: '#FF5252' }}>{reportData.absent}</div>
                                    </motion.div>
                                    <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                                        <div className="stat-card-header">
                                            <div className="stat-card-icon" style={{ background: 'rgba(255,214,0,0.1)', color: '#FFD600' }}><TrendingUp size={20} /></div>
                                            <span className="stat-card-label">Percentage</span>
                                        </div>
                                        <div className="stat-card-value" style={{ color: '#FFD600' }}>{reportData.percentage}%</div>
                                    </motion.div>
                                </>
                            )}
                            {reportType === 'monthly' && (
                                <motion.div className="glass-card stat-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                    <div className="stat-card-header">
                                        <div className="stat-card-icon" style={{ background: 'rgba(255,214,0,0.1)', color: '#FFD600' }}><Calendar size={20} /></div>
                                        <span className="stat-card-label">Working Days</span>
                                    </div>
                                    <div className="stat-card-value" style={{ color: '#FFD600' }}>{reportData.working_days}</div>
                                </motion.div>
                            )}
                        </div>

                        {/* Charts */}
                        <div className="grid-2" style={{ marginTop: 'var(--space-lg)' }}>
                            {reportType === 'daily' && pieData.length > 0 && (
                                <motion.div className="glass-card-static chart-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <h3 className="section-title" style={{ padding: '20px 20px 0' }}>Attendance Distribution</h3>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ background: 'rgba(18,18,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            )}

                            {reportType === 'monthly' && barData.length > 0 && (
                                <motion.div className="glass-card-static chart-card" style={{ gridColumn: '1 / -1' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <h3 className="section-title" style={{ padding: '20px 20px 0' }}>Student-wise Attendance</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={barData} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="name" stroke="#6B6B80" fontSize={11} angle={-45} textAnchor="end" />
                                            <YAxis stroke="#6B6B80" fontSize={12} />
                                            <Tooltip contentStyle={{ background: 'rgba(18,18,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                                            <Bar dataKey="days" fill="#6C63FF" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </motion.div>
                            )}

                            {/* Detail Table */}
                            <motion.div className="glass-card-static data-table-container" style={{ gridColumn: reportType === 'daily' ? '1 / -1' : '1 / -1' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Name</th><th>Department</th>
                                            {reportType === 'daily' ? <><th>Status</th><th>Time</th></> : <><th>Days Present</th><th>Working Days</th><th>Percentage</th><th>Status</th></>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(reportData.data || []).map((row, i) => (
                                            <tr key={i}>
                                                <td>{row.student_id}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                                                <td>{row.department}</td>
                                                {reportType === 'daily' ? (
                                                    <>
                                                        <td><span className={`badge badge-${row.status === 'Present' ? 'success' : row.status === 'Late' ? 'warning' : 'error'}`}>{row.status}</span></td>
                                                        <td>{row.time}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td>{row.days_present}</td>
                                                        <td>{row.working_days}</td>
                                                        <td><strong style={{ color: row.percentage >= 75 ? 'var(--success)' : row.percentage >= 50 ? 'var(--warning)' : 'var(--error)' }}>{row.percentage}%</strong></td>
                                                        <td><span className={`badge badge-${row.status === 'Good' ? 'success' : row.status === 'Low' ? 'warning' : 'error'}`}>{row.status}</span></td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </motion.div>
                        </div>
                    </>
                ) : null}
            </motion.div>
        </div>
    );
}
