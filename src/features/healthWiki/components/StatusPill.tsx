import { STATUS_LABEL, TYPE_LABEL, contributorStatusLabel, type ArticleStatus, type ArticleType, type ContributorStatus, type ContributorType } from '../types';

export default function StatusPill({ status }: { status: ArticleStatus }) {
  return <span className={`hw-pill hw-pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function TypePill({ type }: { type: ArticleType }) {
  return <span className={`hw-pill hw-pill-type-${type}`}>{TYPE_LABEL[type]}</span>;
}

export function ContributorStatusPill({ type, status }: { type: ContributorType; status: ContributorStatus }) {
  return <span className={`hw-pill hw-pill-c-${status}`}>{contributorStatusLabel(type, status)}</span>;
}
