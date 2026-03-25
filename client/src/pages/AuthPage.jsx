import { useEffect, useMemo, useState } from 'react';
import { PiShieldCheckBold } from 'react-icons/pi';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const categories = ['Works', 'Goods', 'Consulting', 'Other'];
const vendorGroups = ['Small', 'Medium', 'Large', 'Consortium'];
const organizationTypes = ['Sole Proprietor', 'Private Limited', 'Partnership', 'Cooperative', 'NGO/INGO', 'Other'];

export const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const modeIntent = new URLSearchParams(location.search).get('tab');
  const roleIntent = new URLSearchParams(location.search).get('role');
  const isOrganizationIntent = roleIntent === 'organization';
  const { login, register, registerOrganization } = useAuth();
  const [isRegister, setIsRegister] = useState(modeIntent === 'signup' || mode === 'signup');
  const [accountType, setAccountType] = useState(isOrganizationIntent ? 'organization' : 'vendor');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    district: '',
    category: 'Works',
    vendorGroup: 'Small',
    organizationType: 'Other',
    expertiseTags: '',
    capacity: '',
  });

  const update = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  useEffect(() => {
    if (modeIntent === 'signup' || mode === 'signup') {
      setIsRegister(true);
      return;
    }

    if (modeIntent === 'login' || mode === 'login') {
      setIsRegister(false);
    }
  }, [mode, modeIntent]);

  useEffect(() => {
    if (roleIntent === 'organization') {
      setAccountType('organization');
      return;
    }

    if (roleIntent === 'vendor') {
      setAccountType('vendor');
    }
  }, [roleIntent]);

  const uiMeta = useMemo(() => {
    if (accountType === 'organization') {
      return {
        eyebrow: 'Organization Workspace',
        title: 'Publish private tenders with clarity and speed.',
        subtitle: 'Create and manage private-sector opportunities and connect with verified vendors.',
      };
    }

    return {
      eyebrow: 'Vendor Workspace',
      title: 'Find better tenders with less noise.',
      subtitle: 'Get profile-ranked opportunities, action-ready recommendations, and workflow support.',
    };
  }, [accountType]);

  const validateForm = () => {
    if (isRegister) {
      if (form.password.length < 8) {
        return 'Password must be at least 8 characters.';
      }

      if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
        return 'Password must include uppercase, lowercase and number.';
      }

      if (accountType === 'vendor') {
        const cap = Number(form.capacity);
        if (Number.isNaN(cap) || cap < 0) {
          return 'Capacity must be a non-negative number.';
        }
      }
    }

    return null;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      let authenticatedUser = null;

      if (isRegister) {
        if (accountType === 'organization') {
          authenticatedUser = await registerOrganization({
            name: form.name,
            email: form.email,
            password: form.password,
            district: form.district,
            organizationType: form.organizationType,
          });
        } else {
          authenticatedUser = await register({
            ...form,
            expertiseTags: form.expertiseTags
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            capacity: Number(form.capacity),
          });
        }
      } else {
        authenticatedUser = await login({ email: form.email, password: form.password });
      }

      navigate(authenticatedUser?.role === 'organization' ? '/organization' : '/dashboard');
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl px-4 py-8 md:px-6 lg:grid-cols-2 lg:items-center lg:gap-6">
      <aside className="card order-2 p-6 lg:order-1 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{uiMeta.eyebrow}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{uiMeta.title}</h1>
        <p className="mt-3 text-sm text-muted md:text-base">{uiMeta.subtitle}</p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Smooth Workflow</p>
          <div className="mt-3 grid gap-2 text-sm text-slate-700">
            <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">1</span> Choose account type</div>
            <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">2</span> Login or create account</div>
            <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">3</span> Enter focused workspace</div>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> {accountType === 'organization' ? 'Private tender publishing and lifecycle control' : 'Profile-based opportunity ranking'}</div>
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> {accountType === 'organization' ? 'Tender traction insights from vendor bookmarks' : 'Deadline and digest alert workflow'}</div>
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> {accountType === 'organization' ? 'Clean console for active and paused opportunities' : 'Document readiness and tracking support'}</div>
        </div>

      </aside>

      <form className="card order-1 space-y-3 p-6 lg:order-2 lg:p-8" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${isRegister ? 'text-slate-600' : 'bg-white text-brand-700 shadow-soft'}`}
            onClick={() => {
              setError('');
              setIsRegister(false);
            }}
          >
            Login
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${isRegister ? 'bg-white text-brand-700 shadow-soft' : 'text-slate-600'}`}
            onClick={() => {
              setError('');
              setIsRegister(true);
            }}
          >
            Signup
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${accountType === 'vendor' ? 'bg-white text-brand-700 shadow-soft' : 'text-slate-600'}`}
            onClick={() => setAccountType('vendor')}
          >
            Vendor Professional
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${accountType === 'organization' ? 'bg-white text-brand-700 shadow-soft' : 'text-slate-600'}`}
            onClick={() => setAccountType('organization')}
          >
            Organization Professional
          </button>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Professional Access</p>
          <h2 className="mt-1 text-2xl font-bold">
            {isRegister
              ? accountType === 'organization'
                ? 'Create Organization Workspace'
                : 'Create Vendor Workspace'
              : accountType === 'organization'
                ? 'Organization Login'
                : 'Vendor Login'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {accountType === 'organization'
              ? 'Access your private tender publishing console.'
              : 'Access your personalized procurement dashboard.'}
          </p>
        </div>

        {error ? <div className="status-error">{error}</div> : null}

        {isRegister && accountType === 'vendor' ? (
          <label>
            <span className="label">Full Name</span>
            <input className="input" value={form.name} onChange={update('name')} required />
          </label>
        ) : null}

        <label>
          <span className="label">Email</span>
          <input className="input" type="email" value={form.email} onChange={update('email')} required />
        </label>

        <label>
          <span className="label">Password</span>
          <input className="input" type="password" value={form.password} onChange={update('password')} required />
        </label>

        {isRegister ? <p className="text-xs text-slate-500">Use at least 8 characters with uppercase, lowercase, and number.</p> : null}

        {isRegister && accountType === 'vendor' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="label">District</span>
              <input className="input" value={form.district} onChange={update('district')} placeholder="Kathmandu" required />
            </label>

            <label>
              <span className="label">Category</span>
              <select className="input" value={form.category} onChange={update('category')}>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Vendor Group</span>
              <select className="input" value={form.vendorGroup} onChange={update('vendorGroup')}>
                {vendorGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Organization Type</span>
              <select className="input" value={form.organizationType} onChange={update('organizationType')}>
                {organizationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">Financial Capacity (NPR)</span>
              <input className="input" type="number" min="0" value={form.capacity} onChange={update('capacity')} required />
            </label>

            <label className="md:col-span-2">
              <span className="label">Expertise Tags</span>
              <input className="input" value={form.expertiseTags} onChange={update('expertiseTags')} placeholder="Road works, medical supply, audit" />
            </label>
          </div>
        ) : null}

        {isRegister && accountType === 'organization' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="label">Organization Name</span>
              <input className="input" value={form.name} onChange={update('name')} required />
            </label>

            <label>
              <span className="label">District</span>
              <input className="input" value={form.district} onChange={update('district')} placeholder="Kathmandu" required />
            </label>

            <label>
              <span className="label">Organization Type</span>
              <select className="input" value={form.organizationType} onChange={update('organizationType')}>
                {organizationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? (accountType === 'organization' ? 'Create Organization Account' : 'Create Vendor Account') : (accountType === 'organization' ? 'Login to Organization Portal' : 'Login to Vendor Dashboard')}
        </button>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setError('');
              setAccountType((prev) => (prev === 'vendor' ? 'organization' : 'vendor'));
            }}
          >
            Switch Account Type
          </button>

          <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
            Back to Homepage
          </button>
        </div>
      </form>
    </div>
  );
};
