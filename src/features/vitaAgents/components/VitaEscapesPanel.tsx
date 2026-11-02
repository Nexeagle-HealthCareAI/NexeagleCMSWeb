import React from 'react';
import { Bug, Send } from 'lucide-react';
import { toast } from 'sonner';
import { vitaApi, vitaApiError } from '../services/vitaApi';
import type { VitaEscape, VitaEscapeStatus } from '../types';
import { shortId, useLoad, when } from './format';
import { Empty, ErrorBox, Pill } from './shared';
import type { Tone } from './format';
import { useVitaAccess } from './testAgent';

const escapeTone = (s: VitaEscapeStatus): Tone => (s === 'linked' ? 'good' : s === 'open' ? 'warn' : 'neutral');

/**
 * "Log an escape": a bug that reached users. Vita saves it and asks the Case Generator for shadow cases that would have caught it
 * (POST /escapes/{repo}); the first reproducing case is linked to the escape. Logging needs vita.manage; the list needs vita.view.
 */
const VitaEscapesPanel: React.FC<{ repo: string; onGenerated?: () => void }> = ({ repo, onGenerated }) => {
    const { canManage } = useVitaAccess();
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [sha, setSha] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    const { data: escapes, error, reload } = useLoad(
        () => (repo ? vitaApi.escapes(repo) : Promise.resolve([] as VitaEscape[])),
        [repo]
    );

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !description.trim()) return;
        setSaving(true);
        try {
            const res = await vitaApi.logEscape(repo, { title: title.trim(), description: description.trim(), sha: sha.trim() || null });
            if (res.case_ids.length > 0) {
                toast.success('Escape logged', { description: `${res.case_ids.length} shadow case(s) generated to reproduce it.` });
            } else {
                toast.warning('Escape logged, no reproducing case yet', {
                    description:
                        res.source === 'fallback'
                            ? 'No model is available: the escape stays open until the Case Generator can read it.'
                            : res.dropped.length
                              ? `${res.dropped.length} proposal(s) were dropped: ${res.dropped[0].reasons.join('; ')}`
                              : 'The generator proposed nothing for it.',
                });
            }
            setTitle('');
            setDescription('');
            setSha('');
            reload();
            onGenerated?.();
        } catch (err) {
            toast.error(vitaApiError(err, 'Could not log the escape.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="vita-card">
            <header className="vita-card-head">
                <h3>
                    <Bug size={16} /> Escaped bugs
                </h3>
            </header>

            {canManage ? (
                <form className="vita-ta-escape-form" onSubmit={submit}>
                    <input
                        className="vita-input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What went wrong, e.g. Receptionist could cancel another hospital's appointment"
                        maxLength={400}
                        required
                    />
                    <textarea
                        className="vita-input"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Endpoint, request, what was returned and what should have happened. No patient data."
                        rows={3}
                        required
                    />
                    <div className="vita-ta-actions">
                        <input className="vita-input" value={sha} onChange={(e) => setSha(e.target.value)} placeholder="Commit sha (optional)" />
                        <button className="vita-btn vita-btn-primary" type="submit" disabled={saving || !title.trim() || !description.trim()}>
                            <Send size={14} /> {saving ? 'Logging…' : 'Log an escape'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="vita-explainer">
                    Logging an escape needs the <strong>vita.manage</strong> permission.
                </div>
            )}

            {error && !escapes ? (
                <ErrorBox message={vitaApiError(error, 'Could not load the escapes.')} onRetry={reload} />
            ) : !escapes ? (
                <Empty>Loading escapes…</Empty>
            ) : escapes.length === 0 ? (
                <Empty>No escapes logged for {repo}.</Empty>
            ) : (
                <div className="vita-scroll">
                    <table className="vita-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Case</th>
                                <th>Reported by</th>
                                <th>Sha</th>
                                <th>Logged</th>
                            </tr>
                        </thead>
                        <tbody>
                            {escapes.map((x) => (
                                <tr key={x.id}>
                                    <td className="vita-wrap" title={x.description}>
                                        {x.title}
                                    </td>
                                    <td>
                                        <Pill tone={escapeTone(x.status)}>{x.status}</Pill>
                                    </td>
                                    <td className="vita-code" title={x.linked_case_id ?? ''}>
                                        {x.linked_case_id ? shortId(x.linked_case_id) : '—'}
                                    </td>
                                    <td className="vita-nowrap">{x.reported_by}</td>
                                    <td className="vita-code">{x.sha ? x.sha.slice(0, 8) : '—'}</td>
                                    <td className="vita-nowrap">{when(x.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default VitaEscapesPanel;
