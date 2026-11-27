import type { Channel, PostKind, SocialDraftSave } from './types';

// Helpers shared by the Social tabs. The rules mirror Meta's and the API's (SocialComposeService.Check).

export const RULES = { carouselMax: 10, instagramCaption: 2200, hashtags: 30, imageBytes: 8 * 1024 * 1024, videoBytes: 300 * 1024 * 1024, scheduleMinMinutes: 10, scheduleMaxDays: 180 };
export const KINDS: PostKind[] = ['Photo', 'Carousel', 'Video', 'Reel', 'Story', 'Text', 'Link'];
/** The checks an approver must tick (SocialComposeService.RequiredChecks). */
export const REQUIRED_CHECKS = [
  { key: 'noTestimonials', label: 'No patient testimonials or “best doctor / best hospital” claims' },
  { key: 'factsBackedUp', label: 'Facts we can back up (prices, services, timings)' },
];
export const OPTIONAL_CHECKS = [{ key: 'madeWithAi', label: 'Made with AI: add the AI label in the app before or after it goes out' }];

/** India time, as the queue and the API use. */
export const IST_OFFSET_MIN = 330;

export const n = (v?: number | null): string => (v == null ? '—' : v >= 10_000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k` : v.toLocaleString('en-IN'));
export const money = (v: number | null | undefined, currency = 'INR', digits = 0): string =>
  v == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
export const pct = (part: number, whole: number): string => (whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '—');
/** "+18% on the period before", or null when there is nothing to compare with. */
export const change = (now: number, before?: number | null): number | null => (before && before > 0 ? Math.round(((now - before) / before) * 100) : null);

export const when = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
export const day = (iso?: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

/** "10:42" today, "Mon" this week, "12 Nov" otherwise: for lists. */
export const shortWhen = (iso?: string | null, now = new Date()): string => {
  if (!iso) return '';
  const t = new Date(iso);
  const days = (now.getTime() - t.getTime()) / 86_400_000;
  if (t.toDateString() === now.toDateString()) return t.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (days < 6) return t.toLocaleDateString('en-IN', { weekday: 'short' });
  return t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

/** "3 h 20 min" until a time, or null once it has passed. */
export const timeLeft = (until?: string | null, now = new Date()): string | null => {
  if (!until) return null;
  const ms = new Date(until).getTime() - now.getTime();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return d > 0 ? `${d} d ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
};

export const ago = (iso?: string | null, now = new Date()): string => {
  if (!iso) return '';
  const min = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  if (min < 60 * 48) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} days`;
};

export const channelName = (c: string): string =>
  c === 'facebook' ? 'Facebook' : c === 'instagram' ? 'Instagram' : c === 'messenger' ? 'Messenger' : c === 'comments' ? 'Comments' : c;

export const hashtags = (text?: string | null): number => (text ?? '').match(/#\w/g)?.length ?? 0;

/** Caption that goes to a channel: its own one, or the shared one. */
export const captionFor = (p: Pick<SocialDraftSave, 'caption' | 'facebookCaption' | 'instagramCaption'>, c: Channel): string =>
  ((c === 'instagram' ? p.instagramCaption : p.facebookCaption)?.trim() ? (c === 'instagram' ? p.instagramCaption : p.facebookCaption) : p.caption) ?? '';

/** What is wrong with a post before the API sees it, or null. Same rules as SocialComposeService.Check. */
export function checkPost(r: SocialDraftSave, now = new Date()): string | null {
  if (!r.toFacebook && !r.toInstagram) return 'Choose Facebook, Instagram or both.';
  if (!KINDS.includes(r.kind)) return 'Choose the kind of post.';
  if (r.toInstagram && (r.kind === 'Text' || r.kind === 'Link')) return 'Instagram posts need a picture or a video.';
  if (r.toFacebook && r.kind === 'Story') return 'Stories are posted to Instagram only here.';
  const images = r.media.filter(m => m.mime.startsWith('image/')).length;
  const videos = r.media.filter(m => m.mime.startsWith('video/')).length;
  switch (r.kind) {
    case 'Photo': if (r.media.length !== 1 || images !== 1) return 'A photo post has one picture.'; break;
    case 'Carousel':
      if (images < 2 || videos > 0) return 'A carousel has 2 to 10 pictures.';
      if (images > RULES.carouselMax) return `A carousel has at most ${RULES.carouselMax} pictures.`;
      break;
    case 'Video': case 'Reel': if (r.media.length !== 1 || videos !== 1) return 'Add one video.'; break;
    case 'Story': if (r.media.length !== 1) return 'A story has one picture or one video.'; break;
    case 'Text': case 'Link': if (r.media.length > 0) return 'Text and link posts have no pictures; choose Photo instead.'; break;
  }
  if (r.toInstagram && r.media.some(m => m.mime === 'image/png')) return 'Instagram takes JPEG pictures only.';
  const ig = captionFor(r, 'instagram');
  const fb = captionFor(r, 'facebook');
  if (r.toInstagram && ig.length > RULES.instagramCaption) return `Instagram captions can be at most ${RULES.instagramCaption.toLocaleString('en-IN')} characters.`;
  if (r.toInstagram && hashtags(ig) > RULES.hashtags) return `Instagram allows at most ${RULES.hashtags} hashtags.`;
  if (r.kind === 'Text' && !fb.trim()) return 'Write the post.';
  if (r.kind === 'Link' && !r.link?.trim()) return 'Add the link.';
  if (r.link?.trim() && !/^https?:\/\/[^\s/]+\.[^\s]+/i.test(r.link.trim())) return 'The link must start with https://.';
  if (r.whenMode === 'schedule') {
    if (!r.scheduledAt) return 'Choose the date and time.';
    const t = new Date(r.scheduledAt).getTime();
    if (t < now.getTime() + RULES.scheduleMinMinutes * 60_000) return 'Schedule at least 10 minutes ahead.';
    if (t > now.getTime() + RULES.scheduleMaxDays * 86_400_000) return 'Schedule at most six months ahead.';
  }
  if ((r.title ?? '').length > 150) return 'The title can be at most 150 characters.';
  return null;
}

/** Problems with a file before it is uploaded, or null. */
export function checkFile(f: File): string | null {
  const image = f.type.startsWith('image/');
  const video = f.type.startsWith('video/');
  if (!image && !video) return `${f.name}: choose a picture or a video.`;
  if (image && f.size > RULES.imageBytes) return `${f.name}: pictures can be at most 8 MB.`;
  if (video && f.size > RULES.videoBytes) return `${f.name}: videos can be at most 300 MB.`;
  return null;
}

/** Instagram takes JPEG only: turn any other picture into a JPEG in the browser (white behind transparent parts). */
export async function toJpeg(file: File, quality = 0.9): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/jpeg') return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot convert the picture.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not convert the picture to JPEG.');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

/** An ISO time from a <input type="datetime-local"> value (the browser's own time zone). */
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);
export const toLocalInput = (iso?: string | null): string => {
  if (!iso) return '';
  const t = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}`;
};

/** "YYYY-MM-DD" of a date, for API date parameters. */
export const ymd = (t: Date): string => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

/** What a lead made from a chat or comment is interested in. */
export const PRODUCTS = ['1HMS', '1Rad', 'Doctor Dekho', 'Not sure'];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const STATUS_LABEL: Record<string, string> = {
  Draft: 'Draft', AwaitingApproval: 'Waiting for approval', SentBack: 'Sent back', Scheduled: 'Scheduled', Publishing: 'Publishing',
  Published: 'Published', Failed: 'Failed', Cancelled: 'Cancelled',
};
/** SocialLead.Source in the API. */
export const LEAD_SOURCE: Record<string, string> = { form: 'Lead form', messenger: 'Messenger', instagram: 'Instagram message', comment: 'Comment' };
