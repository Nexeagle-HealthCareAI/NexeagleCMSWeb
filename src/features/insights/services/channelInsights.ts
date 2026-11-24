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

// ── What people searched for, on Doctor Dekho and WhatsApp ──────────────────────────────────────

export type SearchKind = 'symptom' | 'doctor' | 'specialty' | 'hospital' | 'other';
export type SearchChannel = 'all' | 'doctordekho' | 'whatsapp';

export interface SearchKindRow {
    kind: SearchKind;
    label: string;
    doctorDekho: number;
    whatsApp: number;
    total: number;
    /** Searches by someone who went on to book in the same visit / conversation. */
    ledToBooking: number;
    /** Doctor Dekho: no doctors shown; WhatsApp: the bot asked again. */
    foundNothing: number;
}

export interface SearchTermRow {
    term: string;
    kind: SearchKind;
    doctorDekho: number;
    whatsApp: number;
    total: number;
    ledToBooking: number;
    foundNothing: number;
}

export interface SearchDayRow {
    date: string;
    doctorDekho: number;
    whatsApp: number;
    symptom: number;
    doctorName: number;
    specialty: number;
    hospital: number;
    other: number;
}

export interface SearchInsights {
    from: string;
    to: string;
    searches: number;
    people: number;
    ledToBooking: number;
    foundNothing: number;
    kinds: SearchKindRow[];
    days: SearchDayRow[];
    topTerms: SearchTermRow[];
    specialties: SearchTermRow[];
    nothingFound: SearchTermRow[];
    whatsAppAvailable: boolean;
    whatsAppProblem: string | null;
}

export interface SearchListRow {
    at: string;
    channel: 'doctordekho' | 'whatsapp';
    kind: SearchKind;
    kindLabel: string;
    text: string | null;
    specialty: string | null;
    results: number | null;
    found: boolean | null;
    booked: boolean;
    city: string | null;
    /** WhatsApp only; masked without the contacts permission. */
    phone: string | null;
    sessionId: string | null;
}

export interface SearchListQuery {
    from?: string;
    to?: string;
    channel?: SearchChannel;
    kind?: SearchKind | 'all' | 'nothing' | 'booked';
    search?: string;
    page?: number;
    limit?: number;
}

// ── Every appointment, by channel ───────────────────────────────────────────────────────────────

export type AppointmentChannel = 'doctordekho' | 'whatsapp' | 'hospital';
export type AppointmentChannelFilter = 'all' | 'online' | AppointmentChannel;
export type AppointmentGroupBy = 'day' | 'week' | 'month';

export interface AppointmentPeriodRow {
    /** First day of the period, yyyy-MM-dd ("total" for the totals). */
    start: string;
    doctorDekho: number;
    whatsApp: number;
    hospitalDesk: number;
    online: number;
    total: number;
    cancelled: number;
    isPartial: boolean;
}

export interface AppointmentPlaceRow {
    id: string;
    name: string;
    hospital: string | null;
    doctorDekho: number;
    whatsApp: number;
    hospitalDesk: number;
    online: number;
    total: number;
}

export interface AppointmentOption { id: string; name: string; hospitalId: string | null }

export interface AppointmentTrend {
    from: string;
    to: string;
    groupBy: AppointmentGroupBy;
    dateBy: 'booked' | 'appointment';
    totals: AppointmentPeriodRow;
    periods: AppointmentPeriodRow[];
    topHospitals: AppointmentPlaceRow[];
    topDoctors: AppointmentPlaceRow[];
    hospitals: AppointmentOption[];
    doctors: AppointmentOption[];
}

export interface AppointmentQuery {
    from?: string;
    to?: string;
    dateBy?: 'booked' | 'appointment';
    groupBy?: AppointmentGroupBy;
    channel?: AppointmentChannelFilter;
    hospitalId?: string;
    doctorId?: string;
    search?: string;
    includeCancelled?: boolean;
    page?: number;
    limit?: number;
}

export interface AppointmentRow {
    apptId: string;
    bookedAt: string;
    apptDate: string;
    channel: AppointmentChannel;
    channelLabel: string;
    status: string;
    statusCode: string;
    patientName: string | null;
    /** Masked without the contacts permission. */
    patientMobile: string | null;
    doctorName: string | null;
    hospitalName: string | null;
    loggedIn: boolean;
}

const appointmentParams = (q: AppointmentQuery) => ({
    ...(q.from ? { from: q.from } : {}), ...(q.to ? { to: q.to } : {}),
    dateBy: q.dateBy ?? 'booked', channel: q.channel ?? 'all',
    ...(q.groupBy ? { groupBy: q.groupBy } : {}),
    ...(q.hospitalId ? { hospitalId: q.hospitalId } : {}), ...(q.doctorId ? { doctorId: q.doctorId } : {}),
});

const range = (from?: string, to?: string) => ({ ...(from ? { from } : {}), ...(to ? { to } : {}) });

export const channelInsights = {
    /** The last `weeks` weeks, or every week with a day between from and to. */
    weeklyGrowth: async (weeks: number, from?: string, to?: string) =>
        (await api.get<WeeklyGrowth>(API_ENDPOINTS.INSIGHTS.WEEKLY_GROWTH, { params: from && to ? { from, to } : { weeks } })).data,
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
    appointmentTrend: async (q: AppointmentQuery) =>
        (await api.get<AppointmentTrend>(API_ENDPOINTS.INSIGHTS.APPOINTMENT_TREND, { params: appointmentParams(q) })).data,
    appointmentList: async (q: AppointmentQuery) =>
        (await api.get<PagedResponse<AppointmentRow>>(API_ENDPOINTS.INSIGHTS.APPOINTMENT_LIST, {
            params: { ...appointmentParams(q), ...(q.search ? { search: q.search } : {}), includeCancelled: q.includeCancelled ?? true, page: q.page ?? 1, limit: q.limit ?? 25 },
        })).data,
    searchAnalysis: async (from?: string, to?: string, channel: SearchChannel = 'all') =>
        (await api.get<SearchInsights>(API_ENDPOINTS.INSIGHTS.SEARCH_ANALYSIS, { params: { ...range(from, to), channel } })).data,
    searchList: async (q: SearchListQuery) =>
        (await api.get<PagedResponse<SearchListRow>>(`${API_ENDPOINTS.INSIGHTS.SEARCH_ANALYSIS}/list`, {
            params: { ...range(q.from, q.to), channel: q.channel ?? 'all', kind: q.kind ?? 'all', ...(q.search ? { search: q.search } : {}), page: q.page ?? 1, limit: q.limit ?? 25 },
        })).data,
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
