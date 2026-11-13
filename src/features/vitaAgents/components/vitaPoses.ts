import angry from '../assets/poses/angry.webp';
import eating from '../assets/poses/eating.webp';
import flying from '../assets/poses/flying.webp';
import joyful from '../assets/poses/joyful.webp';
import relaxed from '../assets/poses/relaxed.webp';
import resting from '../assets/poses/resting.webp';
import resting2 from '../assets/poses/resting2.webp';
import sleeping from '../assets/poses/sleeping.webp';
import thinking from '../assets/poses/thinking.webp';
import welcome from '../assets/poses/welcome.webp';
import working from '../assets/poses/working.webp';
import type { EagleMood } from './aerieJobs';

/**
 * Vita's eagle in each of its poses (the brand artwork, cut out). Where each one is used:
 *   working  — testing a repo at its work station (and the header while runs execute)
 *   flying   — on the way to work and back home
 *   thinking — the job is queued / being planned
 *   joyful   — the run passed;  angry — the run failed
 *   welcome  — greeting when the page opens, and "on it!" when called to work
 *   relaxed / eating / resting / resting2 — at home in the nests between jobs
 *   sleeping — Vita is not connected
 */
export type VitaPose = 'working' | 'flying' | 'relaxed' | 'welcome' | 'thinking' | 'sleeping' | 'resting' | 'resting2' | 'eating' | 'joyful' | 'angry';

export const POSES: Record<VitaPose, string> = {
    working, flying, relaxed, welcome, thinking, sleeping, resting, resting2, eating, joyful, angry,
};

/** What an eagle does at home, in turn (each eagle starts on a different one). */
export const HOME_POSES: VitaPose[] = ['relaxed', 'eating', 'resting', 'resting2'];

export const poseForMood = (mood: EagleMood): VitaPose =>
    mood === 'queued' ? 'thinking'
        : mood === 'running' ? 'working'
            : mood === 'green' ? 'joyful'
                : mood === 'red' ? 'angry'
                    : mood === 'neutral' ? 'relaxed' : 'relaxed';
