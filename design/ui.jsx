/* Reusable UI primitives — Icon set (inline SVG), Toast, ChipSelect, Checkbox, Modal, Drawer, StatusBadge, Thumb */
const { useState, useContext, createContext, useEffect } = React;

/* ───────── Icons (lucide-style, currentColor) ───────── */
const I = (paths) => ({ size = 14, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {paths}
  </svg>
);

const Icon = {
  Dashboard:   I(<><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>),
  Layers:      I(<><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></>),
  Type:        I(<><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></>),
  Wand:        I(<><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></>),
  Crop:        I(<><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></>),
  FileText:    I(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></>),
  Video:       I(<><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></>),
  Tag:         I(<><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.42 0l8.58-8.58a1 1 0 0 0 0-1.42z"/><circle cx="7" cy="7" r="1"/></>),
  Pencil:      I(<><path d="m18 2 4 4-14 14H4v-4z"/></>),
  Image:       I(<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></>),
  Sparkle:     I(<><path d="M12 3v3"/><path d="M12 18v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/><circle cx="12" cy="12" r="3"/></>),
  Globe:       I(<><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/></>),
  Clock:       I(<><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>),
  Settings:    I(<><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/><circle cx="12" cy="12" r="4"/></>),
  Search:      I(<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>),
  Bell:        I(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></>),
  Help:        I(<><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.7 1c0 2-3 3-3 3"/><path d="M12 17h0"/></>),
  Plus:        I(<><path d="M12 5v14"/><path d="M5 12h14"/></>),
  Check:       I(<path d="M20 6 9 17l-5-5"/>),
  X:           I(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>),
  ChevDown:    I(<path d="m6 9 6 6 6-6"/>),
  ChevUp:      I(<path d="m18 15-6-6-6 6"/>),
  ChevLeft:    I(<path d="m15 18-6-6 6-6"/>),
  ChevRight:   I(<path d="m9 18 6-6-6-6"/>),
  ArrowRight:  I(<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>),
  More:        I(<><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>),
  Zap:         I(<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>),
  Eye:         I(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>),
  Refresh:     I(<><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></>),
  Trash:       I(<><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  Copy:        I(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
  Database:    I(<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></>),
  Inbox:       I(<><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></>),
  Folder:      I(<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>),
  Play:        I(<polygon points="6 3 20 12 6 21 6 3"/>),
  Pause:       I(<><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>),
  Star:        I(<polygon points="12 2 15 8.5 22 9.3 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.3 9 8.5 12 2"/>),
  Grid:        I(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>),
  List:        I(<><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></>),
  Download:    I(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
  Upload:      I(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>),
  Activity:    I(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  AlertTriangle: I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h0"/></>),
  Plug:        I(<><path d="M12 22v-5"/><path d="M9 7V2"/><path d="M15 7V2"/><path d="M6 13V8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z"/></>),
  Users:       I(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  Coin:        I(<><circle cx="12" cy="12" r="9"/><path d="M12 6v12"/><path d="M9 9h4.5a2 2 0 1 1 0 4H9"/><path d="M9 13h5.5a2 2 0 1 1 0 4H9"/></>),
  Info:        I(<><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h0"/></>),
  RotateCcw:   I(<><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></>),
};
window.Icon = Icon;

/* ───────── Toast ───────── */
const ToastCtx = createContext(() => {});
function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = (msg, opt = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems(s => [...s, { id, msg, ...opt }]);
    setTimeout(() => setItems(s => s.filter(t => t.id !== id)), 3500);
  };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.kind || ''}`}>
            {t.kind === 'success' && <Icon.Check size={14} />}
            {t.kind === 'error' && <Icon.AlertTriangle size={14} />}
            <span>{t.msg}</span>
            {t.action && <span className="act">{t.action}</span>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
window.ToastProvider = ToastProvider;
window.useToast = () => useContext(ToastCtx);

/* ───────── Checkbox ───────── */
function Checkbox({ checked, onChange }) {
  return (
    <span className={`cb ${checked ? 'checked' : ''}`} onClick={(e) => { e.stopPropagation(); onChange(); }}>
      {checked && <Icon.Check size={10} />}
    </span>
  );
}
window.Checkbox = Checkbox;

/* ───────── ChipSelect (label + value, opens menu) ───────── */
function ChipSelect({ label, value, options, onChange, width }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative' }}>
      <button className={`chip ${open ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} style={width ? { minWidth: width } : null}>
        {label && <span className="lbl">{label}</span>}
        <span>{String(value)}</span>
        <Icon.ChevDown size={11} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 6,
            boxShadow: 'var(--shadow-2)', zIndex: 40, minWidth: 160, maxHeight: 280, overflow: 'auto', padding: 4
          }}>
            {options.map((o, i) => (
              <button key={i} onClick={() => { onChange(o); setOpen(false); }}
                      style={{
                        display: 'flex', width: '100%', alignItems: 'center', gap: 6,
                        padding: '6px 10px', border: 0, background: o === value ? 'var(--accent-soft)' : 'transparent',
                        color: o === value ? 'var(--accent-strong)' : 'var(--ink)',
                        fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', borderRadius: 4, textAlign: 'left'
                      }}>
                {o === value && <Icon.Check size={11} />}
                <span>{String(o)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
window.ChipSelect = ChipSelect;

/* ───────── StatusBadge ───────── */
function StatusBadge({ value }) {
  const map = {
    '已发布':   { cls: 'sp-ok' },
    '使用中':   { cls: 'sp-ok' },
    '待发布':   { cls: 'sp-warn' },
    '待选':     { cls: 'sp-warn' },
    '默认首帧': { cls: 'sp-off' },
    '已选封面': { cls: 'sp-ok' },
    '已使用':   { cls: 'sp-ok' },
    '未使用':   { cls: 'sp-off' },
    '待评估':   { cls: 'sp-warn' },
    '优质':     { cls: 'sp-ok' },
    '反面':     { cls: 'sp-warn' },
    '草稿':     { cls: 'sp-off' },
    '-':        { cls: 'sp-off' },
  };
  const m = map[value] || { cls: 'sp-off' };
  return <span className={`status-pill ${m.cls}`}><span className="dot"/>{value}</span>;
}
window.StatusBadge = StatusBadge;

/* ───────── Modal ───────── */
function Modal({ open, onClose, title, children, footer, width }) {
  if (!open) return null;
  return (
    <div className="mask" onClick={onClose}>
      <div className="modal" style={width ? { width } : null} onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h2>{title}</h2>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon.X size={14} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
window.Modal = Modal;

/* ───────── Drawer ───────── */
function Drawer({ open, onClose, title, children, width }) {
  if (!open) return null;
  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer" style={width ? { width } : null} onClick={e => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, margin: 0, fontWeight: 600 }}>{title}</h2>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon.X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
window.Drawer = Drawer;

/* ───────── Thumb (placeholder colored block) ───────── */
function Thumb({ kind = 'square', label, corner, play }) {
  return (
    <div className={`thumb ${kind === 'video' ? 'video' : ''}`}>
      <span style={{ opacity: 0.7 }}>{label}</span>
      {corner && <span className="corner">{corner}</span>}
      {play && <span className="play">{play}</span>}
    </div>
  );
}
window.Thumb = Thumb;
