import { BellRing, CheckCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PiChartLineUpBold, PiCompassRoseBold, PiFilesBold, PiShieldCheckBold } from 'react-icons/pi';
import { Link } from 'react-router-dom';
import api from '../api/client';

const formatNpr = (amount) => {
  const value = Number(amount || 0);
  if (!value) {
    return 'Amount pending';
  }

  return `NPR ${value.toLocaleString()}`;
};

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

const sharedStarterPlan = {
  name: 'Starter (Free)',
  price: 'Free',
  subtitle: 'Core tools for early-stage teams',
  features: [
    'Live notice feed (public tenders)',
    'Basic profile setup and district filters',
    'Manual bookmarks and tender watchlist',
    'Limited monthly smart matches',
  ],
  cta: 'Start Free',
};

const rolePlans = {
  vendor: {
    roleLabel: 'For Vendors',
    plans: [
      sharedStarterPlan,
      {
        name: 'Vendor ',
        price: 'NPR 999 / month',
        subtitle: 'For vendors actively bidding every month',
        features: [
          'Everything in Starter',
          'Unlimited profile-based matches',
          'Boardroom insights and executive brief tools',
          'Advanced alerts, ops workflows, and vault readiness',
          '15-day free trial ',
        ],
        cta: 'Start Vendor Trial',
      },
    ],
  },
  publisher: {
    roleLabel: 'For Publishers',
    plans: [
      sharedStarterPlan,
      {
        name: 'Publisher ',
        price: 'NPR 1,499 / month',
        subtitle: 'For organizations publishing private tenders',
        features: [
          'Everything in Starter',
          'Private tender publishing workspace',
          'Vendor traction insights and activity tracking',
          'Multi-user publisher roles and controls',
          '15-day free trial',
        ],
        cta: 'Start Publisher Trial',
      },
    ],
  },
};

export const LandingPage = () => {
  const [items, setItems] = useState([]);
  const [sourceType, setSourceType] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [pricingAudience, setPricingAudience] = useState('vendor');

  const scrollToSection = (event, sectionId) => {
    event.preventDefault();
    const section = document.getElementById(sectionId);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    (async () => {
      try {
        const params = { limit: 12 };
        if (sourceType !== 'all') {
          params.sourceType = sourceType;
        }
        if (categoryFilter !== 'all') {
          params.category = categoryFilter;
        }

        const response = await api.get('/tenders', { params });
        setItems(response.data.items || []);
      } catch {
        setItems([]);
      }
    })();
  }, [sourceType, categoryFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const works = items.filter((item) => item.category === 'Works').length;
    const goods = items.filter((item) => item.category === 'Goods').length;
    const privateCount = items.filter((item) => item.sourceType === 'private').length;
    return { total, works, goods, privateCount };
  }, [items]);

  const visiblePlans = rolePlans[pricingAudience].plans;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 md:px-6">
      <header className="card sticky top-3 z-30 flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold">अवसर पत्र</h1>
            <p className="text-xs text-muted">Nepal Public Procurement, Simplified</p>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
          <a href="#how-it-works" className="rounded-lg px-2 py-1 hover:bg-slate-100" onClick={(event) => scrollToSection(event, 'how-it-works')}>How It Works</a>
          <a href="#live-notices" className="rounded-lg px-2 py-1 hover:bg-slate-100" onClick={(event) => scrollToSection(event, 'live-notices')}>Live Notices</a>
          <a href="#pricing" className="rounded-lg px-2 py-1 hover:bg-slate-100" onClick={(event) => scrollToSection(event, 'pricing')}>Pricing</a>
          <a href="#why-avasar" className="rounded-lg px-2 py-1 hover:bg-slate-100" onClick={(event) => scrollToSection(event, 'why-avasar')}>Why Avasar Patra</a>
        </nav>

        <div className="flex flex-wrap gap-2">
          <Link className="btn-primary" to="/access">Login / Register</Link>
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
            <Link to="/access" className="btn-primary">Login / Register</Link>
            <a href="#live-notices" className="btn-secondary" onClick={(event) => scrollToSection(event, 'live-notices')}>Explore Live Notices</a>
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
            <div className="kpi-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private</p>
              <p className="mt-1 text-2xl font-bold">{stats.privateCount}</p>
            </div>
          </div>
        </aside>
      </section>

      <section id="how-it-works" className="landing-section card mt-4 p-6 md:p-8">
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

      <section id="live-notices" className="landing-section card mt-4 p-6 md:p-8">
        <h3 className="page-title text-2xl">Live Notice Preview</h3>
        <p className="page-subtitle">See current opportunities before signup. Personal scoring starts after login.</p>

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_220px]">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`btn-secondary ${sourceType === 'all' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceType('all')}>All Sources</button>
            <button type="button" className={`btn-secondary ${sourceType === 'ppmo' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceType('ppmo')}>PPMO Tenders</button>
            <button type="button" className={`btn-secondary ${sourceType === 'private' ? 'border-brand-500 text-brand-700' : ''}`} onClick={() => setSourceType('private')}>Private Tenders</button>
          </div>

          <select className="input" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All Categories</option>
            <option value="Works">Works</option>
            <option value="Goods">Goods</option>
            <option value="Consulting">Consulting</option>
            <option value="ICT">ICT</option>
            <option value="Health & Medical">Health & Medical</option>
            <option value="Agriculture">Agriculture</option>
            <option value="Education">Education</option>
            <option value="Energy">Energy</option>
            <option value="Services">Services</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={item._id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.category}</span>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">{formatCountdown(item.deadlineAt)}</span>
              </div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">{item.sourceType === 'private' ? 'Private Organization' : 'PPMO'}</p>
              <h4 className="mt-3 line-clamp-2 text-base font-semibold">{item.title}</h4>
              <p className="mt-2 text-sm text-muted">{item.procuringEntity}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">{formatNpr(item.amount)}</p>
              <p className="mt-2 text-xs text-slate-500">{item.district} | {item.tenderId}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="why-avasar" className="landing-section card mt-4 grid gap-4 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
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
          <p className="mt-2 text-sm text-slate-700">Set your professional profile, shortlist tenders, and organize submission readiness in minutes.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/access" className="btn-primary">Open Access Portal</Link>
          </div>
        </article>
      </section>

      <section id="pricing" className="landing-section card mt-4 p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Pricing</p>
            <h3 className="page-title text-2xl">Simple Role-Based Plans</h3>
            <p className="page-subtitle max-w-3xl">
              Start free for core workflows, then upgrade with role-based subscriptions for Vendors and Publishers (Organizations).
            </p>
          </div>
          <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            15-day free trial available
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${pricingAudience === 'vendor' ? 'bg-white text-brand-700 shadow-soft' : 'text-slate-600'}`}
            onClick={() => setPricingAudience('vendor')}
          >
            For Vendors
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${pricingAudience === 'publisher' ? 'bg-white text-brand-700 shadow-soft' : 'text-slate-600'}`}
            onClick={() => setPricingAudience('publisher')}
          >
            For Publishers
          </button>
          <span className="w-full text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{rolePlans[pricingAudience].roleLabel}</span>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {visiblePlans.map((plan) => (
            <article
              key={plan.name}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <h4 className="text-lg font-bold">{plan.name}</h4>
              <p className="mt-2 text-2xl font-bold text-ink">{plan.price}</p>
              <p className="mt-1 text-sm text-muted">{plan.subtitle}</p>

              <ul className="mt-4 grid gap-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                    <CheckCircle2 size={15} className="mt-0.5 text-brand-700" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button type="button" className={`mt-5 w-full ${plan.price === 'Free' ? 'btn-secondary' : 'btn-primary'}`}>
                {plan.cta}
              </button>
            </article>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Subscription checkout is currently demo-only for hackathon presentation. Pricing and offers shown here represent the planned go-to-market model.
        </p>
      </section>

      <footer className="card mt-4 flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="text-sm font-bold">Avasar Patra</h4>
          <p className="text-sm text-muted">A cleaner procurement workflow for local vendors and SMEs.</p>
          <p className="mt-1 text-xs text-slate-500">Copyright InFISAN Tech</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="#how-it-works" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600" onClick={(event) => scrollToSection(event, 'how-it-works')}>How It Works</a>
          <a href="#live-notices" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600" onClick={(event) => scrollToSection(event, 'live-notices')}>Live Notices</a>
          <a href="#pricing" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600" onClick={(event) => scrollToSection(event, 'pricing')}>Pricing</a>
          <Link to="/access" className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">Login / Register</Link>
        </div>
      </footer>
    </div>
  );
};
