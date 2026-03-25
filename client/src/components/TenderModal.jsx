import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';

export const TenderModal = ({ tender, onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  if (!tender) {
    return null;
  }

  const checklist = tender.checklist || [];
  const links = [
    ...(tender.noticeUrl ? [{ label: 'Notice PDF', url: tender.noticeUrl, type: 'pdf' }] : []),
    ...(tender.detailUrl ? [{ label: 'Detail Page', url: tender.detailUrl, type: 'detail' }] : []),
    ...((tender.documentLinks || []).filter((item) => item?.url) || []),
  ].filter(
    (item, index, arr) => arr.findIndex((entry) => entry.url === item.url) === index
  );

  const previewPdfUrl =
    links.find((item) => item.type === 'pdf')?.url ||
    links.find((item) => item.url?.toLowerCase().includes('.pdf'))?.url ||
    '';

  const recommendation = tender.insight?.recommendation;
  const deadlineRisk = tender.insight?.deadlineRisk;
  const documentGap = tender.insight?.documentGap;
  const topReasons = tender.insight?.topReasons || [];

  const exportExecutiveBrief = async () => {
    try {
      setExporting(true);
      setExportStatus('Preparing PDF brief...');

      const response = await api.get(`/tenders/${tender._id}/executive-brief.pdf`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${String(tender.tenderId || tender.title || 'executive-brief').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-brief.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      setExportStatus('Executive brief downloaded.');
    } catch (error) {
      setExportStatus(error.response?.data?.message || 'Failed to export PDF brief.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4" onClick={onClose} role="presentation">
      <div className="card relative max-h-[90vh] w-full max-w-3xl overflow-auto p-5" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="btn-secondary absolute right-4 top-4 px-2 py-2" onClick={onClose}>
          <X size={16} />
        </button>

        <h3 className="pr-14 text-xl font-bold">{tender.title}</h3>
        <p className="mt-1 text-sm text-muted">{tender.procuringEntity}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="kpi-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tender ID</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{tender.tenderId}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expected Value</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">NPR {Number(tender.amount || 0).toLocaleString()}</p>
          </div>
          <div className="kpi-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{tender.deadlineRaw || 'Refer to notice for exact deadline'}</p>
          </div>
        </div>

        {recommendation ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="section-title">Go/No-Go Recommendation</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="kpi-card md:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision</p>
                <p className="mt-1 text-base font-bold text-slate-800">{recommendation.label}</p>
                <p className="text-xs text-slate-500">Confidence {recommendation.confidence}%</p>
              </div>
              <div className="kpi-card md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Why</p>
                <p className="mt-1 text-sm text-slate-700">{recommendation.reason}</p>
                {tender.insight?.executiveSummary ? (
                  <p className="mt-2 text-xs text-slate-500">{tender.insight.executiveSummary}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {deadlineRisk ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="section-title">Deadline Risk Timeline</h4>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
              <div className="kpi-card">
                <p className="text-xs uppercase tracking-wide text-slate-500">Risk Level</p>
                <p className="mt-1 font-semibold">{deadlineRisk.label}</p>
              </div>
              <div className="kpi-card">
                <p className="text-xs uppercase tracking-wide text-slate-500">Days Left</p>
                <p className="mt-1 font-semibold">{deadlineRisk.daysLeft == null ? 'Unknown' : deadlineRisk.daysLeft}</p>
              </div>
              <div className="kpi-card">
                <p className="text-xs uppercase tracking-wide text-slate-500">Action</p>
                <p className="mt-1 text-xs">{deadlineRisk.recommendation}</p>
              </div>
            </div>
          </div>
        ) : null}

        {topReasons.length ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="section-title">Fit Score Explainability</h4>
            <div className="mt-3 space-y-2">
              {topReasons.map((item) => (
                <div key={item.title} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <p className="text-xs font-semibold text-slate-500">{item.score}/{item.max}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {documentGap ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="section-title">Document Gap Assistant</h4>
            <p className="mt-2 text-sm text-slate-700">Readiness: {documentGap.readyPercent}%</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing</p>
                <ul className="mt-2 list-disc pl-4 text-sm text-slate-700">
                  {documentGap.missing.length ? documentGap.missing.map((item) => <li key={item}>{item}</li>) : <li>None</li>}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expiring Soon</p>
                <ul className="mt-2 list-disc pl-4 text-sm text-slate-700">
                  {documentGap.expiringSoon.length ? documentGap.expiringSoon.map((item) => <li key={item}>{item}</li>) : <li>None</li>}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {links.length ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="section-title">Official Notice And Documents</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={exportExecutiveBrief}
                disabled={exporting}
              >
                {exporting ? 'Generating...' : 'Export Executive PDF'}
              </button>
              {links.map((item) => (
                <a
                  key={`${item.url}-${item.label}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                >
                  {item.label || 'Open document'}
                </a>
              ))}
            </div>
            {exportStatus ? <p className="mt-3 text-xs text-slate-600">{exportStatus}</p> : null}
          </div>
        ) : null}

        {previewPdfUrl ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="section-title">Notice Preview (PDF)</h4>
            <iframe
              title="Tender notice preview"
              src={previewPdfUrl}
              className="mt-3 min-h-[360px] w-full rounded-xl border border-slate-200"
            />
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="section-title">Avasar Checklist ({tender.category})</h4>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
