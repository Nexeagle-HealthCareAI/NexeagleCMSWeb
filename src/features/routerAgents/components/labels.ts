// Router taxonomy (1HMS-NLP-Router hms_router/domain/taxonomy.py SPECIALTY_NAMES).
export const SPECIALTIES: Record<string, string> = {
    general: 'General Physician', pediatrics: 'Paediatrics', cardiology: 'Cardiology', dermatology: 'Dermatology',
    orthopedics: 'Orthopaedics', gynecology: 'Gynaecology', dentistry: 'Dentistry', ent: 'ENT',
    ophthalmology: 'Ophthalmology', neurology: 'Neurology', psychiatry: 'Psychiatry', urology: 'Urology',
    gastroenterology: 'Gastroenterology', endocrinology: 'Endocrinology', pulmonology: 'Pulmonology',
    nephrology: 'Nephrology', oncology: 'Oncology', rheumatology: 'Rheumatology', physiotherapy: 'Physiotherapy',
    generalsurgery: 'General Surgery', neurosurgery: 'Neurosurgery', plasticsurgery: 'Plastic Surgery',
    vascularsurgery: 'Vascular Surgery', cardiothoracicsurgery: 'Cardiothoracic Surgery', anesthesiology: 'Anaesthesiology',
    radiology: 'Radiology', pathology: 'Pathology', emergencymedicine: 'Emergency Medicine', geriatrics: 'Geriatrics',
    sportsmedicine: 'Sports Medicine',
};

export const specialtyName = (id: string | null | undefined) => (id ? SPECIALTIES[id] ?? id : '—');

/** "2026-10-19-134807-9f8e7d6c" -> "19 Oct 13:48 · 9f8e7d6c" (the build time is UTC). */
export const versionLabel = (v: string | null | undefined): string => {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\d{2}-([0-9a-f]+)$/.exec(v);
    if (!m) return v;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return `${d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${m[6]}`;
};

export const AGENT_NAMES: Record<string, string> = { route: 'Symptom router', chat: 'Chat agent' };

export const DECISIONS: Record<string, { label: string; color: string; hint: string }> = {
    answer: { label: 'Answered', color: '#2a78d6', hint: 'Sure enough to name the specialty' },
    clarify: { label: 'Asked to clarify', color: '#8b5cf6', hint: 'Unsure: asked a question or showed a short list' },
    abstain: { label: 'No match', color: '#eb6834', hint: 'Nothing like it in training, or not a health query' },
    emergency: { label: 'Emergency', color: '#e34948', hint: 'Emergency signs: told to call 108 / 112 / go to ER' },
    follow_up: { label: 'Follow-up question', color: '#0ea5e9', hint: 'Chat agent asked for more detail' },
    recommendation: { label: 'Recommendation', color: '#1baf7a', hint: 'Chat agent named specialists' },
};

export const SOURCES: Record<string, { label: string; hint: string }> = {
    booking_correction: { label: 'Booked something else', hint: 'Patient searched, the router suggested one specialty, the patient booked a different one' },
    no_match: { label: 'No match', hint: 'The router could not route this; it may be a new way of describing a symptom' },
    low_confidence: { label: 'Low confidence', hint: 'Answered, but not sure' },
    clarify: { label: 'Had to ask', hint: 'Needed a clarifying question' },
    emergency_check: { label: 'Emergency check', hint: 'Flagged as an emergency: confirm it was right (false alarms and misses both matter)' },
    user_feedback: { label: 'User said wrong', hint: 'Chat user said the specialist was wrong' },
    novel_phrase: { label: 'New phrase', hint: 'Chat user reported a phrase the agent did not know' },
};

export const callerName = (c: string | null | undefined) =>
    !c ? '—' : ({ doctordekho: 'Doctor Dekho', whatsapp: 'WhatsApp bot', voicerx: 'VoiceRx', 'anonymous-dev': 'Dev / no key', unknown: 'Unknown' } as Record<string, string>)[c] ?? c;
