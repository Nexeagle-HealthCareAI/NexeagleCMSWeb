import { useEffect, useState } from 'react';
import { healthWikiService } from '../services/healthWikiService';
import type { HistoryEntry } from '../types';

/** Who did what to an article and when, newest first. */
export default function HistoryPanel({ slug, refreshKey }: { slug: string; refreshKey: number }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    healthWikiService.articleHistory(slug).then((e) => { if (alive) { setEntries(e); setFailed(false); } }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [slug, refreshKey]);

  return (
    <section className="hw-panel hw-card hw-history" aria-labelledby="hw-history-h">
      <h2 id="hw-history-h">History</h2>
      {failed ? <p className="hw-muted">Could not load the history.</p>
        : entries === null ? <p className="hw-muted">Loading…</p>
        : entries.length === 0 ? <p className="hw-muted">Nothing recorded yet.</p>
        : (
          <ol>
            {entries.map((h, i) => (
              <li key={`${h.at}-${i}`}>
                <div><b>{h.action}</b> <span className="hw-muted">by {h.actor}</span></div>
                {h.detail && <div className="hw-hist-detail">{h.detail}</div>}
                <time className="hw-muted" dateTime={h.at}>{new Date(h.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</time>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
