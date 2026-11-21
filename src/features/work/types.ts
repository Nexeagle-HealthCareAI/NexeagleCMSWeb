// Daily Work Board. These mirror the CMS API's Work* DTOs (CMSAPI.Application/Models/WorkModels.cs).

export type ItemType = 'Epic' | 'Feature' | 'Story' | 'Task' | 'Bug' | 'Subtask';
/** What a board column means, whatever the team calls it. */
export type StatusCategory = 'ToDo' | 'InProgress' | 'Done';

/** A column of a project's board. Items carry `key`, which never changes; `name` can be renamed. */
export interface WorkStatus {
  statusId: string;
  key: string;
  name: string;
  category: StatusCategory;
  sortOrder: number;
}
export type ItemPriority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';

export interface WorkProject {
  projectId: string;
  key: string;
  name: string;
  description: string | null;
  sprintDays: number;
  isArchived: boolean;
  /** True when only its members can open it. */
  isRestricted: boolean;
  /** The board's columns, in order. */
  statuses: WorkStatus[];
}

export type AccessAction = 'MemberAdded' | 'MemberRemoved' | 'Restricted' | 'Opened';

/** Who can open one board, and the latest changes to that. */
export interface WorkProjectAccess {
  projectId: string;
  isRestricted: boolean;
  memberUserIds: string[];
  log: { action: AccessAction; targetName: string | null; actorName: string; createdAt: string }[];
}

/** A person's own sign-in details, as the API recorded them. */
export interface MyPresence {
  openedAt: string | null;
  ip: string | null;
  previousOpenedAt: string | null;
  previousIp: string | null;
}
export interface LastSeen { userId: string; lastSeenAt: string; isOnline: boolean }
export type GuardEvent = 'CopyBlocked' | 'PrintBlocked' | 'SaveBlocked' | 'ScreenshotKey';
export type ActivitySource = 'items' | 'comments' | 'access' | 'docs' | 'sessions';

/** One line of the activity log. */
export interface WorkActivity {
  source: ActivitySource;
  /** items: the changed field. Otherwise the action. */
  action: string;
  actorUserId: string | null;
  actorName: string;
  projectKey: string | null;
  workItemId: string | null;
  itemKey: string | null;
  itemTitle: string | null;
  documentId: string | null;
  documentName: string | null;
  oldValue: string | null;
  newValue: string | null;
  detail: string | null;
  createdAt: string;
}
export interface ActivityQuery { userId?: string; projectId?: string; source?: ActivitySource; from?: string; before?: string; take?: number }

export interface WorkUser {
  userId: string;
  fullName: string;
  email: string;
}

export interface WorkItem {
  workItemId: string;
  projectId: string;
  /** Project key and number: HMS-142. */
  key: string;
  number: number;
  itemType: ItemType;
  title: string;
  /** Key of one of the project's columns. */
  status: string;
  statusName: string;
  statusCategory: StatusCategory;
  priority: ItemPriority;
  storyPoints: number | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  reporterUserId: string | null;
  reporterName: string | null;
  parentId: string | null;
  parentKey: string | null;
  parentTitle: string | null;
  parentType: ItemType | null;
  sprintId: string | null;
  labels: string[];
  /** yyyy-MM-dd */
  startDate: string | null;
  /** yyyy-MM-dd */
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  rank: number;
  childCount: number;
  doneChildCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WorkComment {
  commentId: string;
  authorUserId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface WorkHistoryEntry {
  historyId: string;
  actorName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

export interface WorkItemDetail extends WorkItem {
  /** Markdown. */
  description: string | null;
  children: WorkItem[];
  comments: WorkComment[];
  history: WorkHistoryEntry[];
}

export interface CreateItemPayload {
  projectId: string;
  itemType: ItemType;
  title: string;
  description?: string | null;
  priority?: ItemPriority;
  storyPoints?: number | null;
  assigneeUserId?: string | null;
  parentId?: string | null;
  labels?: string[];
  startDate?: string | null;
  dueDate?: string | null;
}

/** The full editable state. A null clears the field; nothing is "left as it was". */
export interface UpdateItemPayload {
  title: string;
  description: string | null;
  status: string;
  priority: ItemPriority;
  storyPoints: number | null;
  assigneeUserId: string | null;
  parentId: string | null;
  sprintId: string | null;
  labels: string[];
  startDate: string | null;
  dueDate: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
}
