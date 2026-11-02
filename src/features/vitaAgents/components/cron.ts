/**
 * Vita's 5-field cron (minute hour day-of-month month day-of-week), always evaluated in IST (vita/runners/cron.py).
 * cronProblems mirrors the server check in vita/api/settings_routes.py so the form refuses what Vita would refuse.
 */

const FIELDS: [label: string, lo: number, hi: number][] = [
    ['minute', 0, 59],
    ['hour', 0, 23],
    ['day of month', 1, 31],
    ['month', 1, 12],
    ['day of week', 0, 6],
];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const IST_OFFSET_MIN = 330; // Asia/Kolkata, no DST

const isNum = (s: string) => /^\d+$/.test(s);

export const cronProblems = (cron: string): string[] => {
    const parts = (cron ?? '').trim().split(/\s+/).filter(Boolean);
    if (parts.length !== 5) return [`A cron needs 5 fields (minute hour day-of-month month day-of-week), this has ${parts.length}.`];
    const out: string[] = [];
    parts.forEach((expr, i) => {
        const [label, lo, hi] = FIELDS[i];
        for (const part of expr.split(',')) {
            const [base, step] = part.split('/', 2);
            if (step !== undefined && (!isNum(step) || Number(step) < 1)) out.push(`${label}: bad step "${step}"`);
            if (base === '*') continue;
            const ends = base.split('-', 2);
            if (!ends.every(isNum)) {
                out.push(`${label}: "${part}" is not a number, range or *`);
                continue;
            }
            const nums = ends.map(Number);
            if (nums.some((n) => n < lo || n > hi)) out.push(`${label}: ${base} is outside ${lo}-${hi}`);
            else if (nums.length === 2 && nums[0] > nums[1]) out.push(`${label}: range ${base} is reversed`);
        }
    });
    return out;
};

const fieldMatches = (expr: string, value: number, lo: number, hi: number) =>
    expr.split(',').some((part) => {
        const [base, s] = part.split('/', 2);
        const step = s ? Number(s) : 1;
        let a = lo;
        let b = hi;
        if (base !== '*') {
            const ends = base.split('-', 2).map(Number);
            a = ends[0];
            b = ends.length === 2 ? ends[1] : ends[0];
        }
        return value >= a && value <= b && (value - a) % step === 0;
    });

/** IST wall-clock parts of an instant. */
const ist = (d: Date) => {
    const t = new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
    return { minute: t.getUTCMinutes(), hour: t.getUTCHours(), day: t.getUTCDate(), month: t.getUTCMonth() + 1, dow: t.getUTCDay() };
};

export const cronMatches = (cron: string, at: Date) => {
    const [m, h, dom, mon, dow] = cron.trim().split(/\s+/);
    const t = ist(at);
    return (
        fieldMatches(m, t.minute, 0, 59) &&
        fieldMatches(h, t.hour, 0, 23) &&
        fieldMatches(dom, t.day, 1, 31) &&
        fieldMatches(mon, t.month, 1, 12) &&
        fieldMatches(dow, t.dow, 0, 6)
    );
};

/** Next firing after `from` within `horizonDays` (the server's next_run looks 8 days ahead), or null. */
export const nextCronRun = (cron: string, from = new Date(), horizonDays = 35): Date | null => {
    if (cronProblems(cron).length) return null;
    const t = new Date(Math.floor(from.getTime() / 60_000) * 60_000 + 60_000);
    for (let i = 0; i < horizonDays * 1440; i++, t.setTime(t.getTime() + 60_000)) {
        if (cronMatches(cron, t)) return new Date(t);
    }
    return null;
};

const pad = (n: number) => String(n).padStart(2, '0');

const listOf = (expr: string, names?: string[], offset = 0): string | null => {
    // "1-5" / "1,3,5" / "0" -> names; anything with a step -> null (described generically)
    if (expr.includes('/')) return null;
    const out: string[] = [];
    for (const part of expr.split(',')) {
        const ends = part.split('-').map(Number);
        if (ends.length === 2) out.push(names ? `${names[ends[0] - offset]}–${names[ends[1] - offset]}` : `${ends[0]}–${ends[1]}`);
        else out.push(names ? names[ends[0] - offset] : String(ends[0]));
    }
    return out.length > 1 ? `${out.slice(0, -1).join(', ')} and ${out[out.length - 1]}` : out[0];
};

/** "Every day at 06:00 IST", "Every Sunday at 03:00 IST", "Every 15 minutes", ... (falls back to the raw fields). */
export const describeCron = (cron: string): string => {
    if (cronProblems(cron).length) return 'Invalid cron';
    const [m, h, dom, mon, dow] = cron.trim().split(/\s+/);
    const fixedTime = isNum(m) && /^\d+(,\d+)*$/.test(h);
    let when: string | null = null;
    if (m.startsWith('*/') && h === '*') when = `Every ${m.slice(2)} minutes`;
    else if (m === '*' && h === '*') when = 'Every minute';
    else if (isNum(m) && h === '*') when = `Every hour at :${pad(Number(m))}`;
    else if (isNum(m) && h.startsWith('*/')) when = `Every ${h.slice(2)} hours at :${pad(Number(m))}`;
    else if (fixedTime) when = `at ${h.split(',').map((x) => `${pad(Number(x))}:${pad(Number(m))}`).join(' and ')} IST`;
    if (!when) return `Cron ${cron} (IST)`;

    const timed = when.startsWith('at ');
    let days: string;
    if (dom === '*' && dow === '*') days = timed ? 'Every day' : '';
    else if (dom === '*') {
        const d = listOf(dow, DOW);
        if (!d) return `Cron ${cron} (IST)`;
        days = dow === '1-5' ? 'Weekdays (Mon–Fri)' : dow === '0,6' || dow === '6,0' ? 'Weekends' : `Every ${d}`;
    } else if (dow === '*') {
        const d = listOf(dom);
        if (!d) return `Cron ${cron} (IST)`;
        days = `On day ${d} of the month`;
    } else return `Cron ${cron} (IST)`;

    let months = '';
    if (mon !== '*') {
        const l = listOf(mon, MONTHS, 1);
        if (!l) return `Cron ${cron} (IST)`;
        months = ` in ${l}`;
    }
    if (timed) return `${days}${months} ${when}`;
    return days ? `${when}, ${days.charAt(0).toLowerCase()}${days.slice(1)}${months} (IST)` : `${when}${months}`;
};

/** Vita's timestamps are UTC without an offset (SQLAlchemy DateTime); show them in IST. */
export const istTime = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })} IST`;
};

/** Relative wording for a future instant ("in 3 h", "in 2 d"). */
export const fromNow = (d: Date | null, now = new Date()): string => {
    if (!d) return '';
    const min = Math.round((d.getTime() - now.getTime()) / 60_000);
    if (min < 60) return `in ${Math.max(min, 0)} min`;
    if (min < 48 * 60) return `in ${Math.round(min / 60)} h`;
    return `in ${Math.round(min / 1440)} d`;
};
