import { useEffect, useState } from 'react';
import api from '../api/client';

export const NotificationsPage = () => {
  const [items, setItems] = useState([]);
  const [preferences, setPreferences] = useState({
    emailEnabled: true,
    inAppEnabled: true,
    quickMatchAlerts: true,
    digestEnabled: true,
    digestHour: 8,
    maxAlertsPerRun: 8,
    minimumMatchPercent: 60,
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      const [notificationsResponse, preferencesResponse] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/preferences'),
      ]);

      setItems(notificationsResponse.data.items || []);
      setPreferences((prev) => ({ ...prev, ...(preferencesResponse.data.preferences || {}) }));
    })();
  }, []);

  const markAsRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((item) => (item._id === id ? { ...item, isRead: true } : item)));
  };

  const updatePreferences = async () => {
    try {
      const response = await api.patch('/notifications/preferences', preferences);
      setPreferences((prev) => ({ ...prev, ...(response.data.preferences || {}) }));
      setStatus('Notification preferences saved.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to save preferences.');
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Alerts</p>
        <h2 className="page-title">Notifications</h2>
        <p className="page-subtitle">Keep settings simple: control channels, threshold, and digest timing.</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="kpi-card"><p className="text-xs text-slate-500">Total</p><p className="text-xl font-bold">{items.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Unread</p><p className="text-xl font-bold">{items.filter((item) => !item.isRead).length}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Digest</p><p className="text-xl font-bold">{preferences.digestEnabled ? 'On' : 'Off'}</p></div>
        </div>
      </article>

      {status ? <div className="status-info">{status}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card p-4">
          <h3 className="section-title">Alert Settings</h3>
          <div className="mt-3 grid gap-3">
            <label>
              <span className="label">Email Notifications</span>
              <select className="input" value={preferences.emailEnabled ? 'on' : 'off'} onChange={(event) => setPreferences((prev) => ({ ...prev, emailEnabled: event.target.value === 'on' }))}>
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </label>

            <label>
              <span className="label">In-App Notifications</span>
              <select className="input" value={preferences.inAppEnabled ? 'on' : 'off'} onChange={(event) => setPreferences((prev) => ({ ...prev, inAppEnabled: event.target.value === 'on' }))}>
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </label>

            <label>
              <span className="label">Quick Match Emails</span>
              <select className="input" value={preferences.quickMatchAlerts ? 'on' : 'off'} onChange={(event) => setPreferences((prev) => ({ ...prev, quickMatchAlerts: event.target.value === 'on' }))}>
                <option value="on">Enabled</option>
                <option value="off">Disabled</option>
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Digest Hour</span>
                <input className="input" type="number" min="0" max="23" value={preferences.digestHour} onChange={(event) => setPreferences((prev) => ({ ...prev, digestHour: Number(event.target.value || 8) }))} />
              </label>
              <label>
                <span className="label">Max Alerts Per Run</span>
                <input className="input" type="number" min="1" max="30" value={preferences.maxAlertsPerRun} onChange={(event) => setPreferences((prev) => ({ ...prev, maxAlertsPerRun: Number(event.target.value || 8) }))} />
              </label>
            </div>

            <label>
              <span className="label">Minimum Match % For Alert</span>
              <input className="input" type="number" min="30" max="100" value={preferences.minimumMatchPercent} onChange={(event) => setPreferences((prev) => ({ ...prev, minimumMatchPercent: Number(event.target.value || 60) }))} />
            </label>

            <button type="button" className="btn-primary" onClick={updatePreferences}>Save Settings</button>
          </div>
        </article>

        <article className="card p-4">
          <h3 className="section-title">Recent Notifications</h3>
          <div className="mt-3 grid gap-3">
            {items.map((item) => (
              <article key={item._id} className="rounded-xl border border-slate-200 p-3">
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <p className="mt-1 text-sm text-muted">{item.reason}</p>
                {item.metadata?.alertScore ? (
                  <p className="mt-2 text-xs text-slate-500">Alert {item.metadata.alertScore}% ({item.metadata.alertLevel || 'low'}) | Match {item.metadata.matchPercent || 0}%</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                {!item.isRead ? (
                  <button type="button" className="btn-secondary mt-2" onClick={() => markAsRead(item._id)}>Mark as read</button>
                ) : null}
              </article>
            ))}
          </div>
        </article>
      </div>

      {!items.length ? <p className="text-sm text-slate-500">No new notifications right now.</p> : null}
    </section>
  );
};
