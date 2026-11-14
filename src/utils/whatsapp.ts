/**
 * WhatsApp click-to-chat links (wa.me). Opens WhatsApp with the message typed
 * in; the person checks it and presses send — nothing is sent automatically.
 * Indian 10-digit mobiles get the 91 country code.
 */
export const whatsappNumber = (raw?: string | null): string | null => {
    const d = (raw || '').replace(/\D/g, '').replace(/^0+/, '');
    if (d.length === 10) return '91' + d;
    if (d.length === 12 && d.startsWith('91')) return d;
    return d.length >= 11 && d.length <= 15 ? d : null;
};

export const whatsappLink = (raw: string | null | undefined, text: string): string | null => {
    const n = whatsappNumber(raw);
    return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};

/** The renewal reminder used on Today and on a hospital's page. */
export const renewalText = (hospitalName: string, planName: string | null | undefined, daysLeft: number | null | undefined) => {
    const when = daysLeft == null ? 'soon' : daysLeft <= 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
    return `Hello from NexEagle. The 1HMS ${planName ? `${planName} ` : ''}plan for ${hospitalName} ends ${when}. `
        + 'Please renew it so your team can keep working without a break. Reply here if you need any help.';
};
