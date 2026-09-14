import React, { useState } from 'react';

function formatSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
}

function getFileIcon(name, mimetype) {
  const n = (name || '').toLowerCase();
  const t = (mimetype || '').toLowerCase();
  if (t.startsWith('image/'))   return '🖼️';
  if (t.startsWith('video/'))   return '🎬';
  if (t.startsWith('audio/'))   return '🎵';
  if (t === 'application/pdf')  return '📄';
  if (n.match(/\.(zip|rar|7z|gz|tar)$/)) return '🗜️';
  if (n.match(/\.(js|ts|jsx|tsx|py|go|rs|c|cpp|java|html|css|json)$/)) return '💻';
  if (t.startsWith('text/'))    return '📝';
  if (n.match(/\.(xlsx?|csv)$/)) return '📊';
  if (n.match(/\.(docx?|pptx?)$/)) return '📄';
  return '📎';
}

export default function FileList({ files, onDownload, onDelete }) {
  const [deleting, setDeleting] = useState(null);

  if (!files || files.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '32px 20px',
        border: '1.5px dashed var(--border-mid)',
        borderRadius: 'var(--r-md)',
        background: 'rgba(108,99,255,0.04)',
      }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
        <p style={{ fontFamily: 'var(--font-d)', fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 5 }}>
          No files shared yet
        </p>
        <p style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', letterSpacing: 1 }}>
          upload a file to share with the other device
        </p>
      </div>
    );
  }

  const handleDelete = async (id) => {
    setDeleting(id);
    await onDelete(id);
    setDeleting(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <label className="field-label" style={{ margin: 0 }}>Shared Files</label>
        <span style={{
          fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--violet)',
          background: 'var(--violet-faint)',
          border: '1px solid var(--border-mid)',
          padding: '2px 9px', borderRadius: 20, fontWeight: 600,
        }}>
          {files.length}
        </span>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        maxHeight: 300, overflowY: 'auto',
        paddingRight: 2,
      }}>
        {files.map((f) => (
          <div key={f.id} className="file-item">
            <div className="file-icon">{getFileIcon(f.originalName, f.mimetype)}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-d)', fontSize: 12, fontWeight: 600,
                color: 'var(--t1)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {f.originalName}
              </p>
              <p style={{ fontFamily: 'var(--font-m)', fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
                {formatSize(f.size)}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => onDownload(f.id, f.originalName)}
                style={{
                  padding: '5px 12px', borderRadius: 8,
                  border: '1px solid rgba(108,99,255,0.25)',
                  background: 'var(--violet-faint)',
                  color: 'var(--violet)',
                  fontFamily: 'var(--font-m)',
                  fontSize: 10, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                ↓ Save
              </button>
              <button
                onClick={() => handleDelete(f.id)}
                disabled={deleting === f.id}
                style={{
                  padding: '5px 10px', borderRadius: 8,
                  border: '1px solid rgba(242,107,107,0.22)',
                  background: 'var(--rose-faint)',
                  color: 'var(--rose)',
                  fontFamily: 'var(--font-m)',
                  fontSize: 10, fontWeight: 600,
                  cursor: deleting === f.id ? 'not-allowed' : 'pointer',
                  opacity: deleting === f.id ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {deleting === f.id ? '…' : '✕'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}