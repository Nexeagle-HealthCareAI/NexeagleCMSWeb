import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, MessageCircle, Phone, QrCode, Search, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../store/useAuthStore';
import { InsightsExplainer } from './InsightsExplainer';
import { istDaysAgo, todayIst } from '../utils/istDate';
import {
    channelInsights, dayLabel, peopleCsv,
    type NamedCount, type WhatsAppDailyStats, type WhatsAppPeopleQuery, type WhatsAppPerson, type WhatsAppTranscript,
} from '../services/channelInsights';

export const CONTACTS_PERMISSION = 'insights.contacts';

const RANGES = [
    { key: 'today', label: 'Today', days: 1 },
    { key: '7', label: '7 days', days: 7 },
    { key: '30', label: '30 days', days: 30 },
    { key: '90', label: '90 days', days: 90 },
    { key: 'custom', label: 'Custom', days: 0 },
] as const;
type RangeKey = typeof RANGES[number]['key'];

const OUTCOMES = [
    { key: 'all', label: 'Everyone' },
    { key: 'booked', label: 'Booked' },
    { key: 'left', label: 'Left in between' },
    { key: 'other', label: 'Came for something else' },
] as const;
const SOURCES = [
    { key: 'all', label: 'Any source' },
    { key: 'qr', label: 'Scanned a QR code' },
    { key: 'direct', label: 'Messaged directly' },
] as const;

const PAGE = 25;
const fmt = (n: number) => n.toLocaleString('en-IN');
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const istTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Ranked({ title, rows, empty, icon }: { title: string; rows: NamedCount[]; empty: string; icon?: React.ReactNode }) {
    const max = Math.max(1, ...rows.map(r => r.count));
    return (
        <div className="insights-mini-table-card">
            <h3 className="insights-mini-table-title">{icon}{title}</h3>
            {rows.length === 0 ? <div className="insights-empty">{empty}</div> : rows.map(r => (
                <div key={r.name} className="insights-share-row" title={`${r.name}: ${fmt(r.count)}`}>
                    <div className="insights-share-bar" style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }} />
                    <span className="insights-mini-row-label">{r.name}</span>
                    <span className="insights-mini-row-value">{fmt(r.count)}</span>
                </div>
            ))}
        </div>
    );
}

/** The whole conversation, as the bot recorded it. */
function ChatDialog({ person, onClose }: { person: WhatsAppPerson; onClose: () => void }) {
    const [chat, setChat] = useState<WhatsAppTranscript | null>(null);
    const [error, setError] = useState('');
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        let alive = true;
        channelInsights.whatsAppTranscript(person.sessionId)
            .then(t => { if (alive) setChat(t); })
            .catch(() => { if (alive) setError('Could not load this conversation.'); });
        closeRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => { alive = false; document.removeEventListener('keydown', onKey); };
    }, [person.sessionId, onClose]);

    return (
        <div className="insights-dialog-backdrop" onMouseDown={onClose}>
            <div className="insights-dialog" role="dialog" aria-modal="true" aria-label={`Conversation with ${person.phone}`} onMouseDown={e => e.stopPropagation()}>
                <header>
                    <div>
                        <h3>{person.phone}</h3>
                        <p>{istTime(person.startedAt)} · {person.sourceLabel}</p>
                    </div>
                    <button ref={closeRef} type="button" className="insights-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
                </header>
                <div className="insights-chat">
                    {error ? <div className="insights-empty">{error}</div> : !chat ? <div className="insights-empty">Loading…</div> : chat.lines.length === 0 ? (
                        <div className="insights-empty">Nothing was recorded for this conversation.</div>
                    ) : chat.lines.map((l, i) => l.from === 'person' ? (
                        <div key={i} className="insights-chat-msg">
                            <span>{l.text}</span>
                            <small>{l.at ? istTime(l.at) : ''}{l.stepLabel ? ` · answering: ${l.stepLabel}` : ''}</small>
                        </div>
                    ) : (
                        <div key={i} className="insights-chat-step">{l.text}</div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Who wrote to the WhatsApp booking bot, day by day: how many, how many were new, how many came from
 * a QR code, who booked and who left before booking; then every conversation with the number (for
 * people allowed to see it), what was searched, and how it ended.
 */
export const WhatsAppBotPanel: React.FC = () => {
    const permissions = useAuthStore(s => s.permissions) || [];
    const canSeeContacts = permissions.includes(CONTACTS_PERMISSION);

    const [range, setRange] = useState<RangeKey>('7');
    const [customFrom, setCustomFrom] = useState(istDaysAgo(6));
    const [customTo, setCustomTo] = useState(todayIst());
    const { from, to } = useMemo(() => {
        if (range === 'custom') return { from: customFrom, to: customTo };
        const days = RANGES.find(r => r.key === range)!.days;
        return { from: istDaysAgo(days - 1), to: todayIst() };
    }, [range, customFrom, customTo]);

    const [stats, setStats] = useState<WhatsAppDailyStats | null>(null);
    const [statsError, setStatsError] = useState('');
    const [statsFor, setStatsFor] = useState('');

    const [outcome, setOutcome] = useState<NonNullable<WhatsAppPeopleQuery['outcome']>>('all');
    const [source, setSource] = useState<NonNullable<WhatsAppPeopleQuery['source']>>('all');
    const [typed, setTyped] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [people, setPeople] = useState<WhatsAppPerson[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(0);
    const [peopleFor, setPeopleFor] = useState('');
    const [peopleError, setPeopleError] = useState('');
    const [open, setOpen] = useState<WhatsAppPerson | null>(null);
    const [exporting, setExporting] = useState(false);
    const closeChat = useCallback(() => setOpen(null), []);

    const ready = Boolean(from && to);

    useEffect(() => {
        const t = window.setTimeout(() => { setSearch(typed.trim()); setPage(1); }, 350);
        return () => window.clearTimeout(t);
    }, [typed]);

    const statsKey = `${from}|${to}`;
    useEffect(() => {
        if (!ready) return;
        let alive = true;
        channelInsights.whatsAppDaily(from, to)
            .then(s => { if (alive) { setStats(s); setStatsError(''); } })
            .catch(e => { if (alive) setStatsError(e?.response?.data?.message || 'Could not load the WhatsApp figures.'); })
            .finally(() => { if (alive) setStatsFor(`${from}|${to}`); });
        return () => { alive = false; };
    }, [from, to, ready]);

    const query: WhatsAppPeopleQuery = useMemo(() => ({ from, to, outcome, source, search, page, limit: PAGE }), [from, to, outcome, source, search, page]);
    const peopleKey = JSON.stringify(query);
    useEffect(() => {
        if (!ready) return;
        let alive = true;
        channelInsights.whatsAppPeople(query)
            .then(r => {
                if (!alive) return;
                setPeople(r.data); setTotal(r.pagination.totalItems); setPages(r.pagination.totalPages); setPeopleError('');
            })
            .catch(e => { if (alive) { setPeople([]); setPeopleError(e?.response?.data?.message || 'Could not load the people list.'); } })
            .finally(() => { if (alive) setPeopleFor(JSON.stringify(query)); });
        return () => { alive = false; };
    }, [query, ready]);

    const exportCsv = async () => {
        setExporting(true);
        try {
            const all = await channelInsights.whatsAppPeople({ ...query, page: 1, limit: 1000 });
            const blob = new Blob(['﻿' + peopleCsv(all.data)], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whatsapp-bot-${from}-to-${to}${outcome !== 'all' ? '-' + outcome : ''}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            if (all.pagination.totalItems > all.data.length) toast.message(`The file has the first ${all.data.length} of ${all.pagination.totalItems}. Choose a shorter period for the rest.`);
        } catch {
            toast.error('Could not export. Try again.');
        } finally {
            setExporting(false);
        }
    };

    const t = stats?.totals;
    const decided = t ? t.booked + t.left : 0;
    const statsLoading = statsFor !== statsKey;
    const peopleLoading = peopleFor !== peopleKey;

    return (
        <div>
            <InsightsExplainer>
                <p>
                    <strong>Every conversation with the WhatsApp booking bot.</strong> <em>Booked</em> means the booking
                    went through. <em>Left in between</em> means the person started looking for a doctor and stopped
                    before booking; the list says where. <em>Came for something else</em> is checking or changing an
                    appointment, hospital check-in, a prescription or a follow-up. <em>New</em> is a number writing to
                    the bot for the first time ever. A QR code is recognised from the message the scan fills in.
                </p>
                <p>
                    {canSeeContacts
                        ? 'You can see full numbers, call or message people, export them and read whole conversations. Use them only to help people book.'
                        : 'Numbers are shown in part. Seeing full numbers needs the "See phone numbers and chats of WhatsApp bot users" permission.'}
                </p>
            </InsightsExplainer>

            <div className="insights-filter-row">
                <div className="insights-filter-toggle" role="group" aria-label="Period">
                    {RANGES.map(r => (
                        <button key={r.key} className={`insights-filter-btn ${range === r.key ? 'active' : ''}`} onClick={() => { setRange(r.key); setPage(1); }}>
                            {r.label}
                        </button>
                    ))}
                </div>
                {range === 'custom' && (
                    <>
                        <input type="date" value={customFrom} max={customTo || todayIst()} onChange={e => { setCustomFrom(e.target.value); setPage(1); }} className="insights-date-input" aria-label="From" />
                        <span style={{ fontSize: 12, color: '#64748b' }}>to</span>
                        <input type="date" value={customTo} min={customFrom || undefined} max={todayIst()} onChange={e => { setCustomTo(e.target.value); setPage(1); }} className="insights-date-input" aria-label="To" />
                        <span className="insights-card-note" style={{ margin: 0 }}>Up to 92 days</span>
                    </>
                )}
            </div>

            {!ready ? <div className="insights-empty">Pick a start and end date.</div> : statsError ? (
                <p className="insights-warning" role="alert">{statsError}</p>
            ) : !stats ? <div className="insights-empty">Loading…</div> : (
                <div style={{ opacity: statsLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                    <div className="insights-stat-grid">
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.people)}</div><div className="insights-stat-label">People ({fmt(t!.conversations)} conversations)</div></div>
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.newPeople)}</div><div className="insights-stat-label">New to the bot</div></div>
                        <div className="insights-stat-card"><div className="insights-stat-value">{fmt(t!.fromQr)}</div><div className="insights-stat-label">Came from a QR code</div></div>
                        <div className="insights-stat-card is-good"><div className="insights-stat-value">{fmt(t!.booked)}</div><div className="insights-stat-label">Booked · {pct(t!.booked, decided)} of those who tried</div></div>
                        <div className="insights-stat-card is-bad"><div className="insights-stat-value">{fmt(t!.left)}</div><div className="insights-stat-label">Left in between</div></div>
                        <div className="insights-stat-card insights-stat-card-muted"><div className="insights-stat-value">{fmt(t!.other)}</div><div className="insights-stat-label">Came for something else</div></div>
                    </div>

                    <div className="premium-table-card">
                        <div className="premium-responsive-wrapper">
                            <table className="premium-table" aria-label="WhatsApp bot by day">
                                <thead>
                                    <tr><th>Day</th><th>People</th><th>New</th><th>From QR</th><th>Booked</th><th>Left in between</th><th>Something else</th></tr>
                                </thead>
                                <tbody>
                                    {stats.days.map(d => (
                                        <tr key={d.date} className="premium-row">
                                            <td>{dayLabel(d.date)}</td>
                                            <td>{fmt(d.people)}</td>
                                            <td>{fmt(d.newPeople)}</td>
                                            <td>{fmt(d.fromQr)}</td>
                                            <td className={d.booked ? 'insights-good' : ''}>{fmt(d.booked)}</td>
                                            <td className={d.left ? 'insights-bad' : ''}>{fmt(d.left)}</td>
                                            <td>{fmt(d.other)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="insights-panels-grid">
                        <Ranked title="Where people left" rows={stats.leftAt} empty="Nobody left part-way in this period." />
                        <Ranked title="What people searched for" rows={stats.topSearches} empty="No searches in this period." icon={<Search size={14} className="insights-title-icon" />} />
                        <Ranked title="QR codes that brought people" rows={stats.qrSources} empty="Nobody came from a QR code in this period." icon={<QrCode size={14} className="insights-title-icon" />} />
                    </div>
                </div>
            )}

            {ready && (
                <>
                    <h3 className="insights-section-title">People</h3>
                    <div className="insights-filter-row">
                        <div className="insights-filter-toggle" role="group" aria-label="Result">
                            {OUTCOMES.map(o => (
                                <button key={o.key} className={`insights-filter-btn ${outcome === o.key ? 'active' : ''}`} onClick={() => { setOutcome(o.key); setPage(1); }}>{o.label}</button>
                            ))}
                        </div>
                        <select className="premium-filter-select" value={source} onChange={e => { setSource(e.target.value as typeof source); setPage(1); }} aria-label="Came from">
                            {SOURCES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                        <input type="search" className="insights-search-input" value={typed} onChange={e => setTyped(e.target.value)}
                            placeholder="Number, name, doctor, search…" aria-label="Find a person" />
                        {canSeeContacts && (
                            <button type="button" className="insights-filter-btn insights-export-btn" onClick={() => void exportCsv()} disabled={exporting || total === 0}>
                                <Download size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
                            </button>
                        )}
                    </div>

                    {peopleError ? <p className="insights-warning" role="alert">{peopleError}</p> : (
                        <div className="premium-table-card" style={{ opacity: peopleLoading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
                            <div className="premium-responsive-wrapper">
                                <table className="premium-table" aria-label="People who used the WhatsApp bot">
                                    <thead>
                                        <tr><th>When</th><th>Number</th><th>Came from</th><th>Searched</th><th>Result</th><th aria-label="Actions" /></tr>
                                    </thead>
                                    <tbody>
                                        {peopleLoading && people.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Loading…</td></tr>
                                        ) : people.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>Nobody matches these choices.</td></tr>
                                        ) : people.map(p => (
                                            <tr key={p.sessionId} className="premium-row">
                                                <td style={{ whiteSpace: 'nowrap' }}>{istTime(p.startedAt)}</td>
                                                <td>
                                                    <div className="insights-phone">{p.phone}{p.isNewPerson && <span className="insights-badge insights-badge-new">New</span>}</div>
                                                    {p.city && <div className="insights-sub">{p.city}</div>}
                                                </td>
                                                <td>{p.sourceLabel}</td>
                                                <td>{p.searched.length ? p.searched.join(', ') : <span className="insights-sub">—</span>}</td>
                                                <td>
                                                    {p.outcome === 'Booked' ? (
                                                        <>
                                                            <span className="insights-badge insights-badge-loggedin"><CheckCircle2 size={12} /> Booked</span>
                                                            <div className="insights-sub">
                                                                {[p.bookedDoctor, p.bookedHospital].filter(Boolean).join(' · ')}
                                                                {p.appointmentDate && ` · ${dayLabel(p.appointmentDate)}`}
                                                                {p.patientName && ` · for ${p.patientName}`}
                                                            </div>
                                                        </>
                                                    ) : p.outcome === 'Left' ? (
                                                        <>
                                                            <span className="insights-badge insights-badge-left"><XCircle size={12} /> Left</span>
                                                            <div className="insights-sub">{p.stageLabel}</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="insights-badge insights-badge-guest">Something else</span>
                                                            <div className="insights-sub">{p.lastStepLabel}</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="insights-actions">
                                                        {p.phoneDigits && (
                                                            <>
                                                                <a className="insights-icon-btn" href={`https://wa.me/${p.phoneDigits}`} target="_blank" rel="noopener noreferrer" aria-label={`Message ${p.phone} on WhatsApp`} title="Message on WhatsApp"><MessageCircle size={16} /></a>
                                                                <a className="insights-icon-btn" href={`tel:+${p.phoneDigits}`} aria-label={`Call ${p.phone}`} title="Call"><Phone size={16} /></a>
                                                            </>
                                                        )}
                                                        {canSeeContacts && <button type="button" className="insights-link-btn" onClick={() => setOpen(p)}>Chat ({p.messages})</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="premium-pagination">
                                <div className="premium-page-info">
                                    {total === 0 ? 'No people' : <>Showing <b>{(page - 1) * PAGE + 1}</b> to <b>{Math.min(page * PAGE, total)}</b> of <b>{fmt(total)}</b></>}
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

            {open && <ChatDialog person={open} onClose={closeChat} />}
        </div>
    );
};

export default WhatsAppBotPanel;
