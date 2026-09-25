import React, { useState, useEffect, useCallback } from 'react';
import { getMySessions, openMySession, extendMySession, setRoomToken } from '../api';

/* Countdown label for a session's remaining life. */
function remaining(expiresAt) {
  const rem = Number(expiresAt) - Date.now();
  if (rem <= 0) return 'expired';
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export default function MySessions({ onOpen }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await getMySessions();
      setSessions(res.data.sessions || []);
    } catch (e) {
      setError('// could not load your sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async (roomId) => {
    setBusyId(roomId);
    setError('');
    try {
      const res = await openMySession(roomId);
      setRoomToken(res.data.token);
      onOpen?.(res.data, !!res.data.isOwner);
    } catch (e) {
      const s = e.response?.status;
      setError(s === 410 ? '// this session already expired' : '// could not open session');
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleExtend = async (roomId) => {
    setBusyId(roomId);
    setError('');
    try {
      await extendMySession(roomId, '24h');
      await load();
    } catch (e) {
      setError('// could not extend — ' + (e.response?.data?.error || 'try again'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <p className="slash-label" style={{ textAlign: 'center', padding: 20 }}>loading your sessions...</p>;
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p className="section-label" style={{ margin: 0 }}>My Saved Sessions</p>
        <button className="ice-btn btn-ghost" style={{ width: 'auto', padding: '4px 10px', fontSize: 10 }} onClick={load}>⟳ Refresh</button>
      </div>

      {error && <p className="text-error" style={{ marginBottom: 8 }}>{error}</p>}

      {sessions.length === 0 ? (
        <div className="glass-card" style={{ padding: 16, textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-m)', fontSize: 10.5, color: 'var(--t3)', lineHeight: 1.8 }}>
            // no saved sessions yet<br />// create or join one while logged in — it'll show up here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sessions.map((s) => {
            const expired = Number(s.expiresAt) <= Date.now();
            const label = s.displayName || s.code || s.gmail || 'Session';
            return (
              <div key={s.roomId} className="session-row bracketed" style={{ cursor: 'default' }}>
                <div className="session-avatar">{label.charAt(0).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--font-d)', fontSize: 14, fontWeight: 700, color: 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {label}
                    {s.isOwner && <span className="tag-owner">OWNER</span>}
                    {s.approvalRequired && <span className="tag-approval">APPROVAL</span>}
                  </p>
                  <p style={{ fontFamily: 'var(--font-m)', fontSize: 9.5, color: expired ? 'var(--rose)' : 'var(--t3)', marginTop: 3 }}>
                    {remaining(s.expiresAt)} · {s.messageCount || 0} msgs · {s.fileCount || 0} files
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {s.isOwner && !expired && (
                    <button
                      className="ice-btn btn-lavender"
                      style={{ width: 'auto', padding: '6px 10px', fontSize: 10 }}
                      disabled={busyId === s.roomId}
                      onClick={() => handleExtend(s.roomId)}
                      title="Extend to 24h from now"
                    >
                      +Extend
                    </button>
                  )}
                  <button
                    className="ice-btn btn-teal"
                    style={{ width: 'auto', padding: '6px 12px', fontSize: 10 }}
                    disabled={busyId === s.roomId || expired}
                    onClick={() => handleOpen(s.roomId)}
                  >
                    {busyId === s.roomId ? '⟳' : (expired ? 'Expired' : 'Open')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
