import { useState } from 'react';
import { PiShieldCheckBold } from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const categories = ['Works', 'Goods', 'Consulting', 'Other'];
const vendorGroups = ['Small', 'Medium', 'Large', 'Consortium'];
const organizationTypes = ['Sole Proprietor', 'Private Limited', 'Partnership', 'Cooperative', 'NGO/INGO', 'Other'];

export const AuthPage = ({ mode = 'login' }) => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(mode === 'signup');
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

  const validateForm = () => {
    if (isRegister) {
      if (form.password.length < 8) {
        return 'Password must be at least 8 characters.';
      }

      if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
        return 'Password must include uppercase, lowercase and number.';
      }

      const cap = Number(form.capacity);
      if (Number.isNaN(cap) || cap < 0) {
        return 'Capacity must be a non-negative number.';
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
      if (isRegister) {
        await register({
          ...form,
          expertiseTags: form.expertiseTags
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          capacity: Number(form.capacity),
        });
      } else {
        await login({ email: form.email, password: form.password });
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl px-4 py-8 md:px-6 lg:grid-cols-2 lg:items-center lg:gap-6">
      <aside className="card order-2 p-6 lg:order-1 lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Avasar Patra Vendor Workspace</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">Simple onboarding. Fast tender matching.</h1>
        <p className="mt-3 text-sm text-muted md:text-base">
          Set your procurement profile once and get cleaner dashboards, targeted opportunities, and better daily visibility.
        </p>

        <div className="mt-5 grid gap-3">
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> Profile-based opportunity ranking</div>
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> Deadline and digest alert workflow</div>
          <div className="flex items-start gap-2 text-sm text-slate-700"><PiShieldCheckBold className="mt-0.5 text-brand-700" /> Document readiness and tracking support</div>
        </div>
      </aside>

      <form className="card order-1 space-y-3 p-6 lg:order-2 lg:p-8" onSubmit={onSubmit}>
        <div>
          <h2 className="text-2xl font-bold">{isRegister ? 'Create Vendor Profile' : 'Vendor Login'}</h2>
          <p className="mt-1 text-sm text-muted">Access your personalized procurement dashboard.</p>
        </div>

        {error ? <div className="status-error">{error}</div> : null}

        {isRegister ? (
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

        {isRegister ? (
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

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
        </button>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setError('');
              setIsRegister((prev) => !prev);
            }}
          >
            {isRegister ? 'Switch to Login' : 'Switch to Signup'}
          </button>

          <button type="button" className="btn-secondary" onClick={() => navigate('/')}>
            Back to Homepage
          </button>
        </div>
      </form>
    </div>
  );
};
