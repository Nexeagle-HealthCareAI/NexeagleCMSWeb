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
/** Choose who can open each board; opens every board. */
export const WORK_MEMBERS = 'work.members';
/** Copy out of, print and download from the board. Without it the screen is protected (ScreenGuard). */
export const WORK_EXPORT = 'work.export';
export const canManageMembers = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(WORK_MEMBERS);
/** No example-data shortcut here: the protected screen is the normal case and should be seen in review. */
export const canExportWork = (permissions: string[]): boolean => permissions.includes(WORK_EXPORT);

// Docs tab. The API enforces the same keys (DocsController); restricted folders are checked there too.
export const DOCS_VIEW = 'docs.view';
export const DOCS_EDIT = 'docs.edit';
/** Move to the bin and restore. Apart from editing on purpose, like WORK_DELETE. */
export const DOCS_DELETE = 'docs.delete';
/** Open every restricted folder, choose who may open one, read the access log. */
export const DOCS_SENSITIVE = 'docs.sensitive';

export const canViewDocs = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(DOCS_VIEW);
export const canEditDocs = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(DOCS_EDIT);
export const canDeleteDocs = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(DOCS_DELETE);
export const canSeeSensitiveDocs = (permissions: string[]): boolean => WORK_MOCK || permissions.includes(DOCS_SENSITIVE);
