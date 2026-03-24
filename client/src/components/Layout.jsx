import { ArrowLeft, BarChart3, Bell, Bookmark, ClipboardCheck, FileText, Home, LogOut, ShieldCheck } from 'lucide-react';
import { PiCompassRoseBold } from 'react-icons/pi';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Feed', icon: Home },
  { to: '/brief', label: 'Boardroom', icon: BarChart3 },
  { to: '/bookmarks', label: 'Tracked', icon: Bookmark },
  { to: '/operations', label: 'Operations', icon: ClipboardCheck },
  { to: '/vault', label: 'Document Vault', icon: FileText },
  { to: '/notifications', label: 'Alerts', icon: Bell },
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

  return role === 'admin' ? 'Admin' : 'Vendor';
};

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const showBackButton = location.pathname !== '/dashboard';

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/dashboard');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
      <header className="card sticky top-3 z-30 grid grid-cols-1 items-center gap-3 px-4 py-3 md:grid-cols-[auto_1fr_auto]">
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button type="button" className="btn-secondary px-2 py-2" onClick={goBack} aria-label="Go back">
              <ArrowLeft size={16} />
            </button>
          ) : null}

          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
              <PiCompassRoseBold size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold">अवसर PATRA</h1>
              <p className="text-xs text-muted">Avasar Patra Workspace</p>
            </div>
          </Link>
        </div>

        <div className="hidden md:block" />

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:justify-start md:gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.name || 'Vendor User'}</p>
            <p className="text-xs text-slate-500">{user?.district || 'Nepal'} | {formatRole(user?.role)}</p>
          </div>
          {user?.role === 'admin' ? <ShieldCheck size={16} /> : null}
        </div>
      </header>

      <div className="mt-4 grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="card h-max p-3 lg:sticky lg:top-24">
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Navigation</p>
            <h2 className="mt-1 text-lg font-bold">Dashboard</h2>
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
          {children}

          <footer className="card flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center">
            <div>
              <h4 className="text-sm font-bold">Avasar Patra Workspace</h4>
              <p className="text-sm text-muted">Built for faster bid decisions, easier teamwork, and better vendor readiness.</p>
              <p className="mt-1 text-xs text-slate-500">Copyright iFISAN Tech</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Profile matching</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">Ops workflow</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};
