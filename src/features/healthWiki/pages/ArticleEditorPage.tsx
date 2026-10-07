import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import {
  CONDITION_OPTIONS, SLUG_PATTERN, TYPE_LABEL, isDoctor,
  type ArticlePayload, type ArticleStatus, type ArticleType, type Contributor, type HealthArticle,
} from '../types';
import StatusPill from '../components/StatusPill';
import TiptapEditor from '../components/TiptapEditor';
import CoverImageField from '../components/CoverImageField';
import ContributorPicker from '../components/ContributorPicker';
import ArticlePagePreview from '../components/ArticlePagePreview';
import SendLinkRow from '../components/SendLinkRow';
import '../healthWiki.css';

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200);

interface Errors { title?: string; slug?: string; content?: string; cover?: string; author?: string; reviewer?: string }

export default function ArticleEditorPage() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const isNew = !routeSlug;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [people, setPeople] = useState<Contributor[]>([]);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [mobile, setMobile] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const [status, setStatus] = useState<ArticleStatus>('DRAFT');
  const [type, setType] = useState<ArticleType>('MEDICAL');
  const [reviewerComment, setReviewerComment] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [initialMd, setInitialMd] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [condition, setCondition] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverAlt, setCoverAlt] = useState('');
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [list, article] = await Promise.all([
          healthWikiService.listContributors(),
          isNew ? Promise.resolve<HealthArticle | null>(null) : healthWikiService.get(routeSlug!),
        ]);
        if (!alive) return;
        setPeople(list);
        if (article) {
          setStatus(article.status);
          setType(article.type);
          setReviewerComment(article.reviewerComment ?? null);
          setSlug(article.slug);
          setTitle(article.title);
          setDescription(article.description ?? '');
          setInitialMd(article.content);
          setContentMd(article.content);
          setCondition(article.relatedConditionSlug);
          setCoverUrl(article.coverImageUrl);
          setCoverAlt(article.coverImageAlt ?? '');
          setAuthorId(article.authorContributorId);
          setReviewerId(article.reviewerContributorId);
        }
      } catch (e) {
        if (alive) setLoadError(errorMessage(e, 'Could not load this article.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isNew, routeSlug, version]);

  const locked = status !== 'DRAFT';
  const medical = type === 'MEDICAL';
  const author = people.find((p) => p.contributorId === authorId) ?? null;
  const reviewer = people.find((p) => p.contributorId === reviewerId) ?? null;
  const authorOptions = people.filter((p) => p.status === 'VERIFIED' || p.contributorId === authorId);
  const reviewerOptions = people.filter((p) => isDoctor(p.type) && p.contributorId !== authorId && (p.status === 'VERIFIED' || p.contributorId === reviewerId));
  const replacePerson = (c: Contributor) => setPeople((l) => l.map((p) => (p.contributorId === c.contributorId ? c : p)));

  const onTitle = (v: string) => {
    setTitle(v);
    if (isNew && !slugTouched) setSlug(slugify(v));
  };

  const onType = (t: ArticleType) => {
    setType(t);
    if (t === 'SECTOR_UPDATE') {
      setReviewerId(null);
      setCondition(null);
    }
  };

  const validate = (submit: boolean): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (isNew && !SLUG_PATTERN.test(slug)) e.slug = 'Use lowercase letters, numbers and single hyphens.';
    if (!contentMd.trim()) e.content = 'Content cannot be empty.';
    if (coverUrl && !coverAlt.trim()) e.cover = 'Add alt text for the cover image.';
    if (medical && author?.type === 'WRITER') e.author = 'A writer can only write Sector updates.';
    if (submit && !authorId) e.author = 'Pick an author to submit.';
    if (submit && medical && !reviewerId) e.reviewer = 'Pick a reviewer to submit.';
    return e;
  };

  const save = async (submit: boolean) => {
    const e = validate(submit);
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload: ArticlePayload = {
      slug: isNew ? slug : undefined,
      type,
      title: title.trim(),
      description: description.trim(),
      content: contentMd,
      relatedConditionSlug: medical ? condition : null,
      coverImageUrl: coverUrl,
      coverImageAlt: coverUrl ? coverAlt.trim() : null,
      authorContributorId: authorId,
      reviewerContributorId: medical ? reviewerId : null,
      status: submit ? 'IN_REVIEW' : 'DRAFT',
    };
    setSaving(true);
    try {
      const saved = isNew ? await healthWikiService.create(payload) : await healthWikiService.update(routeSlug!, payload);
      toast.success(submit ? (medical ? `Sent to ${reviewer?.fullName ?? 'the reviewer'} for review` : 'Sent for editor approval') : 'Draft saved');
      if (isNew) navigate(`/health-wiki/${saved.slug}`, { replace: true });
      else {
        setStatus(saved.status);
        setReviewerComment(null);
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the article.'));
    } finally {
      setSaving(false);
    }
  };

  const approve = async () => {
    setSaving(true);
    try {
      await healthWikiService.approveArticle(routeSlug!);
      toast.success('Published on Doctor Dekho');
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not approve the article.'));
    } finally {
      setSaving(false);
    }
  };

  const returnToDraft = async () => {
    if (reason.trim().length < 3) {
      setReasonError('Add a reason. It is kept in the audit trail and shown to the author.');
      return;
    }
    setReasonError('');
    setSaving(true);
    try {
      await healthWikiService.returnToDraft(routeSlug!, reason.trim());
      toast.success(status === 'PUBLISHED' ? 'Taken down and returned to draft' : 'Returned to draft');
      setReason('');
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change the status.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="hw-page"><div className="hw-empty">Loading…</div></div>;
  if (loadError) {
    return (
      <div className="hw-page">
        <div className="hw-empty">
          <b>{loadError}</b>
          <button type="button" className="hw-btn" onClick={() => navigate('/health-wiki')}>Back to Health Wiki</button>
        </div>
      </div>
    );
  }

  const waitingOn = medical ? (reviewer?.fullName ?? 'the reviewer') : 'a CMS editor';
  const independent = [author, medical ? reviewer : null].filter((p): p is Contributor => !!p && p.type === 'INDEPENDENT_DOCTOR');
  const sendRows = independent.filter((p, i, l) => l.findIndex((x) => x.contributorId === p.contributorId) === i);

  return (
    <div className="hw-page">
      <button type="button" className="hw-crumb" onClick={() => navigate('/health-wiki')}><ArrowLeft size={14} /> Health Wiki</button>
      <div className="hw-top">
        <div>
          <h1 className="hw-h1">{isNew ? 'New article' : title || 'Untitled'}</h1>
          <p className="hw-sub">{isNew ? 'Saved only in the CMS until you submit it.' : `/health/conditions/${slug}`}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="hw-seg" role="tablist" aria-label="Editor view">
        <button type="button" role="tab" aria-selected={view === 'edit'} className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Edit</button>
        <button type="button" role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Page preview</button>
      </div>

      {view === 'edit' && status === 'IN_REVIEW' && <div className="hw-banner info">Waiting for {waitingOn} to {medical ? 'review in EasyHMS' : 'approve'}. Editing is locked until a decision.</div>}
      {view === 'edit' && status === 'PUBLISHED' && <div className="hw-banner ok">Published and visible on Doctor Dekho. Content is read-only here.</div>}
      {view === 'edit' && status === 'DRAFT' && reviewerComment && <div className="hw-banner warn"><b>Comment:</b> {reviewerComment}</div>}

      {view === 'preview' && (
        <div>
          <div className="hw-pv-tools">
            <p className="hw-sub">This is how the article will look on Doctor Dekho, using what you have entered so far.</p>
            <div className="hw-seg">
              <button type="button" className={!mobile ? 'on' : ''} onClick={() => setMobile(false)}>Desktop</button>
              <button type="button" className={mobile ? 'on' : ''} onClick={() => setMobile(true)}>Mobile</button>
            </div>
          </div>
          <ArticlePagePreview type={type} title={title.trim()} description={description.trim()} coverUrl={coverUrl} coverAlt={coverAlt}
            html={contentHtml} author={author} reviewer={reviewer} condition={condition} mobile={mobile} />
        </div>
      )}

      <div className="hw-grid" hidden={view === 'preview'}>
        <div className="hw-panel hw-card">
          <div className="hw-field">
            <label className="hw-label" htmlFor="hw-type">Article type</label>
            <select id="hw-type" value={type} disabled={locked} onChange={(e) => onType(e.target.value as ArticleType)}>
              <option value="MEDICAL">{TYPE_LABEL.MEDICAL}: a doctor reviews it</option>
              <option value="SECTOR_UPDATE">{TYPE_LABEL.SECTOR_UPDATE}: news and trends, an editor approves it</option>
            </select>
            {!medical && <div className="hw-hint"><span>Must not give medical advice. Doctor Dekho shows "Written by" and a not-medical-advice notice, never the reviewer badge.</span></div>}
          </div>
          <div className="hw-field">
            <label className="hw-label" htmlFor="hw-title">Title</label>
            <input id="hw-title" type="text" value={title} maxLength={300} disabled={locked} placeholder="Understanding Type 2 Diabetes" onChange={(e) => onTitle(e.target.value)} />
            <div className="hw-hint"><span className="hw-err">{errors.title}</span><span>{title.length} / 300</span></div>
          </div>
          <div className="hw-field">
            <label className="hw-label" htmlFor="hw-slug">Slug</label>
            <input id="hw-slug" type="text" value={slug} disabled={locked || !isNew} placeholder="diabetes-type-2"
              onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); }} />
            <div className="hw-hint">
              <span className={errors.slug ? 'hw-err' : ''}>{errors.slug ?? 'Becomes doctordekho.nexeagle.com/health/conditions/<slug>. Cannot change after creation.'}</span>
            </div>
          </div>
          <div className="hw-field">
            <label className="hw-label" htmlFor="hw-desc">Short description</label>
            <input id="hw-desc" type="text" value={description} maxLength={1000} disabled={locked} placeholder="A plain-language guide to symptoms, causes and management." onChange={(e) => setDescription(e.target.value)} />
            <div className="hw-hint"><span>Shown on the article card and in search results.</span><span>{description.length} / 1000</span></div>
          </div>
          <CoverImageField url={coverUrl} alt={coverAlt} disabled={locked} error={errors.cover}
            uploadImage={healthWikiService.uploadImage} onChange={(u, a) => { setCoverUrl(u); setCoverAlt(a); }} />
          <div className="hw-field">
            <span className="hw-label" id="hw-content-label">Content</span>
            <TiptapEditor key={routeSlug ?? 'new'} initialMarkdown={initialMd} disabled={locked}
              uploadImage={healthWikiService.uploadImage} onChange={(md, html) => { setContentMd(md); setContentHtml(html); }} />
            <div className="hw-hint"><span className="hw-err">{errors.content}</span><span>Saved as markdown.</span></div>
          </div>
        </div>

        <div className="hw-panel hw-card">
          {medical && (
            <div className="hw-field">
              <label className="hw-label" htmlFor="hw-cond">Related condition</label>
              <select id="hw-cond" value={condition ?? ''} disabled={locked} onChange={(e) => setCondition(e.target.value || null)}>
                <option value="">None</option>
                {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
          )}
          <ContributorPicker label="Author" options={authorOptions} value={authorId} disabled={locked} error={errors.author}
            hint="Only verified or approved people." onChange={setAuthorId} />
          {medical && (
            <ContributorPicker label="Reviewer" required options={reviewerOptions} value={reviewerId} disabled={locked} error={errors.reviewer}
              hint="Verified doctors only. The doctor reviews in EasyHMS or from a WhatsApp link." onChange={setReviewerId} />
          )}
          {sendRows.map((p) => (
            <SendLinkRow key={p.contributorId} contributor={p} articleSlug={isNew ? undefined : routeSlug} onSent={replacePerson} />
          ))}
          <div className="hw-actions">
            <button type="button" className="hw-btn" disabled={locked || saving} onClick={() => save(false)}>Save draft</button>
            <button type="button" className="hw-btn hw-btn-primary" disabled={locked || saving} onClick={() => save(true)}>Submit for review</button>
          </div>

          {!isNew && locked && (
            <div className="hw-decision">
              <h2>Editor actions</h2>
              {type === 'SECTOR_UPDATE' && status === 'IN_REVIEW' && (
                <button type="button" className="hw-btn hw-btn-primary" disabled={saving} onClick={approve}>Approve and publish</button>
              )}
              <div className="hw-field">
                <label className="hw-label" htmlFor="hw-reason">{status === 'PUBLISHED' ? 'Reason for taking it down' : 'Reason for returning it'}</label>
                <input id="hw-reason" type="text" value={reason} placeholder="Shown to the author and kept in the audit trail" onChange={(e) => setReason(e.target.value)} />
                {reasonError && <span className="hw-err">{reasonError}</span>}
              </div>
              <button type="button" className="hw-btn" disabled={saving} onClick={returnToDraft}>{status === 'PUBLISHED' ? 'Take down' : 'Return to draft'}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
