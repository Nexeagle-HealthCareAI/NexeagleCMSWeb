import { STATUS_LABEL, type ArticleStatus } from '../types';

export default function StatusPill({ status }: { status: ArticleStatus }) {
  return <span className={`hw-pill hw-pill-${status}`}>{STATUS_LABEL[status]}</span>;
}
