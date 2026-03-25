import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const DAY_MS = 1000 * 60 * 60 * 24;

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const defaultForm = {
  title: '',
  category: 'Works',
  district: 'Kathmandu',
  location: '',
  amount: '',
  deadlineRaw: '',
  detailUrl: '',
  noticeUrl: '',
  contactEmail: '',
  contactPhone: '',
  requiredDocumentsText: 'Company Registration\nTax Clearance\nPAN/VAT',
};

export const OrganizationPortalPage = () => {
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [summary, setSummary] = useState({
    totalTenders: 0,
    activeTenders: 0,
    totalValue: 0,
    totalBookmarks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const utilizationRate = summary.totalTenders
    ? Math.round((summary.activeTenders / summary.totalTenders) * 100)
    : 0;

  const intelligence = useMemo(() => {
    const now = Date.now();
    const closingSoonIds = new Set();
    const stalePausedIds = new Set();
    const highTractionIds = new Set();
    const newTodayIds = new Set();

    items.forEach((item) => {
      const deadlineMs = parseDateValue(item.deadlineAt || item.deadlineRaw);
      const updatedMs = parseDateValue(item.updatedAt);
      const createdMs = parseDateValue(item.createdAt);
      const bookmarkCount = Number(item.analytics?.bookmarkCount || 0);

      if (item.isActive && deadlineMs && deadlineMs > now && deadlineMs <= now + DAY_MS * 2) {
        closingSoonIds.add(item._id);
      }

      if (!item.isActive && updatedMs && updatedMs <= now - DAY_MS * 7) {
        stalePausedIds.add(item._id);
      }

      if (bookmarkCount >= 5) {
        highTractionIds.add(item._id);
      }

      if (createdMs && createdMs >= now - DAY_MS) {
        newTodayIds.add(item._id);
      }
    });

    return {
      closingSoonIds,
      stalePausedIds,
      highTractionIds,
      newTodayIds,
      closingSoonCount: closingSoonIds.size,
      stalePausedCount: stalePausedIds.size,
      highTractionCount: highTractionIds.size,
      newTodayCount: newTodayIds.size,
    };
  }, [items]);

  const loadPublished = async () => {
    try {
      setLoading(true);
      const response = await api.get('/organization/tenders');
      setItems(response.data.items || []);
      setSummary(
        response.data.summary || {
          totalTenders: 0,
          activeTenders: 0,
          totalValue: 0,
          totalBookmarks: 0,
        }
      );
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load organization tenders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPublished();
  }, []);

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(defaultForm);
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    const deadlineValue = item.deadlineAt ? new Date(item.deadlineAt).toISOString().slice(0, 16) : '';
    setForm({
      title: item.title || '',
      category: item.category || 'Works',
      district: item.district || 'Kathmandu',
      location: item.location || '',
      amount: item.amount || '',
      deadlineRaw: deadlineValue,
      detailUrl: item.detailUrl || '',
      noticeUrl: item.noticeUrl || '',
      contactEmail: item.contactEmail || '',
      contactPhone: item.contactPhone || '',
      requiredDocumentsText: (item.requiredDocuments || []).join('\n') || defaultForm.requiredDocumentsText,
    });
    setStatus('Editing mode enabled. Update fields and save changes.');
  };

  const toggleActive = async (item) => {
    try {
      const response = await api.patch(`/organization/tenders/${item._id}`, {
        isActive: !item.isActive,
      });
      setStatus(response.data.message || 'Tender status updated.');
      await loadPublished();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to update tender status.');
    }
  };

  const publish = async (event) => {
    event.preventDefault();
    setStatus('');

    try {
      const payload = {
        ...form,
        amount: Number(form.amount || 0),
        requiredDocuments: form.requiredDocumentsText
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      const response = editingId
        ? await api.patch(`/organization/tenders/${editingId}`, payload)
        : await api.post('/organization/tenders', payload);
      setStatus(response.data.message || (editingId ? 'Tender updated successfully.' : 'Tender published successfully.'));
      resetForm();
      await loadPublished();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to save private tender.');
    }
  };

  const filteredItems = items.filter((item) => {
    const haystack = `${item.title || ''} ${item.tenderId || ''} ${item.district || ''} ${item.category || ''}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'paused' && !item.isActive);
    const matchesPriority =
      priorityFilter === 'all' ||
      (priorityFilter === 'closing-soon' && intelligence.closingSoonIds.has(item._id)) ||
      (priorityFilter === 'stale-paused' && intelligence.stalePausedIds.has(item._id)) ||
      (priorityFilter === 'high-traction' && intelligence.highTractionIds.has(item._id)) ||
      (priorityFilter === 'new-today' && intelligence.newTodayIds.has(item._id));

    return matchesSearch && matchesStatus && matchesPriority;
  }).sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Publisher Workspace</p>
        <h2 className="page-title">Publish And Manage Private Tenders</h2>
        <p className="page-subtitle">Run a complete publisher workflow: draft opportunities, monitor vendor interest, and optimize tender status by timeline.</p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publisher Workflow</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">1. Draft with amount, deadline, contact channel, and document requirements.</div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">2. Publish and track vendor traction from bookmarks and engagement trends.</div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">3. Optimize lifecycle by pausing, reactivating, or updating tenders based on hiring demand.</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Published</p>
            <p className="mt-1 text-xl font-bold">{summary.totalTenders}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Active</p>
            <p className="mt-1 text-xl font-bold">{summary.activeTenders}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Total Value</p>
            <p className="mt-1 text-xl font-bold">NPR {Number(summary.totalValue || 0).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Vendor Traction</p>
            <p className="mt-1 text-xl font-bold">{summary.totalBookmarks}</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publishing Utilization</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${utilizationRate}%` }} />
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-700">{utilizationRate}% active tenders</p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publisher Intelligence</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <button type="button" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left" onClick={() => setPriorityFilter('closing-soon')}>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Closing in 48h</p>
              <p className="mt-1 text-xl font-bold text-amber-900">{intelligence.closingSoonCount}</p>
              <p className="mt-1 text-xs text-amber-700">Priority follow-up required</p>
            </button>
            <button type="button" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-left" onClick={() => setPriorityFilter('stale-paused')}>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Paused {'>'} 7 Days</p>
              <p className="mt-1 text-xl font-bold text-rose-900">{intelligence.stalePausedCount}</p>
              <p className="mt-1 text-xs text-rose-700">Needs lifecycle decision</p>
            </button>
            <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left" onClick={() => setPriorityFilter('high-traction')}>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">High Traction</p>
              <p className="mt-1 text-xl font-bold text-emerald-900">{intelligence.highTractionCount}</p>
              <p className="mt-1 text-xs text-emerald-700">5+ vendor bookmarks</p>
            </button>
            <button type="button" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-left" onClick={() => setPriorityFilter('new-today')}>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Published Today</p>
              <p className="mt-1 text-xl font-bold text-sky-900">{intelligence.newTodayCount}</p>
              <p className="mt-1 text-xs text-sky-700">New opportunities in last 24h</p>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <p className="font-semibold uppercase tracking-wide text-slate-500">Focus: {priorityFilter.replace('-', ' ')}</p>
            {priorityFilter !== 'all' ? (
              <button type="button" className="text-brand-700 underline" onClick={() => setPriorityFilter('all')}>Clear Focus</button>
            ) : null}
          </div>
        </div>
      </article>

      {status ? <div className="status-info">{status}</div> : null}

      <article className="card p-4">
        <h3 className="section-title">{editingId ? 'Edit Private Tender' : 'New Private Tender'}</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={publish}>
          <label className="md:col-span-2">
            <span className="label">Tender Title</span>
            <input className="input" value={form.title} onChange={update('title')} required />
          </label>

          <label>
            <span className="label">Category</span>
            <select className="input" value={form.category} onChange={update('category')}>
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
          </label>

          <label>
            <span className="label">District</span>
            <input className="input" value={form.district} onChange={update('district')} required />
          </label>

          <label>
            <span className="label">Location</span>
            <input className="input" value={form.location} onChange={update('location')} placeholder="Area or site location" />
          </label>

          <label>
            <span className="label">Tender Amount (NPR)</span>
            <input className="input" type="number" min="0" value={form.amount} onChange={update('amount')} required />
          </label>

          <label>
            <span className="label">Deadline</span>
            <input className="input" type="datetime-local" value={form.deadlineRaw} onChange={update('deadlineRaw')} required />
          </label>

          <label>
            <span className="label">Detail URL</span>
            <input className="input" value={form.detailUrl} onChange={update('detailUrl')} placeholder="https://..." />
          </label>

          <label>
            <span className="label">Notice URL</span>
            <input className="input" value={form.noticeUrl} onChange={update('noticeUrl')} placeholder="https://..." />
          </label>

          <label>
            <span className="label">Contact Email</span>
            <input className="input" type="email" value={form.contactEmail} onChange={update('contactEmail')} />
          </label>

          <label>
            <span className="label">Contact Phone</span>
            <input className="input" value={form.contactPhone} onChange={update('contactPhone')} />
          </label>

          <label className="md:col-span-2">
            <span className="label">Required Documents (one per line)</span>
            <textarea className="input min-h-28" value={form.requiredDocumentsText} onChange={update('requiredDocumentsText')} />
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">{editingId ? 'Save Changes' : 'Publish Tender'}</button>
            {editingId ? (
              <button type="button" className="btn-secondary" onClick={resetForm}>Cancel Edit</button>
            ) : null}
          </div>
        </form>
      </article>

      <article className="card p-4">
        <h3 className="section-title">Published Tenders</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, ID, district, category"
          />
          <select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`btn-secondary ${priorityFilter === 'all' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setPriorityFilter('all')}>All</button>
          <button type="button" className={`btn-secondary ${priorityFilter === 'closing-soon' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setPriorityFilter('closing-soon')}>Closing in 48h</button>
          <button type="button" className={`btn-secondary ${priorityFilter === 'high-traction' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setPriorityFilter('high-traction')}>High Traction</button>
          <button type="button" className={`btn-secondary ${priorityFilter === 'stale-paused' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setPriorityFilter('stale-paused')}>Paused {'>'} 7d</button>
          <button type="button" className={`btn-secondary ${priorityFilter === 'new-today' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setPriorityFilter('new-today')}>Published Today</button>
        </div>

        <div className="mt-2 flex justify-end">
          <button type="button" className="btn-secondary" onClick={loadPublished}>Refresh List</button>
        </div>

        {loading ? <p className="mt-3 text-sm text-slate-500">Loading published tenders...</p> : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {filteredItems.map((item) => (
            <div key={item._id} className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Private Tender</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
              <p className="mt-1 text-xs text-slate-500">{item.category} | {item.district}</p>
              <p className="mt-1 text-xs text-slate-700">NPR {Number(item.amount || 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Deadline: {item.deadlineRaw || 'N/A'}</p>
              <p className="mt-1 text-xs font-semibold text-slate-700">Bookmarked by vendors: {item.analytics?.bookmarkCount || 0}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <p className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {item.isActive ? 'Active' : 'Paused'}
                </p>
                {intelligence.closingSoonIds.has(item._id) ? <p className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Closing {'<'} 48h</p> : null}
                {intelligence.stalePausedIds.has(item._id) ? <p className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">Paused {'>'} 7d</p> : null}
                {intelligence.highTractionIds.has(item._id) ? <p className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">High Traction</p> : null}
                {intelligence.newTodayIds.has(item._id) ? <p className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Published Today</p> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={() => startEdit(item)}>Edit</button>
                <button type="button" className="btn-secondary" onClick={() => toggleActive(item)}>
                  {item.isActive ? 'Pause' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {!loading && !filteredItems.length ? <p className="mt-3 text-sm text-slate-500">No private tenders found for current search/filter.</p> : null}
      </article>
    </section>
  );
};
