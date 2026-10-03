import type { DoctorOption } from '../types';

interface Props {
  title: string;
  description: string;
  coverUrl: string | null;
  coverAlt: string;
  /** HTML produced by the Tiptap editor (its schema limits what can appear). */
  html: string;
  reviewer: DoctorOption | null;
  condition: string | null;
  mobile: boolean;
}

const initials = (name: string) => name.replace(/^Dr\.?\s+/i, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/** Replica of the Doctor Dekho article page (DoctorDekhoWeb/app/health/conditions/[condition]/page.tsx). */
export default function ArticlePagePreview({ title, description, coverUrl, coverAlt, html, reviewer, condition, mobile }: Props) {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const reg = reviewer?.registrationNumber
    ? `Reg. ${reviewer.registrationNumber}${reviewer.registrationCouncil ? ` · ${reviewer.registrationCouncil}` : ''}`
    : null;

  return (
    <div className={`dd-shell${mobile ? ' mobile' : ''}`}>
      <div className="dd">
        <div className="dd-head">
          <div className="dd-logo">
            <div className="dd-mark">N</div>
            <div className="dd-word">NexEagle<small>Healthcare Excellence</small></div>
          </div>
          <div className="dd-right"><span className="dd-pill">All India</span><span className="dd-cta">For Hospitals</span></div>
        </div>
        <div className="dd-crumb"><div>Home <span>›</span> Health Wiki <span>›</span> <b>{title || 'Your article title'}</b></div></div>
        <div className="dd-body">
          <article className="dd-art">
            <h1>{title || <span className="dd-ph">Your article title</span>}</h1>
            <p className="dd-desc">{description || <span className="dd-ph">Short description appears here.</span>}</p>
            {coverUrl
              ? <img className="dd-cover" src={coverUrl} alt={coverAlt} />
              : <div className="dd-cover-empty">No cover image yet</div>}
            <div className="dd-trust">
              {reviewer ? (
                <div className="dd-rev">
                  <div className="dd-av">{initials(reviewer.fullName)}</div>
                  <div className="dd-rev-text">
                    <div className="k">✓ Medically Reviewed By</div>
                    <div className="n">{reviewer.fullName}</div>
                    <div className="q">{[reviewer.qualification, reviewer.specialty].filter(Boolean).join(' • ')}</div>
                    {reg && <div className="q">{reg}</div>}
                  </div>
                </div>
              ) : (
                <div className="dd-norev">Reviewer not chosen yet. The "Medically Reviewed By" badge appears here once you pick one.</div>
              )}
              <div className="dd-sep" />
              <div className="dd-meta"><span>Updated {date}</span><span>✓ Evidence Based</span></div>
            </div>
            <div className="dd-prose" dangerouslySetInnerHTML={{ __html: html || '<p class="dd-ph">Your article content appears here.</p>' }} />
          </article>
          <aside>
            <div className="dd-side">
              <h3>Need a Specialist?</h3>
              <p>Don't wait if you are experiencing symptoms of {(condition || 'this condition').replace(/-/g, ' ')}. Consult with top-rated doctors near you instantly.</p>
              <span className="go">Find Doctors Near Me</span>
              <div className="v">✓ 100% Verified Experts</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
