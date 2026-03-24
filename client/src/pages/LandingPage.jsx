import { BellRing, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PiChartLineUpBold, PiCompassRoseBold, PiFilesBold, PiShieldCheckBold } from 'react-icons/pi';
import { Link } from 'react-router-dom';
import api from '../api/client';

const formatCountdown = (deadlineAt) => {
  const target = new Date(deadlineAt).getTime();
  if (!deadlineAt || Number.isNaN(target)) {
    return 'Date pending';
  }

  const diff = target - Date.now();
  if (diff <= 0) {
    return 'Closed';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  return `${days}d ${hours}h left`;
};

const steps = [
  {
    title: 'Create Vendor Profile',
    text: 'Set district, category, and capacity once. Matching stays automatic.',
    icon: PiCompassRoseBold,
  },
  {
    title: 'Get Ranked Opportunities',
    text: 'Only relevant tenders surface first so your team does less manual filtering.',
    icon: PiChartLineUpBold,
  },
  {
    title: 'Prepare And Submit Faster',
    text: 'Use document and checklist workflows to reduce last-hour submission stress.',
    icon: PiFilesBold,
  },
];

const whyItems = [
  'Built for Nepal SME vendors',
  'Works, Goods, and Consulting support',
  'Deadline-focused dashboard workflow',
  'Profile-based matching and alerts',
];

export const LandingPage = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/tenders', { params: { limit: 6 } });
        setItems(response.data.items || []);
      } catch {
        setItems([]);
      }
    })();
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const works = items.filter((item) => item.category === 'Works').length;
    const goods = items.filter((item) => item.category === 'Goods').length;
    return { total, works, goods };
  }, [items]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
      <header className="card sticky top-3 z-30 flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
            <PiCompassRoseBold size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold">अवसर PATRA</h1>
            <p className="text-xs text-muted">Nepal Public Procurement, Simplified</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
          <a href="#how-it-works" className="rounded-lg px-2 py-1 hover:bg-slate-100">How It Works</a>
          <a href="#live-notices" className="rounded-lg px-2 py-1 hover:bg-slate-100">Live Notices</a>
          <a href="#why-avasar" className="rounded-lg px-2 py-1 hover:bg-slate-100">Why Avasar Patra</a>
        </nav>

        <div className="flex gap-2">
          <Link className="btn-secondary" to="/login">Login</Link>
          <Link className="btn-primary" to="/signup">Signup</Link>
        </div>
      </header>

      <section className="card mt-4 grid gap-6 p-6 md:grid-cols-[1.35fr_1fr] md:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Smart Tender Matching for SME Vendors</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">Simple dashboard. Better tender decisions.</h2>
          <p className="page-subtitle max-w-2xl">
            Avasar Patra helps vendors find relevant opportunities quickly, track deadlines clearly, and prepare submissions with less confusion.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-primary">Create Vendor Account</Link>
            <Link to="/login" className="btn-secondary">Open Dashboard</Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-2"><PiShieldCheckBold className="text-brand-700" /> Public-source transparency</div>
            <div className="flex items-center gap-2"><BellRing size={16} className="text-brand-700" /> Alert + digest workflow</div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-lg font-semibold">Live Snapshot</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 md:grid-cols-1">
            <div className="kpi-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fresh Notices</p>
              <p className="mt-1 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Works</p>
              <p className="mt-1 text-2xl font-bold">{stats.works}</p>
            </div>
            <div className="kpi-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goods</p>
              <p className="mt-1 text-2xl font-bold">{stats.goods}</p>
            </div>
          </div>
        </aside>
      </section>

      <section id="how-it-works" className="card mt-4 p-6 md:p-8">
        <h3 className="page-title text-2xl">How It Works</h3>
        <p className="page-subtitle">A clean three-step flow focused on speed and readiness.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Icon size={24} className="text-brand-700" />
                <h4 className="mt-3 text-lg font-semibold">{step.title}</h4>
                <p className="mt-2 text-sm text-muted">{step.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="live-notices" className="card mt-4 p-6 md:p-8">
        <h3 className="page-title text-2xl">Live Notice Preview</h3>
        <p className="page-subtitle">See current opportunities before signup. Personal scoring starts after login.</p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.category}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{formatCountdown(item.deadlineAt)}</span>
              </div>
              <h4 className="mt-3 line-clamp-2 text-base font-semibold">{item.title}</h4>
              <p className="mt-2 text-sm text-muted">{item.procuringEntity}</p>
              <p className="mt-2 text-xs text-slate-500">{item.district} | {item.tenderId}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="why-avasar" className="card mt-4 grid gap-4 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <article>
          <h3 className="page-title text-2xl">Why Vendors Choose Avasar Patra</h3>
          <p className="page-subtitle max-w-2xl">Most portals are noisy and hard to prioritize. Avasar Patra keeps decision-making simple and practical.</p>
          <div className="mt-4 grid gap-2">
            {whyItems.map((point) => (
              <div key={point} className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle2 size={15} className="text-brand-700" />
                {point}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <h4 className="text-lg font-semibold">Ready to start?</h4>
          <p className="mt-2 text-sm text-slate-700">Set your profile, shortlist tenders, and organize submission readiness in minutes.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/signup" className="btn-primary">Start Free</Link>
            <Link to="/login" className="btn-secondary">Login</Link>
          </div>
        </article>
      </section>

      <footer className="card mt-4 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-bold">Avasar Patra</h4>
          <p className="text-sm text-muted">A cleaner procurement workflow for local vendors and SMEs.</p>
          <p className="mt-1 text-xs text-slate-500">Copyright InFISAN Tech</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="#how-it-works" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">How It Works</a>
          <a href="#live-notices" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">Live Notices</a>
          <Link to="/signup" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">Create Account</Link>
        </div>
      </footer>
    </div>
  );
};
