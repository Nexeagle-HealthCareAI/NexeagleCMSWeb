import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, Download, Presentation, Stethoscope, Building2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { InsightsExplainer } from './InsightsExplainer';
import { CONTACTS_PERMISSION } from './WhatsAppBotPanel';
import { istDaysAgo, todayIst } from '../utils/istDate';
import {
    channelInsights, dayLabel,
    type AppointmentChannelFilter, type AppointmentGroupBy, type AppointmentPeriodRow, type AppointmentPlaceRow,
    type AppointmentQuery, type AppointmentRow, type AppointmentTrend,
} from '../services/channelInsights';

const RANGES = [
    { key: '7', label: '7 days', days: 7 },
    { key: '30', label: '30 days', days: 30 },
    { key: '90', label: '90 days', days: 90 },
    { key: '365', label: '12 months', days: 365 },
    { key: 'custom', label: 'Custom', days: 0 },
] as const;
type RangeKey = typeof RANGES[number]['key'];

const CHANNELS: { key: AppointmentChannelFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'NexEagle online' },
    { key: 'doctordekho', label: 'Doctor Dekho' },
    { key: 'whatsapp', label: 'WhatsApp bot' },
    { key: 'hospital', label: 'Hospital desk' },
];

// Stacked from the bottom: WhatsApp, Doctor Dekho, hospital desk (validated in this order).
const SERIES = [
    { key: 'whatsApp', label: 'WhatsApp bot', colour: '#16a34a' },
    { key: 'doctorDekho', label: 'Doctor Dekho', colour: '#2563eb' },
    { key: 'hospitalDesk', label: 'Hospital desk', colour: '#eda100' },
] as const;

const PAGE = 25;
const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const istTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const longDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function periodLabel(start: string, group: AppointmentGroupBy) {
    const d = new Date(`${start}T00:00:00`);
    if (group === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    if (group === 'week') return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function appointmentsCsv(rows: AppointmentRow[]): string {
    const cell = (v: unknown) => {
        const s = v == null ? '' : String(v);
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const head = ['Booked (IST)', 'Appointment date', 'Came through', 'Status', 'Patient', 'Mobile', 'Doctor', 'Hospital'];
    return [head.join(','), ...rows.map(r => [istTime(r.bookedAt), r.apptDate, r.channelLabel, r.status, r.patientName ?? '', r.patientMobile ?? '', r.doctorName ?? '', r.hospitalName ?? ''].map(cell).join(','))].join('\n');
}

function PlaceTable({ label, rows, showDesk, doctors }: { label: string; rows: AppointmentPlaceRow[]; showDesk: boolean; doctors?: boolean }) {
    return (
        <div className="premium-table-card">
            <div className="premium-responsive-wrapper">
                <table className="premium-table" aria-label={label}>
                    <thead>
                        <tr>
                            <th>{doctors ? 'Doctor' : 'Hospital'}</th><th>Doctor Dekho</th><th>WhatsApp</th><th>NexEagle online</th>
                            {showDesk && <><th>Hospital desk</th><th>Online share</th></>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={showDesk ? 6 : 4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No online bookings in this period.</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.id} className="premium-row">
                                <td>
                                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                                    {r.hospital && <div className="insights-sub">{r.hospital}</div>}
                                </td>
                                <td>{fmt(r.doctorDekho)}</td>
                                <td>{fmt(r.whatsApp)}</td>
                                <td style={{ fontWeight: 700 }}>{fmt(r.online)}</td>
                                {showDesk && <><td>{fmt(r.hospitalDesk)}</td><td>{pct(r.online, r.total)}</td></>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Every appointment in the HMS by where it came from — Doctor Dekho, the WhatsApp bot, or the hospital's
 * own desk — as a chart to show doctors how their appointments come in, with the list behind it.
 */
export const AppointmentsPanel: React.FC = () => {
    const permissions = useAuthStore(s => s.permissions) || [];
    const canSeeContacts = permissions.includes(CONTACTS_PERMISSION);

    const [range, setRange] = useState<RangeKey>('30');
    const [customFrom, setCustomFrom] = useState(istDaysAgo(29));
    const [customTo, setCustomTo] = useState(todayIst());
    const [dateBy, setDateBy] = useState<'booked' | 'appointment'>('booked');
    const [groupBy, setGroupBy] = useState<AppointmentGroupBy | 'auto'>('auto');
    const [channel, setChannel] = useState<AppointmentChannelFilter>('all');
    const [hospitalId, setHospitalId] = useState('');
    const [doctorId, setDoctorId] = useState('');
    const [present, setPresent] = useState(false);

    const { from, to } = useMemo(() => {
        if (range === 'custom') return { from: customFrom, to: customTo };
        const days = RANGES.find(r => r.key === range)!.days;
        return { from: istDaysAgo(days - 1), to: todayIst() };
    }, [range, customFrom, customTo]);
    const ready = Boolean(from && to);

    const base: AppointmentQuery = useMemo(() => ({
        from, to, dateBy, channel,
        hospitalId: hospitalId || undefined, doctorId: doctorId || undefined,
        groupBy: groupBy === 'auto' ? undefined : groupBy,
    }), [from, to, dateBy, channel, hospitalId, doctorId, groupBy]);

    const [trend, setTrend] = useState<AppointmentTrend | null>(null);
    const [trendError, setTrendError] = useState('');
    const [trendFor, setTrendFor] = useState('');
    const trendKey = JSON.stringify(base);
    useEffect(() => {
        if (!ready) return;
        let alive = true;
        channelInsights.appointmentTrend(base)
            .then(t => { if (alive) { setTrend(t); setTrendError(''); } })
            .catch(e => { if (alive) setTrendError(e?.response?.data?.message || 'Could not load the appointments.'); })
            .finally(() => { if (alive) setTrendFor(JSON.stringify(base)); });
        return () => { alive = false; };
    }, [base, ready]);

    // The list
    const [typed, setTyped] = useState('');
    const [search, setSearch] = useState('');
    const [includeCancelled, setIncludeCancelled] = useState(true);
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<AppointmentRow[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [listFor, setListFor] = useState('');
    const [listError, setListError] = useState('');
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const t = window.setTimeout(() => { setSearch(typed.trim()); setPage(1); }, 350);
        return () => window.clearTimeout(t);
    }, [typed]);

    const listQuery: AppointmentQuery = useMemo(() => ({ ...base, search, includeCancelled, page, limit: PAGE }), [base, search, includeCancelled, page]);
    const listKey = JSON.stringify(listQuery);
    useEffect(() => {
        if (!ready || present) return;
        let alive = true;
        channelInsights.appointmentList(listQuery)
            .then(r => { if (alive) { setRows(r.data); setTotal(r.pagination.totalItems); setPages(r.pagination.totalPages); setListError(''); } })
            .catch(e => { if (alive) { setRows([]); setListError(e?.response?.data?.message || 'Could not load the appointments.'); } })
            .finally(() => { if (alive) setListFor(JSON.stringify(listQuery)); });
        return () => { alive = false; };
    }, [listQuery, ready, present]);

    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = await channelInsights.appointmentList({ ...listQuery, page: 1, limit: 1000 });
            const blob = new Blob(['﻿' + appointmentsCsv(all.data)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `appointments-${from}-to-${to}${channel !== 'all' ? '-' + channel : ''}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            if (all.pagination.totalItems > all.data.length) toast.message(`The file has the first ${all.data.length} of ${all.pagination.totalItems}. Choose a shorter period for the rest.`);
        } catch {
            toast.error('Could not export. Try again.');
        } finally {
            setExporting(false);
        }
    };

    const doctorOptions = useMemo(() => (trend?.doctors ?? []).filter(d => !hospitalId || d.hospitalId === hospitalId), [trend, hospitalId]);
    const showDesk = channel === 'all' || channel === 'hospital';
    const series = SERIES.filter(s => (channel === 'all' ? true
        : channel === 'online' ? s.key !== 'hospitalDesk'
            : channel === 'doctordekho' ? s.key === 'doctorDekho'
                : channel === 'whatsapp' ? s.key === 'whatsApp'
                    : s.key === 'hospitalDesk'));
    const group = trend?.groupBy ?? 'day';
    const chartData = useMemo(() => (trend?.periods ?? []).map(p => ({ ...p, label: periodLabel(p.start, group) + (p.isPartial ? '*' : '') })), [trend, group]);
    const t: AppointmentPeriodRow | undefined = trend?.totals;
    const loading = trendFor !== trendKey;
    const listLoading = listFor !== listKey;
    const who = doctorId ? trend?.doctors.find(d => d.id === doctorId)?.name
        : hospitalId ? trend?.hospitals.find(h => h.id === hospitalId)?.name : null;
    const groupWord = group === 'month' ? 'month' : group === 'week' ? 'week' : 'day';
    const partialNote = chartData.some(p => p.isPartial)
        ? `* ${group === 'day' ? 'Today' : `This ${groupWord}`} or a period only partly inside the dates: counted so far.` : null;

    const filters = (
        <>
            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="Period">
                    {RANGES.map(r => (
                        <button key={r.key} className={`insights-filter-btn ${range === r.key ? 'active' : ''}`} onClick={() => { setRange(r.key); setPage(1); }}>{r.label}</button>
                    ))}
                </div>
                {range === 'custom' && (
                    <>
                        <input type="date" value={customFrom} max={customTo || undefined} onChange={e => { setCustomFrom(e.target.value); setPage(1); }} className="insights-date-input" aria-label="From" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} min={customFrom || undefined} onChange={e => { setCustomTo(e.target.value); setPage(1); }} className="insights-date-input" aria-label="To" />
                    </>
                )}
                <select className="premium-filter-select" value={dateBy} onChange={e => { setDateBy(e.target.value as typeof dateBy); setPage(1); }} aria-label="Count by">
                    <option value="booked">By the day it was booked</option>
                    <option value="appointment">By the appointment date</option>
                </select>
            </div>
            <div className="insights-filter-row">
                <select className="premium-filter-select" value={hospitalId} onChange={e => { setHospitalId(e.target.value); setDoctorId(''); setPage(1); }} aria-label="Hospital">
                    <option value="">All hospitals</option>
                    {(trend?.hospitals ?? []).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
                <select className="premium-filter-select" value={doctorId} onChange={e => { setDoctorId(e.target.value); setPage(1); }} aria-label="Doctor">
                    <option value="">All doctors</option>
                    {doctorOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <div className="insights-filter-toggle" role="group" aria-label="Came through">
                    {CHANNELS.map(c => (
                        <button key={c.key} className={`insights-filter-btn ${channel === c.key ? 'active' : ''}`} onClick={() => { setChannel(c.key); setPage(1); }}>{c.label}</button>
                    ))}
                </div>
                <select className="premium-filter-select" value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)} aria-label="Chart by">
                    <option value="auto">Chart: best fit</option>
                    <option value="day">Chart: by day</option>
                    <option value="week">Chart: by week</option>
                    <option value="month">Chart: by month</option>
                </select>
            </div>
        </>
    );

    const chart = trend && (
        <div className={`insights-mini-table-card ${present ? 'insights-present-chart' : ''}`}>
            <h3 className="insights-mini-table-title"><CalendarDays size={14} className="insights-title-icon" />Appointments each {groupWord}</h3>
            <div className="insights-growth-chart" role="img" aria-label={`Appointments each ${groupWord} by where they came from; the same figures are in the table`}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                        <CartesianGrid vertical={false} stroke="#eef2f6" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={8} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={40}
                            label={{ value: 'Appointments', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8', dy: 40 }} />
                        <Tooltip cursor={{ fill: 'rgba(100,116,139,0.08)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} itemSorter={null}
                            formatter={(value: string) => <span style={{ color: '#475569' }}>{value}</span>} />
                        {series.map((s, i) => (
                            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="channel" fill={s.colour} stroke="#ffffff" strokeWidth={1}
                                maxBarSize={36} isAnimationActive={false} radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {partialNote && <p className="insights-card-note">{partialNote}</p>}
        </div>
    );

    if (present && trend && t) {
        // A clean view to show a doctor: no patient names or numbers, just how appointments come in.
        return (
            <div className="insights-present">
                <div className="insights-present-head">
                    <div>
                        <p className="insights-present-kicker">{who ?? 'All hospitals on NexEagle'} · {longDay(trend.from)} to {longDay(trend.to)}</p>
                        <h2>{fmt(t.online)} appointments came through NexEagle</h2>
                        <p className="insights-present-sub">
                            {fmt(t.doctorDekho)} from the Doctor Dekho website and {fmt(t.whatsApp)} from the WhatsApp bot
                            {t.hospitalDesk > 0 && <> — {pct(t.online, t.total)} of all {fmt(t.total)} appointments</>}.
                        </p>
                    </div>
                    <button type="button" className="insights-filter-btn" onClick={() => setPresent(false)}><X size={14} /> Close</button>
                </div>
                <div className="insights-stat-grid">
                    <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#2563eb' }}><div className="insights-stat-value">{fmt(t.doctorDekho)}</div><div className="insights-stat-label">Doctor Dekho website</div></div>
                    <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#16a34a' }}><div className="insights-stat-value">{fmt(t.whatsApp)}</div><div className="insights-stat-label">WhatsApp bot</div></div>
                    {showDesk && <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#eda100' }}><div className="insights-stat-value">{fmt(t.hospitalDesk)}</div><div className="insights-stat-label">Hospital desk</div></div>}
                </div>
                {chart}
            </div>
        );
    }

    return (
        <div className="insights-search-panel">
            <InsightsExplainer>
                <p>
                    <strong>Every appointment, by where it came from.</strong> <em>Doctor Dekho</em> and the <em>WhatsApp bot</em> are
                    the patient's own online bookings through NexEagle; <em>Hospital desk</em> is every appointment the hospital's
                    staff made (walk-ins, phone calls). Counted by the day it was booked (India time), or by the appointment date.
                    Cancelled appointments still count as booked and are also shown on their own.
                </p>
                <p>
                    To show a doctor how their appointments come in, pick their name and press <strong>Show to a doctor</strong>: a
                    clean view with the chart and no patient details.
                </p>
            </InsightsExplainer>

            {filters}

            {!ready ? <div className="insights-empty">Pick a start and end date.</div> : trendError ? <p className="insights-warning" role="alert">{trendError}</p> : !trend || !t ? <div className="insights-empty">Loading…</div> : (
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <div className="insights-present-bar">
                        <span>{who ? <>Showing <b>{who}</b></> : 'All hospitals and doctors'} · {longDay(trend.from)} to {longDay(trend.to)}</span>
                        <button type="button" className="insights-filter-btn insights-export-btn" onClick={() => setPresent(true)}>
                            <Presentation size={14} /> Show to a doctor
                        </button>
                    </div>

                    <div className="insights-stat-grid">
                        <div className="insights-stat-card is-good"><div className="insights-stat-value">{fmt(t.online)}</div><div className="insights-stat-label">Through NexEagle online{showDesk && t.total > 0 ? ` · ${pct(t.online, t.total)} of all` : ''}</div></div>
                        <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#2563eb' }}><div className="insights-stat-value">{fmt(t.doctorDekho)}</div><div className="insights-stat-label">Doctor Dekho</div></div>
                        <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#16a34a' }}><div className="insights-stat-value">{fmt(t.whatsApp)}</div><div className="insights-stat-label">WhatsApp bot</div></div>
                        <div className="insights-stat-card insights-channel-card" style={{ borderTopColor: '#eda100' }}><div className="insights-stat-value">{fmt(t.hospitalDesk)}</div><div className="insights-stat-label">Hospital desk</div></div>
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t.total)}</div><div className="insights-stat-label">All appointments</div></div>
                        <div className="insights-stat-card is-bad"><div className="insights-stat-value">{fmt(t.cancelled)}</div><div className="insights-stat-label">Cancelled since · {pct(t.cancelled, t.total)}</div></div>
                    </div>

                    {chart}

                    <details className="insights-details">
                        <summary>The figures {group === 'month' ? 'month' : group === 'week' ? 'week' : 'day'} by {groupWord}</summary>
                        <div className="premium-table-card">
                            <div className="premium-responsive-wrapper">
                                <table className="premium-table" aria-label="Appointments by period">
                                    <thead>
                                        <tr><th>{group === 'month' ? 'Month' : group === 'week' ? 'Week starting' : 'Day'}</th><th>Doctor Dekho</th><th>WhatsApp</th><th>NexEagle online</th><th>Hospital desk</th><th>All</th><th>Cancelled</th></tr>
                                    </thead>
                                    <tbody>
                                        {[...trend.periods].reverse().map(p => (
                                            <tr key={p.start} className="premium-row">
                                                <td>{group === 'day' ? dayLabel(p.start) : periodLabel(p.start, group)}{p.isPartial ? ' (so far)' : ''}</td>
                                                <td>{fmt(p.doctorDekho)}</td><td>{fmt(p.whatsApp)}</td><td style={{ fontWeight: 700 }}>{fmt(p.online)}</td>
                                                <td>{fmt(p.hospitalDesk)}</td><td>{fmt(p.total)}</td><td>{fmt(p.cancelled)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </details>

                    {!doctorId && (
                        <>
                            <h3 className="insights-section-title"><Stethoscope size={15} className="insights-title-icon" />Doctors with the most online bookings</h3>
                            <PlaceTable label="Doctors with the most online bookings" rows={trend.topDoctors} showDesk={showDesk} doctors />
                        </>
                    )}
                    {!hospitalId && !doctorId && (
                        <>
                            <h3 className="insights-section-title"><Building2 size={15} className="insights-title-icon" />Hospitals with the most online bookings</h3>
                            <PlaceTable label="Hospitals with the most online bookings" rows={trend.topHospitals} showDesk={showDesk} />
                        </>
                    )}
                </div>
            )}

            {ready && (
                <>
                    <h3 className="insights-section-title">The appointments</h3>
                    <div className="insights-filter-row">
                        <input type="search" className="insights-search-input" value={typed} onChange={e => setTyped(e.target.value)}
                            placeholder="Patient, doctor or hospital…" aria-label="Find an appointment" />
                        <label className="insights-check">
                            <input type="checkbox" checked={includeCancelled} onChange={e => { setIncludeCancelled(e.target.checked); setPage(1); }} /> Show cancelled
                        </label>
                        {canSeeContacts && (
                            <button type="button" className="insights-filter-btn insights-export-btn" onClick={() => void exportCsv()} disabled={exporting || total === 0}>
                                <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
                            </button>
                        )}
                    </div>
                    {listError ? <p className="insights-warning" role="alert">{listError}</p> : (
                        <div className="premium-table-card" style={{ opacity: listLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                            <div className="premium-responsive-wrapper">
                                <table className="premium-table" aria-label="The appointments">
                                    <thead>
                                        <tr><th>Booked</th><th>Appointment</th><th>Came through</th><th>Patient</th><th>Doctor</th><th>Hospital</th><th>Status</th></tr>
                                    </thead>
                                    <tbody>
                                        {listLoading && rows.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                                        ) : rows.length === 0 ? (
                                            <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No appointments match these choices.</td></tr>
                                        ) : rows.map(r => {
                                            const s = SERIES.find(x => (r.channel === 'whatsapp' ? x.key === 'whatsApp' : r.channel === 'doctordekho' ? x.key === 'doctorDekho' : x.key === 'hospitalDesk'));
                                            return (
                                                <tr key={r.apptId} className="premium-row">
                                                    <td style={{ whiteSpace: 'nowrap' }}>{istTime(r.bookedAt)}</td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>{dayLabel(r.apptDate)}</td>
                                                    <td>
                                                        <span className="insights-swatch" style={{ background: s?.colour }} aria-hidden="true" />{r.channelLabel}
                                                        {r.loggedIn && <div className="insights-sub">signed in</div>}
                                                    </td>
                                                    <td>
                                                        <div style={{ fontWeight: 600 }}>{r.patientName ?? '—'}</div>
                                                        {r.patientMobile && <div className="insights-sub insights-phone">{r.patientMobile}</div>}
                                                    </td>
                                                    <td>{r.doctorName ?? '—'}</td>
                                                    <td>{r.hospitalName ?? '—'}</td>
                                                    <td>{r.statusCode === 'CANCELLED' ? <span className="insights-badge insights-badge-left">{r.status}</span> : r.status}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="premium-pagination">
                                <div className="premium-page-info">
                                    {total === 0 ? 'No appointments' : <>Showing <b>{(page - 1) * PAGE + 1}</b> to <b>{Math.min(page * PAGE, total)}</b> of <b>{fmt(total)}</b></>}
                                </div>
                                <div className="premium-page-controls">
                                    <button onClick={() => setPage(x => Math.max(x - 1, 1))} disabled={page === 1} className="premium-page-btn">Previous</button>
                                    <span style={{ margin: '0 12px', fontSize: 14, color: '#64748b' }}>Page {page} of {pages || 1}</span>
                                    <button onClick={() => setPage(x => Math.min(x + 1, pages))} disabled={page >= pages} className="premium-page-btn">Next</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AppointmentsPanel;
