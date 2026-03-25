import { MessageCircle, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const JV_SELECTION_STORAGE_KEY = 'avasar_jv_partner_selection';

const parseStoredSelections = () => {
  try {
    const raw = localStorage.getItem(JV_SELECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const JVPage = () => {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [feedTenders, setFeedTenders] = useState([]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [activeJvTenderIds, setActiveJvTenderIds] = useState([]);
  const [partners, setPartners] = useState([]);
  const [toggling, setToggling] = useState(false);

  const activeSet = useMemo(
    () => new Set((activeJvTenderIds || []).map((item) => String(item))),
    [activeJvTenderIds]
  );

  const jvEnabled = selectedTenderId ? activeSet.has(String(selectedTenderId)) : false;

  const loadTenderPicker = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/tenders/personalized', { params: { limit: 30 } });
      const items = response.data?.items || [];
      setFeedTenders(items);
      setSelectedTenderId((prev) => {
        if (prev && items.some((item) => item._id === prev)) {
          return prev;
        }
        return items[0]?._id || '';
      });
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load feed tenders for JV.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPartners = useCallback(async (tenderId) => {
    if (!tenderId) {
      setPartners([]);
      return;
    }

    try {
      const response = await api.get(`/jv/partners/${tenderId}`);
      setPartners(response.data?.partners || []);
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load JV partner list.');
    }
  }, []);

  useEffect(() => {
    loadTenderPicker();
  }, [loadTenderPicker]);

  useEffect(() => {
    setActiveJvTenderIds((user?.activeJVBids || []).map((item) => String(item)));
  }, [user?.activeJVBids]);

  useEffect(() => {
    const enabled = selectedTenderId ? activeSet.has(String(selectedTenderId)) : false;

    if (enabled) {
      loadPartners(selectedTenderId);
    } else {
      setPartners([]);
    }
  }, [selectedTenderId, activeSet, loadPartners]);

  const updateJvToggle = async (enabled) => {
    if (!selectedTenderId) {
      setStatus('Select a tender first.');
      return;
    }

    try {
      setToggling(true);
      const response = await api.post('/jv/join', {
        tenderId: selectedTenderId,
        enabled,
      });

      const nextIds = (response.data?.activeJVBids || []).map((item) => String(item));
      setActiveJvTenderIds(nextIds);
      await refreshUser();
      setStatus(response.data?.message || 'JV participation updated.');

      if (enabled) {
        await loadPartners(selectedTenderId);
      } else {
        setPartners([]);
      }
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to update JV participation.');
    } finally {
      setToggling(false);
    }
  };

  const storeSelectedPartner = (partner) => {
    if (!selectedTenderId || !partner) {
      return;
    }

    const current = parseStoredSelections();
    current[selectedTenderId] = {
      partnerId: partner._id,
      partnerName: partner.name,
      partnerCapacity: Number(partner.capacity || 0),
      selectedAt: new Date().toISOString(),
    };

    localStorage.setItem(JV_SELECTION_STORAGE_KEY, JSON.stringify(current));
    setStatus(`JV partner selected for match score: ${partner.name}`);
  };

  const selectedTender = feedTenders.find((item) => item._id === selectedTenderId);

  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <article className="card p-4 md:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">JV Workspace</p>
          <h2 className="page-title">Specific Tender JV Matching</h2>
          <p className="page-subtitle">Enable JV participation tender-wise and connect with active vendors fast.</p>

          <div className="mt-4 max-w-xl">
            <label>
              <span className="label">Tender Picker</span>
              <select className="input" value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
                <option value="">Select tender from feed</option>
                {feedTenders.map((item) => (
                  <option key={item._id} value={item._id}>{item.tenderId} - {item.title}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedTender ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-800">Selected Tender</p>
              <p className="mt-1">{selectedTender.title}</p>
              <p className="mt-1 text-xs text-slate-500">{selectedTender.tenderId} | {selectedTender.category} | {selectedTender.district}</p>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Available for Joint Venture</p>
                <p className="mt-1 text-sm text-slate-700">Set availability status for this tender from your live feed.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={jvEnabled}
                  className={`relative h-8 w-14 rounded-full border transition ${jvEnabled ? 'border-emerald-400 bg-emerald-500' : 'border-slate-300 bg-slate-300'} ${!selectedTenderId || toggling ? 'opacity-70' : ''}`}
                  disabled={!selectedTenderId || toggling}
                  onClick={() => updateJvToggle(!jvEnabled)}
                >
                  <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${jvEnabled ? 'left-7' : 'left-0.5'}`} />
                </button>
                <p className={`text-sm font-semibold ${jvEnabled ? 'text-emerald-700' : 'text-slate-700'}`}>
                  {toggling ? 'Updating...' : jvEnabled ? 'Currently Available' : 'Currently Not Available'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">If not participating, keep this tender as Not Available for Joint Venture.</p>
          </div>
        </article>

        <article className="card p-4 md:p-5">
          <h3 className="section-title">Active Vendors seeking JV for this Tender.</h3>
          <p className="mt-1 text-sm text-slate-500">Corporate/B2B discovery list for rapid partner outreach.</p>

          {!jvEnabled && selectedTenderId ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Enable JV Participation for this tender to discover active partners.
            </div>
          ) : null}

          {jvEnabled ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {partners.map((partner) => {
                const message = encodeURIComponent(
                  `Avasar Patra JV Request\nTender: ${selectedTender?.title || ''}\nCompany: ${partner.name}\nLet's discuss JV participation for this bid.`
                );

                return (
                  <article key={partner._id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-base font-semibold text-slate-800">{partner.name}</p>
                    <p className="mt-1 text-sm text-slate-600">Category: {partner.category}</p>
                    <p className="mt-1 text-sm text-slate-600">District: {partner.district}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer" className="btn-secondary">
                        <MessageCircle size={14} /> WhatsApp Connect
                      </a>
                      <button type="button" className="btn-secondary" onClick={() => storeSelectedPartner(partner)}>
                        Use for Match Score
                      </button>
                    </div>
                  </article>
                );
              })}

              {partners.length === 0 ? (
                <p className="text-sm text-slate-500">No active vendors seeking JV for this tender yet.</p>
              ) : null}
            </div>
          ) : null}
        </article>

        {status ? <div className="status-info">{status}</div> : null}
        {loading ? <div className="status-info">Loading JV workspace...</div> : null}
      </div>

      <aside className="space-y-4">
        <article className="card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-700" />
            <h3 className="text-sm font-bold">PPMO JV Compliance</h3>
          </div>

          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Max 3 Partners</li>
            <li>Designate Lead Partner</li>
            <li>Submit JV Agreement with Bid</li>
          </ul>
        </article>
      </aside>
    </section>
  );
};
