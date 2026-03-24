import { useEffect, useState } from 'react';
import api from '../api/client';

export const BookmarksPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/bookmarks');
        setItems(response.data.items || []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Shortlist</p>
        <h2 className="page-title">Tracked Tenders</h2>
        <p className="page-subtitle">Keep your most important opportunities in one place.</p>

        <div className="mt-4 max-w-xs">
          <div className="kpi-card">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Tracked</p>
            <p className="mt-1 text-2xl font-bold">{items.length}</p>
          </div>
        </div>
      </article>

      {loading ? <div className="status-info">Loading bookmarks...</div> : null}

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item._id} className="card p-4">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">{item.procuringEntity}</p>
            <p className="mt-2 text-xs text-slate-500">{item.district} | {item.category} | {item.tenderId}</p>
          </article>
        ))}
      </div>

      {!loading && !items.length ? <p className="text-sm text-slate-500">You have not tracked any tender yet.</p> : null}
    </section>
  );
};
