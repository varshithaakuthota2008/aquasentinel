import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, FlaskConical, Zap } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useAuth } from '../AuthContext';
import { measurementsApi, locationsApi, iotApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const PARAMS = ['pH','turbidity','dissolved_oxygen','conductivity','temperature','tds','nitrate'];
const UNITS  = { pH:'pH', turbidity:'NTU', dissolved_oxygen:'mg/L', conductivity:'µS/cm', temperature:'°C', tds:'mg/L', nitrate:'mg/L' };
const REFS   = {
  pH:               {min:6.5, max:8.5, std:'WHO 2017'},
  turbidity:        {min:0,   max:4.0, std:'WHO 2017'},
  dissolved_oxygen: {min:5.0, max:null,std:'IS 10500'},
  conductivity:     {min:null,max:750, std:'WHO 2017'},
  tds:              {min:null,max:500, std:'WHO 2017'},
  nitrate:          {min:null,max:10,  std:'WHO 2017'},
};
const COLORS = ['#0d918d','#2d5fb5','#e07b39','#c53030','#7c3aed','#d4a017','#3da35d'];

function flag(param, val) {
  const r = REFS[param];
  if (!r || val === null) return 'unknown';
  if (r.min !== null && val < r.min) return 'low';
  if (r.max !== null && val > r.max) return 'high';
  return 'normal';
}

export default function MonitoringPage() {
  const { token, user } = useAuth();
  const [measurements, setMeasurements] = useState([]);
  const [locations,    setLocations]    = useState([]);
  const [alerts,       setAlerts]       = useState([]);
  const [selParam,     setSelParam]     = useState('pH');
  const [selLoc,       setSelLoc]       = useState('all');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [simBusy,      setSimBusy]      = useState(false);
  const [simMsg,       setSimMsg]       = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [m, l, a] = await Promise.all([
        measurementsApi.list(token, '?limit=200'),
        locationsApi.list(),
        iotApi.alerts(token),
      ]);
      setMeasurements(m); setLocations(l); setAlerts(a);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function runSimulate() {
    setSimBusy(true); setSimMsg('');
    try {
      if (user?.role !== 'admin') { setSimMsg('Admin only.'); return; }
      const r = await iotApi.simulate(token);
      setSimMsg(r.message);
      load();
    } catch(e) { setSimMsg(e.message); }
    finally { setSimBusy(false); }
  }

  async function ackAlert(id) {
    try { await iotApi.acknowledge(id, token); load(); } catch { /* silent */ }
  }

  if (loading) return <LoadingSpinner message="Loading monitoring data…"/>;

  const filteredM = measurements.filter(m =>
    m.parameter === selParam &&
    (selLoc === 'all' || String(m.location_id) === selLoc)
  );

  // Latest reading per location for this param
  const latestByLoc = {};
  filteredM.forEach(m => {
    const k = String(m.location_id || 'none');
    if (!latestByLoc[k] || new Date(m.measured_at) > new Date(latestByLoc[k].measured_at))
      latestByLoc[k] = m;
  });

  // Chart data: last 30 readings for selected param+loc
  const chartData = filteredM
    .slice(0, 30).reverse()
    .map(m => ({ t: new Date(m.measured_at).toLocaleDateString(), v: m.value, src: m.data_source }));

  // Station comparison: latest value per location for selected param
  const stationComp = Object.entries(latestByLoc).map(([locId, m]) => {
    const loc = locations.find(l => String(l.id) === locId);
    return { name: loc?.name || `Loc ${locId}`, value: m.value, flag: flag(selParam, m.value) };
  });

  const ref = REFS[selParam];
  const unacknowledged = alerts.filter(a => !a.is_acknowledged);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="role-eyebrow analyst">WATER MONITORING</div>
          <h1>Monitoring Dashboard</h1>
          <p>Live, imported and simulated measurements. Source labels shown on all readings.</p>
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          {user?.role === 'admin' && (
            <button className="secondary" onClick={runSimulate} disabled={simBusy}>
              <Zap size={14}/> {simBusy ? 'Simulating…' : 'Run Simulation'}
            </button>
          )}
          <button className="secondary" onClick={load}><RefreshCw size={15}/></button>
        </div>
      </div>

      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}
      {simMsg && <div className="notice info"><Zap size={15}/><span>{simMsg}</span></div>}

      {/* Active alerts */}
      {unacknowledged.length > 0 && (
        <div className="section-card" style={{borderLeft:'4px solid #c53030'}}>
          <h3>⚠ Active Alerts ({unacknowledged.length})</h3>
          {unacknowledged.slice(0,5).map(a => (
            <div key={a.id} className="alert-row">
              <span className={`risk-badge risk-${a.severity}`}>{a.severity}</span>
              <div style={{flex:1}}><b>{a.title}</b><p style={{fontSize:11,color:'#607987',margin:0}}>{a.message}</p></div>
              <button className="secondary" style={{fontSize:10,padding:'5px 9px'}} onClick={() => ackAlert(a.id)}>Acknowledge</button>
            </div>
          ))}
          <p className="section-sub" style={{marginTop:8}}>
            Preliminary threshold alerts only. Not lab-confirmed contamination events.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar" style={{marginBottom:16}}>
        {PARAMS.map(p => (
          <button key={p} className={`filter-btn ${selParam===p?'active':''}`} onClick={() => setSelParam(p)}>
            {p} <span style={{fontSize:9,color:'inherit'}}>{UNITS[p]}</span>
          </button>
        ))}
      </div>
      <div className="filter-bar" style={{marginBottom:20}}>
        <button className={`filter-btn ${selLoc==='all'?'active':''}`} onClick={() => setSelLoc('all')}>All Locations</button>
        {locations.map(l => (
          <button key={l.id} className={`filter-btn ${selLoc===String(l.id)?'active':''}`} onClick={() => setSelLoc(String(l.id))}>
            {l.name}
          </button>
        ))}
      </div>

      {measurements.length === 0 ? (
        <EmptyState
          icon={<FlaskConical size={32}/>}
          title="No measurements yet"
          body="Import a CSV file, run the demo seed, or use the IoT simulation to add data."
        />
      ) : (
        <>
          {/* Trend chart */}
          <div className="section-card">
            <h3>{selParam} Trend {UNITS[selParam] && <span className="unit-badge">{UNITS[selParam]}</span>}</h3>
            {ref && <p className="section-sub">Reference: {ref.min !== null ? `min ${ref.min}` : ''}{ref.min !== null && ref.max !== null ? ' — ' : ''}{ref.max !== null ? `max ${ref.max}` : ''} ({ref.std}). Preliminary — not lab-confirmed.</p>}
            {chartData.length === 0
              ? <EmptyState title="No data for this filter"/>
              : <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                    <XAxis dataKey="t" tick={{fontSize:10}} interval="preserveStartEnd"/>
                    <YAxis tick={{fontSize:10}}/>
                    <Tooltip formatter={(v, _, p) => [`${v} ${UNITS[selParam]}`, selParam]}/>
                    <Legend/>
                    {ref?.min !== null && <ReferenceLine y={ref.min} stroke="#e07b39" strokeDasharray="4 2" label={{value:'min',fill:'#e07b39',fontSize:9}}/>}
                    {ref?.max !== null && <ReferenceLine y={ref.max} stroke="#c53030" strokeDasharray="4 2" label={{value:'max',fill:'#c53030',fontSize:9}}/>}
                    <Line type="monotone" dataKey="v" name={selParam} stroke="#0d918d" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
            }
          </div>

          {/* Station comparison */}
          {stationComp.length > 1 && (
            <div className="section-card">
              <h3>Station Comparison — Latest {selParam}</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stationComp} margin={{bottom:30}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8edf0"/>
                  <XAxis dataKey="name" tick={{fontSize:10}} angle={-20} textAnchor="end"/>
                  <YAxis tick={{fontSize:10}}/>
                  <Tooltip/>
                  {ref?.max !== null && <ReferenceLine y={ref.max} stroke="#c53030" strokeDasharray="4 2"/>}
                  <Bar dataKey="value" name={selParam}>
                    {stationComp.map((d,i) => (
                      <Cell key={i} fill={d.flag==='high'?'#c53030':d.flag==='low'?'#e07b39':'#0d918d'}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Latest readings table */}
          <div className="section-card">
            <h3>Recent Readings — {selParam}</h3>
            <div style={{overflowX:'auto'}}>
              <table className="analyst-table">
                <thead><tr><th>Value</th><th>Unit</th><th>Flag</th><th>Source</th><th>Location</th><th>Measured At</th></tr></thead>
                <tbody>
                  {filteredM.slice(0,20).map(m => {
                    const f = flag(m.parameter, m.value);
                    return (
                      <tr key={m.id}>
                        <td style={{fontWeight:700}}>{m.value}</td>
                        <td>{m.unit}</td>
                        <td><span className={`meas-flag flag-${f}`} style={{fontWeight:800,fontSize:10,textTransform:'uppercase'}}>{f}</span></td>
                        <td><span className="data-source-badge">{m.data_source}</span></td>
                        <td>{locations.find(l=>l.id===m.location_id)?.name || m.location_id || '—'}</td>
                        <td style={{fontSize:10}}>{new Date(m.measured_at).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
