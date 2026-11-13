import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Search, Check, X, RefreshCw } from 'lucide-react';
import { useCountsStore } from '../../store/useCountsStore';
import { loadPayments, approvePayment, rejectPayment, errorText, inr, type Payment, type PayStatus, type ProductKey } from './approvalsService';
import './approvals.css';

type View = 'waiting' | 'approved' | 'rejected';
type ProductFilter = 'all' | ProductKey;

const when = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
const ago = (iso: string | null) => {
    if (!iso) return '';
    const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 60) return m < 2 ? 'just now' : `${m} min`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h` : `${Math.round(h / 24)} d`;
};
const STATUS_TEXT: Record<PayStatus, string> = { waiting: 'Waiting for you', approved: 'Approved', rejected: 'Rejected', replaced: 'Replaced by a newer payment' };
const isTyping = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/**
 * Money › Payment approvals. Waiting payments from 1HMS and 1Rad in one list,
 * oldest first; the chosen one opens beside the list with everything needed to
 * decide. "Approve and open next" keeps the hand on the keyboard: A approves,
 * R rejects, J/K move.
 */
const ApprovalsInbox: React.FC = () => {
    const [params, setParams] = useSearchParams();
    const refreshCounts = useCountsStore(s => s.refreshApprovals);
    const [payments, setPayments] = React.useState<Payment[] | null>(null);
    const [errors, setErrors] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [version, setVersion] = React.useState(0);
    const [view, setView] = React.useState<View>('waiting');
    const [query, setQuery] = React.useState('');
    const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
    const [confirming, setConfirming] = React.useState(false);
    const [rejecting, setRejecting] = React.useState(false);
    const [reason, setReason] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const reasonRef = React.useRef<HTMLTextAreaElement>(null);
    const product: ProductFilter = params.get('product') === '1rad' ? '1rad' : params.get('product') === '1hms' ? '1hms' : 'all';

    React.useEffect(() => {
        let alive = true;
        loadPayments().then(r => {
            if (!alive) return;
            setPayments(r.payments);
            setErrors(r.errors);
            setLoading(false);
        });
        return () => { alive = false; };
    }, [version]);

    const reload = () => { setLoading(true); setVersion(v => v + 1); void refreshCounts(); };

    const inView = (p: Payment) => view === 'waiting' ? p.status === 'waiting'
        : view === 'approved' ? p.status === 'approved' : (p.status === 'rejected' || p.status === 'replaced');
    const q = query.trim().toLowerCase();
    const list = (payments || [])
        .filter(p => product === 'all' || p.product === product)
        .filter(inView)
        .filter(p => !q || `${p.hospitalName} ${p.plan} ${p.reference || ''} ${p.payer || ''}`.toLowerCase().includes(q))
        .sort((a, b) => {
            const ta = new Date(a.submittedAt || 0).getTime(), tb = new Date(b.submittedAt || 0).getTime();
            return view === 'waiting' ? ta - tb : tb - ta; // waiting: oldest first; past: newest first
        });
    const counts = {
        waiting: (payments || []).filter(p => (product === 'all' || p.product === product) && p.status === 'waiting').length,
    };
    const selected = list.find(p => p.key === selectedKey) || null;
    // On wide screens the first row is open by default; on phones the list shows until a row is tapped.
    const wide = typeof window !== 'undefined' && window.innerWidth > 900;
    const shown = selected || (wide ? list[0] || null : null);
    const index = shown ? list.findIndex(p => p.key === shown.key) : -1;

    const open = (p: Payment | null | undefined) => {
        setSelectedKey(p ? p.key : null);
        setConfirming(false);
        setRejecting(false);
        setReason('');
    };
    const move = (step: number) => {
        if (!list.length) return;
        const next = list[Math.min(list.length - 1, Math.max(0, (index < 0 ? 0 : index) + step))];
        open(next);
    };

    const doApprove = async (p: Payment) => {
        setBusy(true);
        try {
            const msg = await approvePayment(p);
            toast.success(msg || `Approved · ${p.hospitalName}. The plan is now active.`);
            const next = list[index + 1] || list[index - 1] || null;
            setPayments(ps => (ps || []).map(x => x.key === p.key ? { ...x, status: 'approved', reviewedAt: new Date().toISOString() } : x));
            open(next && next.key !== p.key ? next : null);
            void refreshCounts();
        } catch (e) {
            toast.error(errorText(e, 'Could not approve this payment. Nothing was changed.'));
        } finally {
            setBusy(false);
            setConfirming(false);
        }
    };

    const doReject = async (p: Payment) => {
        const why = reason.trim();
        if (!why) { reasonRef.current?.focus(); return; }
        setBusy(true);
        try {
            const msg = await rejectPayment(p, why);
            toast.success(msg || `Rejected · ${p.hospitalName}. They can send the payment again.`);
            const next = list[index + 1] || list[index - 1] || null;
            setPayments(ps => (ps || []).map(x => x.key === p.key ? { ...x, status: 'rejected', note: why, reviewedAt: new Date().toISOString() } : x));
            open(next && next.key !== p.key ? next : null);
            void refreshCounts();
        } catch (e) {
            toast.error(errorText(e, 'Could not reject this payment. Nothing was changed.'));
        } finally {
            setBusy(false);
        }
    };

    // Keyboard: J/K move, A approve (asks once), R reject, Esc cancels.
    const keyState = React.useRef({ shown, confirming, rejecting, busy, view });
    const actions = React.useRef({ move, doApprove, open });
    React.useEffect(() => {
        keyState.current = { shown, confirming, rejecting, busy, view };
        actions.current = { move, doApprove, open };
    });
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
            const s = keyState.current;
            const k = e.key.toLowerCase();
            if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); actions.current.move(1); }
            else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); actions.current.move(-1); }
            else if (k === 'a' && s.shown && s.view === 'waiting' && !s.busy) {
                e.preventDefault();
                if (s.confirming) void actions.current.doApprove(s.shown); else { setRejecting(false); setConfirming(true); }
            } else if (k === 'r' && s.shown && s.view === 'waiting' && !s.busy) {
                e.preventDefault(); setConfirming(false); setRejecting(true);
                window.setTimeout(() => reasonRef.current?.focus(), 0);
            } else if (e.key === 'Escape') { setConfirming(false); setRejecting(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const setProduct = (p: ProductFilter) => { setParams(p === 'all' ? {} : { product: p }, { replace: true }); open(null); };
    const customerLink = (p: Payment) => p.product === '1rad' ? `/rad-centers?q=${encodeURIComponent(p.hospitalName)}` : `/hospital/${p.hospitalId}`;

    return (
        <div className={`ap ${selected ? 'has-open' : ''}`}>
            <header className="ne-page-head">
                <div>
                    <h1>Payment approvals</h1>
                    <p>1HMS and 1Rad together. A plan starts the moment you approve its payment.</p>
                </div>
                <button type="button" className="ap-btn" onClick={reload} disabled={loading} aria-label="Refresh" title="Refresh">
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </button>
            </header>

            <div className="ap-bar">
                <div className="ne-seg" role="tablist" aria-label="Which payments">
                    {(['waiting', 'approved', 'rejected'] as View[]).map(v => (
                        <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'is-on' : ''}
                            onClick={() => { setView(v); open(null); }}>
                            {v === 'waiting' ? 'Waiting' : v === 'approved' ? 'Approved' : 'Rejected'}
                            {v === 'waiting' && counts.waiting > 0 && <span className="ne-seg-count">{counts.waiting}</span>}
                        </button>
                    ))}
                </div>
                <div className="ne-seg" role="radiogroup" aria-label="Product">
                    {(['all', '1hms', '1rad'] as ProductFilter[]).map(p => (
                        <button key={p} type="button" role="radio" aria-checked={product === p} className={product === p ? 'is-on' : ''} onClick={() => setProduct(p)}>
                            {p === 'all' ? 'All' : p === '1hms' ? '1HMS' : '1Rad'}
                        </button>
                    ))}
                </div>
                <label className="ap-search">
                    <Search size={16} aria-hidden="true" />
                    <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Customer, plan or reference" aria-label="Search payments" />
                </label>
            </div>

            {errors.length > 0 && <div className="ap-warn" role="alert">{errors.join(' ')} <button type="button" onClick={reload}>Try again</button></div>}

            <div className="ap-body">
                <section className="ap-list" aria-label="Payments">
                    {loading && !payments && <div className="ap-skel" aria-hidden="true">{[0, 1, 2].map(i => <span key={i} />)}</div>}
                    {payments && list.length === 0 && (
                        <div className="ap-empty">
                            <span className="ap-empty-ico"><Check size={20} /></span>
                            <strong>{view === 'waiting' ? 'No payments waiting' : 'Nothing here yet'}</strong>
                            <span>{view === 'waiting' ? 'New payments from customers will show up here.' : 'Try another product or clear the search.'}</span>
                        </div>
                    )}
                    {list.map(p => (
                        <button key={p.key} type="button" className={`ap-item ${shown?.key === p.key ? 'is-on' : ''}`} onClick={() => open(p)} aria-current={shown?.key === p.key ? 'true' : undefined}>
                            <span className="ap-item-top">
                                <strong>{p.hospitalName}</strong>
                                <span className="ap-item-age">{view === 'waiting' ? ago(p.submittedAt) : when(p.reviewedAt || p.submittedAt)}</span>
                            </span>
                            <span className="ap-item-sub">
                                <span className={`ap-prod ${p.product === '1rad' ? 'p-rad' : 'p-hms'}`}>{p.product === '1rad' ? '1Rad' : '1HMS'}</span>
                                {p.plan.replace(/^(1HMS|1Rad) · /, '')} · {inr(p.amount)}
                            </span>
                        </button>
                    ))}
                </section>

                {shown && (
                    <section className="ap-detail" aria-labelledby="ap-title">
                        <button type="button" className="ap-back" onClick={() => open(null)}><ArrowLeft size={16} /> All payments</button>
                        <div className="ap-detail-head">
                            <div>
                                <h2 id="ap-title">{shown.hospitalName}</h2>
                                <Link to={customerLink(shown)} className="ap-link">Open customer</Link>
                            </div>
                            <span className={`ap-status ${shown.status}`}>{STATUS_TEXT[shown.status]}</span>
                        </div>

                        <dl className="ap-facts">
                            <div><dt>Plan</dt><dd>{shown.plan}</dd></div>
                            <div><dt>Amount</dt><dd className="ap-amount">{inr(shown.amount)}</dd></div>
                            <div><dt>Paid by</dt><dd>{shown.mode || '—'}{shown.payer ? ` · ${shown.payer}` : ''}</dd></div>
                            <div><dt>Reference</dt><dd className="ap-mono">{shown.reference || '—'}</dd></div>
                            <div><dt>Sent</dt><dd>{when(shown.submittedAt)}</dd></div>
                            {shown.status !== 'waiting' && <div><dt>Decided</dt><dd>{when(shown.reviewedAt)}</dd></div>}
                        </dl>

                        {shown.extras.length > 0 && (
                            <ul className="ap-extras">{shown.extras.map(x => <li key={x}>{x}</li>)}</ul>
                        )}
                        {shown.note && shown.status !== 'waiting' && <p className="ap-note"><strong>Reason given:</strong> {shown.note}</p>}

                        {shown.status === 'waiting' && (
                            <div className="ap-actions">
                                {rejecting ? (
                                    <div className="ap-reject">
                                        <label htmlFor="ap-reason">Why are you rejecting it? The customer sees this.</label>
                                        <textarea id="ap-reason" ref={reasonRef} rows={3} value={reason} onChange={e => setReason(e.target.value)}
                                            placeholder="For example: no payment with this reference reached our account" />
                                        <div className="ap-row">
                                            <button type="button" className="ap-btn" onClick={() => { setRejecting(false); setReason(''); }} disabled={busy}>Cancel</button>
                                            <button type="button" className="ap-btn ap-danger" onClick={() => doReject(shown)} disabled={busy || !reason.trim()}>
                                                <X size={16} /> Reject payment
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="ap-row">
                                        <span className="ap-keys" aria-hidden="true"><kbd className="ne-kbd">A</kbd> approve · <kbd className="ne-kbd">R</kbd> reject · <kbd className="ne-kbd">J</kbd> <kbd className="ne-kbd">K</kbd> move</span>
                                        <button type="button" className="ap-btn ap-danger-text" onClick={() => { setConfirming(false); setRejecting(true); window.setTimeout(() => reasonRef.current?.focus(), 0); }} disabled={busy}>Reject</button>
                                        {confirming ? (
                                            <button type="button" className="ap-btn ap-go is-confirm" onClick={() => doApprove(shown)} disabled={busy} autoFocus>
                                                <Check size={16} /> {busy ? 'Approving…' : `Yes, approve ${inr(shown.amount)}`}
                                            </button>
                                        ) : (
                                            <button type="button" className="ap-btn ap-go" onClick={() => setConfirming(true)} disabled={busy}>
                                                <Check size={16} /> {list.length > 1 ? 'Approve and open next' : 'Approve'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
};

export default ApprovalsInbox;
