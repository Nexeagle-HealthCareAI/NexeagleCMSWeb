import React from 'react';
import type { VitaRepoOverview } from '../types';
import VitaAerieFlat from './VitaAerieFlat';
import './vitaAerie3d.css';

/**
 * Vita's eagles: home on the cliff, called to the work deck when a run is queued or running.
 * The 3D scene (three.js, loaded on demand) is used where WebGL works and the user has not asked for reduced
 * motion; otherwise, or if the 3D scene fails, the flat version is shown.
 */
const VitaAerie3D = React.lazy(() => import('./VitaAerie3D'));
const HEIGHT_3D = 460;

const can3d = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
        return false;
    }
};

const VitaAerie: React.FC<{ repos: VitaRepoOverview[]; connected: boolean }> = ({ repos, connected }) => {
    const [use3d, setUse3d] = React.useState(can3d);
    const fail = React.useCallback(() => setUse3d(false), []);
    if (!use3d) return <VitaAerieFlat repos={repos} connected={connected} />;
    return (
        <React.Suspense fallback={<div className="vita-aerie3d" style={{ height: HEIGHT_3D }} aria-busy="true" />}>
            <VitaAerie3D repos={repos} connected={connected} onFail={fail} />
        </React.Suspense>
    );
};

export default VitaAerie;
