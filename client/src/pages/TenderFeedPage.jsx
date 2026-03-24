import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { TenderCard } from '../components/TenderCard';
import { TenderModal } from '../components/TenderModal';

export const TenderFeedPage = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [activeTender, setActiveTender] = useState(null);

  const bookmarkSet = useMemo(() => new Set(bookmarks.map((id) => id.toString())), [bookmarks]);
  const highFitCount = useMemo(() => items.filter((item) => Number(item.matchPercent || 0) >= 75).length, [items]);
  const goCount = useMemo(
    () => items.filter((item) => item.insight?.recommendation?.decision === 'go').length,
    [items]
  );
  const closingSoonCount = useMemo(
    () =>
      items.filter((item) => {
        const time = new Date(item.deadlineAt).getTime();
        if (!item.deadlineAt || Number.isNaN(time)) {
          return false;
        }

        return time - Date.now() <= 1000 * 60 * 60 * 24 * 3;
      }).length,
    [items]
  );

  const loadTenders = async (query = '') => {
    try {
      setLoading(true);
      const [tenderResponse, bookmarkResponse] = await Promise.all([
        api.get('/tenders/personalized', { params: { q: query } }),
        api.get('/bookmarks'),
      ]);

      setItems(tenderResponse.data.items || []);
      setBookmarks((bookmarkResponse.data.items || []).map((item) => item._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tenders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      loadTenders(search.trim());
    }, 250);

    return () => clearTimeout(id);
  }, [search]);

  const onBookmark = async (tenderId) => {
    try {
      const response = await api.post('/bookmarks/toggle', { tenderId });
      setBookmarks(response.data.bookmarks || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update bookmark.');
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Personalized Feed</p>
            <h2 className="page-title">Matched Tender Feed</h2>
            <p className="page-subtitle">Simple, high-signal opportunities ranked for your vendor profile.</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="kpi-card">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-1 text-lg font-bold">{items.length}</p>
            </div>
            <div className="kpi-card">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Go</p>
              <p className="mt-1 text-lg font-bold">{goCount}</p>
            </div>
            <div className="kpi-card">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">3-Day</p>
              <p className="mt-1 text-lg font-bold">{closingSoonCount}</p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500">High-fit opportunities (75%+): {highFitCount}</p>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, tender ID, or entity"
          />
          <button type="button" className="btn-secondary" onClick={() => loadTenders(search.trim())}>Refresh</button>
        </div>
      </article>

      {error ? <div className="status-error">{error}</div> : null}
      {loading ? <div className="status-info">Loading tenders...</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((tender) => (
          <TenderCard
            key={tender._id}
            tender={tender}
            isBookmarked={bookmarkSet.has(tender._id)}
            onBookmark={onBookmark}
            onOpen={setActiveTender}
          />
        ))}
      </div>

      {!loading && !items.length ? <p className="text-sm text-slate-500">No tenders found for this search.</p> : null}

      <TenderModal tender={activeTender} onClose={() => setActiveTender(null)} />
    </section>
  );
};
