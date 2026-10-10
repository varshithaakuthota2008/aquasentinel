import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Droplets, ShieldCheck, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { authApi } from '../api';

/**
 * Role options for registration.
 *
 * Labels shown to users: "Water Analyst" and "Field Verifier"
 * Values sent to the backend: "water_authority" and "field_inspector"
 * — kept unchanged so existing approved accounts continue to work.
 *
 * Admin registration is intentionally absent — admin accounts must
 * be created via the secure backend/create_admin.py script.
 */
const ROLES = [
  {
    value: 'citizen',
    label: 'Citizen',
    hint: 'Report water concerns and follow community updates',
  },
  {
    value: 'water_authority',
    label: 'Water Analyst',
    hint: 'Monitor sources and coordinate remediation — requires admin approval',
  },
  {
    value: 'field_inspector',
    label: 'Field Verifier',
    hint: 'Conduct on-site inspections and submit findings — requires admin approval',
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    role: 'citizen', phone: '',
    department: '', designation: '', employee_id: '', credential_note: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [busy,    setBusy]    = useState(false);

  const u = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isOfficial = form.role !== 'citizen';

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSuccess('');
    try {
      const res = await authApi.register(form);
      if (res.account_status === 'pending') {
        setSuccess(
          'Registration submitted. Your credentials are pending administrator review before you can log in.'
        );
      } else {
        setSuccess('Account created. You can now sign in.');
      }
      setTimeout(() => navigate('/login'), 2500);
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
        <div className="eyebrow"><ShieldCheck size={15} /> JOIN AQUASENTINEL</div>
        <h1>Create your<br /><em>account.</em></h1>
        <p>
          Choose your role to get started. Water Analyst and Field Verifier accounts
          require administrator approval before accessing privileged features.
        </p>
        <div className="intro-points">
          <span><ShieldCheck size={18} /> Secure verification</span>
          <span><Droplets size={18} /> Role-based dashboards</span>
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
          <Link to="/login"><button>Sign in</button></Link>
          <button className="active">Create account</button>
        </div>

        {error   && <div className="notice error"  ><AlertCircle size={17}/><span>{error}</span></div>}
        {success && <div className="notice success"><Check size={17}/><span>{success}</span></div>}

        <form onSubmit={submit}>
          <div className="card-heading">
            <h2>Create your account</h2>
            <p>Choose your role to get started.</p>
          </div>

          {/* Role selector */}
          <label>Register as
            <select value={form.role} onChange={e => u('role', e.target.value)}>
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <small className="field-hint">
              {ROLES.find(r => r.value === form.role)?.hint}
            </small>
          </label>

          {/* Admin note */}
          <div className="notice info" style={{ marginTop: -8, marginBottom: 4 }}>
            <ShieldCheck size={15} />
            <span>
              Administrator accounts are not available through public registration.
              They must be created using the secure setup script.
            </span>
          </div>

          {/* Personal details */}
          <label>Full name
            <input required minLength={2} value={form.full_name}
              onChange={e => u('full_name', e.target.value)} placeholder="Your full name" />
          </label>

          <label>Email address
            <input type="email" required value={form.email}
              onChange={e => u('email', e.target.value)} placeholder="you@example.com" />
          </label>

          <div className="two-cols">
            <label>Password
              <input type="password" minLength={8} required value={form.password}
                onChange={e => u('password', e.target.value)} placeholder="8+ characters" />
              <small className="field-hint">Include a number and symbol.</small>
            </label>
            <label>Confirm password
              <input type="password" minLength={8} required value={form.confirm_password}
                onChange={e => u('confirm_password', e.target.value)} placeholder="Repeat password" />
            </label>
          </div>

          <label>Phone <span className="optional">(optional)</span>
            <input value={form.phone} onChange={e => u('phone', e.target.value)}
              placeholder="Contact number" />
          </label>

          {/* Extra fields for officials */}
          {isOfficial && (
            <div className="official-fields">
              <div className="verification-banner">
                <ShieldCheck size={20} />
                <span>
                  <b>Official verification required</b>
                  <small>
                    Your account stays restricted until an administrator reviews your credentials.
                  </small>
                </span>
              </div>

              <label>Department / Government agency
                <input required value={form.department}
                  onChange={e => u('department', e.target.value)}
                  placeholder="e.g. Water Resources Department" />
              </label>

              <div className="two-cols">
                <label>Designation
                  <input required value={form.designation}
                    onChange={e => u('designation', e.target.value)} placeholder="Job title" />
                </label>
                <label>Employee ID
                  <input required value={form.employee_id}
                    onChange={e => u('employee_id', e.target.value)} placeholder="Official ID" />
                </label>
              </div>

              <label>
                Verification details{' '}
                <span className="optional">(no passwords or sensitive ID numbers)</span>
                <textarea value={form.credential_note}
                  onChange={e => u('credential_note', e.target.value)}
                  placeholder="Reference details for the verifier." rows={2} />
              </label>

              <p className="privacy-note">
                Only submit information your department permits you to share.
                This prototype does not validate government employment automatically.
              </p>
            </div>
          )}

          <button className="primary" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'} <ArrowRight size={17} />
          </button>
          <p className="switch-text">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </form>

        <div className="card-foot">
          <ShieldCheck size={15} /> Secure, role-based access to water-quality workflows
        </div>
      </section>
    </div>
  );
}
