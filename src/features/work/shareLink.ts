/** The address that opens this item (after signing in, for people who can see its board). */
export const itemLink = (itemId: string, origin = window.location.origin) => `${origin}/work?item=${encodeURIComponent(itemId)}`;

/** The message that goes with the link. The title only when the person may take board content out. */
export function shareText(itemKey: string, title: string, canExport: boolean, link: string) {
  return canExport ? `${itemKey}: ${title}\n${link}` : `${itemKey} on the Daily Work Board\n${link}`;
}
