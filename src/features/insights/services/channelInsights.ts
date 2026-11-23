import { api } from '../../../services/api';
import { API_ENDPOINTS } from '../../../services/endpoints';
import type { PagedResponse } from './insightsService';

// The WhatsApp booking bot, Doctor Dekho and nexeagle.com day by day and week by week (CMS API:
// InsightsController, WhatsAppInsightsService). Days are India time; weeks run Monday to Sunday.

export interface WeeklyGrowthRow {
    /** Monday of the week, yyyy-MM-dd. */
    weekStart: string;
    /** Different phone numbers that wrote to the WhatsApp bot; null when the bot could not be read. */
    whatsAppPeople: number | null;
    nexeagleVisits: number;
    doctorDekhoVisits: number;
    /** The week that is still running. */
    isPartial: boolean;
}

export interface WeeklyGrowth {
    weeks: WeeklyGrowthRow[];
    whatsAppAvailable: boolean;
    whatsAppProblem: string | null;
}

export interface WhatsAppDailyRow {
    date: string;
    conversations: number;
    people: number;
    newPeople: number;
    fromQr: number;
    booked: number;
    /** Started booking and stopped before it went through. */
    left: number;
    /** Came for an existing appointment, check-in, a document or a follow-up. */
    other: number;
}

export interface NamedCount { name: string; count: number }

export interface WhatsAppDailyStats {
    from: string;
    to: string;
    totals: WhatsAppDailyRow;
    days: WhatsAppDailyRow[];
    leftAt: NamedCount[];
    topSearches: NamedCount[];
    qrSources: NamedCount[];
}

export type WhatsAppOutcome = 'Booked' | 'Left' | 'Other';

export interface WhatsAppPerson {
    sessionId: string;
    startedAt: string;
    lastActivityAt: string;
    /** Full for people allowed to see contacts, masked (98XXXXXX10) for everyone else. */
    phone: string;
    /** Digits for wa.me / tel: links; empty without the contacts permission. */
    phoneDigits: string;
    isNewPerson: boolean;
    source: string;
    sourceLabel: string;
    outcome: WhatsAppOutcome;
    stage: number;
    stageLabel: string;
    lastStepLabel: string;
    searched: string[];
    city: string | null;
    bookedDoctor: string | null;
    bookedHospital: string | null;
    bookedFor: string | null;
    patientName: string | null;
    appointmentDate: string | null;
    messages: number;
}

export interface WhatsAppPeopleQuery {
    from?: string;
    to?: string;
    outcome?: 'all' | 'booked' | 'left' | 'other';
    source?: 'all' | 'qr' | 'direct';
    search?: string;
    page?: number;
    limit?: number;
}

export interface WhatsAppTranscript {
    sessionId: string;
    phone: string;
    lines: { from: 'person' | 'bot'; text: string; stepLabel: string | null; at: string | null }[];
}

export interface DoctorDekhoDailyRow {
    date: string;
    visits: number;
    searched: number;
    viewedDoctor: number;
    startedBooking: number;
    enteredDetails: number;
    booked: number;
    left: number;
}

export interface DoctorDekhoDailyStats { from: string; to: string; totals: DoctorDekhoDailyRow; days: DoctorDekhoDailyRow[] }

const range = (from?: string, to?: string) => ({ ...(from ? { from } : {}), ...(to ? { to } : {}) });

export const channelInsights = {
    weeklyGrowth: async (weeks: number) =>
        (await api.get<WeeklyGrowth>(API_ENDPOINTS.INSIGHTS.WEEKLY_GROWTH, { params: { weeks } })).data,
    whatsAppDaily: async (from?: string, to?: string) =>
        (await api.get<WhatsAppDailyStats>(API_ENDPOINTS.INSIGHTS.WHATSAPP_DAILY, { params: range(from, to) })).data,
    whatsAppPeople: async (q: WhatsAppPeopleQuery) =>
        (await api.get<PagedResponse<WhatsAppPerson>>(API_ENDPOINTS.INSIGHTS.WHATSAPP_PEOPLE, {
            params: { ...range(q.from, q.to), outcome: q.outcome ?? 'all', source: q.source ?? 'all', ...(q.search ? { search: q.search } : {}), page: q.page ?? 1, limit: q.limit ?? 25 },
        })).data,
    whatsAppTranscript: async (sessionId: string) =>
        (await api.get<WhatsAppTranscript>(`${API_ENDPOINTS.INSIGHTS.WHATSAPP_PEOPLE}/${encodeURIComponent(sessionId)}`)).data,
    doctorDekhoDaily: async (from?: string, to?: string) =>
        (await api.get<DoctorDekhoDailyStats>(API_ENDPOINTS.INSIGHTS.DOCTORDEKHO_DAILY, { params: range(from, to) })).data,
};

/** "Sun 22 Nov" */
export const dayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** "16 Nov" */
export const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** A list of people as CSV, for follow-up calls in a spreadsheet. */
export function peopleCsv(rows: WhatsAppPerson[]): string {
    const cell = (v: unknown) => {
        const s = v == null ? '' : String(v);
        // A leading = + - @ would run as a formula in Excel.
        const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
        return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const head = ['Started (IST)', 'Phone', 'New', 'Came from', 'Result', 'Left at', 'Searched', 'Area', 'Doctor booked', 'Hospital', 'Patient', 'Appointment date', 'Messages'];
    const ist = (iso: string) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const lines = rows.map(r => [
        ist(r.startedAt), r.phone, r.isNewPerson ? 'yes' : '', r.sourceLabel,
        r.outcome === 'Booked' ? 'Booked' : r.outcome === 'Left' ? 'Left' : 'Other',
        r.outcome === 'Left' ? r.stageLabel : '', r.searched.join('; '), r.city ?? '',
        r.bookedDoctor ?? '', r.bookedHospital ?? '', r.patientName ?? '', r.appointmentDate ?? '', r.messages,
    ].map(cell).join(','));
    return [head.join(','), ...lines].join('\n');
}
