import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, CheckCircle2, Info, XCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { calculateDocStatus, getNepaliFiscalYearFromExpiry } from '../utils/documentStatus';

const docs = [
  { key: 'panVat', label: 'PAN/VAT Certificate' },
  { key: 'taxClearance', label: 'Tax Clearance' },
  { key: 'companyRegistration', label: 'Company Registration' },
];

const badgeClassByVariant = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  destructive: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

const iconByVariant = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  neutral: BadgeCheck,
};

const StatusBadge = ({ status }) => {
  const Icon = iconByVariant[status.variant] || BadgeCheck;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${badgeClassByVariant[status.variant] || badgeClassByVariant.neutral}`}>
      <Icon size={12} />
      {status.label}
    </span>
  );
};

export const VaultPage = () => {
  const { refreshUser } = useAuth();
  const [documents, setDocuments] = useState({});
  const [compliance, setCompliance] = useState({
    bidReadyScore: 0,
    readinessLabel: 'Critical gaps',
    blockers: { missingCount: 0, expiredCount: 0, expiringSoonCount: 0 },
    categoryGuides: [],
  });
  const [activeCategory, setActiveCategory] = useState('Works');
  const [expiryInputs, setExpiryInputs] = useState({});
  const [status, setStatus] = useState('');

  const activeGuide =
    compliance.categoryGuides.find((item) => item.category === activeCategory) ||
    compliance.categoryGuides[0] ||
    null;

  const loadVault = useCallback(async () => {
    const response = await api.get('/documents');
    setDocuments(response.data.documents || {});
    setCompliance(
      response.data.compliance || {
        bidReadyScore: 0,
        readinessLabel: 'Critical gaps',
        blockers: { missingCount: 0, expiredCount: 0, expiringSoonCount: 0 },
        categoryGuides: [],
      }
    );
  }, []);

  useEffect(() => {
    (async () => {
      await loadVault();
    })();
  }, [loadVault]);

  const upload = async (docType, file) => {
    if (!file) {
      return;
    }

    setStatus('Uploading...');

    try {
      const form = new FormData();
      form.append('docType', docType);
      form.append('file', file);

      const response = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setDocuments(response.data.documents || {});
      await loadVault();
      await refreshUser();
      setStatus('Upload successful.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Upload failed.');
    }
  };

  const saveExpiry = async (docType) => {
    try {
      const response = await api.patch('/documents/expiry', {
        docType,
        expiresAt: expiryInputs[docType] || null,
      });

      setDocuments(response.data.documents || {});
      await loadVault();
      await refreshUser();
      setStatus('Expiry updated.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to update expiry.');
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Compliance</p>
        <h2 className="page-title">Document Vault</h2>
        <p className="page-subtitle">Keep required files and expiry dates in one clean place.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="kpi-card md:col-span-2">
            <p className="text-xs text-slate-500">Bid-Ready Score</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600" style={{ width: `${compliance.bidReadyScore || 0}%` }} />
            </div>
            <p className="mt-2 text-xl font-bold">{compliance.bidReadyScore || 0}%</p>
            <p className="text-xs text-slate-500">{compliance.readinessLabel || 'Critical gaps'}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Missing Docs</p>
            <p className="mt-2 text-xl font-bold">{compliance.blockers?.missingCount || 0}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs text-slate-500">Expired Docs</p>
            <p className="mt-2 text-xl font-bold">{compliance.blockers?.expiredCount || 0}</p>
          </div>
        </div>
      </article>

      {status ? <div className="status-info">{status}</div> : null}

      <article className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Smart Checklist Guide</h3>
          <select className="input max-w-xs" value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)}>
            {(compliance.categoryGuides || []).map((item) => (
              <option key={item.category} value={item.category}>{item.category}</option>
            ))}
          </select>
        </div>

        {activeGuide ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">Required Documents</p>
              <div className="mt-2 space-y-2">
                {(activeGuide.requiredDocs || []).map((item) => (
                  <div key={item.key} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">
                      {!item.available
                        ? 'Missing'
                        : item.isExpired
                          ? 'Expired'
                          : item.isExpiringSoon
                            ? `Expiring in ${item.expiresInDays} day(s)`
                            : 'Available and valid'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">Category Guide Items</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {(activeGuide.checklistItems || []).map((item) => (
                  <li key={item.label}>{item.label}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Checklist guide will appear after loading compliance data.</p>
        )}
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <article key={doc.key} className="card p-4 md:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">{doc.label}</h3>
                <p className="mt-1 text-sm text-muted">{documents[doc.key]?.originalName || 'Not uploaded yet'}</p>
              </div>
              {doc.key === 'panVat' ? (
                <StatusBadge status={{ label: 'Last Verified', variant: 'neutral' }} />
              ) : (
                <StatusBadge status={calculateDocStatus(documents[doc.key]?.expiresAt || expiryInputs[doc.key])} />
              )}
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              {doc.key === 'panVat' ? (
                <p>
                  <span className="font-semibold text-slate-700">Last Verified:</span>{' '}
                  {documents[doc.key]?.uploadedAt ? new Date(documents[doc.key].uploadedAt).toLocaleDateString() : 'Not verified yet'}
                </p>
              ) : doc.key === 'taxClearance' ? (
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold text-slate-700">Fiscal Year:</span> {getNepaliFiscalYearFromExpiry(documents[doc.key]?.expiresAt || expiryInputs[doc.key])}
                  </p>
                  <p className="flex items-center gap-1 text-slate-500">
                    <Info size={12} />
                    <span title="Valid until the next filing deadline (Mangsir end)">Valid until the next filing deadline (Mangsir end)</span>
                  </p>
                </div>
              ) : (
                <p>
                  <span className="font-semibold text-slate-700">Expiry:</span>{' '}
                  {documents[doc.key]?.expiresAt ? new Date(documents[doc.key].expiresAt).toLocaleDateString() : 'Not set'}
                </p>
              )}
            </div>

            <div className="mt-3 space-y-3">
              <label>
                <span className="label">Upload Document</span>
                <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => upload(doc.key, event.target.files?.[0])} />
              </label>

              {doc.key !== 'panVat' ? (
                <>
                  <label>
                    <span className="label">Expiry Date</span>
                    <input className="input" type="date" value={expiryInputs[doc.key] || ''} onChange={(event) => setExpiryInputs((prev) => ({ ...prev, [doc.key]: event.target.value }))} />
                  </label>

                  <button type="button" className="btn-secondary" onClick={() => saveExpiry(doc.key)}>Save Expiry</button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
