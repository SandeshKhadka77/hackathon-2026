import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { TenderCard } from '../components/TenderCard';
import { TenderModal } from '../components/TenderModal';

export const TenderFeedPage = () => {
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [deadlineWindow, setDeadlineWindow] = useState('');
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
  const ppmoCount = useMemo(
    () => items.filter((item) => item.sourceType !== 'private').length,
    [items]
  );
  const privateCount = useMemo(
    () => items.filter((item) => item.sourceType === 'private').length,
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

  const loadTenders = useCallback(async (query = '') => {
    try {
      setLoading(true);
      const params = { q: query };
      if (sourceFilter !== 'all') {
        params.sourceType = sourceFilter;
      }
      if (categoryFilter !== 'all') {
        params.category = categoryFilter;
      }
      if (districtFilter.trim()) {
        params.district = districtFilter.trim();
      }
      if (amountMin !== '') {
        params.amountGte = Number(amountMin);
      }
      if (amountMax !== '') {
        params.amountLte = Number(amountMax);
      }
      if (deadlineWindow !== '') {
        params.deadlineWithinDays = Number(deadlineWindow);
      }

      const [tenderResponse, bookmarkResponse] = await Promise.all([
        api.get('/tenders/personalized', { params }),
        api.get('/bookmarks'),
      ]);

      setItems(tenderResponse.data.items || []);
      setBookmarks((bookmarkResponse.data.items || []).map((item) => item._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tenders.');
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, categoryFilter, districtFilter, amountMin, amountMax, deadlineWindow]);

  useEffect(() => {
    const id = setTimeout(() => {
      loadTenders(search.trim());
    }, 250);

    return () => clearTimeout(id);
  }, [search, loadTenders]);

  const onBookmark = async (tenderId) => {
    try {
      const response = await api.post('/bookmarks/toggle', { tenderId });
      setBookmarks(response.data.bookmarks || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update bookmark.');
    }
  };

  const clearFilters = () => {
    setSourceFilter('all');
    setCategoryFilter('all');
    setDistrictFilter('');
    setAmountMin('');
    setAmountMax('');
    setDeadlineWindow('');
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
        <p className="mt-1 text-xs text-slate-500">Source mix: PPMO {ppmoCount} | Private-Sector {privateCount}</p>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, tender ID, or entity"
          />
          <button type="button" className="btn-secondary" onClick={() => loadTenders(search.trim())}>Refresh</button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn-secondary ${sourceFilter === 'all' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceFilter('all')}>All Tenders</button>
            <button type="button" className={`btn-secondary ${sourceFilter === 'ppmo' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceFilter('ppmo')}>PPMO</button>
            <button type="button" className={`btn-secondary ${sourceFilter === 'private' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceFilter('private')}>Private-Sector</button>
          </div>

          <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All Categories</option>
            <option value="Works">Works</option>
            <option value="Goods">Goods</option>
            <option value="Consulting">Consulting</option>
            <option value="ICT">ICT</option>
            <option value="Health & Medical">Health & Medical</option>
            <option value="Agriculture">Agriculture</option>
            <option value="Education">Education</option>
            <option value="Energy">Energy</option>
            <option value="Services">Services</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input className="input" value={districtFilter} onChange={(event) => setDistrictFilter(event.target.value)} placeholder="District filter" />
          <input className="input" type="number" min="0" value={amountMin} onChange={(event) => setAmountMin(event.target.value)} placeholder="Min NPR" />
          <input className="input" type="number" min="0" value={amountMax} onChange={(event) => setAmountMax(event.target.value)} placeholder="Max NPR" />
          <select className="input" value={deadlineWindow} onChange={(event) => setDeadlineWindow(event.target.value)}>
            <option value="">Any Deadline</option>
            <option value="3">Next 3 days</option>
            <option value="7">Next 7 days</option>
            <option value="14">Next 14 days</option>
            <option value="30">Next 30 days</option>
          </select>
        </div>

        <div className="mt-2 flex justify-end">
          <button type="button" className="btn-secondary" onClick={clearFilters}>Clear Filters</button>
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
