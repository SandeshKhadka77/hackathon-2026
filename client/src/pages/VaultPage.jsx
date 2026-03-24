import { useEffect, useState } from 'react';
import api from '../api/client';

const docs = [
  { key: 'panVat', label: 'PAN/VAT Certificate' },
  { key: 'taxClearance', label: 'Tax Clearance' },
  { key: 'companyRegistration', label: 'Company Registration' },
];

export const VaultPage = () => {
  const [documents, setDocuments] = useState({});
  const [expiry, setExpiry] = useState({});
  const [expiryInputs, setExpiryInputs] = useState({});
  const [status, setStatus] = useState('');

  useEffect(() => {
    (async () => {
      const response = await api.get('/documents');
      setDocuments(response.data.documents || {});
      setExpiry(response.data.expiry || {});
    })();
  }, []);

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
      const fresh = await api.get('/documents');
      setExpiry(fresh.data.expiry || {});
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
      const fresh = await api.get('/documents');
      setExpiry(fresh.data.expiry || {});
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
      </article>

      {status ? <div className="status-info">{status}</div> : null}

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
