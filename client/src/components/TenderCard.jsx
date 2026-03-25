import { Bookmark, BookmarkCheck, Clock3, MapPin, Wallet } from 'lucide-react';

const getTimeLeft = (deadlineAt) => {
  const end = new Date(deadlineAt).getTime();
  const now = Date.now();
  const diff = end - now;

  if (!deadlineAt || Number.isNaN(end) || diff <= 0) {
    return 'Deadline passed';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  return `${days}d ${hours}h ${minutes}m left`;
};

export const TenderCard = ({ tender, isBookmarked, onBookmark, onOpen }) => {
  const recommendation = tender.insight?.recommendation;
  const deadlineRisk = tender.insight?.deadlineRisk;
  const documentGap = tender.insight?.documentGap;

  const decisionClassName =
    recommendation?.decision === 'go'
      ? 'bg-emerald-50 text-emerald-700'
      : recommendation?.decision === 'hold'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';

  return (
    <article className="card p-4">
      <header className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{tender.category}</span>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{tender.matchPercent || 0}% Match</span>
      </header>

      {recommendation ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${decisionClassName}`}>
            {recommendation.label} ({recommendation.confidence}%)
          </span>
          {deadlineRisk ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
              Deadline Risk: {deadlineRisk.label}
            </span>
          ) : null}
        </div>
      ) : null}

      <h3 className="mt-3 line-clamp-2 text-base font-semibold">{tender.title}</h3>
      <p className="mt-1 text-sm text-muted">{tender.procuringEntity}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
        {tender.sourceType === 'private' ? 'Private Organization' : 'PPMO'}
      </p>

      <div className="mt-3 grid gap-2 text-sm text-slate-600">
        <span className="flex items-center gap-2">
          <MapPin size={14} />
          {tender.district}
        </span>
        <span className="flex items-center gap-2">
          <Clock3 size={14} />
          {getTimeLeft(tender.deadlineAt)}
        </span>
        <span className="flex items-center gap-2">
          <Wallet size={14} />
          NPR {Number(tender.amount || 0).toLocaleString()}
        </span>
      </div>

      {documentGap ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Document readiness: {documentGap.readyPercent}%</p>
          <p className="mt-1">Missing: {documentGap.missing.length} | Expiring: {documentGap.expiringSoon.length}</p>
        </div>
      ) : null}

      <footer className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => onOpen(tender)}>
          View Full Notice
        </button>
        <button type="button" className="btn-secondary" onClick={() => onBookmark(tender._id)}>
          {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {isBookmarked ? 'Tracked' : 'Track'}
        </button>
      </footer>
    </article>
  );
};
