import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { STATUS_LABEL, type ArticleStatus, type DoctorOption, type HealthArticle } from '../types';
import StatusPill from '../components/StatusPill';
import '../healthWiki.css';

type Tab = 'ALL' | ArticleStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'IN_REVIEW', label: STATUS_LABEL.IN_REVIEW },
  { key: 'PUBLISHED', label: STATUS_LABEL.PUBLISHED },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function HealthWikiPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('ALL');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [list, docs] = await Promise.all([healthWikiService.list(), healthWikiService.listDoctors()]);
      setArticles(list);
      setDoctors(docs);
    } catch (e) {
      setFailed(true);
      toast.error(errorMessage(e, 'Could not load the articles.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const doctorName = (id: string | null) => doctors.find((d) => d.doctorId === id)?.fullName ?? null;
  const count = (t: Tab) => (t === 'ALL' ? articles.length : articles.filter((a) => a.status === t).length);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => (tab === 'ALL' || a.status === tab) && (!q || `${a.title} ${a.slug}`.toLowerCase().includes(q)));
  }, [articles, tab, query]);

  return (
    <div className="hw-page">
      <div className="hw-top">
        <div>
          <h1 className="hw-h1"><BookOpen size={24} /> Health Wiki</h1>
          <p className="hw-sub">Articles shown on Doctor Dekho once a doctor approves them.</p>
        </div>
        <button type="button" className="hw-btn hw-btn-primary" onClick={() => navigate('/health-wiki/new')}>
          <Plus size={16} /> New article
        </button>
      </div>

      <div className="hw-panel">
        <div className="hw-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
              className={`hw-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span>{count(t.key)}</span>
            </button>
          ))}
        </div>
        <div className="hw-bar">
          <Search size={15} />
          <input type="text" value={query} placeholder="Search title or slug" aria-label="Search articles" onChange={(e) => setQuery(e.target.value)} />
        </div>

        {loading ? (
          <div className="hw-empty">Loading articles…</div>
        ) : failed ? (
          <div className="hw-empty">
            <AlertTriangle size={32} />
            <b>Couldn't load the articles</b>
            <button type="button" className="hw-btn" onClick={load}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="hw-empty">
            <b>{articles.length === 0 ? 'No articles yet' : 'No articles match'}</b>
            {articles.length === 0 ? 'Use New article to write the first one.' : 'Try another tab or search.'}
          </div>
        ) : (
          <div className="hw-tbl">
            <table>
              <thead><tr><th>Article</th><th>Status</th><th>Reviewer</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.slug} tabIndex={0} onClick={() => navigate(`/health-wiki/${a.slug}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/health-wiki/${a.slug}`)}>
                    <td>
                      <div className="hw-cell">
                        {a.coverImageUrl ? <img className="hw-thumb" src={a.coverImageUrl} alt="" /> : <span className="hw-thumb" />}
                        <div><div className="hw-title">{a.title}</div><div className="hw-slug">{a.slug}</div></div>
                      </div>
                    </td>
                    <td><StatusPill status={a.status} /></td>
                    <td>{doctorName(a.reviewerDoctorId) ?? <span className="hw-muted">Not assigned</span>}</td>
                    <td>{fmtDate(a.updatedAt)}</td>
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
