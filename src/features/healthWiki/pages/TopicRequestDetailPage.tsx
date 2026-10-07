import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { CONTRIBUTOR_TYPE_LABEL, TOPIC_OPEN, type Contributor, type TopicRequest } from '../types';
import { TopicStatusPill, TypePill } from '../components/StatusPill';
import { refreshNavCounts } from '../components/navEvents';
import '../healthWiki.css';

type Mode = null | 'DECLINE' | 'ASK_DETAIL';

export default function TopicRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<TopicRequest | null>(null);
  const [person, setPerson] = useState<Contributor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [textError, setTextError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [t, people] = await Promise.all([healthWikiService.getTopicRequest(id!), healthWikiService.listContributors()]);
        if (!alive) return;
        setTopic(t);
        setPerson(people.find((p) => p.contributorId === t.contributorId) ?? null);
      } catch (e) {
        if (alive) setError(errorMessage(e, 'Could not load this topic request.'));
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const decide = async (d: Parameters<typeof healthWikiService.decideTopicRequest>[1], done: string) => {
    setBusy(true);
    try {
      setTopic(await healthWikiService.decideTopicRequest(id!, d));
      setMode(null);
      setText('');
      refreshNavCounts();
      toast.success(done);
    } catch (e) {
      toast.error(errorMessage(e, 'Could not save the decision. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const submitText = () => {
    if (text.trim().length < 5) {
      setTextError(mode === 'DECLINE' ? 'Add a reason so the contributor knows why.' : 'Say what detail you need.');
      return;
    }
    setTextError('');
    if (mode === 'DECLINE') decide({ action: 'DECLINE', reason: text.trim() }, 'Declined. The contributor is told why.');
    else decide({ action: 'ASK_DETAIL', message: text.trim() }, 'Asked for more detail.');
  };

  if (error) {
    return (
      <div className="hw-page">
        <div className="hw-empty">
          <b>{error}</b>
          <button type="button" className="hw-btn" onClick={() => navigate('/health-wiki/topics')}>Back to topic requests</button>
        </div>
      </div>
    );
  }
  if (!topic) return <div className="hw-page"><div className="hw-empty">Loading…</div></div>;

  const open = TOPIC_OPEN.includes(topic.status);

  return (
    <div className="hw-page">
      <button type="button" className="hw-crumb" onClick={() => navigate('/health-wiki/topics')}><ArrowLeft size={14} /> Topic requests</button>
      <div className="hw-top">
        <div>
          <h1 className="hw-h1">{topic.title}</h1>
          <p className="hw-sub">Suggested by {person?.fullName ?? 'a contributor'} on {new Date(topic.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <div className="hw-row"><TypePill type={topic.type} /><TopicStatusPill status={topic.status} /></div>
      </div>

      <div className="hw-grid">
        <div className="hw-panel hw-card">
          <div className="hw-field"><span className="hw-label">What they want to write</span><p className="hw-text">{topic.outline}</p></div>
          <div className="hw-field"><span className="hw-label">Why it matters</span><p className="hw-text">{topic.whyItMatters}</p></div>
          {topic.conditionSlug && <div className="hw-field"><span className="hw-label">Related condition</span><p className="hw-text">{topic.conditionSlug.replace(/-/g, ' ')}</p></div>}
          <div className="hw-field"><span className="hw-label">References</span><p className="hw-text">{topic.references || <span className="hw-muted">None given</span>}</p></div>
        </div>

        <div className="hw-panel hw-card">
          <div className="hw-field">
            <span className="hw-label">Contributor</span>
            {person ? (
              <div className="hw-text"><b>{person.fullName}</b>{person.type === 'INDEPENDENT_DOCTOR' && <span className="hw-tag">Independent</span>}
                <div className="hw-muted">{CONTRIBUTOR_TYPE_LABEL[person.type]}{person.organisation ? `, ${person.organisation}` : ''}</div></div>
            ) : <span className="hw-muted">Not found</span>}
          </div>

          {topic.decisionReason && topic.status !== 'SUBMITTED' && (
            <div className={`hw-banner ${topic.status === 'DECLINED' ? 'warn' : 'info'}`}>
              <b>{topic.status === 'DECLINED' ? 'Declined:' : topic.status === 'NEEDS_DETAIL' ? 'Asked:' : 'Note:'}</b> {topic.decisionReason}
            </div>
          )}
          {topic.status === 'NEEDS_DETAIL' && <p className="hw-sub">Waiting for the contributor to add detail. It comes back here as Submitted.</p>}
          {topic.articleSlug && (
            <div className="hw-banner ok">Draft created and assigned to the contributor. <Link to={`/health-wiki/${topic.articleSlug}`}>Open the draft</Link></div>
          )}

          {open && mode === null && (
            <div className="hw-actions">
              <button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={() => decide({ action: 'ACCEPT' }, 'Accepted. A draft was created and the contributor is told.')}>Accept and create draft</button>
              <button type="button" className="hw-btn" disabled={busy} onClick={() => { setMode('ASK_DETAIL'); setText(''); setTextError(''); }}>Ask for more detail</button>
              <button type="button" className="hw-btn" disabled={busy} onClick={() => { setMode('DECLINE'); setText(''); setTextError(''); }}>Decline</button>
            </div>
          )}
          {open && mode !== null && (
            <div className="hw-decision">
              <div className="hw-field">
                <label className="hw-label" htmlFor="topic-text">{mode === 'DECLINE' ? 'Reason for declining' : 'What detail do you need?'}</label>
                <textarea id="topic-text" value={text} autoFocus placeholder={mode === 'DECLINE' ? 'Shown to the contributor' : 'For example: which age group, and which sources?'} onChange={(e) => setText(e.target.value)} />
                {textError && <span className="hw-err">{textError}</span>}
              </div>
              <div className="hw-row">
                <button type="button" className="hw-btn hw-btn-primary" disabled={busy} onClick={submitText}>{mode === 'DECLINE' ? 'Decline' : 'Send request'}</button>
                <button type="button" className="hw-btn" onClick={() => setMode(null)}>Cancel</button>
              </div>
            </div>
          )}
          {!open && !topic.articleSlug && topic.status !== 'NEEDS_DETAIL' && <p className="hw-sub">This request is final.</p>}
        </div>
      </div>
    </div>
  );
}
