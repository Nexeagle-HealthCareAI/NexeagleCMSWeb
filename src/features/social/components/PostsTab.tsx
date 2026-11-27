import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, Plus, RefreshCw } from 'lucide-react';
import type { SocialCan } from '../access';
import { socialService, socialError } from '../services/socialService';
import type { Channel, SocialAccount, SocialPostDetail, SocialPostPage, SocialPostQuery } from '../types';
import { ago, change, channelName, day, n, pct, when } from '../socialUtils';
import { Bars, ChannelTag } from './shared';
import CommentCard from './CommentCard';

// Social → Posts: every post on the Page and the Instagram account (also those made outside the CMS) with
// Meta's numbers; pick one to see its first days, its comments, and answer them.

const PERIODS = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'year', label: 'This year', days: 0 },
  { id: 'all', label: 'All time', days: -1 },
];
const TYPES = ['Photo', 'Video', 'Reel', 'Carousel', 'Story', 'Link', 'Text'];

const since = (period: string): string | undefined => {
  const p = PERIODS.find(x => x.id === period)!;
  if (p.days < 0) return undefined;
  const t = p.days === 0 ? new Date(new Date().getFullYear(), 0, 1) : new Date(Date.now() - p.days * 86_400_000);
  return t.toISOString();
};

export default function PostsTab({ account, can }: { account: SocialAccount; can: SocialCan }) {
  const [channel, setChannel] = useState<Channel | ''>('');
  const [type, setType] = useState('');
  const [period, setPeriod] = useState('30');
  const [sort, setSort] = useState<SocialPostQuery['sort']>('newest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<SocialPostPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [more, setMore] = useState(1);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      socialService.posts({ accountId: account.accountId, channel: channel || undefined, type: type || undefined, from: since(period), search: search.trim() || undefined, sort, page: 1, pageSize: 50 * more })
        .then(p => { if (!live) return; setPage(p); setError(null); setPicked(cur => (cur && p.items.some(i => i.postId === cur) ? cur : p.items[0]?.postId ?? null)); })
        .catch(e => { if (live) setError(socialError(e)); });
    }, search ? 300 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [account.accountId, channel, type, period, search, sort, more]);

  const s = page?.summary;
  const periodLabel = PERIODS.find(p => p.id === period)!.label.toLowerCase();
  const viewsChange = s ? change(s.views, s.previousViews) : null;

  return (
    <div className="wa-pad">
      {s && (
        <div className="wa-tiles">
          <div className="wa-tile"><span>Posts, {periodLabel}</span><b>{s.posts}</b><span>{s.facebookPosts} Facebook · {s.instagramPosts} Instagram</span></div>
          <div className="wa-tile"><span>Views</span><b>{n(s.views)}</b><span>{viewsChange == null ? 'No earlier period to compare' : `${viewsChange >= 0 ? '+' : ''}${viewsChange}% on the period before`}</span></div>
          <div className="wa-tile"><span>Likes, comments, shares, saves</span><b>{s.interactions.toLocaleString('en-IN')}</b><span>{pct(s.interactions, s.views)} of views</span></div>
          <div className="wa-tile">
            <span>New followers</span>
            <b>{s.newFacebookFollowers == null && s.newInstagramFollowers == null ? '—' : `+${(s.newFacebookFollowers ?? 0) + (s.newInstagramFollowers ?? 0)}`}</b>
            <span>Facebook {s.newFacebookFollowers == null ? '—' : `+${s.newFacebookFollowers}`} · Instagram {s.newInstagramFollowers == null ? '—' : `+${s.newInstagramFollowers}`}</span>
          </div>
        </div>
      )}

      <div className="hw-bar wa-bar wa-flush">
        <div className="sc-seg" role="group" aria-label="Channel">
          {(['', 'facebook', 'instagram'] as const).map(c => (
            <button key={c || 'all'} type="button" className={channel === c ? 'on' : ''} aria-pressed={channel === c} onClick={() => setChannel(c)}>{c ? channelName(c) : 'All'}</button>
          ))}
        </div>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Type">
          <option value="">All types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={period} onChange={e => setPeriod(e.target.value)} aria-label="Period">
          {PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as SocialPostQuery['sort'])} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="views">Most views</option>
          <option value="interactions">Most interactions</option>
        </select>
        <input type="text" placeholder="Search captions" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search captions" />
        <span className="wa-grow" />
        {can.compose && <Link to="/social/compose" className="hw-btn hw-btn-primary"><Plus size={14} /> New post</Link>}
      </div>

      {error && <p className="hw-err">{error}</p>}
      {!page && !error && <p className="hw-muted">Loading…</p>}
      {page && page.items.length === 0 && (
        <div className="hw-empty">
          <p>No posts {period === 'all' ? 'yet' : `in the ${periodLabel}`}.</p>
          {account.connected && <SyncButton accountId={account.accountId} can={can} />}
        </div>
      )}
      {page && page.items.length > 0 && (
        <div className="sc-split">
          <div className="sc-split-main">
            <div className="hw-tbl">
              <table className="sc-posts">
                <thead>
                  <tr><th>Post</th><th>Published</th><th className="wa-num">Views</th><th className="wa-num">Likes</th><th className="wa-num">Comments</th><th className="wa-num">Shares</th><th className="wa-num">Saves</th></tr>
                </thead>
                <tbody>
                  {page.items.map(p => (
                    <tr key={p.postId} className={picked === p.postId ? 'on' : ''} onClick={() => setPicked(p.postId)}>
                      <td>
                        <button type="button" className="sc-post-cell" onClick={() => setPicked(p.postId)} aria-label={`Open ${p.type}: ${p.caption ?? ''}`}>
                          {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className="sc-thumb" loading="lazy" referrerPolicy="no-referrer" /> : <span className="sc-thumb sc-ph">{p.type}</span>}
                          <span className="sc-post-text">
                            <span className="sc-cap">{p.caption || <i className="hw-muted">No caption</i>}</span>
                            <span className="sc-post-meta"><ChannelTag channel={p.channel} /> {p.type} · {p.fromCms ? `From the CMS${p.publishedBy ? ` by ${p.publishedBy}` : ''}` : 'Posted outside the CMS'}</span>
                          </span>
                        </button>
                      </td>
                      <td className="sc-nowrap" title={when(p.publishedAt)}>{day(p.publishedAt)}</td>
                      <td className="wa-num">{n(p.views)}</td>
                      <td className="wa-num">{n(p.likes)}</td>
                      <td className="wa-num">{n(p.comments)}</td>
                      <td className="wa-num">{n(p.shares)}</td>
                      <td className="wa-num">{n(p.saves)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.total > page.items.length && <button type="button" className="hw-btn sc-more" onClick={() => setMore(m => m + 1)}>Show more ({page.total - page.items.length} left)</button>}
            <p className="hw-muted wa-small">
              Includes posts made outside the CMS. Numbers come from Meta and refresh every few hours{page.syncedAt ? ` (last read ${ago(page.syncedAt)} ago)` : ''}; “—” means Meta gives no figure for that kind of post.
            </p>
          </div>
          {picked && <PostPanel key={picked} postId={picked} can={can} />}
        </div>
      )}
    </div>
  );
}

function SyncButton({ accountId, can }: { accountId: string; can: SocialCan }) {
  const [busy, setBusy] = useState(false);
  if (!can.connect) return <p className="hw-muted wa-small">Posts are read from Meta every few hours.</p>;
  return (
    <button type="button" className="hw-btn" disabled={busy} onClick={async () => {
      setBusy(true);
      try { const r = await socialService.sync(accountId, true); toast.success(r.message ?? 'Reading from Meta now.'); } catch (e) { toast.error(socialError(e)); } finally { setBusy(false); }
    }}><RefreshCw size={13} /> Read all posts from Meta now</button>
  );
}

function PostPanel({ postId, can }: { postId: string; can: SocialCan }) {
  const [d, setD] = useState<SocialPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    socialService.post(postId).then(x => { if (live) setD(x); }).catch(e => { if (live) setError(socialError(e)); });
    return () => { live = false; };
  }, [postId]);

  const bars = useMemo(() => (d?.days ?? []).map(x => ({ key: x.day, label: day(x.day), value: x.views ?? 0 })), [d]);
  if (error) return <aside className="sc-panel"><p className="hw-err">{error}</p></aside>;
  if (!d) return <aside className="sc-panel"><p className="hw-muted">Loading…</p></aside>;
  const p = d.post;
  const stats: [string, number | null | undefined][] = [['Views', p.views], ['Reach', p.reach], ['Likes', p.likes], ['Comments', p.comments], ['Shares', p.shares], ['Saves', p.saves]];
  if (p.clicks != null) stats.push(['Link clicks', p.clicks]);
  const top = d.comments.filter(c => !c.parentMetaId);

  return (
    <aside className="sc-panel" aria-label="Post">
      <div className="wa-row wa-between">
        <span><ChannelTag channel={p.channel} /> <span className="hw-muted wa-small">{p.type}</span></span>
        {p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="wa-link">Open on {channelName(p.channel)} <ExternalLink size={12} /></a>}
      </div>
      {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="sc-preview-img" referrerPolicy="no-referrer" />}
      <p className="sc-caption">{p.caption}</p>
      <p className="hw-muted wa-small">{when(p.publishedAt)} · {p.fromCms ? `Published from the CMS${p.publishedBy ? ` by ${p.publishedBy}` : ''}` : 'Posted outside the CMS'}</p>
      <dl className="sc-stats">
        {stats.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{n(v)}</dd></div>)}
      </dl>
      {bars.some(b => b.value > 0) && (
        <section className="sc-sub">
          <h4 className="wa-h3">Views, first {bars.length} days</h4>
          <Bars items={bars} label="Views per day" format={v => `${v.toLocaleString('en-IN')} views`} />
        </section>
      )}
      <section className="sc-sub">
        <div className="wa-row wa-between">
          <h4 className="wa-h3">Comments ({p.comments ?? top.length})</h4>
          <Link to="/social/inbox" className="wa-link">Open in Inbox</Link>
        </div>
        {top.length === 0 && <p className="hw-muted wa-small">No comments in the last 7 days. Older comments are on {channelName(p.channel)}.</p>}
        {top.map(c => <CommentCard key={c.commentId} comment={c} can={can} compact />)}
      </section>
    </aside>
  );
}
