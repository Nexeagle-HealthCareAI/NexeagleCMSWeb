import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog } from '../components/parts';
import { errorMessage } from '../services/workService';
import { docsService } from './docsService';
import { DocIcon } from './DocIcon';
import type { Doc } from './types';

/** Find a document to tag on a work item. Searches names, tags and the text of pages. */
export default function DocPicker({ alreadyLinked, onClose, onPick }: { alreadyLinked: string[]; onClose: () => void; onPick: (doc: Doc) => void }) {
  const [query, setQuery] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    // A short pause, so a search is not sent for every letter typed.
    const timer = setTimeout(() => {
      setLoading(true);
      docsService.list(null, query.trim() || undefined)
        .then(list => { if (alive) { setDocs(list); setError(''); } })
        .catch(e => { if (alive) setError(errorMessage(e, 'Could not load documents.')); })
        .finally(() => { if (alive) setLoading(false); });
    }, query ? 250 : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  const choices = docs.filter(d => !alreadyLinked.includes(d.documentId));

  return (
    <Dialog title="Link a document" onClose={onClose}>
      <label className="wk-search">
        <Search size={16} aria-hidden="true" />
        <input data-autofocus type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents by name, tag or text" aria-label="Search documents" />
      </label>
      {error && <p className="wk-error" role="alert">{error}</p>}
      {loading ? <p className="wk-muted">Searching…</p> : choices.length === 0 ? (
        <p className="wk-muted">{query.trim() ? 'No documents match.' : 'Type to search every folder. Documents at the top level are listed first.'}</p>
      ) : (
        <ul className="dc-picklist">
          {choices.map(d => (
            <li key={d.documentId}>
              <button type="button" onClick={() => onPick(d)}>
                <DocIcon doc={d} />
                <span className="dc-pick-name">{d.name}</span>
                <span className="dc-pick-path">{d.path.length > 0 ? d.path.join(' › ') : 'Top level'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="wk-form-actions"><button type="button" className="wk-btn" onClick={onClose}>Close</button></div>
    </Dialog>
  );
}
