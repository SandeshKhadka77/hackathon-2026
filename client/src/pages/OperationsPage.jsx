import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const emptyEstimate = {
  emdAmount: '',
  documentCost: '',
  logisticsCost: '',
  laborCost: '',
  contingencyCost: '',
  notes: '',
};

export const OperationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [board, setBoard] = useState({
    timeline: { closingSoon: [], thisWeek: [], upcoming: [] },
    trackedTenders: [],
    pipelines: [],
    summary: {
      readinessScore: 0,
      averageFeasibility: 0,
      averageAssignmentProgress: 0,
      highUrgencyCount: 0,
    },
  });

  const [selectedTenderId, setSelectedTenderId] = useState('');
  const [estimate, setEstimate] = useState(emptyEstimate);
  const [assignment, setAssignment] = useState({ memberName: '', role: '', task: '', dueAt: '' });
  const [outcome, setOutcome] = useState({ result: 'pending', reason: '', learning: '' });
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [autoPlanning, setAutoPlanning] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/operations/board');
      const data = response.data || {};
      setBoard({
        timeline: data.timeline || { closingSoon: [], thisWeek: [], upcoming: [] },
        trackedTenders: data.trackedTenders || [],
        pipelines: data.pipelines || [],
        summary: data.summary || {
          readinessScore: 0,
          averageFeasibility: 0,
          averageAssignmentProgress: 0,
          highUrgencyCount: 0,
        },
      });

      if (!selectedTenderId && data.trackedTenders?.length) {
        setSelectedTenderId(data.trackedTenders[0]._id);
      }
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load operations board.');
    } finally {
      setLoading(false);
    }
  }, [selectedTenderId]);

  useEffect(() => {
    (async () => {
      await loadBoard();
    })();
  }, [loadBoard]);

  const estimatedTotal = useMemo(() => {
    const num = (value) => Number(value || 0);
    return num(estimate.emdAmount) + num(estimate.documentCost) + num(estimate.logisticsCost) + num(estimate.laborCost) + num(estimate.contingencyCost);
  }, [estimate]);

  const updateEstimateValue = (key) => (event) => setEstimate((prev) => ({ ...prev, [key]: event.target.value }));

  const submitEstimate = async (event) => {
    event.preventDefault();
    if (!selectedTenderId) {
      setStatus('Select a tracked tender first.');
      return;
    }

    try {
      const response = await api.post('/operations/estimate', { tenderId: selectedTenderId, ...estimate });
      setStatus(response.data.message || 'Estimate saved.');
      await loadBoard();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to save estimate.');
    }
  };

  const runSimulation = async () => {
    if (!selectedTenderId) {
      setStatus('Select a tracked tender first.');
      return;
    }

    try {
      setSimulating(true);
      const response = await api.post('/operations/simulate', { tenderId: selectedTenderId, ...estimate });
      setSimulation(response.data || null);
      setStatus('What-if simulation updated.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to run what-if simulation.');
    } finally {
      setSimulating(false);
    }
  };

  const generateAutoPlan = async () => {
    if (!selectedTenderId) {
      setStatus('Select a tracked tender first.');
      return;
    }

    try {
      setAutoPlanning(true);
      const response = await api.post('/operations/auto-plan', { tenderId: selectedTenderId });
      setStatus(response.data.message || 'Auto plan generated.');
      await loadBoard();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to generate auto plan.');
    } finally {
      setAutoPlanning(false);
    }
  };

  const addAssignment = async (event) => {
    event.preventDefault();

    if (!selectedTenderId) {
      setStatus('Select a tracked tender first.');
      return;
    }

    try {
      const response = await api.post('/operations/assignments', {
        tenderId: selectedTenderId,
        ...assignment,
      });
      setStatus(response.data.message || 'Assignment added.');
      setAssignment({ memberName: '', role: '', task: '', dueAt: '' });
      await loadBoard();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to add assignment.');
    }
  };

  const markDone = async (pipelineId, assignmentId) => {
    try {
      const response = await api.patch(`/operations/assignments/${pipelineId}/${assignmentId}/done`);
      setStatus(response.data.message || 'Assignment updated.');
      await loadBoard();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to mark assignment done.');
    }
  };

  const submitOutcome = async (event) => {
    event.preventDefault();

    if (!selectedTenderId) {
      setStatus('Select a tracked tender first.');
      return;
    }

    try {
      const response = await api.post('/operations/outcome', {
        tenderId: selectedTenderId,
        ...outcome,
      });
      setStatus(response.data.message || 'Outcome recorded.');
      await loadBoard();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to record outcome.');
    }
  };

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Execution</p>
            <h2 className="page-title">Operations Workspace</h2>
            <p className="page-subtitle">Track readiness, assign tasks, estimate costs, and capture outcomes.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="kpi-card"><p className="text-xs text-slate-500">Readiness</p><p className="text-lg font-bold">{board.summary.readinessScore}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Feasibility</p><p className="text-lg font-bold">{board.summary.averageFeasibility}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Urgent</p><p className="text-lg font-bold">{board.summary.highUrgencyCount}</p></div>
          </div>
        </div>

        <div className="mt-4 max-w-lg">
          <label>
            <span className="label">Active Tracked Tender</span>
            <select className="input" value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
              <option value="">Select tracked tender</option>
              {board.trackedTenders.map((item) => (
                <option key={item._id} value={item._id}>{item.tenderId} - {item.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={runSimulation} disabled={simulating}>
            {simulating ? 'Simulating...' : 'Run What-If'}
          </button>
          <button type="button" className="btn-primary" onClick={generateAutoPlan} disabled={autoPlanning}>
            {autoPlanning ? 'Generating...' : 'Auto-Generate Plan'}
          </button>
        </div>
      </article>

      {status ? <div className="status-info">{status}</div> : null}
      {loading ? <div className="status-info">Loading operations board...</div> : null}

      <div className="grid gap-3 lg:grid-cols-4">
        <article className="card p-4">
          <h3 className="section-title">Readiness Snapshot</h3>
          <div className="mt-3 grid gap-2 text-sm">
            <div className="kpi-card"><p>Document Readiness</p><p className="font-bold">{board.summary.readinessScore}%</p></div>
            <div className="kpi-card"><p>Avg Feasibility</p><p className="font-bold">{board.summary.averageFeasibility}%</p></div>
            <div className="kpi-card"><p>Task Progress</p><p className="font-bold">{board.summary.averageAssignmentProgress}%</p></div>
          </div>
        </article>

        {['closingSoon', 'thisWeek', 'upcoming'].map((key) => (
          <article key={key} className="card p-4">
            <h3 className="section-title">{key === 'closingSoon' ? 'Closing Soon' : key === 'thisWeek' ? 'This Week' : 'Upcoming'}</h3>
            <div className="mt-3 grid gap-2">
              {(board.timeline[key] || []).map((item) => (
                <div key={item._id} className="rounded-xl border border-slate-200 p-2">
                  <p className="text-sm font-semibold line-clamp-2">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.tenderId} | Match {item.matchPercent}%</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card p-4">
          <h3 className="section-title">Bid Cost Estimator</h3>
          <form className="mt-3 grid gap-3" onSubmit={submitEstimate}>
            {['emdAmount', 'documentCost', 'logisticsCost', 'laborCost', 'contingencyCost'].map((field) => (
              <label key={field}>
                <span className="label">{field.replace(/([A-Z])/g, ' $1').trim()}</span>
                <input className="input" type="number" min="0" value={estimate[field]} onChange={updateEstimateValue(field)} />
              </label>
            ))}
            <label>
              <span className="label">Notes</span>
              <input className="input" value={estimate.notes} onChange={updateEstimateValue('notes')} />
            </label>
            <p className="text-sm font-semibold">Estimated Total: NPR {estimatedTotal.toLocaleString()}</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">Save Estimate</button>
              <button type="button" className="btn-secondary" onClick={runSimulation} disabled={simulating}>
                {simulating ? 'Simulating...' : 'Simulate Impact'}
              </button>
            </div>
          </form>

          {simulation ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-sm font-semibold text-slate-800">What-If Outcome</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="kpi-card"><p className="text-xs text-slate-500">Feasibility</p><p className="font-bold">{simulation.feasibilityScore}%</p></div>
                <div className="kpi-card"><p className="text-xs text-slate-500">Budget Fit</p><p className="font-bold">{simulation.budgetFit}%</p></div>
                <div className="kpi-card"><p className="text-xs text-slate-500">Cost Risk</p><p className="font-bold">{simulation.costRiskLevel}</p></div>
                <div className="kpi-card"><p className="text-xs text-slate-500">Decision</p><p className="font-bold">{simulation.recommendation?.label || 'N/A'}</p></div>
              </div>
              <p className="mt-2 text-xs text-slate-600">{simulation.note}</p>
            </div>
          ) : null}
        </article>

        <article className="card p-4">
          <h3 className="section-title">Team Assignment</h3>
          <form className="mt-3 grid gap-3" onSubmit={addAssignment}>
            <label><span className="label">Member Name</span><input className="input" value={assignment.memberName} onChange={(event) => setAssignment((prev) => ({ ...prev, memberName: event.target.value }))} required /></label>
            <label><span className="label">Role</span><input className="input" value={assignment.role} onChange={(event) => setAssignment((prev) => ({ ...prev, role: event.target.value }))} required /></label>
            <label><span className="label">Task</span><input className="input" value={assignment.task} onChange={(event) => setAssignment((prev) => ({ ...prev, task: event.target.value }))} required /></label>
            <label><span className="label">Due Date</span><input className="input" type="date" value={assignment.dueAt} onChange={(event) => setAssignment((prev) => ({ ...prev, dueAt: event.target.value }))} /></label>
            <button type="submit" className="btn-primary">Add Assignment</button>
          </form>
        </article>
      </div>

      <article className="card p-4">
        <h3 className="section-title">Submission Post-Mortem</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={submitOutcome}>
          <label>
            <span className="label">Result</span>
            <select className="input" value={outcome.result} onChange={(event) => setOutcome((prev) => ({ ...prev, result: event.target.value }))}>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </label>
          <label>
            <span className="label">Reason</span>
            <input className="input" value={outcome.reason} onChange={(event) => setOutcome((prev) => ({ ...prev, reason: event.target.value }))} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Learning</span>
            <input className="input" value={outcome.learning} onChange={(event) => setOutcome((prev) => ({ ...prev, learning: event.target.value }))} />
          </label>
          <button type="submit" className="btn-primary md:col-span-2">Save Post-Mortem</button>
        </form>
      </article>

      <article className="card p-4">
        <h3 className="section-title">Assignment Tracker</h3>
        <div className="mt-3 grid gap-3">
          {board.pipelines.flatMap((pipeline) =>
            (pipeline.assignments || []).map((item) => (
              <div key={item._id} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold">{item.task}</p>
                <p className="mt-1 text-sm text-muted">{pipeline.tender?.title || 'Tender removed'} | {item.memberName} ({item.role})</p>
                <p className="mt-1 text-xs text-slate-500">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'No due date set'}</p>
                {!item.done ? <button type="button" className="btn-secondary mt-2" onClick={() => markDone(pipeline._id, item._id)}>Mark done</button> : null}
              </div>
            ))
          )}
        </div>
      </article>
    </section>
  );
};
