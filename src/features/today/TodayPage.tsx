import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CreditCard, MessageSquare, BookOpen, Siren, AlertTriangle, Building2, ScanLine, Stethoscope, Users, Check, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useSupportStore } from '../../store/useSupportStore';
import { useCountsStore } from '../../store/useCountsStore';
import { loadToday, waited, inr, type Product, type TodayData } from './todayService';
import './today.css';

type Area = 'money' | 'support' | 'content' | 'admin';
interface Todo {
    id: string; product: Product; area: Area; icon: LucideIcon;
    title: string; detail: string; at: string | null; action: string; to: string;
}

const AREA_LABEL: Record<Area, string> = { money: 'Money', support: 'Support', content: 'Content', admin: 'Admin' };
const PRODUCTS: { key: Product; label: string }[] = [
    { key: 'all', label: 'All' }, { key: '1hms', label: '1HMS' }, { key: '1rad', label: '1Rad' }, { key: 'dd', label: 'Doctor Dekho' },
];
const PRODUCT_KEY = 'ne_today_product';

const greeting = (d = new Date()) => {
    const h = d.getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const lastDecision = (iso: string | null) => {
    const w = waited(iso);
    return !w ? 'No decisions yet' : w === 'just now' ? 'Last decision just now' : `Last decision ${w} ago`;
};
const firstName = (name?: string | null) => (name || '').trim().split(/\s+/)[0] || '';
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const readProduct = (): Product => {
    try {
        const v = localStorage.getItem(PRODUCT_KEY);
        return v === '1hms' || v === '1rad' || v === 'dd' ? v : 'all';
    } catch { return 'all'; }
};

/** Home page: what needs a person first, then the customers at a glance. */
const TodayPage: React.FC = () => {
    const user = useAuthStore((s) => s.user);
    const permissions = useAuthStore((s) => s.permissions) || [];
    const sessions = useSupportStore((s) => s.sessions);
    const setTodayCount = useCountsStore((s) => s.setToday);
    const [data, setData] = React.useState<TodayData | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [product, setProductState] = React.useState<Product>(readProduct);
    const [version, setVersion] = React.useState(0);
    const permKey = permissions.join('|');

    const setProduct = (p: Product) => {
        setProductState(p);
        try { localStorage.setItem(PRODUCT_KEY, p); } catch { /* private window */ }
    };

    React.useEffect(() => {
        let alive = true;
        loadToday(permKey ? permKey.split('|') : []).then(d => {
            if (!alive) return;
            setData(d);
            setLoading(false);
        });
        return () => { alive = false; };
    }, [permKey, version]);

    const refresh = () => { setLoading(true); setVersion(v => v + 1); };

    const waitingChats = sessions.filter(s => (s.unread ?? 0) > 0);
    const oldestChat = waitingChats.map(s => s.lastMessageAt || s.startedAt).sort()[0] || null;

    const all: Todo[] = [];
    data?.radPending?.forEach(r => all.push({
        id: `rad-${r.requestId}`, product: '1rad', area: 'money', icon: CreditCard,
        title: `Approve payment · ${r.hospitalName}`,
        detail: ['1Rad', r.planName, r.billingCycle, r.paymentMode, inr(r.amount)].filter(Boolean).join(' · '),
        at: r.createdAt, action: 'Review', to: '/approvals?product=1rad',
    }));
    data?.hmsPending?.forEach(r => {
        const isRad = /1rad/i.test(r.applicationName || '');
        all.push({
            id: `hms-${r.hospitalSubscriptionId}`, product: isRad ? '1rad' : '1hms', area: 'money', icon: CreditCard,
            title: `Approve payment · ${r.hospitalName}`,
            detail: [r.applicationName === 'EasyHMS' ? '1HMS' : r.applicationName, r.planName, r.paymentMode, inr(r.paymentAmount)].filter(Boolean).join(' · '),
            at: r.paymentDate, action: 'Review', to: '/approvals',
        });
    });
    if (waitingChats.length) all.push({
        id: 'chat', product: 'all', area: 'support', icon: MessageSquare,
        title: `${plural(waitingChats.length, 'person', 'people')} waiting in live chat`,
        detail: waitingChats.slice(0, 3).map(s => s.guestName || s.guestEmail || 'Visitor').join(', '),
        at: oldestChat, action: 'Answer', to: '/support',
    });
    data?.articlesToReview?.forEach(a => all.push({
        id: `wiki-${a.slug}`, product: 'dd', area: 'content', icon: BookOpen,
        title: `Approve Health Wiki article · ${a.title}`,
        detail: a.suggestedByName ? `Suggested by ${a.suggestedByName}` : 'Waiting for review',
        at: a.updatedAt, action: 'Read', to: `/health-wiki/${encodeURIComponent(a.slug)}`,
    }));
    if (data?.placesToVerify) all.push({
        id: 'emergency', product: 'dd', area: 'content', icon: Siren,
        title: `${plural(data.placesToVerify, 'emergency place')} to verify`,
        detail: 'Check before they are shown to patients', at: null, action: 'Verify', to: '/emergency',
    });
    data?.failedImports?.forEach(b => all.push({
        id: `imp-${b.batchId}`, product: '1hms', area: 'admin', icon: AlertTriangle,
        title: `Data import stopped · ${b.dataType}`,
        detail: `${b.sourceFileName}${b.sourceRowCount ? ` · ${b.sourceRowCount} rows` : ''}`,
        at: b.updatedAt, action: 'Fix', to: `/data-migration/${b.batchId}`,
    }));
    all.sort((a, b) => (a.at ? new Date(a.at).getTime() : Infinity) - (b.at ? new Date(b.at).getTime() : Infinity));

    const todo = all.filter(t => product === 'all' || t.product === product || t.product === 'all');

    // The Today menu badge counts every waiting item, whatever product is picked here.
    React.useEffect(() => { if (data) setTodayCount(all.length); }, [data, all.length, setTodayCount]);

    const hospitals = data?.hospitals || null;
    const hms = hospitals && {
        total: hospitals.length,
        paying: hospitals.filter(h => h.subscriptionStatus === 'Active').length,
        trial: hospitals.filter(h => h.subscriptionStatus === 'Trial').length,
        ending: hospitals.filter(h => h.subscriptionStatus === 'Active' && h.subscriptionDaysRemaining != null && h.subscriptionDaysRemaining <= 7).length,
        stopped: hospitals.filter(h => ['Expired', 'Blocked'].includes(h.subscriptionStatus || '')).length,
    };
    const rad = data?.radCentres || null;
    const radByStatus = rad ? rad.reduce<Record<string, number>>((m, c) => { const k = c.subscriptionStatus || 'No plan'; m[k] = (m[k] || 0) + 1; return m; }, {}) : null;
    const renewals = (hospitals || [])
        .filter(h => h.subscriptionStatus === 'Active' && h.subscriptionDaysRemaining != null && h.subscriptionDaysRemaining <= 7)
        .sort((a, b) => (a.subscriptionDaysRemaining ?? 0) - (b.subscriptionDaysRemaining ?? 0))
        .slice(0, 5);

    const summary = loading && !data ? 'Checking what needs you…'
        : todo.length ? `${plural(todo.length, 'thing')} ${todo.length === 1 ? 'needs' : 'need'} you${product === 'all' ? '' : ' for this product'}.`
            : 'Nothing needs you right now.';

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
        <div className="td">
            <div className="td-head">
                <div className="td-hello">
                    <span className="td-date">{today}</span>
                    <h1>{greeting()}{firstName(user?.name) ? `, ${firstName(user?.name)}` : ''}</h1>
                    <p>{summary}</p>
                </div>
                <div className="td-head-tools">
                    <div className="td-seg" role="radiogroup" aria-label="Product">
                        {PRODUCTS.map(p => (
                            <button key={p.key} type="button" role="radio" aria-checked={product === p.key}
                                className={product === p.key ? 'is-on' : ''} onClick={() => setProduct(p.key)}>{p.label}</button>
                        ))}
                    </div>
                    <button type="button" className="td-btn" onClick={refresh} aria-label="Refresh" title="Refresh" disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {(hms || rad || data?.totals) && (
                <div className="td-kpis">
                    {hms && (
                        <Link to="/onboarded-hospitals" className="td-kpi">
                            <span className="td-kpi-top"><span>Hospitals · 1HMS</span><span className="td-ico tone-blue"><Building2 size={16} /></span></span>
                            <span className="td-kpi-num">{hms.total}</span>
                            <span className="td-kpi-sub">
                                {hms.paying} paying · {hms.trial} on trial
                                {hms.ending > 0 && <> · <strong className="warn">{hms.ending} ending this week</strong></>}
                                {hms.stopped > 0 && <> · <strong className="bad">{hms.stopped} expired or blocked</strong></>}
                            </span>
                        </Link>
                    )}
                    {rad && radByStatus && (
                        <Link to="/rad-centers" className="td-kpi">
                            <span className="td-kpi-top"><span>Diagnostic centres · 1Rad</span><span className="td-ico tone-violet"><ScanLine size={16} /></span></span>
                            <span className="td-kpi-num">{rad.length}</span>
                            <span className="td-kpi-sub">{Object.entries(radByStatus).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ') || 'No centres yet'}</span>
                        </Link>
                    )}
                    {data?.totals && (
                        <Link to="/doctors" className="td-kpi">
                            <span className="td-kpi-top"><span>Doctors</span><span className="td-ico tone-green"><Stethoscope size={16} /></span></span>
                            <span className="td-kpi-num">{data.totals.doctors.toLocaleString('en-IN')}</span>
                            <span className="td-kpi-sub">across all 1HMS hospitals</span>
                        </Link>
                    )}
                    {data?.totals && (
                        <Link to="/growth" className="td-kpi">
                            <span className="td-kpi-top"><span>Patients and users</span><span className="td-ico tone-amber"><Users size={16} /></span></span>
                            <span className="td-kpi-num">{data.totals.patients.toLocaleString('en-IN')}</span>
                            <span className="td-kpi-sub">patients · {data.totals.users.toLocaleString('en-IN')} staff users</span>
                        </Link>
                    )}
                </div>
            )}

            <section className="td-card" aria-labelledby="td-needs">
                <div className="td-card-head">
                    <div className="td-card-title">
                        <h2 id="td-needs">Needs you</h2>
                        {!loading && <span className="td-pill">{todo.length}</span>}
                    </div>
                    <span className="td-hint">Oldest first</span>
                </div>
                {loading && !data && (
                    <div className="td-skel" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} />)}</div>
                )}
                {data && todo.map(t => {
                    const Icon = t.icon;
                    return (
                        <div className="td-row" key={t.id}>
                            <span className={`td-ico td-ico-lg area-${t.area}`}><Icon size={18} aria-hidden="true" /></span>
                            <span className="td-row-text">
                                <span className="td-row-title">{t.title}</span>
                                <span className="td-row-sub">{AREA_LABEL[t.area]} · {t.detail}</span>
                            </span>
                            <span className="td-row-age">{waited(t.at)}</span>
                            <Link to={t.to} className="td-btn td-btn-text">{t.action}</Link>
                        </div>
                    );
                })}
                {data && todo.length === 0 && (
                    <div className="td-empty">
                        <span className="td-empty-ico"><Check size={20} /></span>
                        <strong>All clear{product === 'all' ? '' : ' for this product'}</strong>
                        <span>New payments, chats and reviews will show up here.</span>
                    </div>
                )}
            </section>

            {(renewals.length > 0 || data?.router) && (
                <div className="td-two">
                    {hospitals && (
                        <section className="td-card td-pad" aria-labelledby="td-renew">
                            <div className="td-card-head td-flat">
                                <h2 id="td-renew">Plans ending this week</h2>
                                <Link to="/onboarded-hospitals" className="td-link">See all</Link>
                            </div>
                            {renewals.length === 0 && <p className="td-muted">No paid 1HMS plan ends in the next 7 days.</p>}
                            {renewals.map(h => {
                                const d = h.subscriptionDaysRemaining ?? 0;
                                return (
                                    <Link to={`/hospital/${h.id}`} className="td-line" key={h.id}>
                                        <span className="td-line-text"><span className="td-row-title">{h.name}</span><span className="td-row-sub">1HMS · {h.subscriptionPlanName || 'paid plan'}{h.city ? ` · ${h.city}` : ''}</span></span>
                                        <span className={`td-tag ${d <= 2 ? 'bad' : d <= 4 ? 'warn' : ''}`}>{d <= 0 ? 'ends today' : d === 1 ? '1 day' : `${d} days`}</span>
                                    </Link>
                                );
                            })}
                        </section>
                    )}
                    {data?.router && (
                        <section className="td-card td-pad" aria-labelledby="td-ai">
                            <div className="td-card-head td-flat">
                                <h2 id="td-ai">AI agents</h2>
                                <Link to="/symptom-router" className="td-link">Open</Link>
                            </div>
                            <div className="td-line td-static">
                                <span className={`td-dot ${data.router.reachable ? 'ok' : 'bad'}`} aria-hidden="true" />
                                <span className="td-line-text">
                                    <span className="td-row-title">Symptom router</span>
                                    <span className="td-row-sub">{data.router.reachable ? lastDecision(data.router.lastDecisionReceivedAt) : (data.router.error || 'Not reachable')}</span>
                                </span>
                                <span className={`td-state ${data.router.reachable ? 'ok' : 'bad'}`}>{data.router.reachable ? 'Working' : 'Down'}</span>
                            </div>
                            {permissions.includes('dashboard.view') && (
                                <Link to="/vita-agents" className="td-line">
                                    <span className="td-dot neutral" aria-hidden="true" />
                                    <span className="td-line-text"><span className="td-row-title">Vita · 1HMS assistant</span><span className="td-row-sub">Health, conversations and answer quality</span></span>
                                </Link>
                            )}
                            {permissions.includes('vita.view') && (
                                <Link to="/vita" className="td-line">
                                    <span className="td-dot neutral" aria-hidden="true" />
                                    <span className="td-line-text"><span className="td-row-title">Test agent</span><span className="td-row-sub">Runs, cases and findings</span></span>
                                </Link>
                            )}
                        </section>
                    )}
                </div>
            )}
        </div>
    );
};

export default TodayPage;
