import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Search, Check, X, UserRound } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { adminApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const ROLE_LABEL = { citizen:'Citizen', water_authority:'Water Analyst', field_inspector:'Field Verifier', admin:'Administrator' };

export default function AdminUserManagement() {
  const { user: me, token } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [roleF,   setRoleF]   = useState('all');
  const [statusF, setStatusF] = useState('all');
  const [busy,    setBusy]    = useState({});
  const [loading, setLoading] = useState(true);
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');
  const [confirm, setConfirm] = useState(null); // { userId, action, name }

  const load = useCallback(async () => {
    setLoading(true);
    try { setUsers(await adminApi.users(token)); }
    catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    if (roleF   !== 'all' && u.role !== roleF)           return false;
    if (statusF !== 'all' && u.account_status !== statusF) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.full_name.toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q) &&
          !(u.employee_id||'').toLowerCase().includes(q) &&
          !(u.department||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  async function changeStatus(userId, status, name) {
    setConfirm(null);
    setBusy(b => ({...b, [userId]: status}));
    setMsg(''); setError('');
    try {
      await adminApi.updateUserStatus(userId, status, token);
      setUsers(us => us.map(u => u.id === userId ? {...u, account_status: status} : u));
      setMsg(`${name}: status changed to ${status}.`);
    } catch(e) { setError(e.message); }
    finally { setBusy(b => ({...b, [userId]: null})); }
  }

  if (loading) return <LoadingSpinner message="Loading users…"/>;

  return (
    <div className="page-content">
      <div className="dash-header">
        <div>
          <div className="role-pill admin-pill">ADMINISTRATOR</div>
          <h1 className="dash-title">User Management</h1>
          <p className="dash-sub">View, search, and manage registered accounts.</p>
        </div>
        <button className="btn-icon" onClick={load}><RefreshCw size={16}/></button>
      </div>

      {error && <div className="alert-banner alert-error"><AlertCircle size={16}/><span>{error}</span></div>}
      {msg   && <div className="alert-banner alert-success"><Check size={16}/><span>{msg}</span></div>}

      {/* Confirm dialog */}
      {confirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Action</h3>
            <p>Set <strong>{confirm.name}</strong>'s status to <strong>{confirm.action}</strong>?</p>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <button className="btn-primary" onClick={() => changeStatus(confirm.userId, confirm.action, confirm.name)}>
                Confirm
              </button>
              <button className="btn-secondary" onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filter-toolbar">
        <div className="search-bar" style={{flex:1,maxWidth:320}}>
          <Search size={15}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email, employee ID…"/>
        </div>
        <select className="field-input" style={{width:160}} value={roleF} onChange={e=>setRoleF(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="citizen">Citizen</option>
          <option value="water_authority">Water Analyst</option>
          <option value="field_inspector">Field Verifier</option>
          <option value="admin">Administrator</option>
        </select>
        <select className="field-input" style={{width:160}} value={statusF} onChange={e=>setStatusF(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="revoked">Revoked</option>
        </select>
        <span style={{fontSize:11,color:'#8fa5b0',whiteSpace:'nowrap'}}>{filtered.length} of {users.length}</span>
      </div>

      <div className="panel" style={{marginTop:12}}>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Email</th><th>Role</th>
                <th>Status</th><th>Department</th><th>Emp ID</th><th>Joined</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{textAlign:'center',padding:'32px',color:'#8fa5b0'}}>No users match your filters.</td></tr>
              ) : filtered.map(u => (
                <tr key={u.id}>
                  <td style={{color:'#8fa5b0'}}>{u.id}</td>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:28,height:28,borderRadius:7,background:'#f1f5f9',display:'grid',placeItems:'center',flexShrink:0}}>
                        <UserRound size={14} style={{color:'#64748b'}}/>
                      </div>
                      <span style={{fontWeight:600,fontSize:12}}>{u.full_name}</span>
                    </div>
                  </td>
                  <td style={{fontSize:11,color:'#64748b'}}>{u.email}</td>
                  <td><span className={`role-tag role-${u.role}`}>{ROLE_LABEL[u.role]||u.role}</span></td>
                  <td><StatusBadge status={u.account_status}/></td>
                  <td style={{fontSize:11}}>{u.department||'—'}</td>
                  <td style={{fontSize:11}}>{u.employee_id||'—'}</td>
                  <td style={{fontSize:11,whiteSpace:'nowrap'}}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    {u.id !== me?.id && u.role !== 'admin' && (
                      <div style={{display:'flex',gap:6}}>
                        {u.account_status !== 'active' && (
                          <button className="tbl-action-sm tbl-success" disabled={!!busy[u.id]}
                            onClick={() => setConfirm({userId:u.id,action:'active',name:u.full_name})}>
                            {busy[u.id]==='active'?'…':'Activate'}
                          </button>
                        )}
                        {u.account_status === 'active' && (
                          <button className="tbl-action-sm tbl-danger" disabled={!!busy[u.id]}
                            onClick={() => setConfirm({userId:u.id,action:'revoked',name:u.full_name})}>
                            {busy[u.id]==='revoked'?'…':'Suspend'}
                          </button>
                        )}
                      </div>
                    )}
                    {u.id === me?.id && <span style={{fontSize:10,color:'#94a3b8'}}>You</span>}
                    {u.role === 'admin' && u.id !== me?.id && <span style={{fontSize:10,color:'#94a3b8'}}>Admin</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
