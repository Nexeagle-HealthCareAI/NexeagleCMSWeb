import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../../../store/useAuthStore';
import type { WhatsAppPerson } from '../services/channelInsights';

const api = vi.hoisted(() => ({
    weeklyGrowth: vi.fn(),
    whatsAppDaily: vi.fn(),
    whatsAppPeople: vi.fn(),
    whatsAppTranscript: vi.fn(),
    doctorDekhoDaily: vi.fn(),
}));
vi.mock('../services/channelInsights', async (original) => ({ ...(await original<object>()), channelInsights: api }));
vi.mock('recharts', async (original) => {
    const real = await original<typeof import('recharts')>();
    // jsdom has no layout: give the chart a fixed size.
    return { ...real, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <div style={{ width: 800, height: 300 }}>{children}</div> };
});

import InsightsTab from './InsightsTab';
import { peopleCsv } from '../services/channelInsights';

const person = (over: Partial<WhatsAppPerson>): WhatsAppPerson => ({
    sessionId: 's1', startedAt: '2026-11-23T06:00:00Z', lastActivityAt: '2026-11-23T06:05:00Z', phone: '+91 98222 22222', phoneDigits: '919822222222',
    isNewPerson: true, source: 'Direct', sourceLabel: 'Messaged directly', outcome: 'Left', stage: 3, stageLabel: 'Choosing a time',
    lastStepLabel: 'Choosing a time', searched: ['Cardiology', 'chest pain'], city: 'Purnia', bookedDoctor: null, bookedHospital: null,
    bookedFor: null, patientName: null, appointmentDate: null, messages: 4, ...over,
});
const day = (date: string, over = {}) => ({ date, conversations: 0, people: 0, newPeople: 0, fromQr: 0, booked: 0, left: 0, other: 0, ...over });

const open = (tab: string) => render(<MemoryRouter initialEntries={[`/insights?tab=${tab}`]}><InsightsTab /></MemoryRouter>);

beforeEach(() => {
    useAuthStore.setState({ permissions: ['insights.view', 'insights.contacts'] });
    api.weeklyGrowth.mockResolvedValue({
        whatsAppAvailable: true, whatsAppProblem: null,
        weeks: [
            { weekStart: '2026-11-09', whatsAppPeople: 40, nexeagleVisits: 120, doctorDekhoVisits: 300, isPartial: false },
            { weekStart: '2026-11-16', whatsAppPeople: 50, nexeagleVisits: 100, doctorDekhoVisits: 330, isPartial: false },
            { weekStart: '2026-11-23', whatsAppPeople: 9, nexeagleVisits: 12, doctorDekhoVisits: 40, isPartial: true },
        ],
    });
    api.whatsAppDaily.mockResolvedValue({
        from: '2026-11-17', to: '2026-11-23',
        totals: day('total', { conversations: 12, people: 10, newPeople: 6, fromQr: 3, booked: 4, left: 5, other: 3 }),
        days: [day('2026-11-23', { people: 3, booked: 1, left: 2 }), day('2026-11-22', { people: 7, booked: 3, left: 3 })],
        leftAt: [{ name: 'Choosing a time', count: 3 }], topSearches: [{ name: 'Cardiology', count: 4 }], qrSources: [{ name: 'Hospital QR · City Care', count: 3 }],
    });
    api.whatsAppPeople.mockResolvedValue({
        data: [person({}), person({ sessionId: 's2', phone: '+91 98111 11111', phoneDigits: '919811111111', isNewPerson: false, outcome: 'Booked', stage: 6, stageLabel: 'Booked', bookedDoctor: 'Dr Mehta', bookedHospital: 'City Care', appointmentDate: '2026-11-25', patientName: 'Asha Rao', sourceLabel: 'Hospital QR · City Care', source: 'HospitalQr' })],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 2, itemsPerPage: 25 },
    });
    api.whatsAppTranscript.mockResolvedValue({
        sessionId: 's1', phone: '+91 98222 22222',
        lines: [{ from: 'person', text: 'chest pain', stepLabel: 'Typing a symptom', at: '2026-11-23T06:01:00Z' }, { from: 'bot', text: 'Moved to: Choosing a time', stepLabel: 'Choosing a time', at: null }],
    });
    api.doctorDekhoDaily.mockResolvedValue({
        from: '2026-11-17', to: '2026-11-23',
        totals: { date: 'total', visits: 300, searched: 120, viewedDoctor: 80, startedBooking: 20, enteredDetails: 12, booked: 8, left: 12 },
        days: [{ date: '2026-11-23', visits: 40, searched: 15, viewedDoctor: 9, startedBooking: 3, enteredDetails: 2, booked: 1, left: 2 }],
    });
});
afterEach(() => vi.clearAllMocks());

describe('Weekly growth', () => {
    it('opens first, with one line per channel and the week-on-week change', async () => {
        render(<MemoryRouter initialEntries={['/insights']}><InsightsTab /></MemoryRouter>);
        expect(await screen.findByRole('img', { name: /People and visits per week/ })).toBeInTheDocument();
        expect(api.weeklyGrowth).toHaveBeenCalledWith(12);
        // Last full week, and its change on the week before: 40 -> 50 is +25%.
        expect(screen.getByText('WhatsApp bot (people), last full week').previousSibling).toHaveTextContent('50');
        expect(screen.getByText('+25% on the week before')).toBeInTheDocument();
        const table = screen.getByRole('table', { name: 'Growth by week' });
        expect(within(table).getByText('23 Nov (so far)')).toBeInTheDocument();
    });

    it('says when the WhatsApp line could not be read', async () => {
        api.weeklyGrowth.mockResolvedValueOnce({ whatsAppAvailable: false, whatsAppProblem: 'Login failed.', weeks: [] });
        open('growth');
        expect(await screen.findByRole('status')).toHaveTextContent(/WhatsApp line is missing.*Login failed/);
    });

    it('changes the number of weeks', async () => {
        open('growth');
        await screen.findByRole('img', { name: /per week/ });
        await userEvent.setup().click(screen.getByRole('button', { name: '26 weeks' }));
        await waitFor(() => expect(api.weeklyGrowth).toHaveBeenLastCalledWith(26));
    });
});

describe('WhatsApp bot', () => {
    it('shows the day-by-day figures and who booked or left, with what they searched', async () => {
        open('whatsapp');
        const days = await screen.findByRole('table', { name: 'WhatsApp bot by day' });
        expect(within(days).getAllByRole('row')).toHaveLength(3);
        expect(screen.getByText(/Booked · 44% of those who tried/)).toBeInTheDocument();
        expect(screen.getByText('Hospital QR · City Care', { selector: '.insights-mini-row-label' })).toBeInTheDocument();

        const list = await screen.findByRole('table', { name: 'People who used the WhatsApp bot' });
        expect(within(list).getByText('+91 98222 22222')).toBeInTheDocument();
        expect(within(list).getAllByText('Cardiology, chest pain')).toHaveLength(2);
        expect(within(list).getByText('Choosing a time')).toBeInTheDocument();
        expect(within(list).getByText(/Dr Mehta · City Care · Wed 25 Nov · for Asha Rao/)).toBeInTheDocument();
        expect(within(list).getByRole('link', { name: 'Message +91 98222 22222 on WhatsApp' })).toHaveAttribute('href', 'https://wa.me/919822222222');
    });

    it('filters the people and opens a whole conversation', async () => {
        const user = userEvent.setup();
        open('whatsapp');
        await screen.findByRole('table', { name: 'People who used the WhatsApp bot' });

        await user.click(screen.getByRole('button', { name: 'Left in between' }));
        await waitFor(() => expect(api.whatsAppPeople).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'left', page: 1 })));
        await user.selectOptions(screen.getByRole('combobox', { name: 'Came from' }), 'qr');
        await waitFor(() => expect(api.whatsAppPeople).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'qr' })));

        await user.click(screen.getAllByRole('button', { name: /^Chat \(/ })[0]);
        const chat = await screen.findByRole('dialog', { name: /Conversation with/ });
        expect(await within(chat).findByText('chest pain')).toBeInTheDocument();
        expect(within(chat).getByText('Moved to: Choosing a time')).toBeInTheDocument();
        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('without the contacts permission: no call links, no chats, no export', async () => {
        useAuthStore.setState({ permissions: ['insights.view'] });
        api.whatsAppPeople.mockResolvedValue({ data: [person({ phone: '+91 98XXXXXX22', phoneDigits: '' })], pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 25 } });
        open('whatsapp');
        const list = await screen.findByRole('table', { name: 'People who used the WhatsApp bot' });
        expect(await within(list).findByText('+91 98XXXXXX22')).toBeInTheDocument();
        expect(within(list).queryByRole('link')).not.toBeInTheDocument();
        expect(within(list).queryByRole('button', { name: /Chat/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Export CSV/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Numbers are shown in part/)).toBeInTheDocument();
    });

    it('explains when the bot cannot be read', async () => {
        api.whatsAppDaily.mockRejectedValueOnce({ response: { data: { message: "The WhatsApp bot's figures cannot be read right now." } } });
        open('whatsapp');
        expect(await screen.findByRole('alert')).toHaveTextContent(/cannot be read right now/);
    });
});

describe('Doctor Dekho daily', () => {
    it('follows visits to bookings each day', async () => {
        open('doctordekho');
        const table = await screen.findByRole('table', { name: 'Doctor Dekho by day' });
        const row = within(table).getAllByRole('row')[1];
        expect(row).toHaveTextContent(/Mon 23 Nov\s*40\s*15\s*9\s*3\s*2\s*1\s*2/);
        expect(screen.getByText(/Booked · 40% of those who started/)).toBeInTheDocument();
    });
});

describe('export', () => {
    it('writes one row per person and keeps spreadsheet formulas out', () => {
        const csv = peopleCsv([person({ searched: ['=HYPERLINK("x")', 'fever, cough'] })]);
        const [head, line] = csv.split('\n');
        expect(head).toContain('Phone');
        expect(line).toContain('+91 98222 22222');
        expect(line).toContain(`"'=HYPERLINK(""x""); fever, cough"`);
    });
});
