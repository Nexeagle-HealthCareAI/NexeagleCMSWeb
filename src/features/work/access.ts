// Who may do what on the Daily Work Board. The API enforces the same keys (WorkController).

/** With VITE_WORK_MOCK=true the board runs on example data in the browser, for reviewing screens without the API. */
export const WORK_MOCK = import.meta.env.VITE_WORK_MOCK === 'true';

export const WORK_VIEW = 'work.view';
export const WORK_EDIT = 'work.edit';
export const WORK_MANAGE = 'work.manage';
/** Deleting loses work, so it has its own permission, held by few people. */
export const WORK_DELETE = 'work.delete';

export const canViewWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_VIEW);
export const canEditWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_EDIT);
export const canManageWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_MANAGE);
export const canDeleteWork = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_DELETE);
