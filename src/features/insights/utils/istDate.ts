// Insights date filters are India Standard Time days (UTC+05:30, no daylight saving), matching the
// CMS API (CMSAPI.Application.Models.TrackingTime). Using the browser's own date would shift "Today"
// for anyone whose computer is not set to IST.
const IST_OFFSET_MS = 330 * 60 * 1000;

/** yyyy-MM-dd of the IST day containing `at`. */
export const istDate = (at: Date = new Date()): string => new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

/** Today's IST date. */
export const todayIst = (): string => istDate();

/** IST date `days` days before today. */
export const istDaysAgo = (days: number): string => istDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
