import React, { useEffect, useState, useCallback } from 'react';
import { Bell, X, Check, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { notificationsApi } from '../api';
import { useAuth } from '../AuthContext';
import { Link } from 'react-router-dom';

const ICONS = {
  critical: <AlertCircle size={15} style={{ color: '#c53030' }} />,
  warning:  <AlertTriangle size={15} style={{ color: '#e07b39' }} />,
  alert:    <AlertTriangle size={15} style={{ color: '#d4a017' }} />,
  info:     <Info size={15} style={{ color: '#2d5fb5' }} />,
};

export default function NotificationBell() {
  const { token, user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    if (!user || !token) return;
    try {
      const c = await notificationsApi.count(token);
      setCount(c.unread);
    } catch { /* silent — don't break UI */ }
  }, [token, user]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60_000); // poll every 60s
    return () => clearInterval(interval);
  }, [fetchCount]);

  async function openPanel() {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const data = await notificationsApi.list(token);
        setNotifs(data);
      } catch { /* silent */ } finally { setLoading(false); }
    }
  }

  async function markRead(id) {
    try {
      await notificationsApi.markRead(id, token);
      setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n));
      setCount(c => Math.max(0, c - 1));
    } catch { /* silent */ }
  }

  async function markAllRead() {
    try {
      await notificationsApi.markAllRead(token);
      setNotifs(ns => ns.map(n => ({ ...n, is_read: true })));
      setCount(0);
    } catch { /* silent */ }
  }

  if (!user) return null;

  return (
    <div className="notif-bell-wrap">
      <button className="notif-bell-btn" onClick={openPanel} aria-label={`Notifications${count > 0 ? `, ${count} unread` : ''}`}>
        <Bell size={19} />
        {count > 0 && <span className="notif-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel">
            <div className="notif-panel-head">
              <strong>Notifications</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                {count > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    <Check size={13} /> Mark all read
                  </button>
                )}
                <button className="notif-close" onClick={() => setOpen(false)}><X size={16} /></button>
              </div>
            </div>

            <div className="notif-list">
              {loading && <div className="notif-empty">Loading…</div>}
              {!loading && notifs.length === 0 && (
                <div className="notif-empty"><Bell size={26} /><span>No notifications yet</span></div>
              )}
              {!loading && notifs.map(n => (
                <div
                  key={n.id}
                  className={`notif-item ${n.is_read ? '' : 'unread'} notif-${n.category}`}
                  onClick={() => !n.is_read && markRead(n.id)}
                >
                  <span className="notif-icon">{ICONS[n.category] || ICONS.info}</span>
                  <div className="notif-body">
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                    <div className="notif-meta">
                      {n.report_id && (
                        <Link to={`/reports/${n.report_id}`} onClick={() => setOpen(false)} className="notif-link">
                          View Report #{n.report_id}
                        </Link>
                      )}
                      <time>{new Date(n.created_at).toLocaleString()}</time>
                    </div>
                  </div>
                  {!n.is_read && <span className="notif-dot" />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
