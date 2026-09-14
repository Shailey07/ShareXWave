import React from 'react';
import { downloadFileUrl } from '../api';

export default function MessageBubble({ message, isOwn, roomId }) {
  const t = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.type === 'system') {
    return <div className="bubble system">{message.text}</div>;
  }

  return (
    <div className={`bubble ${isOwn ? 'out' : 'in'}`}>
      {!isOwn && (
        <div style={{
          fontFamily: 'var(--font-m)', fontSize: 9, fontWeight: 700,
          marginBottom: 4, opacity: 0.75,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>{message.fromName || 'Guest'}</span>
        </div>
      )}
      {message.text && <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>}
      {message.attachment && <AttachmentView att={message.attachment} roomId={roomId} />}
      <div className="meta" style={{ textAlign: isOwn ? 'right' : 'left' }}>{t}</div>
    </div>
  );
}

function AttachmentView({ att, roomId }) {
  const url = downloadFileUrl(roomId, att.fileId);
  const t = (att.mimetype || '').toLowerCase();

  if (t.startsWith('image/')) {
    return <img src={url} alt={att.originalName} style={{ maxWidth: 240, borderRadius: 12, marginTop: 6, cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />;
  }
  if (t.startsWith('video/')) {
    return <video src={url} controls style={{ maxWidth: 260, borderRadius: 12, marginTop: 6 }} />;
  }
  if (t.startsWith('audio/')) {
    return <audio src={url} controls style={{ width: 220, marginTop: 6 }} />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{
      display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
      padding: '8px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 10,
      textDecoration: 'none', color: 'inherit',
    }}>
      <span style={{ fontSize: 18 }}>📎</span>
      <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.originalName}</span>
    </a>
  );
}