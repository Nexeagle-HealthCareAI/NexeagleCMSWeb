import React, { useEffect, useRef, useState } from 'react';
import { transformBatch, type BatchDetail } from '../services/dataMigrationService';

interface Props {
    batchId: string;
    onDone: (batch: BatchDetail) => void;
    onError: (message: string) => void;
}

const STAGES = [
    'Parsing rows',
    'Matching patients',
    'Checking doctors',
    'Summarizing',
];

// This checklist is a client-side timed reveal to give the admin something to watch during the
// single POST /transform call -- it does not reflect real per-row server progress. Genuine
// granular progress (via SignalR, mirroring useSupportStore.ts) is a later phase's job.
const TransformStep: React.FC<Props> = ({ batchId, onDone, onError }) => {
    const [activeStage, setActiveStage] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const tickers = STAGES.map((_, i) => setTimeout(() => setActiveStage(i), i * 700));

        transformBatch(batchId)
            .then((batch) => {
                setActiveStage(STAGES.length);
                setTimeout(() => onDone(batch), 400);
            })
            .catch((err) => {
                console.error(err);
                onError('Transform failed -- the migration service may be unavailable.');
            });

        return () => tickers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchId]);

    return (
        <div className="dm-checklist">
            {STAGES.map((label, i) => (
                <div
                    key={label}
                    className={`dm-checklist-item ${i < activeStage ? 'done' : i === activeStage ? 'active' : ''}`}
                >
                    <span>{i < activeStage ? '✓' : i === activeStage ? '⋯' : '○'}</span>
                    <span>{label}</span>
                </div>
            ))}
        </div>
    );
};

export default TransformStep;
