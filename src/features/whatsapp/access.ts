// Who may do what in WhatsApp. The API enforces the same keys (WhatsAppController, script 35).

/** With VITE_WA_MOCK=true the section runs on example data in the browser, for reviewing screens without the API. */
export const WA_MOCK = import.meta.env.VITE_WA_MOCK === 'true';

export const WA_VIEW = 'whatsapp.view';
export const WA_REPLY = 'whatsapp.reply';
export const WA_CONTACTS = 'whatsapp.contacts';
export const WA_BROADCAST = 'whatsapp.broadcast';
export const WA_TEMPLATES = 'whatsapp.templates';
/** Approve broadcasts that would pass the monthly budget. */
export const WA_APPROVE = 'whatsapp.approve';
/** Business profile, budget, sending speed and rates. */
export const WA_SETTINGS = 'whatsapp.settings';
/** Enter the Meta keys and connect the webhook (WhatsApp → Setup). */
export const WA_CONNECT = 'whatsapp.connect';
/** Doctor Dekho patients' numbers (Patient app insights → contacts). */
export const PATIENT_CONTACTS = 'insights.contacts';

export interface WaCan {
  view: boolean;
  reply: boolean;
  contacts: boolean;
  broadcast: boolean;
  templates: boolean;
  approve: boolean;
  settings: boolean;
  connect: boolean;
  patients: boolean;
}

export const waCan = (perms: string[]): WaCan => {
  const has = (p: string) => WA_MOCK || perms.includes(p);
  return {
    view: has(WA_VIEW), reply: has(WA_REPLY), contacts: has(WA_CONTACTS), broadcast: has(WA_BROADCAST),
    templates: has(WA_TEMPLATES), approve: has(WA_APPROVE), settings: has(WA_SETTINGS), connect: has(WA_CONNECT), patients: has(PATIENT_CONTACTS),
  };
};

export const canViewWhatsApp = (perms: string[]): boolean => WA_MOCK || perms.includes(WA_VIEW);
