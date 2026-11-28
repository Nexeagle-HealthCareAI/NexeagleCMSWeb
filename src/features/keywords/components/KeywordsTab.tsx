import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import type { KeywordsCan } from '../access';
import type { KeywordDetail, KeywordPage, KeywordQuery, Lang, Site, TopicRow } from '../types';
import { keywordsService, keywordsError } from '../services/keywordsService';
import { INTENTS, LANGS, SOURCES, intentLabel, monthLabel, n, pos, short, siteLabel } from '../keywordUtils';
import { Empty, Filter, LangTag, SiteTag, Sparkline } from './shared';

// Keywords → Keywords: every phrase, filtered by language, intent, city and source, with 8 weeks of demand. The pane
// on the right shows where a keyword was seen, monthly searches, and the same meaning in other languages; people with
// keywords.edit correct its language or intent, move it to a topic, plan content or ignore it.

const SORTS = [
  { id: 'demand', label: 'Most demand' },
  { id: 'shown', label: 'Most shown' },
  { id: 'position', label: 'Best position' },
  { id: 'rising', label: 'Rising' },
  { id: 'newest', label: 'Newest' },
] as const;

export default function KeywordsTab({ site, can, onChanged }: { site: Site | ''; can: KeywordsCan; onChanged: () => void }) {
  const [params, setParams] = useSearchParams();
  const picked = params.get('keyword');
  const [q, setQ] = useState<KeywordQuery>({ sort: 'demand', pageSize: 100, topicId: params.get('topic') ?? undefined });
  const [text, setText] = useState('');
  const [data, setData] = useState<KeywordPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  // Typing waits a moment before asking the API.
  useEffect(() => {
    const t = setTimeout(() => setQ(cur => (cur.q === text.trim() ? cur : { ...cur, q: text.trim() || undefined, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    let live = true;
    keywordsService.list({ ...q, site })
      .then(p => { if (live) { setData(p); setError(null); } })
      .catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [q, site, version]);

  const set = (patch: Partial<KeywordQuery>) => setQ(cur => ({ ...cur, ...patch, page: 1 }));
  const open = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set('keyword', id); else p.delete('keyword'); setParams(p, { replace: true }); };
  const intents = useMemo(() => INTENTS.filter(i => !site || !i.site || i.site === site), [site]);
  const changed = () => { setVersion(v => v + 1); onChanged(); };

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush gg-wrap">
        <div className="sc-seg" role="group" aria-label="Language">
          {[{ id: '', label: 'All languages' }, ...LANGS.filter(l => l.id !== 'other')].map(l => (
            <button key={l.id || 'all'} type="button" className={(q.language ?? '') === l.id ? 'on' : ''} aria-pressed={(q.language ?? '') === l.id} onClick={() => set({ language: l.id || undefined })}>{l.label}</button>
          ))}
        </div>
        <label className="wa-search"><Search size={14} /><input type="text" value={text} onChange={e => setText(e.target.value)} placeholder="Search keywords" aria-label="Search keywords" /></label>
      </div>
      <div className="hw-bar wa-bar wa-flush gg-wrap kw-filters">
        <Filter label="Intent" value={q.intent ?? ''} onChange={v => set({ intent: v || undefined })} options={intents} />
        <Filter label="City" value={q.city ?? ''} onChange={v => set({ city: v || undefined })} options={(data?.cities ?? []).map(c => ({ id: c, label: c }))} all="All of India" />
        <Filter label="Source" value={q.source ?? ''} onChange={v => set({ source: v || undefined })} options={SOURCES} all="Any" />
        <Filter label="Sort" value={q.sort ?? 'demand'} onChange={v => set({ sort: (v || 'demand') as KeywordQuery['sort'] })} options={SORTS.map(s => ({ ...s }))} all="Most demand" />
        <label className="gg-check wa-small"><input type="checkbox" checked={!!q.ignored} onChange={e => set({ ignored: e.target.checked || undefined })} /> Ignored only</label>
        {q.topicId && <button type="button" className="hw-btn" onClick={() => { set({ topicId: undefined }); const p = new URLSearchParams(params); p.delete('topic'); setParams(p, { replace: true }); }}><X size={13} /> One topic only</button>}
      </div>

      {error && <p className="hw-err">{error}</p>}
      {!data && !error && <p className="hw-muted">Loading…</p>}
      {data && (
        <div className="gg-split kw-split">
          <div className="hw-tbl">
            <p className="hw-muted wa-small kw-count">{n(data.total)} keyword{data.total === 1 ? '' : 's'}{data.total > data.items.length ? `, showing the first ${n(data.items.length)}` : ''}</p>
            {data.items.length === 0 ? <Empty>{q.q ? 'No keyword matches.' : 'No keywords yet. The first collection runs at 05:30 IST, or use Run now in Setup.'}</Empty> : (
              <table>
                <thead><tr><th>Keyword</th><th>Language</th><th>Intent</th><th className="wa-num">Searches a month</th><th className="wa-num">Showed us (28 d)</th><th className="wa-num">Position</th><th>8 weeks</th></tr></thead>
                <tbody>
                  {data.items.map(k => (
                    <tr key={k.keywordId} className={k.keywordId === picked ? 'gg-on' : ''}>
                      <td>
                        <button type="button" className="gg-rowbtn kw-kw" onClick={() => open(k.keywordId)} aria-pressed={k.keywordId === picked}>{k.text}</button>
                        <div className="hw-muted wa-small">{!site && `${siteLabel(k.site)} · `}{k.topicName ?? 'No topic'}{k.city && ` · ${k.city}`}</div>
                      </td>
                      <td><LangTag lang={k.language} /></td>
                      <td className="wa-small">{intentLabel(k.intent)}</td>
                      <td className="wa-num">{short(k.avgMonthlySearches)}</td>
                      <td className="wa-num">{k.impressions > 0 ? short(k.impressions) : k.visitors > 0 ? <span title="Typed into Doctor Dekho's search">{n(k.visitors)} searches</span> : '—'}</td>
                      <td className="wa-num">{pos(k.position)}</td>
                      <td><Sparkline values={k.weeks} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {picked && <KeywordPane key={picked} id={picked} can={can} onClose={() => open(null)} onChanged={changed} />}
        </div>
      )}
      <p className="hw-muted wa-small">Language is read from the words themselves: Devanagari is Hindi, Bengali script is Bengali, and Hindi written in English letters is Hinglish. Corrections made here are kept.</p>
    </div>
  );
}

function KeywordPane({ id, can, onClose, onChanged }: { id: string; can: KeywordsCan; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const [k, setK] = useState<KeywordDetail | null>(null);
  const [topics, setTopics] = useState<TopicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    keywordsService.keyword(id).then(d => { if (live) setK(d); }).catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [id]);
  const kSite = k?.site;
  useEffect(() => {
    if (!kSite || !can.edit) return;
    let live = true;
    keywordsService.topics(kSite).then(t => { if (live) setTopics(t); }).catch(() => { if (live) setTopics([]); });
    return () => { live = false; };
  }, [kSite, can.edit]);

  const update = async (u: Parameters<typeof keywordsService.updateKeyword>[1]) => {
    setBusy(true);
    try { setK(await keywordsService.updateKeyword(id, u)); setError(null); onChanged(); } catch (e) { setError(keywordsError(e)); } finally { setBusy(false); }
  };
  const newTopic = async () => {
    if (!k) return;
    setBusy(true);
    try {
      const t = await keywordsService.createTopic({ site: k.site, name: k.text.charAt(0).toUpperCase() + k.text.slice(1), keywordIds: [k.keywordId] });
      onChanged();
      navigate(`/keywords/topics?topic=${t.topicId}`);
    } catch (e) { setError(keywordsError(e)); setBusy(false); }
  };

  const max = Math.max(1, ...(k?.months ?? []).map(m => m.v));
  return (
    <aside className="wa-chart-card gg-detail kw-pane" aria-label="Keyword details">
      <div className="wa-row wa-between">
        {k ? <b className="kw-ptitle">{k.text}</b> : <span />}
        <button type="button" className="hw-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!k && !error && <p className="hw-muted wa-small">Loading…</p>}
      {k && (
        <>
          <div className="wa-row kw-gap6"><LangTag lang={k.language} /><span className="wa-chip">{intentLabel(k.intent)}</span><SiteTag site={k.site} />{k.city && <span className="wa-chip">{k.city}</span>}{k.status === 'ignored' && <span className="wa-st wa-st-warn">Ignored</span>}</div>
          {k.months.length > 0 && (
            <div>
              <h4 className="gg-h4">Searches a month, India</h4>
              <div className="kw-months" role="img" aria-label={`Monthly searches from ${monthLabel(k.months[0].y, k.months[0].m)}: ${k.months.map(m => m.v).join(', ')}`}>
                {k.months.map(m => <div key={`${m.y}-${m.m}`} title={`${monthLabel(m.y, m.m)}: ${n(m.v)}`} style={{ height: `${Math.max(4, Math.round((m.v / max) * 100))}%` }} />)}
              </div>
              <div className="wa-row wa-between hw-muted wa-small"><span>{monthLabel(k.months[0].y, k.months[0].m)}</span><span>{monthLabel(k.months[k.months.length - 1].y, k.months[k.months.length - 1].m)}</span></div>
            </div>
          )}
          <dl className="gg-mini kw-mini">
            <div><dt>Searches a month</dt><dd>{short(k.avgMonthlySearches)}</dd></div>
            <div><dt>Our position</dt><dd>{pos(k.position)}</dd></div>
            <div><dt>Clicks (28 d)</dt><dd>{n(k.clicks)}</dd></div>
            <div><dt>Ad competition</dt><dd>{k.competition ? k.competition.charAt(0) + k.competition.slice(1).toLowerCase() : '—'}</dd></div>
            <div><dt>Top-of-page bid</dt><dd>{k.lowBid != null && k.highBid != null ? `${k.currency === 'INR' ? '₹' : `${k.currency} `}${short(k.lowBid)}–${short(k.highBid)}` : '—'}</dd></div>
            <div><dt>Site searches</dt><dd>{n(k.visitors)}</dd></div>
          </dl>
          <h4 className="gg-h4">Seen in</h4>
          {k.seenIn.length === 0 ? <p className="hw-muted wa-small">Not seen in the last 28 days.</p> : k.seenIn.map(s => <div key={s.name} className="gg-query wa-small"><b>{s.name}</b><span className="hw-muted">{s.detail}</span></div>)}
          {k.variants.length > 0 && (
            <>
              <h4 className="gg-h4">Same topic in other languages</h4>
              {k.variants.map(v => <div key={v.keywordId} className="gg-query wa-small"><span>{v.text}</span><LangTag lang={v.language} /></div>)}
            </>
          )}
          <p className="hw-muted wa-small">Topic: {k.topicId ? <Link to={`/keywords/topics?topic=${k.topicId}`}>{k.topicName}</Link> : 'none'}{k.page && <> · Page: {k.page}</>}</p>
          {can.edit && (
            <div className="kw-edit">
              <div className="gg-grid2">
                <label className="wa-field"><span>Language{k.languageByPerson && ' (corrected)'}</span>
                  <select value={k.language} disabled={busy} onChange={e => update({ language: e.target.value as Lang })}>{LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
                </label>
                <label className="wa-field"><span>Intent{k.intentByPerson && ' (corrected)'}</span>
                  <select value={k.intent} disabled={busy} onChange={e => update({ intent: e.target.value })}>{INTENTS.filter(i => !i.site || i.site === k.site).map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</select>
                </label>
              </div>
              <label className="wa-field"><span>Topic</span>
                <select value={k.topicId ?? ''} disabled={busy || topics == null} onChange={e => update(e.target.value ? { topicId: e.target.value } : { clearTopic: true })}>
                  <option value="">No topic</option>
                  {(topics ?? []).map(t => <option key={t.topicId} value={t.topicId}>{t.name}</option>)}
                </select>
              </label>
              <div className="wa-row gg-wrap kw-actions">
                {k.topicId
                  ? <Link className="hw-btn hw-btn-primary" to={`/keywords/content?new=1&topic=${k.topicId}`}>Add to content plan</Link>
                  : <button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={newTopic}>Make a topic of it</button>}
                <button type="button" className="hw-btn" disabled={busy} onClick={() => update({ status: k.status === 'ignored' ? 'active' : 'ignored' })}>{k.status === 'ignored' ? 'Keep it' : 'Ignore'}</button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
