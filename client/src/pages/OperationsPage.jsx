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

const emptyOutcome = { result: 'pending', reason: '', learning: '' };

const estimateFieldMeta = [
  { key: 'emdAmount', label: 'EMD Amount' },
  { key: 'documentCost', label: 'Document Cost' },
  { key: 'logisticsCost', label: 'Logistics Cost' },
  { key: 'laborCost', label: 'Labor Cost' },
  { key: 'contingencyCost', label: 'Contingency Cost' },
];

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const formatCurrency = (value) => `NPR ${Number(value || 0).toLocaleString()}`;

const getTenderDaysLeft = (tender) => {
  const deadlineSource = tender?.deadlineAt || tender?.deadlineRaw;
  if (!deadlineSource) {
    return null;
  }

  const deadline = new Date(deadlineSource).getTime();
  if (Number.isNaN(deadline)) {
    return null;
  }

  return Math.ceil((deadline - Date.now()) / (1000 * 60 * 60 * 24));
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
  const [outcome, setOutcome] = useState(emptyOutcome);
  const [simulation, setSimulation] = useState(null);
  const [autoPlanResult, setAutoPlanResult] = useState(null);
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

      const tracked = data.trackedTenders || [];
      setSelectedTenderId((prev) => {
        if (!tracked.length) {
          return '';
        }

        if (prev && tracked.some((item) => item._id === prev)) {
          return prev;
        }

        return tracked[0]._id;
      });
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load operations board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  const selectedPipeline = useMemo(
    () => board.pipelines.find((item) => item.tender?._id === selectedTenderId) || null,
    [board.pipelines, selectedTenderId]
  );

  useEffect(() => {
    if (!selectedPipeline) {
      setEstimate(emptyEstimate);
      return;
    }

    if (!selectedPipeline?.estimate) {
      setEstimate(emptyEstimate);
      return;
    }

    const nextEstimate = selectedPipeline.estimate || {};
    setEstimate((prev) => ({
      ...prev,
      emdAmount: nextEstimate.emdAmount ?? '',
      documentCost: nextEstimate.documentCost ?? '',
      logisticsCost: nextEstimate.logisticsCost ?? '',
      laborCost: nextEstimate.laborCost ?? '',
      contingencyCost: nextEstimate.contingencyCost ?? '',
      notes: nextEstimate.notes || '',
    }));
  }, [selectedPipeline]);

  useEffect(() => {
    if (!selectedPipeline?.outcome) {
      setOutcome(emptyOutcome);
      return;
    }

    setOutcome({
      result: selectedPipeline.outcome.result || 'pending',
      reason: selectedPipeline.outcome.reason || '',
      learning: selectedPipeline.outcome.learning || '',
    });
  }, [selectedPipeline]);

  useEffect(() => {
    setSimulation(null);
    setAutoPlanResult(null);
  }, [selectedTenderId]);

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
      setStatus('Feasibility analysis updated. Review cost risk and recommendation below.');
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
      setAutoPlanResult(response.data || null);
      setStatus(response.data.message || 'Execution plan generated.');
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
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (assignment.dueAt && new Date(assignment.dueAt).getTime() < today.getTime()) {
        setStatus('Due date cannot be in the past.');
        return;
      }

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

  const selectedTender = useMemo(
    () => board.trackedTenders.find((item) => item._id === selectedTenderId) || null,
    [board.trackedTenders, selectedTenderId]
  );

  const hasTrackedTenders = board.trackedTenders.length > 0;
  const selectedDaysLeft = getTenderDaysLeft(selectedTender);

  const assignmentList = useMemo(
    () => (selectedPipeline ? selectedPipeline.assignments || [] : []),
    [selectedPipeline]
  );

  const pendingAssignmentsCount = assignmentList.filter((item) => !item.done).length;

  const dueSoonAssignmentsCount = assignmentList.filter((item) => {
    if (item.done || !item.dueAt) {
      return false;
    }

    const dueMs = new Date(item.dueAt).getTime();
    if (Number.isNaN(dueMs)) {
      return false;
    }

    const diffDays = Math.ceil((dueMs - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 2;
  }).length;

  const nextActionText = useMemo(() => {
    if (!hasTrackedTenders) {
      return 'Bookmark relevant tenders from Feed to start operations.';
    }

    if (!selectedTenderId) {
      return 'Select a tracked tender to continue.';
    }

    if (!selectedPipeline?.estimate || Number(selectedPipeline.estimatedTotal || 0) === 0) {
      return 'Add bid cost estimate and run feasibility analysis.';
    }

    if (!(selectedPipeline.assignments || []).length) {
      return 'Generate task plan and assign owners.';
    }

    if ((selectedPipeline.assignmentProgress || 0) < 100) {
      return 'Complete pending assignments before submission.';
    }

    if (!selectedPipeline.outcome || selectedPipeline.outcome.result === 'pending') {
      return 'Record post-mortem outcome to capture team learnings.';
    }

    return 'Workflow complete. Move to next tender in pipeline.';
  }, [hasTrackedTenders, selectedTenderId, selectedPipeline]);

  const workflowSteps = useMemo(() => {
    const readiness = board.summary.readinessScore || 0;
    const taskProgress = selectedPipeline?.assignmentProgress || 0;
    const feasibility = simulation?.feasibilityScore || selectedPipeline?.feasibilityScore || 0;

    return [
      {
        title: '1. Compliance Ready',
        score: clampPercent(readiness),
        detail: 'Upload and validate core documents before bid preparation.',
      },
      {
        title: '2. Cost Feasibility',
        score: clampPercent(feasibility),
        detail: 'Use cost inputs to test whether this bid is budget-safe.',
      },
      {
        title: '3. Task Execution',
        score: clampPercent(taskProgress),
        detail: 'Assign and complete execution tasks on time.',
      },
      {
        title: '4. Outcome Capture',
        score: selectedPipeline?.outcome?.result && selectedPipeline.outcome.result !== 'pending' ? 100 : 20,
        detail: 'Record result and learning for future bid quality.',
      },
    ];
  }, [board.summary.readinessScore, selectedPipeline, simulation]);

  const timelineBuckets = [
    { key: 'closingSoon', label: 'Closing Soon' },
    { key: 'thisWeek', label: 'This Week' },
    { key: 'upcoming', label: 'Upcoming' },
  ];

  return (
    <section className="space-y-4">
      <article className="card p-5 md:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Execution</p>
            <h2 className="page-title">Operations Workspace</h2>
            <p className="page-subtitle">Simple 4-step workflow: select tender, validate feasibility, execute assignments, and capture outcomes.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="kpi-card"><p className="text-xs text-slate-500">Readiness</p><p className="text-lg font-bold">{clampPercent(board.summary.readinessScore)}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Feasibility</p><p className="text-lg font-bold">{clampPercent(board.summary.averageFeasibility)}%</p></div>
            <div className="kpi-card"><p className="text-xs text-slate-500">Urgent</p><p className="text-lg font-bold">{board.summary.highUrgencyCount}</p></div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Next Best Action</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{nextActionText}</p>
        </div>

        <div className="mt-4 max-w-lg">
          <label>
            <span className="label">Step 1: Select Tracked Tender</span>
            <select className="input" value={selectedTenderId} onChange={(event) => setSelectedTenderId(event.target.value)}>
              <option value="">Select tracked tender</option>
              {board.trackedTenders.map((item) => (
                <option key={item._id} value={item._id}>{item.tenderId} - {item.title}</option>
              ))}
            </select>
          </label>
        </div>

        {!hasTrackedTenders && !loading ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No tracked tenders yet. Bookmark tenders from Feed first, then return here to estimate cost, assign tasks, and record outcomes.
          </div>
        ) : null}

        {selectedTender ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">Selected Tender</p>
            <p className="mt-1">{selectedTender.title}</p>
            <p className="mt-1 text-xs text-slate-500">
              {selectedTender.tenderId} | {selectedTender.category} | {selectedTender.district}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{formatCurrency(selectedTender.amount)}</span>
              {selectedDaysLeft != null ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${selectedDaysLeft <= 2 ? 'bg-amber-100 text-amber-800' : selectedDaysLeft <= 7 ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {selectedDaysLeft < 0 ? 'Closed' : `${selectedDaysLeft} day(s) left`}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={runSimulation} disabled={simulating || !selectedTenderId}>
            {simulating ? 'Analyzing...' : 'Analyze Feasibility'}
          </button>
          <button type="button" className="btn-primary" onClick={generateAutoPlan} disabled={autoPlanning || !selectedTenderId}>
            {autoPlanning ? 'Generating...' : 'Generate Task Plan'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">What does Analyze Feasibility do?</p>
            <p className="mt-1">It simulates your cost assumptions and returns budget fit, risk level, and go/hold/no-go guidance.</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-800">What does Generate Task Plan do?</p>
            <p className="mt-1">It creates smart execution tasks from category checklist and deadline urgency, avoiding duplicates.</p>
          </div>
        </div>
      </article>

      {status ? <div className="status-info">{status}</div> : null}
      {loading ? <div className="status-info">Loading operations board...</div> : null}

      {hasTrackedTenders ? (
        <div className="grid gap-3 lg:grid-cols-4">
          <article className="card p-4 lg:col-span-4">
            <h3 className="section-title">Workflow Progress</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step) => (
                <div key={step.title} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">{step.title}</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-brand-600" style={{ width: `${step.score}%` }} />
                  </div>
                  <p className="mt-2 text-sm font-bold">{step.score}%</p>
                  <p className="mt-1 text-xs text-slate-500">{step.detail}</p>
                </div>
              ))}
            </div>
          </article>

          {timelineBuckets.map((bucket) => (
            <article key={bucket.key} className="card p-4">
              <h3 className="section-title">{bucket.label}</h3>
              <div className="mt-3 grid gap-2">
                {(board.timeline[bucket.key] || []).slice(0, 5).map((item) => (
                  <div key={item._id} className="rounded-xl border border-slate-200 p-2">
                    <p className="text-sm font-semibold line-clamp-2">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.tenderId} | Match {item.matchPercent}%</p>
                  </div>
                ))}
                {!board.timeline[bucket.key]?.length ? <p className="text-xs text-slate-500">No tenders in this bucket.</p> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {hasTrackedTenders ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="card p-4">
            <h3 className="section-title">Step 2: Cost Estimation</h3>
            <form className="mt-3 grid gap-3" onSubmit={submitEstimate}>
              {estimateFieldMeta.map((field) => (
                <label key={field.key}>
                  <span className="label">{field.label}</span>
                  <input className="input" type="number" min="0" value={estimate[field.key]} onChange={updateEstimateValue(field.key)} />
                </label>
              ))}
              <label>
                <span className="label">Notes</span>
                <input className="input" value={estimate.notes} onChange={updateEstimateValue('notes')} />
              </label>
              <p className="text-sm font-semibold">Estimated Total: {formatCurrency(estimatedTotal)}</p>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary">Save Estimate</button>
              </div>
            </form>

            {simulation ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="text-sm font-semibold text-slate-800">Feasibility Result</h4>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="kpi-card"><p className="text-xs text-slate-500">Feasibility</p><p className="font-bold">{simulation.feasibilityScore}%</p></div>
                  <div className="kpi-card"><p className="text-xs text-slate-500">Budget Fit</p><p className="font-bold">{simulation.budgetFit}%</p></div>
                  <div className="kpi-card"><p className="text-xs text-slate-500">Cost Risk</p><p className="font-bold">{simulation.costRiskLevel}</p></div>
                  <div className="kpi-card"><p className="text-xs text-slate-500">Decision</p><p className="font-bold">{simulation.recommendation?.label || 'N/A'}</p></div>
                </div>
                <p className="mt-2 text-xs text-slate-600">{simulation.note}</p>
              </div>
            ) : null}

            {autoPlanResult ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold text-slate-800">Generated Task Plan</h4>
                <p className="mt-1 text-xs text-slate-600">Tasks added: {autoPlanResult.generatedCount || 0}</p>
                <p className="mt-1 text-xs text-slate-600">Recommendation: {autoPlanResult.recommendation?.label || 'N/A'}</p>
              </div>
            ) : null}
          </article>

          <article className="card p-4">
            <h3 className="section-title">Step 3: Team Execution</h3>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <div className="kpi-card"><p className="text-xs text-slate-500">Pending Tasks</p><p className="text-lg font-bold">{pendingAssignmentsCount}</p></div>
              <div className="kpi-card"><p className="text-xs text-slate-500">Due in 48h</p><p className="text-lg font-bold">{dueSoonAssignmentsCount}</p></div>
            </div>

            <form className="mt-3 grid gap-3" onSubmit={addAssignment}>
              <label><span className="label">Member Name</span><input className="input" value={assignment.memberName} onChange={(event) => setAssignment((prev) => ({ ...prev, memberName: event.target.value }))} required /></label>
              <label><span className="label">Role</span><input className="input" value={assignment.role} onChange={(event) => setAssignment((prev) => ({ ...prev, role: event.target.value }))} required /></label>
              <label><span className="label">Task</span><input className="input" value={assignment.task} onChange={(event) => setAssignment((prev) => ({ ...prev, task: event.target.value }))} required /></label>
              <label><span className="label">Due Date</span><input className="input" type="date" value={assignment.dueAt} onChange={(event) => setAssignment((prev) => ({ ...prev, dueAt: event.target.value }))} /></label>
              <button type="submit" className="btn-primary">Add Assignment</button>
            </form>
          </article>
        </div>
      ) : null}

      {hasTrackedTenders ? (
        <article className="card p-4">
          <h3 className="section-title">Step 4: Submission Post-Mortem</h3>
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
      ) : null}

      {hasTrackedTenders ? (
        <article className="card p-4">
          <h3 className="section-title">Assignment Tracker</h3>
          <div className="mt-3 grid gap-3">
            {(selectedPipeline ? [selectedPipeline] : board.pipelines).flatMap((pipeline) =>
              (pipeline.assignments || []).map((item) => (
                <div key={item._id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold">{item.task}</p>
                  <p className="mt-1 text-sm text-muted">{pipeline.tender?.title || 'Tender removed'} | {item.memberName} ({item.role})</p>
                  <p className="mt-1 text-xs text-slate-500">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'No due date set'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {item.done ? 'Done' : 'Pending'}
                    </span>
                    {!item.done ? <button type="button" className="btn-secondary" onClick={() => markDone(pipeline._id, item._id)}>Mark done</button> : null}
                  </div>
                </div>
              ))
            )}
            {(selectedPipeline ? [selectedPipeline] : board.pipelines).every((pipeline) => !(pipeline.assignments || []).length) ? (
              <p className="text-sm text-slate-500">No assignments yet. Add tasks to start execution tracking.</p>
            ) : null}
          </div>
          {selectedPipeline ? <p className="mt-3 text-xs text-slate-500">Showing assignments for selected tender only.</p> : null}
        </article>
      ) : null}
    </section>
  );
};
