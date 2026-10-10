import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Droplets, Waves, ShieldCheck, ArrowRight, Eye, EyeOff,
  AlertCircle, UserRound, BarChart2, ClipboardList, Settings,
} from 'lucide-react';
import { authApi } from '../api';
import { useAuth } from '../AuthContext';

/**
 * Role hint cards — purely cosmetic / UX guidance.
 * The selection is stored as `hintRole` and shown in the form but
 * NEVER sent to the server or used to grant access.
 * The actual role is always determined by the backend JWT response.
 */
const ROLE_HINTS = [
  {
    id: 'citizen',
    label: 'Citizen',
    icon: <UserRound size={22} />,
    description: 'Report water concerns in your community',
    color: '#0d918d',
    bg: '#e4f5f4',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: <Settings size={22} />,
    description: 'Manage users, approvals and system settings',
    color: '#2d5fb5',
    bg: '#e8f0fe',
  },
  {
    id: 'water_authority',
    label: 'Water Analyst',
    icon: <BarChart2 size={22} />,
    description: 'Monitor sources, review reports and analytics',
    color: '#7c3aed',
    bg: '#f3eeff',
  },
  {
    id: 'field_inspector',
    label: 'Field Verifier',
    icon: <ClipboardList size={22} />,
    description: 'Conduct on-site inspections and submit findings',
    color: '#e07b39',
    bg: '#fff4e8',
  },
];

/** Map the server role to the correct dashboard route */
function dashboardFor(role) {
  if (role === 'admin')            return '/admin';
  if (role === 'water_authority')  return '/authority';
  if (role === 'field_inspector')  return '/inspector';
  return '/citizen';
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();

  const [hintRole, setHintRole] = useState('');       // cosmetic only
  const [form, setForm]         = useState({ email: '', password: '' });
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      // Always authenticate through the backend — hintRole is never sent
      const data = await authApi.login({ email: form.email, password: form.password });
      login(data);

      // Route is determined solely by the role the SERVER returned
      const serverRole = data.user.role;
      navigate(dashboardFor(serverRole), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      {/* ── Left intro panel ─────────────────────────────────────────── */}
      <div className="intro">
        <div className="eyebrow"><Waves size={15} /> PROTECTING EVERY DROP</div>
        <h1>Better water data.<br /><em>Earlier action.</em></h1>
        <p>
          AquaSentinel helps communities and water authorities report concerns,
          identify potential risks, and coordinate inspections.
        </p>
        <div className="intro-points">
          <span><ShieldCheck size={18} /> Role-based access</span>
          <span><Droplets size={18} /> Water-quality insights</span>
        </div>
        <div className="water-art">
          <div className="orb orb-one" /><div className="orb orb-two" /><div className="wave-line" />
          <div className="water-label">MONITOR <b>·</b> ASSESS <b>·</b> RESPOND</div>
        </div>
      </div>

      {/* ── Auth card ────────────────────────────────────────────────── */}
      <section className="auth-card">
        <div className="mobile-logo">
          <span className="brand-mark"><Droplets size={23} /></span>
          <strong>AquaSentinel</strong>
        </div>

        <div className="tabs">
          <button className="active">Sign in</button>
          <Link to="/register"><button>Create account</button></Link>
        </div>

        {error && (
          <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>
        )}

        {/* Role hint selector — visual UX only */}
        <div className="card-heading">
          <h2>Welcome back</h2>
          <p>Select your role, then sign in with your credentials.</p>
        </div>

        <div className="role-hint-grid">
          {ROLE_HINTS.map(r => (
            <button
              key={r.id}
              type="button"
              className={`role-hint-card ${hintRole === r.id ? 'selected' : ''}`}
              style={hintRole === r.id ? { borderColor: r.color, background: r.bg } : {}}
              onClick={() => setHintRole(prev => prev === r.id ? '' : r.id)}
              aria-pressed={hintRole === r.id}
            >
              <span className="role-hint-icon" style={{ color: r.color }}>{r.icon}</span>
              <strong>{r.label}</strong>
              <span className="role-hint-desc">{r.description}</span>
            </button>
          ))}
        </div>

        <p className="role-hint-note">
          Your actual permissions are verified by the server — selecting a role here
          does not grant access.
        </p>

        {/* Credentials form */}
        <form onSubmit={submit} style={{ marginTop: 16 }}>
          <label>Email address
            <input
              type="email" required autoComplete="email"
              value={form.email} onChange={e => u('email', e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>Password
            <div className="password-wrap">
              <input
                type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                value={form.password} onChange={e => u('password', e.target.value)}
                placeholder="Your password"
              />
              <button type="button" className="eye" onClick={() => setShowPw(p => !p)}
                aria-label="Toggle password visibility">
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <button className="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} />
          </button>
          <p className="switch-text">
            New here? <Link to="/register">Create an account</Link>
          </p>
        </form>

        <div className="card-foot">
          <ShieldCheck size={15} /> Secure, role-based access · Permissions verified server-side
        </div>
      </section>
    </div>
  );
}
