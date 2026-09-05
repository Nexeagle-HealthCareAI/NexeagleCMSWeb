import React, { useCallback, useEffect, useState } from 'react';
import { Activity, TestTube2, Pill, CalendarClock, Loader2 } from 'lucide-react';
import { getHospitalOperationsSummary, type HospitalOperationsSummaryItem } from '../services/hospitalOperationsService';
import { FreeTierLimitsPanel } from '../components/FreeTierLimitsPanel';
import '../../dashboard/pages/Dashboard.css';
import '../../dashboard/pages/PremiumHospitals.css';

type DateFilterMode = 'today' | 'custom';

const toDateInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const inputStyle = (extra: React.CSSProperties): React.CSSProperties => ({
    height: 38,
    padding: '0 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#334155',
    background: '#fff',
    ...extra,
});

const HospitalOperationsPage: React.FC = () => {
    const today = toDateInputValue(new Date());
    const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('today');
    const [customFrom, setCustomFrom] = useState(today);
    const [customTo, setCustomTo] = useState(today);

    const [hospitals, setHospitals] = useState<HospitalOperationsSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fromDate = dateFilterMode === 'today' ? today : customFrom;
    const toDate = dateFilterMode === 'today' ? today : customTo;

    const load = useCallback(async () => {
        // Custom range: wait until both bounds are picked rather than firing on every half-typed date.
        if (dateFilterMode === 'custom' && (!customFrom || !customTo)) return;
        try {
            setLoading(true);
            setError(null);
            const res = await getHospitalOperationsSummary(fromDate, toDate);
            if (res.success) {
                setHospitals(res.hospitals);
            } else {
                setError(res.message || 'Failed to load hospital operations.');
            }
        } catch {
            setError('Failed to load hospital operations.');
        } finally {
            setLoading(false);
        }
    }, [dateFilterMode, customFrom, customTo, fromDate, toDate]);

    useEffect(() => { load(); }, [load]);

    const totals = hospitals.reduce(
        (acc, h) => ({
            admissions: acc.admissions + h.admissionsCount,
            pathology: acc.pathology + h.pathologyOrdersCount,
            pharmacyInvoices: acc.pharmacyInvoices + h.pharmacyInvoiceCount,
            pharmacyRevenue: acc.pharmacyRevenue + h.pharmacyRevenue,
            onlineAppts: acc.onlineAppts + h.onlineAppointmentsCount,
        }),
        { admissions: 0, pathology: 0, pharmacyInvoices: 0, pharmacyRevenue: 0, onlineAppts: 0 }
    );

    return (
        <div className="premium-container">
            <header className="premium-header">
                <div>
                    <h1 className="premium-title">Hospital Operations</h1>
                    <p className="premium-subtitle">IPD admissions, pathology orders, pharmacy sales, and online appointment requests across every hospital.</p>
                </div>
            </header>

            <FreeTierLimitsPanel />

            <div className="premium-table-card">
                <div className="premium-controls" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <h2 className="premium-table-title">
                        Activity
                        <span className="premium-badge-count">{hospitals.length}</span>
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <select
                            style={inputStyle({ width: 140 })}
                            value={dateFilterMode}
                            onChange={e => setDateFilterMode(e.target.value as DateFilterMode)}
                        >
                            <option value="today">Today</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        {dateFilterMode === 'custom' && (
                            <>
                                <input
                                    type="date"
                                    style={inputStyle({ width: 150 })}
                                    value={customFrom}
                                    max={customTo}
                                    onChange={e => setCustomFrom(e.target.value)}
                                />
                                <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
                                <input
                                    type="date"
                                    style={inputStyle({ width: 150 })}
                                    value={customTo}
                                    min={customFrom}
                                    max={today}
                                    onChange={e => setCustomTo(e.target.value)}
                                />
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div style={{ margin: '0 24px 16px', padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13 }}>
                        {error}
                    </div>
                )}

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <Loader2 className="animate-spin" size={24} color="#94a3b8" />
                    </div>
                ) : (
                    <>
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table">
                                <thead>
                                    <tr>
                                        <th>Hospital</th>
                                        <th><Activity size={14} style={{ marginRight: 4, verticalAlign: -2 }} />IPD Admissions</th>
                                        <th><TestTube2 size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Pathology Orders</th>
                                        <th><Pill size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Pharmacy Invoices</th>
                                        <th>Pharmacy Revenue</th>
                                        <th><CalendarClock size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Online Appointments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hospitals.map(h => (
                                        <tr key={h.hospitalId} className="premium-row">
                                            <td className="premium-hospital-name">{h.hospitalName}</td>
                                            <td>{h.admissionsCount}</td>
                                            <td>{h.pathologyOrdersCount}</td>
                                            <td>{h.pharmacyInvoiceCount}</td>
                                            <td>₹{h.pharmacyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td>{h.onlineAppointmentsCount}</td>
                                        </tr>
                                    ))}
                                    {hospitals.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No activity in this range.</td>
                                        </tr>
                                    )}
                                </tbody>
                                {hospitals.length > 0 && (
                                    <tfoot>
                                        <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                                            <td>Total</td>
                                            <td>{totals.admissions}</td>
                                            <td>{totals.pathology}</td>
                                            <td>{totals.pharmacyInvoices}</td>
                                            <td>₹{totals.pharmacyRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td>{totals.onlineAppts}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default HospitalOperationsPage;
