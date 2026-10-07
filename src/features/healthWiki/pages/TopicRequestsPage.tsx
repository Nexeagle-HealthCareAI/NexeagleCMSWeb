import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { TOPIC_STATUS_LABEL, type Contributor, type TopicRequest, type TopicStatus } from '../types';
import { TopicStatusPill, TypePill } from '../components/StatusPill';
import SectionNav from '../components/SectionNav';
import '../healthWiki.css';

type Tab = 'ALL' | TopicStatus;
const TABS: Tab[] = ['ALL', 'SUBMITTED', 'NEEDS_DETAIL', 'ACCEPTED', 'ARTICLE_STARTED', 'DECLINED'];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function TopicRequestsPage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<TopicRequest[]>([]);
  const [people, setPeople] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('SUBMITTED');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [t, c] = await Promise.all([healthWikiService.listTopicRequests(), healthWikiService.listContributors()]);
      setTopics(t);
      setPeople(c);
    } catch (e) {
      setFailed(true);
      toast.error(errorMessage(e, 'Could not load the topic requests.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameOf = (id: string) => people.find((p) => p.contributorId === id)?.fullName ?? 'Unknown';
  const count = (t: Tab) => (t === 'ALL' ? topics.length : topics.filter((x) => x.status === t).length);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((t) => (tab === 'ALL' || t.status === tab) && (!q || t.title.toLowerCase().includes(q)));
  }, [topics, tab, query]);

  return (
    <div className="hw-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><Lightbulb size={24} /> Health Wiki</h1>
          <p className="hw-sub">Topics suggested by contributors. Accept one to create a draft assigned to them.</p>
        </div>
      </div>
      <SectionNav />

      <div className="hw-panel">
        <div className="hw-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`hw-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
              {t === 'ALL' ? 'All' : TOPIC_STATUS_LABEL[t]}<span>{count(t)}</span>
            </button>
          ))}
        </div>
        <div className="hw-bar hw-filters">
          <Search size={15} />
          <input type="text" value={query} placeholder="Search topic" aria-label="Search topics" onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="hw-empty">Loading topic requests…</div>
        ) : failed ? (
          <div className="hw-empty">
            <AlertTriangle size={32} />
            <b>Couldn't load the topic requests</b>
            <button type="button" className="hw-btn" onClick={load}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="hw-empty">
            <b>{topics.length === 0 ? 'No topic requests yet' : 'Nothing here'}</b>
            {topics.length === 0 ? 'Contributors suggest topics from their page. They will show up here.' : 'Try another tab or search.'}
          </div>
        ) : (
          <div className="hw-tbl">
            <table>
              <thead><tr><th>Topic</th><th>Type</th><th>From</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.topicId} tabIndex={0} onClick={() => navigate(`/health-wiki/topics/${t.topicId}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/health-wiki/topics/${t.topicId}`)}>
                    <td><div className="hw-title">{t.title}</div><div className="hw-slug">{t.outline.slice(0, 80)}{t.outline.length > 80 ? '…' : ''}</div></td>
                    <td><TypePill type={t.type} /></td>
                    <td>{nameOf(t.contributorId)}</td>
                    <td><TopicStatusPill status={t.status} /></td>
                    <td>{fmtDate(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
