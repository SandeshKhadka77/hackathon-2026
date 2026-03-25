import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, UserPlus } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

const defaultChecklist = {
  bidSecurity: false,
  taxClearance: false,
  registration: false,
};

const toDigits = (value = '') => String(value || '').replace(/\D/g, '');

const getMemberKey = (member) => `${String(member.name || '').trim().toLowerCase()}|${toDigits(member.phone)}`;

const mergeMembers = (...groups) => {
  const seen = new Set();
  const merged = [];

  groups
    .flat()
    .filter(Boolean)
    .forEach((member) => {
      const name = String(member.name || '').trim();
      const phone = toDigits(member.phone);
      if (!name) return;

      const normalized = {
        id: member.id || `tm-${name.toLowerCase().replace(/\s+/g, '-')}-${phone || 'np'}`,
        name,
        phone,
      };

      const key = getMemberKey(normalized);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(normalized);
    });

  return merged;
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
};

const formatRecommendation = (value) => {
  if (!value) return 'Continue execution checks';
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const label = value.label || value.decision;
    const confidence = Number(value.confidence);
    const confidenceLabel = Number.isFinite(confidence) ? ` (${Math.round(confidence)}%)` : '';
    const reason = value.reason ? ` - ${value.reason}` : '';
    return `${label || 'Recommendation'}${confidenceLabel}${reason}`;
  }

  return String(value);
};

const getWorkspaceSnapshot = (tenderId, tasksByTender, checklistsByTender) => {
  if (!tenderId) return '';

  return JSON.stringify({
    checklist: { ...defaultChecklist, ...(checklistsByTender[tenderId] || {}) },
    tasks: tasksByTender[tenderId] || [],
  });
};

const buildSavedWorkspaceMap = (tasksByTender, checklistsByTender) => {
  const ids = new Set([...Object.keys(tasksByTender || {}), ...Object.keys(checklistsByTender || {})]);
  const snapshots = {};

  ids.forEach((id) => {
    snapshots[id] = getWorkspaceSnapshot(id, tasksByTender, checklistsByTender);
  });

  return snapshots;
};

const getResultClass = (result) => {
  if (result === 'won') return 'text-emerald-700 bg-emerald-100';
  if (result === 'lost') return 'text-rose-700 bg-rose-100';
  return 'text-slate-700 bg-slate-200';
};

export const OperationsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [activeTenders, setActiveTenders] = useState([]);
  const [closedTenders, setClosedTenders] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [activeTenderId, setActiveTenderId] = useState('');

  const [teamMembers, setTeamMembers] = useState([]);
  const [newMember, setNewMember] = useState({ name: '', phone: '' });

  const [taskInput, setTaskInput] = useState({
    name: '',
    details: '',
    deliverable: '',
    priority: 'medium',
    dueAt: '',
    memberId: '',
  });
  const [tasksByTender, setTasksByTender] = useState({});
  const [checklistsByTender, setChecklistsByTender] = useState({});
  const [savedWorkspaceByTender, setSavedWorkspaceByTender] = useState({});
  const [lastSavedAtByTender, setLastSavedAtByTender] = useState({});
  const infoMessage = loading ? 'Loading operations dashboard...' : status;
  const teamStorageKey = useMemo(
    () => `ops-team-members-${user?.id || user?.email || 'anonymous'}`,
    [user?.id, user?.email]
  );
  const workspaceStorageKey = useMemo(
    () => `ops-workspace-${user?.id || user?.email || 'anonymous'}`,
    [user?.id, user?.email]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(teamStorageKey);
      if (!raw) {
        setTeamMembers([]);
        return;
      }

      const parsed = JSON.parse(raw);
      const persisted = Array.isArray(parsed)
        ? parsed.filter((member) => String(member?.name || '').trim() && toDigits(member?.phone))
        : [];
      setTeamMembers(mergeMembers(persisted));
    } catch {
      setTeamMembers([]);
    }
  }, [teamStorageKey]);

  useEffect(() => {
    localStorage.setItem(teamStorageKey, JSON.stringify(teamMembers));
  }, [teamMembers, teamStorageKey]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(workspaceStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const storedTasks = parsed?.tasksByTender && typeof parsed.tasksByTender === 'object' ? parsed.tasksByTender : {};
      const storedChecklists = parsed?.checklistsByTender && typeof parsed.checklistsByTender === 'object' ? parsed.checklistsByTender : {};
      const storedLastSavedAt = parsed?.lastSavedAtByTender && typeof parsed.lastSavedAtByTender === 'object'
        ? parsed.lastSavedAtByTender
        : {};

      setTasksByTender(storedTasks);
      setChecklistsByTender(storedChecklists);
      setLastSavedAtByTender(storedLastSavedAt);
      setSavedWorkspaceByTender(buildSavedWorkspaceMap(storedTasks, storedChecklists));
    } catch {
      setSavedWorkspaceByTender({});
      setLastSavedAtByTender({});
    }
  }, [workspaceStorageKey]);

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/operations/board');
      const data = response.data || {};
      const trackedTenders = data.trackedTenders || [];
      const boardPipelines = data.pipelines || [];

      const pipelineByTenderId = new Map(
        boardPipelines
          .filter((item) => item?.tender?._id)
          .map((item) => [String(item.tender._id), item])
      );

      const active = trackedTenders.filter((tender) => {
        const pipeline = pipelineByTenderId.get(String(tender._id));
        const result = pipeline?.outcome?.result;
        return !(result && result !== 'pending');
      });

      const closed = trackedTenders
        .map((tender) => {
          const pipeline = pipelineByTenderId.get(String(tender._id));
          const result = pipeline?.outcome?.result;
          if (!result || result === 'pending') return null;

          return { tender, pipeline };
        })
        .filter(Boolean);

      setPipelines(boardPipelines);
      setActiveTenders(active);
      setClosedTenders(closed);

      setActiveTenderId((prev) => {
        if (prev && active.some((item) => item._id === prev)) return prev;
        return active[0]?._id || '';
      });
    } catch (error) {
      setStatus(error.response?.data?.message || 'Failed to load operations dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!activeTenderId) return;
    setChecklistsByTender((prev) => {
      if (prev[activeTenderId]) return prev;
      return { ...prev, [activeTenderId]: { ...defaultChecklist } };
    });
  }, [activeTenderId]);

  const activeTender = useMemo(
    () => activeTenders.find((item) => item._id === activeTenderId) || null,
    [activeTenders, activeTenderId]
  );

  const activePipeline = useMemo(
    () => pipelines.find((item) => item?.tender?._id === activeTenderId) || null,
    [pipelines, activeTenderId]
  );

  const activeChecklist = useMemo(
    () => checklistsByTender[activeTenderId] || defaultChecklist,
    [checklistsByTender, activeTenderId]
  );

  const activeTasks = useMemo(
    () => tasksByTender[activeTenderId] || [],
    [tasksByTender, activeTenderId]
  );

  const checklistCompletion = useMemo(() => {
    const total = Object.keys(defaultChecklist).length;
    const done = Object.values(activeChecklist).filter(Boolean).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [activeChecklist]);

  const taskCompletion = useMemo(() => {
    const total = activeTasks.length;
    const done = activeTasks.filter((task) => task.done).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { done, total, percent };
  }, [activeTasks]);

  const completedTaskCount = useMemo(
    () => activeTasks.filter((task) => task.done).length,
    [activeTasks]
  );

  const pendingTaskCount = Math.max(activeTasks.length - completedTaskCount, 0);

  const hasUnsavedChanges = useMemo(() => {
    if (!activeTenderId) return false;
    const currentSnapshot = getWorkspaceSnapshot(activeTenderId, tasksByTender, checklistsByTender);
    const savedSnapshot = savedWorkspaceByTender[activeTenderId] || '';
    return currentSnapshot !== savedSnapshot;
  }, [activeTenderId, tasksByTender, checklistsByTender, savedWorkspaceByTender]);

  const saveCurrentWorkspace = useCallback(() => {
    if (!activeTenderId) {
      setStatus('Select an active tender first.');
      return false;
    }

    const now = new Date().toISOString();
    const nextLastSaved = { ...lastSavedAtByTender, [activeTenderId]: now };

    localStorage.setItem(
      workspaceStorageKey,
      JSON.stringify({
        tasksByTender,
        checklistsByTender,
        lastSavedAtByTender: nextLastSaved,
      })
    );

    const snapshot = getWorkspaceSnapshot(activeTenderId, tasksByTender, checklistsByTender);
    setLastSavedAtByTender(nextLastSaved);
    setSavedWorkspaceByTender((prev) => ({ ...prev, [activeTenderId]: snapshot }));
    setStatus('Workspace saved for this tender.');
    return true;
  }, [
    activeTenderId,
    checklistsByTender,
    lastSavedAtByTender,
    tasksByTender,
    workspaceStorageKey,
  ]);

  const handleTenderChange = (nextTenderId) => {
    if (!nextTenderId || nextTenderId === activeTenderId) return;

    if (hasUnsavedChanges) {
      const proceedWithSave = window.confirm('You have unsaved workspace changes. Press OK to save and switch tender.');
      if (!proceedWithSave) return;

      const saved = saveCurrentWorkspace();
      if (!saved) return;
    }

    setActiveTenderId(nextTenderId);
    setTaskInput({
      name: '',
      details: '',
      deliverable: '',
      priority: 'medium',
      dueAt: '',
      memberId: '',
    });
  };

  const progressStep = useMemo(() => {
    const checklistDone = Object.values(activeChecklist).every(Boolean);
    const tasksDone = activeTasks.length > 0 && activeTasks.every((task) => task.done);

    if (tasksDone) return 3;
    if (checklistDone) return 2;
    return 1;
  }, [activeChecklist, activeTasks]);

  const steps = ['Tender Active', 'Compliance Ready', 'Team Tasks'];

  const toggleChecklist = (key) => {
    if (!activeTenderId) return;
    setChecklistsByTender((prev) => ({
      ...prev,
      [activeTenderId]: {
        ...(prev[activeTenderId] || defaultChecklist),
        [key]: !(prev[activeTenderId] || defaultChecklist)[key],
      },
    }));
  };

  const addTeamMember = () => {
    const name = newMember.name.trim();
    const phone = toDigits(newMember.phone);

    if (!name || !phone) {
      setStatus('Enter team member name and phone.');
      return;
    }

    const nextMember = {
      id: `tm-${Date.now()}`,
      name,
      phone,
    };

    setTeamMembers((prev) => [...prev, nextMember]);
    setNewMember({ name: '', phone: '' });
    setStatus('Team member added.');
  };

  const addTask = () => {
    if (!activeTenderId) {
      setStatus('Select an active tender first.');
      return;
    }

    const taskName = taskInput.name.trim();
    const taskDetails = taskInput.details.trim();
    const taskDeliverable = taskInput.deliverable.trim();
    const member = teamMembers.find((item) => item.id === taskInput.memberId);

    if (!taskName || !taskDetails || !member) {
      setStatus('Task title, task details, and assignee are required.');
      return;
    }

    const task = {
      id: `task-${Date.now()}`,
      name: taskName,
      memberId: member.id,
      memberName: member.name,
      memberPhone: member.phone,
      details: taskDetails,
      deliverable: taskDeliverable,
      priority: taskInput.priority || 'medium',
      dueAt: taskInput.dueAt || '',
      done: false,
      createdAt: new Date().toISOString(),
    };

    setTasksByTender((prev) => ({
      ...prev,
      [activeTenderId]: [...(prev[activeTenderId] || []), task],
    }));

    setTaskInput({
      name: '',
      details: '',
      deliverable: '',
      priority: 'medium',
      dueAt: '',
      memberId: '',
    });
    setStatus('Task added to active workspace.');
  };

  const toggleTaskDone = (taskId) => {
    if (!activeTenderId) return;

    setTasksByTender((prev) => ({
      ...prev,
      [activeTenderId]: (prev[activeTenderId] || []).map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  };

  const notifyTaskOnWhatsApp = (task) => {
    const member = teamMembers.find((item) => item.id === task.memberId);
    if (!member) {
      setStatus('Assigned team member not found.');
      return;
    }

    if (!member.phone) {
      setStatus('This member has no phone number. Add a phone to send WhatsApp.');
      return;
    }

    const text = `Task: ${task.name} for ${activeTender?.tenderId || 'Tender'}`;
    window.open(`https://wa.me/${member.phone}?text=${encodeURIComponent(text)}`);
  };

  return (
    <section className="space-y-4">
      <article className="card p-4 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Operations</p>
        <h2 className="page-title">Vendor Operations Dashboard</h2>
        <p className="page-subtitle max-w-3xl">Execution-focused workspace for active tenders, team assignment, and closure records.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="kpi-card"><p className="text-xs text-slate-500">Active Tenders</p><p className="text-lg font-bold">{activeTenders.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Closed Tenders</p><p className="text-lg font-bold">{closedTenders.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Team Members</p><p className="text-lg font-bold">{teamMembers.length}</p></div>
          <div className="kpi-card"><p className="text-xs text-slate-500">Open Tasks</p><p className="text-lg font-bold">{activeTasks.filter((task) => !task.done).length}</p></div>
        </div>

        <div className="mt-4 max-w-xl">
          <label>
            <span className="label">Active Tender Selector</span>
            <select className="input" value={activeTenderId} onChange={(event) => handleTenderChange(event.target.value)}>
              <option value="">Select active tender</option>
              {activeTenders.map((item) => (
                <option key={item._id} value={item._id}>{item.tenderId} - {item.title}</option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary" onClick={saveCurrentWorkspace} disabled={!activeTenderId || !hasUnsavedChanges}>
              Save Workspace
            </button>
            <p className="text-xs text-slate-500">
              {activeTenderId
                ? `${hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'} | Last saved: ${formatDateTime(lastSavedAtByTender[activeTenderId])}`
                : 'Select a tender to manage workspace'}
            </p>
          </div>
        </div>

        {infoMessage ? (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
            {infoMessage}
          </div>
        ) : null}
      </article>

      <section className="grid auto-rows-min items-start gap-4 lg:grid-cols-[1.15fr_0.85fr] xl:grid-cols-[1.2fr_0.8fr]">
        <article className="card self-start p-4 md:p-5">
          <h3 className="section-title">Active Workspace</h3>

          {!activeTender ? (
            <p className="mt-3 text-sm text-slate-500">No active tender selected. Track tenders from Feed to start execution.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-slate-800">{activeTender.title}</p>
                <p className="mt-1 text-xs text-slate-500">{activeTender.tenderId} | {activeTender.category} | {activeTender.district}</p>

                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  {steps.map((step, index) => {
                    const isDone = index + 1 <= progressStep;
                    return (
                      <div key={step} className={`rounded-lg border px-2 py-2 text-center text-xs font-semibold ${isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                        {index + 1}. {step}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3 md:p-4">
                <p className="text-sm font-semibold text-slate-800">Compliance Checklist</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={activeChecklist.bidSecurity} onChange={() => toggleChecklist('bidSecurity')} />
                    Bid Security
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={activeChecklist.taxClearance} onChange={() => toggleChecklist('taxClearance')} />
                    Tax Clearance
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={activeChecklist.registration} onChange={() => toggleChecklist('registration')} />
                    Registration
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:p-4">
                <p className="text-sm font-semibold text-slate-800">Tender Operations Summary</p>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Tender ID:</span> {activeTender?.tenderId || 'Not selected'}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Category:</span> {activeTender?.category || 'Not selected'}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Deadline:</span> {formatDate(activeTender?.deadlineAt)}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">District:</span> {activeTender?.district || 'N/A'}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Checklist:</span> {checklistCompletion.done}/{checklistCompletion.total} ({checklistCompletion.percent}%)</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Task Progress:</span> {taskCompletion.done}/{taskCompletion.total} ({taskCompletion.percent}%)</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Pipeline Match:</span> {Math.round(activePipeline?.matchPercent || 0)}%</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Feasibility:</span> {Math.round(activePipeline?.feasibilityScore || 0)}%</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Open Tasks:</span> {pendingTaskCount}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-slate-700"><span className="font-semibold">Last Save:</span> {formatDateTime(lastSavedAtByTender[activeTenderId])}</div>
                  <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 leading-relaxed text-slate-700 sm:col-span-2"><span className="font-semibold">Recommended Action:</span> {formatRecommendation(activePipeline?.recommendation)}</div>
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="card self-start p-4 md:p-5">
          <h3 className="section-title">Team Assignment</h3>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team Members</p>
            <div className="mt-2 grid gap-2 text-sm text-slate-700">
              {teamMembers.map((member) => (
                <div key={member.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  {member.name}{member.phone ? ` | ${member.phone}` : ''}
                </div>
              ))}
              {!teamMembers.length ? <p className="text-xs text-slate-500">No team members yet. Add real members and phone numbers below.</p> : null}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input className="input" placeholder="Team member name" value={newMember.name} onChange={(event) => setNewMember((prev) => ({ ...prev, name: event.target.value }))} />
              <input className="input" placeholder="Phone (e.g. 97798...)" value={newMember.phone} onChange={(event) => setNewMember((prev) => ({ ...prev, phone: toDigits(event.target.value) }))} />
              <button type="button" className="btn-secondary" onClick={addTeamMember}><UserPlus size={14} /> Add</button>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            <input className="input" placeholder="Task title" value={taskInput.name} onChange={(event) => setTaskInput((prev) => ({ ...prev, name: event.target.value }))} />
            <textarea
              className="input min-h-[72px]"
              placeholder="Task details: scope, references, and what exactly must be done"
              value={taskInput.details}
              onChange={(event) => setTaskInput((prev) => ({ ...prev, details: event.target.value }))}
            />
            <input className="input" placeholder="Expected deliverable (e.g. BOQ draft, signed compliance pack)" value={taskInput.deliverable} onChange={(event) => setTaskInput((prev) => ({ ...prev, deliverable: event.target.value }))} />
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="input" value={taskInput.priority} onChange={(event) => setTaskInput((prev) => ({ ...prev, priority: event.target.value }))}>
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
              <input className="input" type="date" value={taskInput.dueAt} onChange={(event) => setTaskInput((prev) => ({ ...prev, dueAt: event.target.value }))} />
            </div>
            <select className="input" value={taskInput.memberId} onChange={(event) => setTaskInput((prev) => ({ ...prev, memberId: event.target.value }))}>
              <option value="">Assign to team member</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
            <button type="button" className="btn-primary" onClick={addTask} disabled={!activeTenderId}>Create Task</button>
          </div>

          <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
            {activeTasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-sm font-semibold text-slate-800">{task.name}</p>
                <p className="mt-1 text-xs text-slate-500">Assigned to: {task.memberName}</p>
                <p className="mt-1 text-xs text-slate-500">Priority: <span className="font-semibold capitalize">{task.priority || 'medium'}</span>{task.dueAt ? ` | Due: ${formatDate(task.dueAt)}` : ''}</p>
                <p className="mt-1 text-xs text-slate-600">{task.details || 'No task details added.'}</p>
                {task.deliverable ? <p className="mt-1 text-xs text-slate-500">Deliverable: {task.deliverable}</p> : null}
                <p className="mt-1 text-xs text-slate-500">Created: {task.createdAt ? formatDateTime(task.createdAt) : 'Not recorded'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={() => toggleTaskDone(task.id)}>
                    {task.done ? 'Mark Pending' : 'Mark Done'}
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => notifyTaskOnWhatsApp(task)}>
                    <MessageCircle size={14} /> WhatsApp Notify
                  </button>
                </div>
              </div>
            ))}
            {!activeTasks.length ? <p className="text-sm text-slate-500">No tasks created for the selected active tender.</p> : null}
          </div>
        </article>
      </section>

      <article className="card p-4 md:p-5">
        <h3 className="section-title">Previous Records</h3>
        <p className="mt-1 text-sm text-slate-500">History of completed tenders with results and lessons learned.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3">Tender Title</th>
                <th className="px-3">Date</th>
                <th className="px-3">Result</th>
                <th className="px-3">Lessons Learned</th>
              </tr>
            </thead>
            <tbody>
              {closedTenders.map((item) => {
                const outcome = item.pipeline?.outcome || {};
                return (
                  <tr key={item.tender._id} className="rounded-xl bg-slate-50 text-sm text-slate-700">
                    <td className="px-3 py-3 font-semibold text-slate-800">{item.tender.title}</td>
                    <td className="px-3 py-3">{formatDate(outcome.recordedAt || item.pipeline?.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${getResultClass(outcome.result)}`}>
                        {outcome.result}
                      </span>
                    </td>
                    <td className="px-3 py-3">{outcome.learning || 'No lesson captured.'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!closedTenders.length ? <p className="text-sm text-slate-500">No closed tender records yet.</p> : null}
        </div>
      </article>
    </section>
  );
};
