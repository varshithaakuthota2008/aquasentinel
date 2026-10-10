import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { analyticsApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const RISK_COLORS = {
  low:      '#3da35d',
  moderate: '#d4a017',
  high:     '#e07b39',
  critical: '#c53030',
  unscored: '#a0b4bc',
};

const STATUS_COLORS = {
  pending_review: '#d4a017',
  under_review:   '#2d5fb5',
  resolved:       '#3da35d',
};

const SOURCE_COLORS = ['#0d918d','#2d5fb5','#e07b39','#3da35d','#c53030','#7c3aed'];

const DAYS_OPTIONS = [7, 14, 30, 90];

export default function AnalyticsPage() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [timeSeries, setTimeSeries] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [bySource, setBySource] = useState([]);
  const [inspStats, setInspStats] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [ov, ts, cat, src] = await Promise.all([
        analyticsApi.overview(token),
        analyticsApi.timeSeries(token, `?days=${days}`),
        analyticsApi.byCategory(token),
        analyticsApi.bySource(token),
      ]);
      setOverview(ov);
      setTimeSeries(ts.series || []);
      setByCategory(cat);
      setBySource(src);
      if (user?.role !== 'citizen') {
        const insp = await analyticsApi.inspections(token);
        setInspStats(insp);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [token, days]);

  if (loading) return <LoadingSpinner message="Loading analytics…" />;

  const totalReports = overview?.total_reports ?? 0;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1>Analytics</h1>
          <p>All data computed from live database records. No hardcoded statistics.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="filter-bar" style={{ margin: 0 }}>
            {DAYS_OPTIONS.map(d => (
              <button key={d} className={`filter-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                {d}d
              </button>
            ))}
          </div>
          <button className="secondary" onClick={load}><RefreshCw size={15} /></button>
        </div>
      </div>

      {error && <div className="notice error"><AlertCircle size={17} /><span>{error}</span></div>}

      {totalReports === 0 ? (
        <EmptyState
          title="No data yet"
          body="Analytics will appear here once reports are submitted. Submit a water-quality report to get started."
        />
      ) : (
        <>
          {/* Overview stats */}
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              ['Total Reports', overview?.total_reports ?? 0],
              ['Pending Review', overview?.by_status?.pending_review ?? 0],
              ['High / Critical', (overview?.by_risk_category?.high ?? 0) + (overview?.by_risk_category?.critical ?? 0)],
              ['Resolved', overview?.by_status?.resolved ?? 0],
            ].map(([l, v]) => (
              <div className="stat" key={l}><span>{l}</span><strong>{v}</strong></div>
            ))}
          </div>

          {/* Time series */}
          <div className="section-card">
            <h3>Reports Over Time <span className="section-badge">Last {days} days</span></h3>
            <p className="section-sub">Daily report submissions and high-risk counts.</p>
            {timeSeries.every(d => d.total === 0) ? (
              <EmptyState title="No reports in this period" body="Try a wider date range." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={timeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Total Reports" stroke="#0d918d" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="high_risk" name="High/Critical" stroke="#c53030" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="analytics-two-col">
            {/* Risk category pie */}
            <div className="section-card">
              <h3>By Risk Category</h3>
              {byCategory.every(d => d.count === 0) ? (
                <EmptyState title="No scored reports yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={byCategory.filter(d => d.count > 0)}
                      dataKey="count"
                      nameKey="category"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {byCategory.filter(d => d.count > 0).map((d) => (
                        <Cell key={d.category} fill={RISK_COLORS[d.category] || '#a0b4bc'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Source type bar */}
            <div className="section-card">
              <h3>By Source Type</h3>
              {bySource.length === 0 ? (
                <EmptyState title="No reports yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bySource} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" />
                    <XAxis dataKey="source_type" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Reports">
                      {bySource.map((d, i) => (
                        <Cell key={d.source_type} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Status bar */}
          <div className="section-card">
            <h3>Report Status Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={Object.entries(overview?.by_status ?? {}).map(([k, v]) => ({ status: k.replace('_', ' '), count: v }))}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Reports">
                  {Object.entries(overview?.by_status ?? {}).map(([k]) => (
                    <Cell key={k} fill={STATUS_COLORS[k] || '#0d918d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Inspections (non-citizen) */}
          {inspStats && (
            <div className="section-card">
              <h3>Inspection Outcomes</h3>
              {inspStats.total === 0 ? (
                <EmptyState title="No inspections recorded yet" />
              ) : (
                <>
                  <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat"><span>Total Inspections</span><strong>{inspStats.total}</strong></div>
                    <div className="stat"><span>Follow-up Required</span><strong>{inspStats.follow_up_required}</strong></div>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={inspStats.by_outcome} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0" />
                      <XAxis dataKey="outcome" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="Inspections" fill="#0d918d" />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
