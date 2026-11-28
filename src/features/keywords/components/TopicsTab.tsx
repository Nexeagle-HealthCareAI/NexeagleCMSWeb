import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { KeywordsCan } from '../access';
import type { Lang, Site, TopicDetail, TopicRow } from '../types';
import { keywordsService, keywordsError } from '../services/keywordsService';
import { OPPORTUNITIES, LANGS, kindLabel, n, pos, short, siteLabel, stageLabel } from '../keywordUtils';
import { Empty, LangTag, OppTag, SiteTag } from './shared';

// Keywords → Topics: keywords that mean the same thing (one page should answer them), with demand per language, our
// page and position, why it is worth work now, and a 0–100 priority. Suggested topics follow the page Search Console
// shows for them; people can rename, point at another page, merge, and plan content.

const KINDS = Object.entries(OPPORTUNITIES).map(([id, o]) => ({ id, label: o.label }));

export default function TopicsTab({ site, can, onChanged }: { site: Site | ''; can: KeywordsCan; onChanged: () => void }) {
  const [params, setParams] = useSearchParams();
  const picked = params.get('topic');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<TopicRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    keywordsService.topics(site, kind)
      .then(t => { if (live) { setRows(t); setError(null); } })
      .catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [site, kind, version]);

  const open = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set('topic', id); else p.delete('topic'); setParams(p, { replace: true }); };
  const changed = () => { setVersion(v => v + 1); onChanged(); };

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush gg-wrap">
        <div className="sc-seg" role="group" aria-label="Why now">
          {[{ id: '', label: 'All' }, ...KINDS].map(k => <button key={k.id || 'all'} type="button" className={kind === k.id ? 'on' : ''} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
        </div>
        {can.edit && <button type="button" className="hw-btn" onClick={() => setAdding(true)}>New topic</button>}
      </div>
      {adding && <NewTopic site={site} onClose={() => setAdding(false)} onMade={id => { setAdding(false); changed(); open(id); }} />}
      {error && <p className="hw-err">{error}</p>}
      {!rows && !error && <p className="hw-muted">Loading…</p>}
      {rows && (
        <div className="gg-split kw-split">
          <div className="hw-tbl">
            {rows.length === 0 ? <Empty>{kind ? 'No topic has this reason right now.' : 'No topics yet. They are suggested from the pages Search Console shows for each keyword.'}</Empty> : (
              <table>
                <thead><tr><th>Topic</th><th>Searches a month by language</th><th>Our page</th><th>Why now</th><th className="wa-num">Priority</th></tr></thead>
                <tbody>
                  {rows.map(t => (
                    <tr key={t.topicId} className={t.topicId === picked ? 'gg-on' : ''}>
                      <td>
                        <button type="button" className="gg-rowbtn" onClick={() => open(t.topicId)} aria-pressed={t.topicId === picked}>{t.name}</button>
                        <div className="hw-muted wa-small">{!site && `${siteLabel(t.site)} · `}{n(t.keywordCount)} keywords{t.isSuggested && ' · suggested'}</div>
                      </td>
                      <td><Demand demand={t.demand} /></td>
                      <td className="wa-small">{t.targetPage ? <><span className="kw-path">{t.targetPage}</span><div className="hw-muted">position {pos(t.position)}</div></> : <span className="hw-muted">No page yet</span>}</td>
                      <td>{t.reason ? <OppTag kind={t.reason} /> : <span className="hw-muted wa-small">—</span>}</td>
                      <td className="wa-num"><b>{t.score}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {picked && <TopicPane key={`${picked}-${version}`} id={picked} can={can} others={rows} onClose={() => open(null)} onChanged={changed} onMoved={open} />}
        </div>
      )}
      <p className="hw-muted wa-small">Priority weighs demand, whether we can serve it (doctors in that city and specialty, or a NexEagle module), how close we are to page one, and what such searches bring in bookings or demo requests. The weights are in Setup.</p>
    </div>
  );
}

const ORDER: Lang[] = ['en', 'hg', 'hi', 'bn', 'other'];
function Demand({ demand }: { demand: TopicRow['demand'] }) {
  const parts = ORDER.filter(l => (demand[l] ?? 0) > 0);
  if (parts.length === 0) return <span className="hw-muted wa-small">—</span>;
  return <div className="wa-row gg-wrap kw-gap6">{parts.map(l => <span key={l} className="kw-dem"><LangTag lang={l} /> {short(demand[l])}</span>)}</div>;
}

function NewTopic({ site, onClose, onMade }: { site: Site | ''; onClose: () => void; onMade: (id: string) => void }) {
  const [s, setS] = useState<Site>(site || 'doctordekho');
  const [name, setName] = useState('');
  const [page, setPage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { onMade((await keywordsService.createTopic({ site: s, name, targetPage: page.trim() || null })).topicId); } catch (e) { setError(keywordsError(e)); setBusy(false); }
  };
  return (
    <section className="wa-chart-card kw-form" aria-label="New topic">
      <div className="gg-grid3">
        <label className="wa-field"><span>Website</span><select value={s} onChange={e => setS(e.target.value as Site)}><option value="doctordekho">Doctor Dekho</option><option value="nexeagle">nexeagle.com</option></select></label>
        <label className="wa-field"><span>Name</span><input value={name} maxLength={200} onChange={e => setName(e.target.value)} placeholder="Typhoid" /></label>
        <label className="wa-field"><span>Our page (optional)</span><input value={page} maxLength={500} onChange={e => setPage(e.target.value)} placeholder="/health/conditions/typhoid" /></label>
      </div>
      {error && <p className="hw-err">{error}</p>}
      <div className="wa-row kw-actions"><button type="button" className="hw-btn hw-btn-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Make the topic'}</button><button type="button" className="hw-btn" onClick={onClose}>Cancel</button></div>
    </section>
  );
}

function TopicPane({ id, can, others, onClose, onChanged, onMoved }: { id: string; can: KeywordsCan; others: TopicRow[]; onClose: () => void; onChanged: () => void; onMoved: (id: string) => void }) {
  const [t, setT] = useState<TopicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [page, setPage] = useState('');
  const [notes, setNotes] = useState('');
  const [into, setInto] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    keywordsService.topic(id).then(d => { if (live) setT(d); }).catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [id]);

  const edit = () => { if (!t) return; setName(t.name); setPage(t.targetPage ?? ''); setNotes(t.notes ?? ''); setEditing(true); };
  const save = async () => {
    if (!t) return;
    setBusy(true);
    try { setT(await keywordsService.updateTopic(id, { site: t.site, name, targetPage: page.trim() || null, notes: notes.trim() || null })); setEditing(false); setError(null); onChanged(); }
    catch (e) { setError(keywordsError(e)); } finally { setBusy(false); }
  };
  const merge = async () => {
    if (!into) return;
    setBusy(true);
    try { await keywordsService.mergeTopic(id, into); onChanged(); onMoved(into); } catch (e) { setError(keywordsError(e)); setBusy(false); }
  };

  const total = t ? Object.values(t.demand).reduce((s, v) => s + (v ?? 0), 0) : 0;
  return (
    <aside className="wa-chart-card gg-detail kw-pane" aria-label="Topic details">
      <div className="wa-row wa-between">
        {t ? <b className="kw-ptitle">{t.name}</b> : <span />}
        <button type="button" className="hw-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!t && !error && <p className="hw-muted wa-small">Loading…</p>}
      {t && (
        <>
          <div className="wa-row kw-gap6"><SiteTag site={t.site} /><span className="hw-muted wa-small">priority {t.score} of 100</span>{t.reason && <OppTag kind={t.reason} />}</div>
          {t.why && <p className="wa-small kw-why">{t.why}</p>}
          <dl className="gg-mini">
            <div><dt>Searches a month</dt><dd>{short(total)}</dd></div>
            <div><dt>Showed us (28 d)</dt><dd>{short(t.impressions)}</dd></div>
            <div><dt>Position</dt><dd>{pos(t.position)}</dd></div>
          </dl>
          <h4 className="gg-h4">Demand by language</h4>
          <div className="kw-langbars">
            {LANGS.filter(l => (t.demand[l.id] ?? 0) > 0).map(l => (
              <div key={l.id} className="kw-langbar"><LangTag lang={l.id} /><div className="gg-share"><div style={{ width: `${Math.round(((t.demand[l.id] ?? 0) * 100) / Math.max(1, total))}%` }} /></div><span className="wa-small">{short(t.demand[l.id])}</span></div>
            ))}
          </div>
          <h4 className="gg-h4">Keywords in this topic</h4>
          {t.keywords.length === 0 ? <p className="hw-muted wa-small">None yet.</p> : t.keywords.slice(0, 10).map(k => (
            <div key={k.keywordId} className="gg-query wa-small"><Link to={`/keywords/keywords?keyword=${k.keywordId}`}>{k.text}</Link><span className="hw-muted">{short(k.avgMonthlySearches ?? k.impressions)}</span></div>
          ))}
          {t.keywordCount > 10 && <Link to={`/keywords/keywords?topic=${t.topicId}`} className="wa-small">All {n(t.keywordCount)} keywords</Link>}
          {t.questions.length > 0 && (
            <>
              <h4 className="gg-h4">Questions people ask</h4>
              <ul className="gg-notes wa-small">{t.questions.map(q => <li key={q}>{q}</li>)}</ul>
            </>
          )}
          <h4 className="gg-h4">Content</h4>
          {t.content.length === 0 ? <p className="hw-muted wa-small">Nothing planned yet.</p> : t.content.map(c => (
            <div key={c.contentId} className="gg-query wa-small"><Link to={`/keywords/content?item=${c.contentId}`}>{c.title}</Link><span className="hw-muted">{kindLabel(c.kind)} · {stageLabel(c.stage)}</span></div>
          ))}
          <p className="hw-muted wa-small">Page: {t.targetPage ?? 'none yet'}{t.isSuggested && ' (suggested from Search Console)'}{t.notes && <><br />{t.notes}</>}</p>
          {can.edit && !editing && (
            <div className="wa-row gg-wrap kw-actions">
              <Link className="hw-btn hw-btn-primary" to={`/keywords/content?new=1&topic=${t.topicId}`}>Plan content</Link>
              <button type="button" className="hw-btn" onClick={edit}>Edit</button>
            </div>
          )}
          {can.edit && editing && (
            <div className="kw-edit">
              <label className="wa-field"><span>Name</span><input value={name} maxLength={200} onChange={e => setName(e.target.value)} /></label>
              <label className="wa-field"><span>Our page</span><input value={page} maxLength={500} onChange={e => setPage(e.target.value)} placeholder="/health/conditions/…" /></label>
              <label className="wa-field"><span>Notes</span><textarea rows={3} value={notes} maxLength={2000} onChange={e => setNotes(e.target.value)} /></label>
              <div className="wa-row kw-actions"><button type="button" className="hw-btn hw-btn-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="hw-btn" onClick={() => setEditing(false)}>Cancel</button></div>
              <label className="wa-field"><span>Merge into another topic</span>
                <select value={into} onChange={e => setInto(e.target.value)}>
                  <option value="">Choose a topic…</option>
                  {others.filter(o => o.site === t.site && o.topicId !== t.topicId).map(o => <option key={o.topicId} value={o.topicId}>{o.name}</option>)}
                </select>
              </label>
              {into && <div className="wa-row kw-actions"><button type="button" className="hw-btn" disabled={busy} onClick={merge}>Move its keywords and content there</button></div>}
            </div>
          )}
        </>
      )}
    </aside>
  );
}
