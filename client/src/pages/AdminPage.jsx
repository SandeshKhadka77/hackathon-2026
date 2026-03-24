import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

export const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState({ points: [], summary: {} });
  const [trendFilters, setTrendFilters] = useState({
    category: 'all',
    vendorGroup: 'all',
    days: 14,
  });
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [sendingDigest, setSendingDigest] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const statsResponse = await api.get('/admin/stats');
      setStats(statsResponse.data);
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load stats.');
    }
  }, []);

  const loadTrends = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        days: String(trendFilters.days || 14),
        category: trendFilters.category || 'all',
        vendorGroup: trendFilters.vendorGroup || 'all',
      });
      const trendResponse = await api.get(`/admin/trends?${params.toString()}`);
      setTrends(trendResponse.data || { points: [], summary: {} });
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load trend stats.');
    }
  }, [trendFilters.days, trendFilters.category, trendFilters.vendorGroup]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const trendMax = useMemo(() => {
    return {
      notifications: Math.max(1, ...((trends.points || []).map((item) => item.notifications) || [1])),
      winRate: Math.max(1, ...((trends.points || []).map((item) => item.winRate) || [1])),
      alertScore: Math.max(1, ...((trends.points || []).map((item) => item.avgAlertScore) || [1])),
    };
  }, [trends]);

  const runScraper = async () => {
    setRunning(true);
    setStatus('Scraper is running...');

    try {
      const response = await api.post('/admin/run-scraper');
      setStatus(
        `Scraper complete. ${response.data.totalScraped} scraped, ${response.data.createdCount} new, ${response.data.emailedCount || 0} quick-match emails, ${response.data.digestSent || 0} digests sent.`
      );
      await loadStats();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to run scraper.');
    } finally {
      setRunning(false);
    }
  };

  const sendDigests = async () => {
    setSendingDigest(true);

    try {
      const response = await api.post('/admin/send-digests');
      setStatus(`Digest batch completed. ${response.data.sent || 0}/${response.data.attempted || 0} emails sent.`);
      await loadStats();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to send digests.');
    } finally {
      setSendingDigest(false);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Admin</p>
        <h2 className="page-title">Platform Dashboard</h2>
        <p className="page-subtitle">Monitor growth, quality, and automation performance from one clean panel.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="kpi-card"><p className="text-xs text-slate-500">Users</p><p className="text-xl font-bold">{stats?.userCount || 0}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Active Tenders</p><p className="text-xl font-bold">{stats?.activeTenderCount || 0}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Avg Alert</p><p className="text-xl font-bold">{stats?.intelligence?.avgAlertScore || 0}%</p></div>
        </div>
      </article>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={loadStats}>Refresh Stats</button>
        <button type="button" className="btn-secondary" onClick={loadTrends}>Refresh Trends</button>
        <button type="button" className="btn-primary" onClick={runScraper} disabled={running}>{running ? 'Running...' : 'Run Scraper'}</button>
        <button type="button" className="btn-primary" onClick={sendDigests} disabled={sendingDigest}>{sendingDigest ? 'Sending...' : 'Send Digests'}</button>
      </div>

      {status ? <div className="status-info">{status}</div> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Total Users', stats.userCount],
            ['Total Tenders', stats.tenderCount],
            ['Active Tenders', stats.activeTenderCount],
            ['Deadlines in 24h', stats.urgency?.deadline24hCount || 0],
            ['Deadlines in 7d', stats.urgency?.deadline7dCount || 0],
            ['Notifications (24h)', stats.notifications?.notification24hCount || 0],
            ['Emails Sent (24h)', stats.notifications?.emailed24hCount || 0],
            ['Avg Parse Confidence', `${stats.scraper?.avgParseConfidence || 0}%`],
            ['Win Rate', `${stats.intelligence?.winRate || 0}%`],
            ['Avg Alert (7d)', `${stats.intelligence?.avgAlertScore || 0}%`],
          ].map(([label, value]) => (
            <article key={label} className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-xl font-bold">{value}</p>
            </article>
          ))}
        </div>
      ) : null}

      {trends?.points?.length ? (
        <article className="card p-4">
          <h3 className="section-title">Momentum Trends</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label>
              <span className="label">Category</span>
              <select className="input" value={trendFilters.category} onChange={(event) => setTrendFilters((prev) => ({ ...prev, category: event.target.value }))}>
                <option value="all">All</option>
                <option value="Works">Works</option>
                <option value="Goods">Goods</option>
                <option value="Consulting">Consulting</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label>
              <span className="label">Vendor Group</span>
              <select className="input" value={trendFilters.vendorGroup} onChange={(event) => setTrendFilters((prev) => ({ ...prev, vendorGroup: event.target.value }))}>
                <option value="all">All</option>
                <option value="Small">Small</option>
                <option value="Medium">Medium</option>
                <option value="Large">Large</option>
                <option value="Consortium">Consortium</option>
              </select>
            </label>
            <label>
              <span className="label">Window</span>
              <select className="input" value={trendFilters.days} onChange={(event) => setTrendFilters((prev) => ({ ...prev, days: Number(event.target.value || 14) }))}>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(trends.points || []).map((point) => (
              <article key={point.date} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold">{point.date.slice(5)}</p>
                <div className="mt-2 space-y-2 text-xs text-slate-600">
                  <div>
                    <div className="mb-1 flex justify-between"><span>Notif</span><span>{point.notifications}</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.round((point.notifications / trendMax.notifications) * 100)}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between"><span>Alert</span><span>{point.avgAlertScore}%</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.round((point.avgAlertScore / trendMax.alertScore) * 100)}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between"><span>Win</span><span>{point.winRate}%</span></div>
                    <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-500" style={{ width: `${Math.round((point.winRate / trendMax.winRate) * 100)}%` }} /></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
};
