import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { healthWikiService, errorMessage } from '../services/healthWikiService';
import { CONDITION_OPTIONS, SLUG_PATTERN, type ArticlePayload, type ArticleStatus, type DoctorOption, type HealthArticle } from '../types';
import StatusPill from '../components/StatusPill';
import TiptapEditor from '../components/TiptapEditor';
import CoverImageField from '../components/CoverImageField';
import DoctorPicker from '../components/DoctorPicker';
import ArticlePagePreview from '../components/ArticlePagePreview';
import '../healthWiki.css';

const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 200);

interface Errors { title?: string; slug?: string; content?: string; cover?: string; reviewer?: string }

export default function ArticleEditorPage() {
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();
  const isNew = !routeSlug;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [mobile, setMobile] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [status, setStatus] = useState<ArticleStatus>('DRAFT');
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
        const [docs, article] = await Promise.all([
          healthWikiService.listDoctors(),
          isNew ? Promise.resolve<HealthArticle | null>(null) : healthWikiService.get(routeSlug!),
        ]);
        if (!alive) return;
        setDoctors(docs);
        if (article) {
          setStatus(article.status);
          setReviewerComment(article.reviewerComment ?? null);
          setSlug(article.slug);
          setTitle(article.title);
          setDescription(article.description ?? '');
          setInitialMd(article.content);
          setContentMd(article.content);
          setCondition(article.relatedConditionSlug);
          setCoverUrl(article.coverImageUrl);
          setCoverAlt(article.coverImageAlt ?? '');
          setAuthorId(article.authorDoctorId);
          setReviewerId(article.reviewerDoctorId);
        }
      } catch (e) {
        if (alive) setLoadError(errorMessage(e, 'Could not load this article.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isNew, routeSlug]);

  const locked = status !== 'DRAFT';
  const reviewer = doctors.find((d) => d.doctorId === reviewerId) ?? null;

  const onTitle = (v: string) => {
    setTitle(v);
    if (isNew && !slugTouched) setSlug(slugify(v));
  };

  const validate = (submit: boolean): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Title is required.';
    if (isNew && !SLUG_PATTERN.test(slug)) e.slug = 'Use lowercase letters, numbers and single hyphens.';
    if (!contentMd.trim()) e.content = 'Content cannot be empty.';
    if (coverUrl && !coverAlt.trim()) e.cover = 'Add alt text for the cover image.';
    if (submit && !reviewerId) e.reviewer = 'Pick a reviewer to submit.';
    return e;
  };

  const save = async (submit: boolean) => {
    const e = validate(submit);
    setErrors(e);
    if (Object.keys(e).length) return;
    const payload: ArticlePayload = {
      slug: isNew ? slug : undefined,
      title: title.trim(),
      description: description.trim(),
      content: contentMd,
      relatedConditionSlug: condition,
      coverImageUrl: coverUrl,
      coverImageAlt: coverUrl ? coverAlt.trim() : null,
      authorDoctorId: authorId,
      reviewerDoctorId: reviewerId,
      status: submit ? 'IN_REVIEW' : 'DRAFT',
    };
    setSaving(true);
    try {
      const saved = isNew ? await healthWikiService.create(payload) : await healthWikiService.update(routeSlug!, payload);
      toast.success(submit ? `Sent to ${reviewer?.fullName ?? 'the reviewer'} for review` : 'Draft saved');
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

  const waitingOn = reviewer?.fullName ?? 'the reviewer';

  return (
    <div className="hw-page">
      <button type="button" className="hw-crumb" onClick={() => navigate('/health-wiki')}><ArrowLeft size={14} /> Health Wiki</button>
      <div className="hw-top">
        <div>
          <h1 className="hw-h1">{isNew ? 'New article' : title || 'Untitled'}</h1>
          <p className="hw-sub">{isNew ? 'Saved only in the CMS until you submit it for review.' : `/health/conditions/${slug}`}</p>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="hw-seg" role="tablist" aria-label="Editor view">
        <button type="button" role="tab" aria-selected={view === 'edit'} className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>Edit</button>
        <button type="button" role="tab" aria-selected={view === 'preview'} className={view === 'preview' ? 'on' : ''} onClick={() => setView('preview')}>Page preview</button>
      </div>

      {view === 'edit' && status === 'IN_REVIEW' && <div className="hw-banner info">Waiting for {waitingOn} to review in EasyHMS. Editing is locked until a decision.</div>}
      {view === 'edit' && status === 'PUBLISHED' && <div className="hw-banner ok">Published and visible on Doctor Dekho. Content is read-only here.</div>}
      {view === 'edit' && status === 'DRAFT' && reviewerComment && <div className="hw-banner warn"><b>Reviewer comment:</b> {reviewerComment}</div>}

      {view === 'preview' && (
        <div>
          <div className="hw-pv-tools">
            <p className="hw-sub">This is how the article will look on Doctor Dekho, using what you have entered so far.</p>
            <div className="hw-seg">
              <button type="button" className={!mobile ? 'on' : ''} onClick={() => setMobile(false)}>Desktop</button>
              <button type="button" className={mobile ? 'on' : ''} onClick={() => setMobile(true)}>Mobile</button>
            </div>
          </div>
          <ArticlePagePreview title={title.trim()} description={description.trim()} coverUrl={coverUrl} coverAlt={coverAlt}
            html={contentHtml} reviewer={reviewer} condition={condition} mobile={mobile} />
        </div>
      )}

      <div className="hw-grid" hidden={view === 'preview'}>
        <div className="hw-panel hw-card">
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
          <div className="hw-field">
            <label className="hw-label" htmlFor="hw-cond">Related condition</label>
            <select id="hw-cond" value={condition ?? ''} disabled={locked} onChange={(e) => setCondition(e.target.value || null)}>
              <option value="">None</option>
              {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c.replace(/-/g, ' ')}</option>)}
            </select>
          </div>
          <DoctorPicker label="Author" doctors={doctors} value={authorId} disabled={locked} onChange={setAuthorId} />
          <DoctorPicker label="Reviewer" required doctors={doctors} value={reviewerId} disabled={locked} error={errors.reviewer}
            hint="Required to submit. The doctor reviews in EasyHMS." onChange={setReviewerId} />
          <div className="hw-actions">
            <button type="button" className="hw-btn" disabled={locked || saving} onClick={() => save(false)}>Save draft</button>
            <button type="button" className="hw-btn hw-btn-primary" disabled={locked || saving} onClick={() => save(true)}>Submit for review</button>
          </div>
        </div>
      </div>
    </div>
  );
}
