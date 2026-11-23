import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCircle2, SearchX, Search, Stethoscope } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { InsightsExplainer } from './InsightsExplainer';
import { ChatDialog, CONTACTS_PERMISSION } from './WhatsAppBotPanel';
import { istDaysAgo, todayIst } from '../utils/istDate';
import {
    channelInsights, dayLabel, shortDay,
    type SearchChannel, type SearchInsights, type SearchKind, type SearchListQuery, type SearchListRow, type SearchTermRow,
} from '../services/channelInsights';

const RANGES = [
    { key: 'today', label: 'Today', days: 1 },
    { key: '7', label: '7 days', days: 7 },
    { key: '30', label: '30 days', days: 30 },
    { key: '90', label: '90 days', days: 90 },
] as const;
type RangeKey = typeof RANGES[number]['key'];

const CHANNELS: { key: SearchChannel; label: string }[] = [
    { key: 'all', label: 'Both' },
    { key: 'doctordekho', label: 'Doctor Dekho' },
    { key: 'whatsapp', label: 'WhatsApp bot' },
];

// One colour per kind, in a fixed order (validated: categorical slots 1–5).
const KINDS: { key: SearchKind; label: string; plural: string; colour: string; dayKey: 'symptom' | 'doctorName' | 'specialty' | 'hospital' | 'other' }[] = [
    { key: 'symptom', label: 'Symptom or health problem', plural: 'Symptoms', colour: '#2a78d6', dayKey: 'symptom' },
    { key: 'doctor', label: "Doctor's name", plural: 'Doctor names', colour: '#eb6834', dayKey: 'doctorName' },
    { key: 'specialty', label: 'Speciality', plural: 'Specialities', colour: '#1baf7a', dayKey: 'specialty' },
    { key: 'hospital', label: 'Hospital name', plural: 'Hospitals', colour: '#eda100', dayKey: 'hospital' },
    { key: 'other', label: 'Other words', plural: 'Other words', colour: '#e87ba4', dayKey: 'other' },
];

const LIST_KINDS: { key: NonNullable<SearchListQuery['kind']>; label: string }[] = [
    { key: 'all', label: 'All searches' },
    ...KINDS.map(k => ({ key: k.key, label: k.label })),
    { key: 'nothing', label: 'Found nothing' },
    { key: 'booked', label: 'Went on to book' },
];

const PAGE = 25;
const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const istTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function TermsTable({ label, rows, empty }: { label: string; rows: SearchTermRow[]; empty: string }) {
    return (
        <div className="premium-table-card">
            <div className="premium-responsive-wrapper">
                <table className="premium-table" aria-label={label}>
                    <thead>
                        <tr><th>Searched for</th><th>Doctor Dekho</th><th>WhatsApp</th><th>Total</th><th>Went on to book</th><th>Found nothing</th></tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>{empty}</td></tr>
                        ) : rows.map(r => (
                            <tr key={r.term} className="premium-row">
                                <td style={{ fontWeight: 600 }}>{r.term}</td>
                                <td>{fmt(r.doctorDekho)}</td>
                                <td>{fmt(r.whatsApp)}</td>
                                <td>{fmt(r.total)}</td>
                                <td className={r.ledToBooking ? 'insights-good' : ''}>{fmt(r.ledToBooking)} <span className="insights-sub-inline">({pct(r.ledToBooking, r.total)})</span></td>
                                <td className={r.foundNothing ? 'insights-bad' : ''}>{fmt(r.foundNothing)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * What people searched for, on Doctor Dekho and on the WhatsApp bot: a symptom, a doctor's name, a
 * speciality, a hospital or other words; which searches lead to bookings and which find nothing.
 */
export const SearchKindsPanel: React.FC = () => {
    const permissions = useAuthStore(s => s.permissions) || [];
    const canSeeContacts = permissions.includes(CONTACTS_PERMISSION);

    const [range, setRange] = useState<RangeKey>('30');
    const [channel, setChannel] = useState<SearchChannel>('all');
    const { from, to } = useMemo(() => {
        const days = RANGES.find(r => r.key === range)!.days;
        return { from: istDaysAgo(days - 1), to: todayIst() };
    }, [range]);

    const [data, setData] = useState<SearchInsights | null>(null);
    const [error, setError] = useState('');
    const [loadedFor, setLoadedFor] = useState('');
    const key = `${from}|${to}|${channel}`;

    useEffect(() => {
        let alive = true;
        channelInsights.searchAnalysis(from, to, channel)
            .then(d => { if (alive) { setData(d); setError(''); } })
            .catch(e => { if (alive) setError(e?.response?.data?.message || 'Could not load the searches.'); })
            .finally(() => { if (alive) setLoadedFor(`${from}|${to}|${channel}`); });
        return () => { alive = false; };
    }, [from, to, channel]);

    const [termKind, setTermKind] = useState<SearchKind>('symptom');

    // Every search
    const [listKind, setListKind] = useState<NonNullable<SearchListQuery['kind']>>('all');
    const [typed, setTyped] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<SearchListRow[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [listFor, setListFor] = useState('');
    const [listError, setListError] = useState('');
    const [chat, setChat] = useState<SearchListRow | null>(null);
    const closeChat = useCallback(() => setChat(null), []);

    useEffect(() => {
        const t = window.setTimeout(() => { setSearch(typed.trim()); setPage(1); }, 350);
        return () => window.clearTimeout(t);
    }, [typed]);

    const query: SearchListQuery = useMemo(() => ({ from, to, channel, kind: listKind, search, page, limit: PAGE }), [from, to, channel, listKind, search, page]);
    const listKey = JSON.stringify(query);
    useEffect(() => {
        let alive = true;
        channelInsights.searchList(query)
            .then(r => { if (alive) { setRows(r.data); setTotal(r.pagination.totalItems); setPages(r.pagination.totalPages); setListError(''); } })
            .catch(e => { if (alive) { setRows([]); setListError(e?.response?.data?.message || 'Could not load the searches.'); } })
            .finally(() => { if (alive) setListFor(JSON.stringify(query)); });
        return () => { alive = false; };
    }, [query]);

    const chartData = useMemo(() => [...(data?.days ?? [])].reverse().map(d => ({ ...d, label: shortDay(d.date) })), [data]);
    const loading = loadedFor !== key;
    const listLoading = listFor !== listKey;
    const showWhatsApp = channel !== 'doctordekho';
    const showDoctorDekho = channel !== 'whatsapp';
    const kindTerms = (data?.topTerms ?? []).filter(t => t.kind === termKind);

    return (
        <div className="insights-search-panel">
            <InsightsExplainer>
                <p>
                    <strong>What people searched for, on Doctor Dekho and on the WhatsApp bot.</strong> Each search is
                    sorted into a <em>symptom or health problem</em> ("pet me dard", "chest pain"), a <em>doctor's name</em>,
                    a <em>speciality</em> (typed, or picked from the list), a <em>hospital name</em>, or <em>other words</em>.
                    On Doctor Dekho a search counts as a symptom when the symptom AI read it; typed words are matched to the
                    doctors, hospitals and specialities in the HMS. On WhatsApp it is the button the person pressed (symptom
                    or doctor's name), the speciality they picked, or the bot's reading of what they typed.
                </p>
                <p>
                    <em>Went on to book</em>: the same website visit, or the same WhatsApp conversation, ended in a booking.
                    <em> Found nothing</em>: Doctor Dekho showed no doctors, or the WhatsApp bot asked again instead of
                    moving on. These are the doctors and specialities people want and could not find.
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="Period">
                    {RANGES.map(r => (
                        <button key={r.key} className={`insights-filter-btn ${range === r.key ? 'active' : ''}`} onClick={() => { setRange(r.key); setPage(1); }}>{r.label}</button>
                    ))}
                </div>
                <div className="insights-filter-toggle" role="group" aria-label="Where">
                    {CHANNELS.map(c => (
                        <button key={c.key} className={`insights-filter-btn ${channel === c.key ? 'active' : ''}`} onClick={() => { setChannel(c.key); setPage(1); }}>{c.label}</button>
                    ))}
                </div>
            </div>

            {error ? <p className="insights-warning" role="alert">{error}</p> : !data ? <div className="insights-empty">Loading…</div> : (
                <div style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    {showWhatsApp && !data.whatsAppAvailable && (
                        <p className="insights-warning" role="status">
                            WhatsApp searches are missing: the CMS could not read the WhatsApp bot's database. {data.whatsAppProblem}
                        </p>
                    )}

                    <div className="insights-stat-grid">
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(data.searches)}</div><div className="insights-stat-label">Searches, by {fmt(data.people)} people</div></div>
                        {KINDS.slice(0, 3).map(k => {
                            const row = data.kinds.find(x => x.kind === k.key);
                            return (
                                <div key={k.key} className="insights-stat-card insights-channel-card" style={{ borderTopColor: k.colour }}>
                                    <div className="insights-stat-value">{fmt(row?.total ?? 0)}</div>
                                    <div className="insights-stat-label">{k.label} · {pct(row?.total ?? 0, data.searches)}</div>
                                </div>
                            );
                        })}
                        <div className="insights-stat-card is-good"><div className="insights-stat-value">{fmt(data.ledToBooking)}</div><div className="insights-stat-label">Went on to book · {pct(data.ledToBooking, data.searches)}</div></div>
                        <div className="insights-stat-card is-bad"><div className="insights-stat-value">{fmt(data.foundNothing)}</div><div className="insights-stat-label">Found nothing · {pct(data.foundNothing, data.searches)}</div></div>
                    </div>

                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table" aria-label="Searches by kind">
                                <thead>
                                    <tr>
                                        <th>Kind of search</th>
                                        {showDoctorDekho && <th>Doctor Dekho</th>}
                                        {showWhatsApp && <th>WhatsApp</th>}
                                        <th>Total</th><th>Share</th><th>Went on to book</th><th>Found nothing</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {KINDS.map(k => {
                                        const r = data.kinds.find(x => x.kind === k.key);
                                        if (!r) return null;
                                        return (
                                            <tr key={k.key} className="premium-row">
                                                <td><span className="insights-swatch" style={{ background: k.colour }} aria-hidden="true" />{k.label}</td>
                                                {showDoctorDekho && <td>{fmt(r.doctorDekho)}</td>}
                                                {showWhatsApp && <td>{fmt(r.whatsApp)}</td>}
                                                <td style={{ fontWeight: 600 }}>{fmt(r.total)}</td>
                                                <td>{pct(r.total, data.searches)}</td>
                                                <td className={r.ledToBooking ? 'insights-good' : ''}>{fmt(r.ledToBooking)} <span className="insights-sub-inline">({pct(r.ledToBooking, r.total)})</span></td>
                                                <td className={r.foundNothing ? 'insights-bad' : ''}>{fmt(r.foundNothing)} <span className="insights-sub-inline">({pct(r.foundNothing, r.total)})</span></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <h3 className="insights-section-title">Most searched</h3>
                    <div className="insights-filter-row">
                        <div className="insights-filter-toggle" role="group" aria-label="Kind of search">
                            {KINDS.map(k => (
                                <button key={k.key} aria-pressed={termKind === k.key} className={`insights-filter-btn ${termKind === k.key ? 'active' : ''}`} onClick={() => setTermKind(k.key)}>{k.plural}</button>
                            ))}
                        </div>
                    </div>
                    <TermsTable label={`Most searched: ${KINDS.find(k => k.key === termKind)!.plural}`} rows={kindTerms} empty="No searches of this kind in this period." />

                    <div className="insights-panels-grid insights-panels-grid-2">
                        <div>
                            <h3 className="insights-section-title"><Stethoscope size={15} className="insights-title-icon" />Specialities people looked for</h3>
                            <p className="insights-card-note">Picked from the list, typed, or what a symptom was matched to.</p>
                            <TermsTable label="Specialities people looked for" rows={data.specialties} empty="No specialities in this period." />
                        </div>
                        <div>
                            <h3 className="insights-section-title"><SearchX size={15} className="insights-title-icon" />Searched, found nothing</h3>
                            <p className="insights-card-note">Doctors, hospitals or specialities people want that are not listed, or words that were not understood.</p>
                            <TermsTable label="Searched, found nothing" rows={data.nothingFound} empty="Every search found something in this period." />
                        </div>
                    </div>

                    {data.days.length > 1 && (
                        <div className="insights-mini-table-card">
                            <h3 className="insights-mini-table-title"><Search size={14} className="insights-title-icon" />Searches each day, by kind</h3>
                            <div className="insights-growth-chart" role="img" aria-label="Searches each day by kind; the same figures are in the table below">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                                        <CartesianGrid vertical={false} stroke="#eef2f6" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={8} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={40}
                                            label={{ value: 'Searches', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8', dy: 30 }} />
                                        <Tooltip cursor={{ fill: 'rgba(100,116,139,0.08)' }} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} itemSorter={null} formatter={(value: string) => <span style={{ color: '#475569' }}>{value}</span>} />
                                        {KINDS.map((k, i) => (
                                            <Bar key={k.key} dataKey={k.dayKey} name={k.label} stackId="kind" fill={k.colour} stroke="#ffffff" strokeWidth={1}
                                                maxBarSize={28} isAnimationActive={false} radius={i === KINDS.length - 1 ? [4, 4, 0, 0] : 0} />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <details className="insights-details">
                        <summary>The figures day by day</summary>
                        <div className="premium-table-card">
                            <div className="premium-responsive-wrapper">
                                <table className="premium-table" aria-label="Searches by day">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            {showDoctorDekho && <th>Doctor Dekho</th>}
                                            {showWhatsApp && <th>WhatsApp</th>}
                                            {KINDS.map(k => <th key={k.key}>{k.plural}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.days.map(d => (
                                            <tr key={d.date} className="premium-row">
                                                <td>{dayLabel(d.date)}</td>
                                                {showDoctorDekho && <td>{fmt(d.doctorDekho)}</td>}
                                                {showWhatsApp && <td>{fmt(d.whatsApp)}</td>}
                                                {KINDS.map(k => <td key={k.key}>{fmt(d[k.dayKey])}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </details>
                </div>
            )}

            <h3 className="insights-section-title">Every search</h3>
            <div className="insights-filter-row">
                <select className="premium-filter-select" value={listKind} onChange={e => { setListKind(e.target.value as typeof listKind); setPage(1); }} aria-label="Show">
                    {LIST_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
                <input type="search" className="insights-search-input" value={typed} onChange={e => setTyped(e.target.value)}
                    placeholder="Words, speciality, area, number…" aria-label="Find a search" />
            </div>

            {listError ? <p className="insights-warning" role="alert">{listError}</p> : (
                <div className="premium-table-card" style={{ opacity: listLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <div className="premium-responsive-wrapper">
                        <table className="premium-table" aria-label="Every search">
                            <thead>
                                <tr><th>When</th><th>Where</th><th>Kind</th><th>Searched for</th><th>Result</th><th>Area</th><th>Number</th></tr>
                            </thead>
                            <tbody>
                                {listLoading && rows.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                                ) : rows.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No searches match these choices.</td></tr>
                                ) : rows.map((r, i) => {
                                    const kind = KINDS.find(k => k.key === r.kind);
                                    return (
                                        <tr key={`${r.at}-${i}`} className="premium-row">
                                            <td style={{ whiteSpace: 'nowrap' }}>{istTime(r.at)}</td>
                                            <td>{r.channel === 'whatsapp' ? 'WhatsApp' : 'Doctor Dekho'}</td>
                                            <td><span className="insights-swatch" style={{ background: kind?.colour }} aria-hidden="true" />{r.kindLabel}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{r.text ?? '—'}</div>
                                                {r.specialty && r.specialty.toLowerCase() !== (r.text ?? '').toLowerCase() && <div className="insights-sub">→ {r.specialty}</div>}
                                            </td>
                                            <td>
                                                {r.found === false ? (
                                                    <span className="insights-badge insights-badge-left"><SearchX size={12} /> Found nothing</span>
                                                ) : r.results != null ? (
                                                    <span className="insights-sub">{fmt(r.results)} doctor{r.results === 1 ? '' : 's'}</span>
                                                ) : <span className="insights-sub">Found</span>}
                                                {r.booked && <div><span className="insights-badge insights-badge-loggedin"><CheckCircle2 size={12} /> Booked</span></div>}
                                            </td>
                                            <td>{r.city ?? <span className="insights-sub">—</span>}</td>
                                            <td>
                                                {r.phone ? (
                                                    <div className="insights-actions">
                                                        <span className="insights-phone">{r.phone}</span>
                                                        {canSeeContacts && r.sessionId && (
                                                            <button type="button" className="insights-link-btn" onClick={() => setChat(r)}>Chat</button>
                                                        )}
                                                    </div>
                                                ) : <span className="insights-sub">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="premium-pagination">
                        <div className="premium-page-info">
                            {total === 0 ? 'No searches' : <>Showing <b>{(page - 1) * PAGE + 1}</b> to <b>{Math.min(page * PAGE, total)}</b> of <b>{fmt(total)}</b></>}
                        </div>
                        <div className="premium-page-controls">
                            <button onClick={() => setPage(x => Math.max(x - 1, 1))} disabled={page === 1} className="premium-page-btn">Previous</button>
                            <span style={{ margin: '0 12px', fontSize: 14, color: '#64748b' }}>Page {page} of {pages || 1}</span>
                            <button onClick={() => setPage(x => Math.min(x + 1, pages))} disabled={page >= pages} className="premium-page-btn">Next</button>
                        </div>
                    </div>
                </div>
            )}

            {chat?.sessionId && <ChatDialog sessionId={chat.sessionId} title={chat.phone ?? ''} subtitle={`${istTime(chat.at)} · searched "${chat.text ?? ''}"`} onClose={closeChat} />}
        </div>
    );
};

export default SearchKindsPanel;
