import React, { useState, useRef } from 'react';
import { Upload, Download, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, FileText } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { importsApi } from '../api';

const PARAMS = [
  'sample_date','station_id','station_name','latitude','longitude',
  'pH','turbidity','tds','temperature','dissolved_oxygen','conductivity','nitrate',
  'source','notes',
];

const STEPS = ['Upload','Map Columns','Validate','Import'];

export default function CSVImportPage() {
  const { token } = useAuth();
  const fileRef = useRef();
  const [step, setStep]         = useState(0);
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);
  const [mapping, setMapping]   = useState({});
  const [validation, setVal]    = useState(null);
  const [result, setResult]     = useState(null);
  const [locationId, setLocId]  = useState('');
  const [sourceLabel, setSrc]   = useState('IMPORTED');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [history, setHistory]   = useState([]);

  async function handleFile(e) {
    const f = e.target.files?.[0]; if (!f) return;
    setFile(f); setError(''); setBusy(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const data = await importsApi.preview(fd, token);
      setPreview(data);
      setMapping(data.auto_mapping || {});
      setStep(1);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function validate() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('column_mapping', JSON.stringify(mapping));
      const data = await importsApi.validate(fd, token);
      setVal(data); setStep(2);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function commit() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('column_mapping', JSON.stringify(mapping));
      fd.append('source_label', sourceLabel);
      fd.append('location_id', locationId);
      const data = await importsApi.commit(fd, token);
      setResult(data); setStep(3);
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function loadHistory() {
    try { setHistory(await importsApi.history(token)); } catch { /* silent */ }
  }

  React.useEffect(() => { loadHistory(); }, []);

  function reset() {
    setStep(0); setFile(null); setPreview(null);
    setMapping({}); setVal(null); setResult(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
    loadHistory();
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="role-eyebrow analyst">DATA IMPORT</div>
          <h1>CSV / XLSX Import</h1>
          <p>Upload historical water-quality data. Preview, map columns, validate, then save.</p>
        </div>
        <a href={`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/v1/imports/template`}
           className="secondary" style={{textDecoration:'none',display:'inline-flex',alignItems:'center',gap:7}}>
          <Download size={15}/> Download Template
        </a>
      </div>

      {error && <div className="notice error"><AlertCircle size={17}/><span>{error}</span></div>}

      {/* Step indicator */}
      <div className="import-steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`import-step ${i <= step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
            <span className="step-num">{i < step ? '✓' : i + 1}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="section-card">
          <h3>Upload File</h3>
          <p className="section-sub">CSV or XLSX, max 20 MB. Download the template above to see required columns.</p>
          <label className="file-label file-label-lg" style={{cursor:'pointer'}}>
            <Upload size={22}/><span>{busy ? 'Reading file…' : 'Click to choose CSV or XLSX'}</span>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{display:'none'}} disabled={busy}/>
          </label>
          <div className="notice info" style={{marginTop:16}}>
            <FileText size={15}/>
            <span>Supported parameters: pH, turbidity, TDS, temperature, dissolved oxygen, conductivity, nitrate. Missing columns are fine — different datasets have different columns.</span>
          </div>
        </div>
      )}

      {/* Step 1: Map columns */}
      {step === 1 && preview && (
        <div className="section-card">
          <h3>Map Columns — {preview.filename}</h3>
          <p className="section-sub">{preview.total_rows} rows detected. Auto-mapped where possible — adjust as needed.</p>
          <div className="column-map-grid">
            {preview.columns.map(col => (
              <div key={col} className="col-map-row">
                <span className="col-csv">{col}</span>
                <ArrowRight size={14} style={{color:'#a0b4bc',flexShrink:0}}/>
                <select value={mapping[col] || ''} onChange={e => setMapping(m => ({...m, [col]: e.target.value || undefined}))}>
                  <option value="">— skip —</option>
                  {PARAMS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="two-cols" style={{marginTop:16}}>
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:11,fontWeight:700,color:'#345464'}}>
              Source label
              <select value={sourceLabel} onChange={e => setSrc(e.target.value)}>
                <option value="IMPORTED">IMPORTED</option>
                <option value="MANUAL">MANUAL</option>
                <option value="LAB">LAB</option>
              </select>
            </label>
            <label style={{display:'flex',flexDirection:'column',gap:6,fontSize:11,fontWeight:700,color:'#345464'}}>
              Monitoring location ID <span style={{fontWeight:400,color:'#8a9eaa'}}>(optional)</span>
              <input type="number" value={locationId} onChange={e => setLocId(e.target.value)} placeholder="Leave blank to skip"/>
            </label>
          </div>
          {/* Preview table */}
          <div style={{overflowX:'auto',marginTop:16}}>
            <table className="analyst-table">
              <thead><tr>{preview.columns.map(c=><th key={c}>{c}</th>)}</tr></thead>
              <tbody>{preview.preview_rows.map((row,i)=>(
                <tr key={i}>{preview.columns.map(c=><td key={c}>{row[c] ?? '—'}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button className="secondary" onClick={reset}>← Back</button>
            <button className="primary" onClick={validate} disabled={busy}>
              {busy ? 'Validating…' : 'Validate'} <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validation results */}
      {step === 2 && validation && (
        <div className="section-card">
          <h3>Validation Results</h3>
          <div className="stats-grid" style={{marginBottom:16}}>
            <div className="stat"><span>Total Rows</span><strong>{validation.total_rows}</strong></div>
            <div className="stat"><span>Accepted</span><strong style={{color:'#3da35d'}}>{validation.accepted_rows}</strong></div>
            <div className="stat"><span>Rejected</span><strong style={{color: validation.rejected_rows > 0 ? '#c53030' : '#3da35d'}}>{validation.rejected_rows}</strong></div>
          </div>
          {validation.errors.length > 0 && (
            <div style={{marginBottom:14}}>
              <h4 style={{fontSize:12,color:'#c53030',margin:'0 0 8px'}}>Row-level errors (first {validation.errors.length}):</h4>
              <table className="analyst-table">
                <thead><tr><th>Row</th><th>Column</th><th>Error</th></tr></thead>
                <tbody>{validation.errors.map((e,i)=>(
                  <tr key={i}><td>{e.row}</td><td>{e.column}</td><td style={{color:'#c53030'}}>{e.error}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {validation.accepted_rows === 0
            ? <div className="notice error"><AlertCircle size={17}/><span>No valid rows found. Fix the errors and re-upload.</span></div>
            : <div className="notice success"><CheckCircle2 size={17}/><span>{validation.accepted_rows} rows are ready to import.</span></div>
          }
          <div style={{display:'flex',gap:10,marginTop:16}}>
            <button className="secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="primary" onClick={commit} disabled={busy || validation.accepted_rows === 0}>
              {busy ? 'Importing…' : `Import ${validation.accepted_rows} rows`} <ArrowRight size={16}/>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && result && (
        <div className="section-card">
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <CheckCircle2 size={48} style={{color:'#3da35d',marginBottom:12}}/>
            <h2 style={{fontFamily:'Manrope,sans-serif',fontSize:22,color:'#12384a',margin:'0 0 8px'}}>Import Complete</h2>
            <p style={{color:'#607987',fontSize:13}}>{result.message}</p>
            <div className="stats-grid" style={{marginTop:20,maxWidth:400,margin:'20px auto 0'}}>
              <div className="stat"><span>Accepted</span><strong style={{color:'#3da35d'}}>{result.accepted_rows}</strong></div>
              <div className="stat"><span>Rejected</span><strong style={{color:'#c53030'}}>{result.rejected_rows}</strong></div>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'center',gap:10,marginTop:20}}>
            <button className="secondary" onClick={reset}><RefreshCw size={15}/> Import Another File</button>
          </div>
        </div>
      )}

      {/* Import history */}
      {history.length > 0 && step === 0 && (
        <div className="section-card">
          <h3>Import History</h3>
          <table className="analyst-table">
            <thead><tr><th>#</th><th>File</th><th>Source</th><th>Rows</th><th>Accepted</th><th>Rejected</th><th>Date</th></tr></thead>
            <tbody>{history.map(h=>(
              <tr key={h.id}>
                <td>{h.id}</td><td>{h.filename}</td>
                <td><span className="data-source-badge">{h.source_label}</span></td>
                <td>{h.total_rows}</td>
                <td style={{color:'#3da35d',fontWeight:700}}>{h.accepted_rows}</td>
                <td style={{color: h.rejected_rows > 0 ? '#c53030' : 'inherit'}}>{h.rejected_rows}</td>
                <td>{new Date(h.created_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
