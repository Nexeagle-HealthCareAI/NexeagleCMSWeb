import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, AlertTriangle, Play } from 'lucide-react';
import { toast } from 'sonner';
import {
    getNightJobs, setNightJobActive, getRecentNightJobRuns, runNightJobNow,
    type JobSettingItem, type NightJobRunItem,
} from '../services/nightJobsService';

// The DB stores UTC, but this page's audience only ever reasons in IST (the 01:00 IST cron
// slot, the "did today's run happen" question) -- every timestamp shown here is pinned to
// Asia/Kolkata explicitly so it reads the same regardless of the viewer's own browser/OS
// timezone, instead of the ambient-local formatting toLocaleString() would otherwise give.
const IST_FORMATTER = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
});

const formatIst = (iso: string | null): string => {
    if (!iso) return 'Never';
    return `${IST_FORMATTER.format(new Date(iso))} IST`;
};

const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'success') return { color: '#16a34a', bg: '#dcfce7', icon: <CheckCircle2 size={12} /> };
    if (s === 'failed') return { color: '#dc2626', bg: '#fee2e2', icon: <XCircle size={12} /> };
    if (s === 'partialfailure') return { color: '#d97706', bg: '#fef3c7', icon: <AlertTriangle size={12} /> };
    return { color: '#475569', bg: '#f1f5f9', icon: <Loader2 size={12} className="animate-spin" /> };
};

export const NightJobsPanel: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const [jobs, setJobs] = useState<JobSettingItem[]>([]);
    const [runs, setRuns] = useState<NightJobRunItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [togglingJob, setTogglingJob] = useState<string | null>(null);
    const [runningJob, setRunningJob] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [jobList, runList] = await Promise.all([
                getNightJobs(),
                getRecentNightJobRuns(10),
            ]);
            setJobs(jobList);
            setRuns(runList);
        } catch {
            toast.error('Could not load night jobs.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (expanded) load(); }, [expanded, load]);

    const handleToggle = async (job: JobSettingItem) => {
        try {
            setTogglingJob(job.jobName);
            const res = await setNightJobActive(job.jobName, !job.isActive);
            if (!res.success) throw new Error(res.message ?? 'Failed');
            toast.success(res.message || 'Saved.');
            setJobs(prev => prev.map(j => j.jobName === job.jobName ? { ...j, isActive: !job.isActive } : j));
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Could not save.');
        } finally {
            setTogglingJob(null);
        }
    };

    const handleRunNow = async (job: JobSettingItem) => {
        try {
            setRunningJob(job.jobName);
            const res = await runNightJobNow(job.jobName);
            if (!res.success) throw new Error(res.message ?? 'Job failed.');
            toast.success(res.message || 'Job ran successfully.', { duration: 8000 });
            load();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Job run failed.', { duration: 8000 });
        } finally {
            setRunningJob(null);
        }
    };

    return (
        <div className="premium-table-card" style={{ marginBottom: 24 }}>
            <button
                onClick={() => setExpanded(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 20, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
            >
                <div>
                    <h2 className="premium-table-title" style={{ margin: 0 }}>Night Jobs</h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                        Enable/disable each nightly job, test-run one on demand, and review recent run history. All times shown in IST.
                    </p>
                </div>
                {expanded ? <ChevronUp size={20} color="#64748b" /> : <ChevronDown size={20} color="#64748b" />}
            </button>

            {expanded && (
                <div style={{ padding: '0 20px 20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                            <Loader2 className="animate-spin" size={20} color="#94a3b8" />
                        </div>
                    ) : (
                        <>
                            <div className="premium-responsive-wrapper" style={{ marginBottom: 20 }}>
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Job</th>
                                            <th>Active</th>
                                            <th>Ran Today (IST)</th>
                                            <th>Last Ran (IST)</th>
                                            <th>Test</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map(j => (
                                            <tr key={j.jobId} className="premium-row">
                                                <td className="premium-hospital-name">{j.jobName}</td>
                                                <td>
                                                    <button
                                                        onClick={() => handleToggle(j)}
                                                        disabled={togglingJob === j.jobName}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 6,
                                                            padding: '6px 12px', borderRadius: 999, border: 'none',
                                                            background: j.isActive ? '#dcfce7' : '#f1f5f9',
                                                            color: j.isActive ? '#16a34a' : '#64748b',
                                                            fontWeight: 700, fontSize: 12, cursor: 'pointer',
                                                        }}
                                                    >
                                                        {togglingJob === j.jobName ? <Loader2 className="animate-spin" size={12} /> : null}
                                                        {j.isActive ? 'Enabled' : 'Disabled'}
                                                    </button>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                                        padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                                        color: j.ranToday ? '#16a34a' : '#b45309',
                                                        background: j.ranToday ? '#dcfce7' : '#fef3c7',
                                                    }}>
                                                        {j.ranToday ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                                        {j.ranToday ? 'Ran today' : 'Not run today'}
                                                    </span>
                                                    {!j.isActive && (
                                                        <div style={{ marginTop: 4, fontSize: 11, color: '#94a3b8' }}>Disabled jobs never run.</div>
                                                    )}
                                                </td>
                                                <td>{formatIst(j.lastExecutionDateUTC)}</td>
                                                <td>
                                                    {j.canTestRun ? (
                                                        <button
                                                            onClick={() => handleRunNow(j)}
                                                            disabled={runningJob === j.jobName}
                                                            style={{
                                                                display: 'flex', alignItems: 'center', gap: 6,
                                                                padding: '6px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                                                                background: '#fff', color: '#334155', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                                                            }}
                                                        >
                                                            {runningJob === j.jobName ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                                                            Run Now
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: '#94a3b8' }} title="Not available for manual trigger from here.">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {jobs.length === 0 && (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>No jobs found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <h3 style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '0 0 10px' }}>Recent Runs</h3>
                            <div className="premium-responsive-wrapper">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>Started (IST)</th>
                                            <th>Status</th>
                                            <th>Duration</th>
                                            <th>Environment</th>
                                            <th>Summary / Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {runs.map(r => {
                                            const badge = statusBadge(r.status);
                                            return (
                                                <tr key={r.runId} className="premium-row">
                                                    <td>{formatIst(r.startedAtUtc)}</td>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                                            color: badge.color, background: badge.bg,
                                                        }}>
                                                            {badge.icon}{r.status}
                                                        </span>
                                                    </td>
                                                    <td>{r.durationSeconds != null ? `${r.durationSeconds}s` : '—'}</td>
                                                    <td>{r.environment || '—'}</td>
                                                    <td style={{ maxWidth: 360, fontSize: 12, color: r.error ? '#dc2626' : '#64748b' }}>
                                                        {r.error || r.summary || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {runs.length === 0 && (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8' }}>No runs recorded yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default NightJobsPanel;
