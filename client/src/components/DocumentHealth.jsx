import { AlertOctagon, AlertTriangle, CheckCircle2, FileWarning, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '../api/client';

const initialState = {
  bidReadyScore: 0,
  readinessLabel: 'Critical gaps',
  blockers: {
    missingCount: 0,
    expiredCount: 0,
    expiringSoonCount: 0,
  },
};

export const DocumentHealth = () => {
  const [health, setHealth] = useState(initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await api.get('/documents');
        const compliance = response.data?.compliance || initialState;

        if (!cancelled) {
          setHealth({
            bidReadyScore: compliance.bidReadyScore || 0,
            readinessLabel: compliance.readinessLabel || 'Critical gaps',
            blockers: compliance.blockers || initialState.blockers,
          });
        }
      } catch {
        if (!cancelled) {
          setHealth(initialState);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-500" />
        <h3 className="text-sm font-bold text-slate-900">Document Health</h3>
      </div>

      {loading ? <p className="mt-2 text-xs text-slate-500">Checking Document Vault...</p> : null}

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Bid-Ready Score</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{health.bidReadyScore}%</p>
        <p className="mt-1 text-xs text-slate-600">{health.readinessLabel}</p>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <FileWarning size={14} className="text-amber-500" /> Missing
          </span>
          <span className="font-semibold text-slate-900">{health.blockers?.missingCount || 0}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <AlertTriangle size={14} className="text-amber-500" /> Expiring Soon
          </span>
          <span className="font-semibold text-slate-900">{health.blockers?.expiringSoonCount || 0}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <AlertOctagon size={14} className="text-amber-500" /> Expired
          </span>
          <span className="font-semibold text-slate-900">{health.blockers?.expiredCount || 0}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-sm">
          <span className="flex items-center gap-2 text-slate-700">
            <CheckCircle2 size={14} className="text-emerald-500" /> Valid Core Docs
          </span>
          <span className="font-semibold text-slate-900">{Math.max(0, 3 - Number(health.blockers?.missingCount || 0))}</span>
        </div>
      </div>
    </article>
  );
};
