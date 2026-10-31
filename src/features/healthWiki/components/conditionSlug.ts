/** The text a writer types for a condition that is not in the list, as the address-style name the article stores ("Knee pain" becomes "knee-pain"). Empty when nothing usable is typed. */
export function slugifyCondition(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export const conditionLabel = (slug: string) => slug.replace(/-/g, ' ');
