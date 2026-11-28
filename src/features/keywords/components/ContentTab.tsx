import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { KeywordsCan } from '../access';
import type { Brief, ContentItem, ContentKind, ContentSave, Lang, Site, Stage, TopicRow } from '../types';
import { keywordsService, keywordsError } from '../services/keywordsService';
import { adminService, type Assignee } from '../../admin/services/adminService';
import { CHECKLIST, CONTENT_LANGS, KINDS, STAGES, dueLabel, kindLabel, langLabel, n, pos, siteLabel, stageLabel } from '../keywordUtils';
import { Empty, Filter, LangTag, SiteTag } from './shared';

// Keywords → Content plan: pages, Health Wiki articles, nexeagle.com guides, social posts and WhatsApp messages planned
// from topics, by stage. Each item carries a brief (main keyword per language, outline, page, schema, writer and
// reviewing doctor) and a checklist; once published, the topic's Search Console numbers before and after are shown.

const emptyBrief = (): Brief => ({ mainKeywords: {}, checklist: {} });

export default function ContentTab({ site, can, onChanged }: { site: Site | ''; can: KeywordsCan; onChanged: () => void }) {
  const [params, setParams] = useSearchParams();
  const picked = params.get('item');
  const creating = params.get('new') === '1';
  const [kind, setKind] = useState('');
  const [stage, setStage] = useState<Stage | ''>('');
  const [items, setItems] = useState<ContentItem[] | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    keywordsService.content(site, kind)
      .then(c => { if (live) { setItems(c); setError(null); } })
      .catch(e => { if (live) setError(keywordsError(e)); });
    return () => { live = false; };
  }, [site, kind, version]);
  useEffect(() => {
    let live = true;
    keywordsService.topics(site).then(t => { if (live) setTopics(t); }).catch(() => { /* topics are optional here */ });
    return () => { live = false; };
  }, [site]);

  const go = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v == null) p.delete(k); else p.set(k, v); }
    setParams(p, { replace: true });
  };
  const changed = () => { setVersion(v => v + 1); onChanged(); };
  const counts = useMemo(() => Object.fromEntries(STAGES.map(s => [s.id, (items ?? []).filter(i => i.stage === s.id).length])), [items]);
  const shown = (items ?? []).filter(i => !stage || i.stage === stage);
  const kinds = KINDS.filter(k => !site || !k.site || k.site === site);
  const item = items?.find(i => i.contentId === picked) ?? null;

  return (
    <div className="wa-pad">
      <div className="hw-bar wa-bar wa-flush gg-wrap">
        <Filter label="Kind" value={kind} onChange={setKind} options={kinds} />
        {can.edit && <button type="button" className="hw-btn hw-btn-primary" onClick={() => go({ new: '1', item: null, topic: null })}>New content</button>}
      </div>
      <div className="kw-stages" role="group" aria-label="Stage">
        <button type="button" className={stage === '' ? 'on' : ''} aria-pressed={stage === ''} onClick={() => setStage('')}>All <b>{items?.length ?? 0}</b></button>
        {STAGES.map(s => <button key={s.id} type="button" className={stage === s.id ? 'on' : ''} aria-pressed={stage === s.id} onClick={() => setStage(s.id)}>{s.label} <b>{counts[s.id] ?? 0}</b></button>)}
      </div>
      {error && <p className="hw-err">{error}</p>}
      {!items && !error && <p className="hw-muted">Loading…</p>}
      {items && (
        <div className="gg-split kw-split kw-csplit">
          <div className="kw-cards">
            {shown.length === 0 ? <Empty>{items.length === 0 ? 'Nothing planned yet. Plan content from a topic, or with New content.' : 'Nothing at this stage.'}</Empty> : shown.map(c => (
              <button key={c.contentId} type="button" className={`kw-ccard${c.contentId === picked ? ' on' : ''}`} onClick={() => go({ item: c.contentId, new: null })} aria-pressed={c.contentId === picked}>
                <span className="wa-row kw-gap6"><span className="wa-chip">{kindLabel(c.kind)}</span><span className={`wa-st ${c.stage === 'published' ? 'wa-st-ok' : c.stage === 'review' ? 'wa-st-warn' : 'wa-st-wait'}`}>{stageLabel(c.stage)}</span>{!site && <SiteTag site={c.site} />}</span>
                <b>{c.title}</b>
                <span className="hw-muted wa-small">{[c.languages.map(langLabel).join(', '), c.ownerName ?? c.brief.writer, c.dueDate && `due ${dueLabel(c.dueDate)}`, c.topicName].filter(Boolean).join(' · ')}</span>
                {c.result && <span className="wa-small kw-res">{c.result.daysAfter} days after: {n(c.result.impressionsAfter)} showings (before {n(c.result.impressionsBefore)}), position {pos(c.result.positionAfter)} (was {pos(c.result.positionBefore)})</span>}
              </button>
            ))}
          </div>
          {(creating || item) && (
            <Editor key={creating ? `new-${params.get('topic') ?? ''}` : item!.contentId} item={creating ? null : item} site={site} topicId={params.get('topic')} topics={topics} can={can}
              onClose={() => go({ item: null, new: null, topic: null })}
              onSaved={c => { changed(); go({ item: c.contentId, new: null, topic: null }); }}
              onDeleted={() => { changed(); go({ item: null }); }} />
          )}
        </div>
      )}
      <p className="hw-muted wa-small">After publishing, the topic’s showings, clicks and position are compared for the 28 days before and after. Movement is shown as it happened; it is not proof that the content caused it.</p>
    </div>
  );
}

function Editor({ item, site, topicId, topics, can, onClose, onSaved, onDeleted }: {
  item: ContentItem | null; site: Site | ''; topicId: string | null; topics: TopicRow[]; can: KeywordsCan;
  onClose: () => void; onSaved: (c: ContentItem) => void; onDeleted: () => void;
}) {
  const topic = topics.find(t => t.topicId === (item?.topicId ?? topicId));
  const [f, setF] = useState<ContentSave>(() => item
    ? { site: item.site, topicId: item.topicId, kind: item.kind, title: item.title, stage: item.stage, languages: item.languages, brief: item.brief, ownerUserId: item.ownerUserId, dueDate: item.dueDate, url: item.url }
    : { site: topic?.site ?? (site || 'doctordekho'), topicId: topic?.topicId ?? null, kind: (topic?.site ?? site) === 'nexeagle' ? 'guide' : 'article', title: topic?.name ?? '', stage: 'idea', languages: ['en'], brief: null, ownerUserId: null, dueDate: null, url: null });
  const [people, setPeople] = useState<Assignee[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const brief = f.brief ?? emptyBrief();
  const readOnly = !can.edit;

  useEffect(() => {
    if (readOnly) return;
    let live = true;
    adminService.getAssignees().then(p => { if (live) setPeople(p); }).catch(() => { if (live) setPeople([]); });
    return () => { live = false; };
  }, [readOnly]);

  const set = (patch: Partial<ContentSave>) => setF(cur => ({ ...cur, ...patch }));
  const setBrief = (patch: Partial<Brief>) => setF(cur => ({ ...cur, brief: { ...(cur.brief ?? emptyBrief()), ...patch } }));
  const toggleLang = (l: Lang) => set({ languages: f.languages.includes(l) ? f.languages.filter(x => x !== l) : [...f.languages, l] });
  const save = async () => {
    setBusy(true);
    try { onSaved(item ? await keywordsService.updateContent(item.contentId, f) : await keywordsService.createContent(f)); setError(null); }
    catch (e) { setError(keywordsError(e)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!item) return;
    setBusy(true);
    try { await keywordsService.deleteContent(item.contentId); onDeleted(); } catch (e) { setError(keywordsError(e)); setBusy(false); }
  };
  const checks = CHECKLIST.filter(c => !c.site || c.site === f.site);

  return (
    <aside className="wa-chart-card gg-detail kw-pane kw-editor" aria-label={item ? 'Content details' : 'New content'}>
      <div className="wa-row wa-between">
        <b className="kw-ptitle">{item ? 'Content' : 'New content'}</b>
        <button type="button" className="hw-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <fieldset disabled={readOnly || busy} className="kw-fs">
        <label className="wa-field"><span>Title</span><input value={f.title} maxLength={300} onChange={e => set({ title: e.target.value })} placeholder="What the piece is called" /></label>
        <div className="gg-grid2">
          {!item && (
            <label className="wa-field"><span>Website</span>
              <select value={f.site} onChange={e => set({ site: e.target.value as Site, topicId: null })}><option value="doctordekho">Doctor Dekho</option><option value="nexeagle">nexeagle.com</option></select>
            </label>
          )}
          {item && <div className="wa-field"><span>Website</span><span>{siteLabel(item.site)}</span></div>}
          <label className="wa-field"><span>Kind</span>
            <select value={f.kind} onChange={e => set({ kind: e.target.value as ContentKind })}>{KINDS.filter(k => !k.site || k.site === f.site).map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
          </label>
          <label className="wa-field"><span>Stage</span>
            <select value={f.stage} onChange={e => set({ stage: e.target.value as Stage })}>{STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          </label>
          <label className="wa-field"><span>Topic</span>
            <select value={f.topicId ?? ''} onChange={e => set({ topicId: e.target.value || null })}>
              <option value="">No topic</option>
              {topics.filter(t => t.site === f.site).map(t => <option key={t.topicId} value={t.topicId}>{t.name}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="wa-field"><legend>Languages</legend>
          <div className="wa-row gg-wrap kw-gap6">{CONTENT_LANGS.map(l => <label key={l.id} className="gg-check wa-small"><input type="checkbox" checked={f.languages.includes(l.id)} onChange={() => toggleLang(l.id)} /> {l.label}</label>)}</div>
        </fieldset>
        {f.languages.length > 0 && (
          <div className="gg-grid2">
            {f.languages.map(l => (
              <label key={l} className="wa-field"><span>Main keyword, {langLabel(l)}</span>
                <input value={brief.mainKeywords[l] ?? ''} maxLength={200} onChange={e => setBrief({ mainKeywords: { ...brief.mainKeywords, [l]: e.target.value } })} placeholder={item || !f.topicId ? '' : 'Filled from the topic when saved'} />
              </label>
            ))}
          </div>
        )}
        <label className="wa-field"><span>Outline</span><textarea rows={6} value={brief.outline ?? ''} maxLength={8000} onChange={e => setBrief({ outline: e.target.value })} placeholder="Start from the questions people ask in the topic" /></label>
        <div className="gg-grid2">
          <label className="wa-field"><span>Page</span><input value={brief.page ?? ''} maxLength={500} onChange={e => setBrief({ page: e.target.value })} placeholder="/health/conditions/…" /></label>
          <label className="wa-field"><span>Structured data</span><input value={brief.schema ?? ''} maxLength={200} onChange={e => setBrief({ schema: e.target.value })} placeholder={f.site === 'doctordekho' ? 'MedicalWebPage, FAQPage' : 'Article, SoftwareApplication'} /></label>
          <label className="wa-field"><span>Writer</span><input value={brief.writer ?? ''} maxLength={200} onChange={e => setBrief({ writer: e.target.value })} /></label>
          <label className="wa-field"><span>{f.site === 'doctordekho' ? 'Reviewing doctor' : 'Reviewer'}</span><input value={brief.reviewer ?? ''} maxLength={200} onChange={e => setBrief({ reviewer: e.target.value })} /></label>
          {people && people.length > 0 && (
            <label className="wa-field"><span>Owner in the CMS</span>
              <select value={f.ownerUserId ?? ''} onChange={e => set({ ownerUserId: e.target.value || null })}><option value="">No one yet</option>{people.map(p => <option key={p.userId} value={p.userId}>{p.fullName}</option>)}</select>
            </label>
          )}
          <label className="wa-field"><span>Due</span><input type="date" value={f.dueDate ?? ''} onChange={e => set({ dueDate: e.target.value || null })} /></label>
        </div>
        {f.stage === 'published' && <label className="wa-field"><span>Published address</span><input value={f.url ?? ''} maxLength={500} onChange={e => set({ url: e.target.value || null })} placeholder="https://…" /></label>}
        <fieldset className="wa-field"><legend>Before publishing</legend>
          {checks.map(c => <label key={c.id} className="gg-check wa-small"><input type="checkbox" checked={!!brief.checklist[c.id]} onChange={e => setBrief({ checklist: { ...brief.checklist, [c.id]: e.target.checked } })} /> {c.label}</label>)}
        </fieldset>
      </fieldset>
      {item?.result && (
        <div>
          <h4 className="gg-h4">Since publishing ({item.result.daysAfter} days)</h4>
          <dl className="gg-mini">
            <div><dt>Showings</dt><dd>{n(item.result.impressionsAfter)}</dd><dt>before: {n(item.result.impressionsBefore)}</dt></div>
            <div><dt>Clicks</dt><dd>{n(item.result.clicksAfter)}</dd><dt>before: {n(item.result.clicksBefore)}</dt></div>
            <div><dt>Position</dt><dd>{pos(item.result.positionAfter)}</dd><dt>before: {pos(item.result.positionBefore)}</dt></div>
          </dl>
        </div>
      )}
      {item && <div className="wa-row kw-gap6">{item.languages.map(l => <LangTag key={l} lang={l} />)}</div>}
      {error && <p className="hw-err">{error}</p>}
      {can.edit && (
        <div className="wa-row gg-wrap kw-actions">
          <button type="button" className="hw-btn hw-btn-primary" disabled={busy || !f.title.trim() || f.languages.length === 0} onClick={save}>{busy ? 'Saving…' : item ? 'Save' : 'Add to the plan'}</button>
          {item && <button type="button" className="hw-btn" disabled={busy} onClick={remove}>Remove from the plan</button>}
        </div>
      )}
    </aside>
  );
}
