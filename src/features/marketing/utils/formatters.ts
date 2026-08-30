// Always shown in IST regardless of the viewer's own timezone.
export const formatDateTimeIST = (iso: string): string => {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
    return `${datePart}, ${timePart}`;
};

export const formatDateIST = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
