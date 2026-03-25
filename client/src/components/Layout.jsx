import { ArrowLeft, BarChart3, Bell, Bookmark, BriefcaseBusiness, ClipboardCheck, FileText, Home, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { DocumentHealth } from './DocumentHealth';

const vendorNavItems = [
  { to: '/dashboard', label: 'Feed', icon: Home },
  { to: '/brief', label: 'Boardroom', icon: BarChart3 },
  { to: '/bookmarks', label: 'Tracked', icon: Bookmark },
  { to: '/operations', label: 'Operations', icon: ClipboardCheck },
  { to: '/jv', label: 'JV Desk', icon: BriefcaseBusiness },
  { to: '/vault', label: 'Document Vault', icon: FileText },
  { to: '/notifications', label: 'Alerts', icon: Bell },
];

const organizationNavItems = [
  { to: '/organization', label: 'Publisher Portal', icon: FileText },
];

const linkClassName = ({ isActive }) =>
  [
    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
    isActive
      ? 'bg-brand-50 text-brand-700 border border-brand-100'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
  ].join(' ');

const formatRole = (role) => {
  if (!role) {
    return 'Vendor';
  }

  if (role === 'admin') {
    return 'Admin';
  }

  if (role === 'organization') {
    return 'Publisher';
  }

  return 'Vendor';
};

const getDaysLeft = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const value = new Date(dateValue).getTime();
  if (Number.isNaN(value)) {
    return null;
  }

  return Math.ceil((value - Date.now()) / (1000 * 60 * 60 * 24));
};

const calculateBidReadyScore = (documents = {}) => {
  const keys = ['panVat', 'taxClearance', 'companyRegistration'];
  let score = 0;

  keys.forEach((key) => {
    const doc = documents?.[key];
    if (!doc) {
      return;
    }

    const daysLeft = getDaysLeft(doc.expiresAt);
    if (daysLeft == null) {
      score += 33;
      return;
    }

    if (daysLeft < 0) score += 5;
    else if (daysLeft <= 7) score += 18;
    else if (daysLeft <= 30) score += 24;
    else score += 33;
  });

  return Math.max(0, Math.min(100, Math.round(score)));
};

const getNextBestAction = (pipeline) => {
  if (!pipeline) {
    return 'Track a live notice from Tender Feed to start your active pipeline.';
  }

  const hasEstimate = pipeline?.estimate && Number(pipeline.estimatedTotal || 0) > 0;
  if (!hasEstimate) {
    return 'Complete Bid Security, Materials, and Site Visit costing to unlock execution.';
  }

  if (!(pipeline.assignments || []).length || (pipeline.assignmentProgress || 0) < 100) {
    return 'Assign execution tasks and sync updates to your WhatsApp ops group.';
  }

  if (!pipeline.outcome || pipeline.outcome.result === 'pending') {
    return 'Capture final bid outcome and learning for throughput analytics.';
  }

  return 'Pipeline closed. Move to the next high-match procurement notice.';
};

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const bidReadyScore = calculateBidReadyScore(user?.documents || {});
  const navItems = user?.role === 'organization' ? organizationNavItems : vendorNavItems;
  const [pipelineSnapshot, setPipelineSnapshot] = useState({
    trackedCount: 0,
    activePipeline: null,
    nextAction: 'Track a live notice from Tender Feed to start your active pipeline.',
  });

  const homePath = user?.role === 'organization' ? '/organization' : '/dashboard';
  const showBackButton = location.pathname !== homePath;

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(homePath);
  };

  useEffect(() => {
    if (user?.role === 'organization' || user?.role === 'admin') {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await api.get('/operations/board');
        if (cancelled) {
          return;
        }

        const tracked = response.data?.trackedTenders || [];
        const pipelines = response.data?.pipelines || [];
        const activePipeline = pipelines[0] || null;
        setPipelineSnapshot({
          trackedCount: tracked.length,
          activePipeline,
          nextAction: getNextBestAction(activePipeline),
        });
      } catch {
        if (!cancelled) {
          setPipelineSnapshot((prev) => ({
            ...prev,
            nextAction: 'Could not load active pipeline. Open Operations Workspace to continue execution.',
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, user?.role]);

  const mobileTabs = navItems.slice(0, 5);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 pb-24 md:px-6 md:pb-8">
      <header className="card sticky top-3 z-30 grid grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button type="button" className="btn-secondary px-2 py-2" onClick={goBack} aria-label="Go back">
              <ArrowLeft size={16} />
            </button>
          ) : null}

          <Link to="/" className="flex items-center gap-3">
            <div>
              <h1 className="text-base font-bold">अवसर पत्र</h1>
              <p className="text-xs text-muted">Avasar Patra Workspace</p>
            </div>
          </Link>
        </div>

        <div className="hidden md:block" />

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:justify-start md:gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.name || (user?.role === 'organization' ? 'Publisher User' : 'Vendor User')}</p>
            <p className="text-xs text-slate-500">{user?.district || 'Nepal'} | {formatRole(user?.role)}</p>
          </div>
          {user?.role === 'admin' ? <ShieldCheck size={16} /> : null}
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="card hidden h-max p-3 lg:sticky lg:top-24 lg:block">
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
            <h2 className="mt-1 text-lg font-bold">{user?.role === 'organization' ? 'Publishing' : 'Dashboard'}</h2>
            {user?.role !== 'organization' ? (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bid-ready Score</p>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-brand-600" style={{ width: `${bidReadyScore}%` }} />
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-700">{bidReadyScore}%</p>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">Publish private-sector procurement notices to verified vendors.</p>
            )}
          </div>

          <nav className="grid gap-2">
            {navItems.map((item) => {
              const IconComponent = item.icon;

              return (
                <NavLink key={item.to} to={item.to} className={linkClassName} end={item.to === '/dashboard'}>
                  <IconComponent size={16} />
                  {item.label}
                </NavLink>
              );
            })}
            {user?.role === 'admin' ? (
              <NavLink to="/admin" className={linkClassName}>
                <ShieldCheck size={16} />
                Admin
              </NavLink>
            ) : null}
          </nav>

          <button type="button" className="btn-secondary mt-4 w-full text-rose-700 hover:border-rose-300 hover:text-rose-700" onClick={logout}>
            <LogOut size={14} />
            Logout
          </button>
        </aside>

        <main className="space-y-4">
          {user?.role !== 'organization' && user?.role !== 'admin' ? (
            <section className="card p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Active Pipeline</p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">{pipelineSnapshot.activePipeline?.tender?.title || 'No active procurement notice selected'}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {pipelineSnapshot.activePipeline?.tender?.tenderId || 'Track a notice from Tender Feed to activate pipeline.'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Tracked Notices</p>
                  <p className="text-lg font-bold text-brand-700">{pipelineSnapshot.trackedCount}</p>
                </div>
              </div>
              <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Next Best Action</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{pipelineSnapshot.nextAction}</p>
              </div>
            </section>
          ) : null}

          {children}

          <footer className="card flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
            <div>
              <h4 className="text-sm font-bold">Avasar Patra Workspace</h4>
              <p className="text-sm text-muted">Built for faster procurement decisions, tighter execution, and role-based operational clarity.</p>
              <p className="mt-1 text-xs text-slate-500">Copyright iFISAN Tech</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Profile matching</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Publisher workflow</span>
            </div>
          </footer>
        </main>

        {user?.role !== 'organization' && user?.role !== 'admin' ? (
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <article className="card p-4">
                <div className="flex items-center gap-2">
                  <BriefcaseBusiness size={16} className="text-brand-700" />
                  <h3 className="text-sm font-bold">Compliance & Financial Pulse</h3>
                </div>
                <p className="mt-2 text-xs text-slate-500">Bid Security and readiness visibility for faster bid submission confidence.</p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Current Bid-Ready</p>
                  <p className="mt-1 text-xl font-bold text-brand-700">{bidReadyScore}%</p>
                </div>
              </article>

              <DocumentHealth />
            </div>
          </aside>
        ) : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-2 lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {mobileTabs.map((item) => {
            const IconComponent = item.icon;
            const active = location.pathname === item.to || (item.to === '/dashboard' && location.pathname.startsWith('/dashboard'));

            return (
              <NavLink key={item.to} to={item.to} className={`flex flex-col items-center justify-center rounded-xl border px-2 py-1 text-[11px] font-semibold ${active ? 'border-brand-100 bg-brand-50 text-brand-700' : 'border-transparent text-slate-600'}`} end={item.to === '/dashboard'}>
                <IconComponent size={16} />
                <span className="mt-0.5 truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
