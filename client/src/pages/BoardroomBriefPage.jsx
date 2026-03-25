import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const emptyScenario = {
  emdAmount: 50000,
  documentCost: 30000,
  logisticsCost: 70000,
  laborCost: 180000,
  contingencyCost: 35000,
};

export const BoardroomBriefPage = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [simulation, setSimulation] = useState(null);
  const [simulationStatus, setSimulationStatus] = useState('');
  const [simulationError, setSimulationError] = useState('');
  const [scenario, setScenario] = useState(emptyScenario);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectedTender = useMemo(
    () => items.find((item) => item._id === selectedTenderId) || null,
    [items, selectedTenderId]
  );

  const loadBoardroom = async () => {
    try {
      setLoading(true);
      // Pull a wider personalized set so executives can switch options without extra API clicks.
      const response = await api.get('/tenders/personalized', { params: { limit: 30 } });
      const tenders = response.data.items || [];
      setItems(tenders);

      const preferred = tenders.find((item) => item.insight?.recommendation?.decision === 'go') || tenders[0] || null;
      if (preferred) {
        setSelectedTenderId(preferred._id);
      } else {
        setSelectedTenderId('');
      }
      setStatus('Boardroom data loaded.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load boardroom data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadBoardroom();
    })();
  }, []);

  useEffect(() => {
    setSimulation(null);
    setSimulationStatus('');
    setSimulationError('');
  }, [selectedTenderId]);

  const runSimulation = async () => {
    if (!selectedTenderId) {
      setSimulationError('Select a tender first.');
      return;
    }

    try {
      setRunningSimulation(true);
      setSimulationError('');
      // Keep simulator feedback local so failures are visible near the action area.
      setSimulationStatus('Running what-if simulation...');
      const response = await api.post('/operations/simulate', {
        tenderId: selectedTenderId,
        ...scenario,
      });
      setSimulation(response.data || null);
      setSimulationStatus('Scenario simulation updated.');
      setStatus('Scenario simulation updated.');
    } catch (error) {
      const isEndpointMissing = error.response?.status === 404;
      const message = isEndpointMissing
        ? 'Simulation endpoint not found. Restart backend server to load latest routes.'
        : error.response?.data?.message || 'Failed to run simulation.';
      setSimulationError(message);
      setSimulationStatus('');
      setStatus(message);
    } finally {
      setRunningSimulation(false);
    }
  };

  const exportPdf = async () => {
    if (!selectedTenderId) {
      setStatus('Select a tender first.');
      return;
    }

    try {
      setDownloading(true);
      const response = await api.get(`/tenders/${selectedTenderId}/executive-brief.pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${String(selectedTender?.tenderId || 'executive-brief').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-executive-brief.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setStatus('Executive brief downloaded.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to export executive brief.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Executive View</p>
            <h2 className="page-title">Boardroom Brief</h2>
            <p className="page-subtitle">One screen for recommendation, simulation, and exportable decision brief.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={loadBoardroom}>Refresh</button>
            <button type="button" className="btn-primary" onClick={exportPdf} disabled={downloading || !selectedTenderId}>
              {downloading ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-xl">
          <label>
            <span className="label">Tender for Boardroom Review</span>
            <select className="input" value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
              <option value="">Select tender</option>
              {items.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.tenderId} - {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <article className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Decision Summary</h3>
        </div>

        {selectedTender ? (
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <div className="kpi-card"><p className="text-xs text-slate-500">Match</p><p className="text-xl font-bold">{selectedTender.matchPercent}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Decision</p><p className="text-xl font-bold">{selectedTender.insight?.recommendation?.label || 'N/A'}</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Confidence</p><p className="text-xl font-bold">{selectedTender.insight?.recommendation?.confidence || 0}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Doc Ready</p><p className="text-xl font-bold">{selectedTender.insight?.documentGap?.readyPercent || 0}%</p></div>
            <div className="md:col-span-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              {selectedTender.insight?.executiveSummary || 'No executive summary available.'}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No tender selected.</p>
        )}
      </article>

      <article className="card p-4">
        <h3 className="section-title">What-If Cost Simulator</h3>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.keys(scenario).map((key) => (
            <label key={key}>
              <span className="label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <input
                className="input"
                type="number"
                min="0"
                value={scenario[key]}
                onChange={(event) => setScenario((prev) => ({ ...prev, [key]: Number(event.target.value || 0) }))}
              />
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={runSimulation} disabled={runningSimulation || !selectedTenderId}>
            {runningSimulation ? 'Running...' : 'Run Simulation'}
          </button>
        </div>

        {simulationStatus ? <div className="status-info mt-3">{simulationStatus}</div> : null}
        {simulationError ? <div className="status-error mt-3">{simulationError}</div> : null}

        {simulation ? (
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <div className="kpi-card"><p className="text-xs text-slate-500">Feasibility</p><p className="text-lg font-bold">{simulation.feasibilityScore}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Budget Fit</p><p className="text-lg font-bold">{simulation.budgetFit}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Risk</p><p className="text-lg font-bold">{simulation.costRiskLevel}</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Decision</p><p className="text-lg font-bold">{simulation.recommendation?.label || 'N/A'}</p></div>
            <div className="md:col-span-4 rounded-xl border border-slate-200 p-3 text-xs text-slate-600">{simulation.note}</div>
          </div>
        ) : null}
      </article>

      {status ? <div className="status-info">{status}</div> : null}
      {loading ? <div className="status-info">Loading boardroom data...</div> : null}
    </section>
  );
};
