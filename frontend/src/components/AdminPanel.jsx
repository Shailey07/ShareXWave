import React, { useState, useEffect } from 'react';
import { adminListRooms, adminGetRoom, adminDeleteRoom, getAdminToken } from '../api';

export default function AdminPanel({ onLogout, onEnterRoom }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [roomDetail, setRoomDetail] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});
  const [copied, setCopied] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListRooms();
      setRooms(res.data.rooms);
    } catch (e) {
      if (e.response?.status === 401) onLogout();
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, []);

  const openRoom = async (roomId) => {
    setSelected(roomId);
    try {
      const res = await adminGetRoom(roomId);
      setRoomDetail(res.data);
    } catch {}
  };

  const enterAsGhost = (room) => {
    onEnterRoom({
      roomId: room.roomId,
      code: room.code,
      displayName: room.displayName || room.code || room.gmail || 'Room',
      type: room.type,
      expiresAt: room.expiresAt,
      textContent: '',
      files: [],
      messages: [],
      totalBytes: room.totalBytes,
      maxBytes: 50 * 1024 * 1024,
      token: getAdminToken(),
      isGhost: true,
    });
  };

  const deleteRoom = async (room) => {
    if (!window.confirm(`End session "${room.code || room.gmail || room.roomId}"? All messages and files will be deleted.`)) return;
    try {
      await adminDeleteRoom(room.roomId);
      setRooms(prev => prev.filter(r => r.roomId !== room.roomId));
      if (selected === room.roomId) { setSelected(null); setRoomDetail(null); }
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const togglePassword = (roomId) => {
    setShowPasswords(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const fmt = (b) => b < 1024 ? b + ' B' : b < 1024**2 ? (b/1024).toFixed(1) + ' KB' : (b/1024**2).toFixed(1) + ' MB';

  return (
    <div style={{ padding: '14px 16px 24px', width: '100%', maxWidth: 900, margin: '0 auto' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-d)', fontSize: 22, fontWeight: 800, color: 'var(--t1)' }}>Admin Panel</h2>
          <p className="slash-label">{rooms.length} active room{rooms.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="ice-btn btn-ghost" style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}>↻ Refresh</button>
          <button onClick={onLogout} className="ice-btn btn-danger" style={{ width: 'auto', padding: '8px 14px', fontSize: 12 }}>Logout</button>
        </div>
      </div>

      {loading && rooms.length === 0 && <p style={{ textAlign: 'center', fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--t3)' }}>Loading rooms...</p>}

      {!loading && rooms.length === 0 && (
        <div className="empty-state">
          <p style={{ fontFamily: 'var(--font-d)', fontSize: 16, fontWeight: 700 }}>No active rooms</p>
          <p className="slash-label" style={{ marginTop: 8 }}>rooms will appear here as they are created</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rooms.map(room => {
          const passVisible = showPasswords[room.roomId];
          return (
            <div key={room.roomId} className="glass-card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div className="session-avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                      {(room.code || room.gmail || room.displayName || 'R').charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-d)', fontSize: 14, fontWeight: 700 }}>
                        {room.code || room.gmail || room.displayName || 'Room'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)' }}>
                        {room.type} · {room.messageCount} msgs · {room.fileCount} files · {fmt(room.totalBytes)}
                      </div>
                    </div>
                  </div>

                  {/* Credentials row — admin only */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {room.code && (
                      <div style={{
                        fontFamily: 'var(--font-m)', fontSize: 10,
                        background: 'rgba(108,99,255,0.08)',
                        border: '1px solid var(--border-mid)',
                        padding: '5px 10px', borderRadius: 8,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ color: 'var(--t3)', letterSpacing: 1 }}>CODE</span>
                        <b style={{ color: 'var(--violet)' }}>{room.code}</b>
                        <button onClick={() => copy(room.code, `code-${room.roomId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--violet)' }}>
                          {copied === `code-${room.roomId}` ? '✓' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {room.plainPassword && (
                      <div style={{
                        fontFamily: 'var(--font-m)', fontSize: 10,
                        background: 'rgba(242,107,107,0.08)',
                        border: '1px solid rgba(242,107,107,0.25)',
                        padding: '5px 10px', borderRadius: 8,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <span style={{ color: 'var(--t3)', letterSpacing: 1 }}>PASS</span>
                        <b style={{ color: 'var(--rose)', minWidth: 60 }}>
                          {passVisible ? room.plainPassword : '••••••••'}
                        </b>
                        <button onClick={() => togglePassword(room.roomId)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--rose)' }}>
                          {passVisible ? '👁 Hide' : '👁 Show'}
                        </button>
                        <button onClick={() => copy(room.plainPassword, `pass-${room.roomId}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--rose)' }}>
                          {copied === `pass-${room.roomId}` ? '✓' : 'Copy'}
                        </button>
                      </div>
                    )}
                  </div>

                  {room.lastMessage?.text && (
                    <p style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t2)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <b>{room.lastMessage.from_name}:</b> {room.lastMessage.text}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => openRoom(room.roomId)} className="ice-btn btn-ghost" style={{ width: 'auto', padding: '6px 12px', fontSize: 10 }}>
                    {selected === room.roomId ? 'Hide' : 'View'}
                  </button>
                  <button onClick={() => enterAsGhost(room)} className="ice-btn btn-lavender" style={{ width: 'auto', padding: '6px 12px', fontSize: 10 }}>Ghost</button>
                  <button onClick={() => deleteRoom(room)} className="ice-btn btn-danger" style={{ width: 'auto', padding: '6px 12px', fontSize: 10 }}>End</button>
                </div>
              </div>

              {selected === room.roomId && roomDetail && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', maxHeight: 300, overflowY: 'auto' }}>
                  {roomDetail.messages.length === 0 && <p style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t3)' }}>No messages yet</p>}
                  {roomDetail.messages.map(m => (
                    <div key={m.id} style={{ marginBottom: 8, padding: '6px 10px', background: 'rgba(255,255,255,0.5)', borderRadius: 8 }}>
                      <div style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)' }}>
                        <b>{m.fromName || 'System'}</b> · {new Date(m.timestamp).toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 3 }}>{m.text || '(attachment)'}</div>
                    </div>
                  ))}
                  {roomDetail.files.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p className="slash-label" style={{ marginBottom: 6 }}>Files ({roomDetail.files.length})</p>
                      {roomDetail.files.map(f => (
                        <div key={f.id} style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--t2)', marginBottom: 3 }}>
                          📎 {f.originalName} · {fmt(f.size)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}