import React, { useCallback, useEffect, useState } from 'react';
import { Activity, TestTube2, Pill, CalendarClock, Loader2, Stethoscope, Users } from 'lucide-react';
import { getHospitalOperationsSummary, type HospitalOperationsSummaryItem } from '../services/hospitalOperationsService';
import { FreeTierLimitsPanel } from './FreeTierLimitsPanel';
import { PlanBadge } from './PlanBadge';

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

// Embedded as a tab inside OnboardedHospitals.tsx (not its own sidebar page/route) --
// per-hospital IPD/pathology/pharmacy/online-appointment activity report + the free-tier
// monthly limit admin settings.
export const HospitalOperationsTab: React.FC = () => {
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
            opdAppts: acc.opdAppts + h.opdAppointmentsCount,
            onlineAppts: acc.onlineAppts + h.onlineAppointmentsCount,
            totalPatients: acc.totalPatients + h.admissionsCount + h.opdAppointmentsCount,
        }),
        { admissions: 0, pathology: 0, pharmacyInvoices: 0, opdAppts: 0, onlineAppts: 0, totalPatients: 0 }
    );

    return (
        <>
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
                    <div className="premium-responsive-wrapper">
                        <table className="premium-table">
                            <thead>
                                <tr>
                                    <th>Hospital</th>
                                    <th>Plan</th>
                                    <th><Activity size={14} style={{ marginRight: 4, verticalAlign: -2 }} />IPD Admissions</th>
                                    <th><Stethoscope size={14} style={{ marginRight: 4, verticalAlign: -2 }} />OPD Count</th>
                                    <th><Users size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Total Patients</th>
                                    <th><TestTube2 size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Pathology Orders</th>
                                    <th><Pill size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Pharmacy Invoices</th>
                                    <th><CalendarClock size={14} style={{ marginRight: 4, verticalAlign: -2 }} />Online Appointments</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hospitals.map(h => (
                                    <tr key={h.hospitalId} className="premium-row">
                                        <td className="premium-hospital-name">{h.hospitalName}</td>
                                        <td><PlanBadge status={h.subscriptionStatus} usedCount={h.freeTierUsedCount} limit={h.freeTierLimit} /></td>
                                        <td>{h.admissionsCount}</td>
                                        <td>{h.opdAppointmentsCount}</td>
                                        <td>{h.admissionsCount + h.opdAppointmentsCount}</td>
                                        <td>{h.pathologyOrdersCount}</td>
                                        <td>{h.pharmacyInvoiceCount}</td>
                                        <td>{h.onlineAppointmentsCount}</td>
                                    </tr>
                                ))}
                                {hospitals.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>No activity in this range.</td>
                                    </tr>
                                )}
                            </tbody>
                            {hospitals.length > 0 && (
                                <tfoot>
                                    <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                                        <td>Total</td>
                                        <td></td>
                                        <td>{totals.admissions}</td>
                                        <td>{totals.opdAppts}</td>
                                        <td>{totals.totalPatients}</td>
                                        <td>{totals.pathology}</td>
                                        <td>{totals.pharmacyInvoices}</td>
                                        <td>{totals.onlineAppts}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

export default HospitalOperationsTab;
