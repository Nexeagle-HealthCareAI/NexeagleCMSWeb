// Who may do what on the Daily Work Board. The API enforces the same keys (WorkController).

/** With VITE_WORK_MOCK=true the board runs on example data in the browser, for reviewing screens without the API. */
export const WORK_MOCK = import.meta.env.VITE_WORK_MOCK === 'true';

export const WORK_VIEW = 'work.view';
export const WORK_EDIT = 'work.edit';
export const WORK_MANAGE = 'work.manage';

export const canViewWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_VIEW);
export const canEditWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_EDIT);
export const canManageWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_MANAGE);
