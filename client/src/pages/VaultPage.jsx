import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const docs = [
  { key: 'panVat', label: 'PAN/VAT Certificate' },
  { key: 'taxClearance', label: 'Tax Clearance' },
  { key: 'companyRegistration', label: 'Company Registration' },
];

export const VaultPage = () => {
  const { refreshUser } = useAuth();
  const [documents, setDocuments] = useState({});
  const [expiry, setExpiry] = useState({});
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
    setExpiry(response.data.expiry || {});
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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => (
          <article key={doc.key} className="card p-4">
            <h3 className="text-base font-semibold">{doc.label}</h3>
            <p className="mt-1 text-sm text-muted">{documents[doc.key]?.originalName || 'Not uploaded yet'}</p>
            <p className="mt-2 text-xs text-slate-500">
              {expiry[doc.key]?.isExpired
                ? 'Expired'
                : expiry[doc.key]?.isExpiringSoon
                  ? `Expiring in ${expiry[doc.key]?.expiresInDays} day(s)`
                  : expiry[doc.key]?.expiresInDays != null
                    ? `Valid for ${expiry[doc.key]?.expiresInDays} day(s)`
                    : 'No expiry date set'}
            </p>

            <div className="mt-3 space-y-3">
              <label>
                <span className="label">Upload Document</span>
                <input className="input" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => upload(doc.key, event.target.files?.[0])} />
              </label>

              <label>
                <span className="label">Expiry Date</span>
                <input className="input" type="date" value={expiryInputs[doc.key] || ''} onChange={(event) => setExpiryInputs((prev) => ({ ...prev, [doc.key]: event.target.value }))} />
              </label>

              <button type="button" className="btn-secondary" onClick={() => saveExpiry(doc.key)}>Save Expiry</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
