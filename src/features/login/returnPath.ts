/** A page of this CMS to go back to after signing in, or Today. Never another site. */
export function returnPath(from: unknown): string {
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return '/';
    if (from.startsWith('/login')) return '/';
    return from;
}
