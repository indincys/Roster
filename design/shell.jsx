/* global React, Icon, usePopover, Popover, Avatar */
const { useState, useEffect, useRef, useMemo } = React;

const PAGES = [
  { id: 'dashboard',   label: '首页',           sect: 'top', icon: Icon.Layers,  prio: '🔴' },
  { id: 'tasks',       label: '任务单',         sect: 'flow', icon: Icon.Tasks,    prio: '🔴', badge: '20' },
  { id: 'titles',      label: '标题工作区',     sect: 'flow', icon: Icon.Sparkle,  prio: '🔴' },
  { id: 'images',      label: '图片工作室',     sect: 'flow', icon: Icon.Image,    prio: '🔴' },
  { id: 'covers',      label: '封面工作区',     sect: 'flow', icon: Icon.Crop,     prio: '🔴', badge: '32' },
  { id: 'scripts',     label: '文案工作区',     sect: 'flow', icon: Icon.FileText, prio: '🟡' },

  { id: 'lib_videos',  label: '视频库',         sect: 'db',  icon: Icon.Video,    prio: '🔴', badge: '1247' },
  { id: 'lib_tags',    label: '标签库',         sect: 'db',  icon: Icon.Tag,      prio: '🟡' },
  { id: 'lib_titles',  label: '标题库',         sect: 'db',  icon: Icon.Star,     prio: '🟡' },
  { id: 'lib_scripts', label: '文案库',         sect: 'db',  icon: Icon.FileText, prio: '🟢' },
  { id: 'lib_prompts', label: '提示词库',       sect: 'db',  icon: Icon.Wand,     prio: '🟡' },
  { id: 'lib_images',  label: '图片库',         sect: 'db',  icon: Icon.Image,    prio: '🟡' },

  { id: 'skills',      label: 'Skill 中心',     sect: 'sys', icon: Icon.Cube,     prio: '🔴' },
  { id: 'market',      label: 'Skill 市场',     sect: 'sys', icon: Icon.Shop,     prio: '🟡' },
  { id: 'cron',        label: '定时任务总览',    sect: 'sys', icon: Icon.Clock,    prio: '🟡' },
  { id: 'settings',    label: '设置',           sect: 'sys', icon: Icon.Settings, prio: '🔴' },
  { id: 'feedback',    label: '反馈日志',       sect: 'sys', icon: Icon.Bug,      prio: '🟢' },
];

function PageNav({ current, onPick }) {
  return (
    <div className="pagenav">
      <span className="label">⚠ 临时页面跳转条（仅审阅用，最终产品不存在）</span>
      {PAGES.map(p => (
        <button key={p.id}
                className={current === p.id ? 'active' : ''}
                onClick={() => onPick(p.id)}>
          {p.prio} {p.label}
        </button>
      ))}
    </div>
  );
}

function TopBar({ workspace, workspaces, onSwitchWs, onOpenCmdK, notifCount = 3 }) {
  const wsPop = usePopover();
  const notifPop = usePopover();
  return (
    <div className="topbar">
      <div className="tb-traffic"><span/><span/><span/></div>
      <button ref={wsPop.ref} className="ws-switcher" onClick={wsPop.toggle}>
        <span className="ws-dot" style={{ background: workspace.color }} />
        <span className="ws-name">{workspace.name}</span>
        <Icon.ChevDown className="ws-caret" size={14} />
      </button>
      <Popover open={wsPop.open} onClose={wsPop.close} anchorRect={wsPop.rect}>
        <div style={{ padding: '2px 8px 6px', color: 'var(--muted)', fontSize: 11, textTransform:'uppercase', letterSpacing: '0.06em' }}>切换工作空间</div>
        {workspaces.map(w => (
          <div key={w.id} className="pop-item" onClick={() => { onSwitchWs(w); wsPop.close(); }}>
            <span className="ws-dot" style={{ background: w.color }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: w.id === workspace.id ? 600 : 400 }}>{w.name}</div>
              <div className="muted" style={{ fontSize: 11 }}>{w.desc}</div>
            </div>
            {w.id === workspace.id && <Icon.Check />}
          </div>
        ))}
        <div className="pop-sep" />
        <div className="pop-item"><Icon.Plus /> 新建工作空间</div>
        <div className="pop-item"><Icon.Settings /> 管理工作空间</div>
      </Popover>

      <button className="tb-search" onClick={onOpenCmdK}>
        <Icon.Search size={14} />
        <span>搜索视频、标题、标签、Skill…</span>
        <span className="kbd">⌘</span><span className="kbd">K</span>
      </button>

      <div className="tb-actions">
        <span className="tb-pill" title="定时任务: 3 个待执行">
          <Icon.Clock size={12} /> 3 个待执行
        </span>
        <button ref={notifPop.ref} className="tb-icon" onClick={notifPop.toggle} style={{ position:'relative' }}>
          <Icon.Bell size={16} />
          {notifCount > 0 && <span style={{ position:'absolute', top: 4, right: 4, width: 7, height: 7, background: 'var(--red)', borderRadius: 999 }} />}
        </button>
        <Popover open={notifPop.open} onClose={notifPop.close} anchorRect={notifPop.rect} align="right">
          <div style={{ padding: '4px 10px', fontSize: 12, color: 'var(--muted)' }}>通知 · {notifCount}</div>
          <div className="pop-item">
            <Icon.CheckCircle style={{ color: 'var(--green)' }} />
            <div>
              <div>已自动生成今日任务单</div>
              <div className="muted" style={{ fontSize: 11 }}>今晨 06:00 · 20 行 · 点击查看</div>
            </div>
          </div>
          <div className="pop-item">
            <Icon.AlertOct style={{ color: 'var(--red)' }} />
            <div>
              <div>API 调用失败：image_main</div>
              <div className="muted" style={{ fontSize: 11 }}>14:21 · 配额超限，建议检查</div>
            </div>
          </div>
          <div className="pop-item">
            <Icon.Cloud style={{ color: 'var(--muted)' }} />
            <div>
              <div>OneDrive 同步延迟</div>
              <div className="muted" style={{ fontSize: 11 }}>当前延迟约 8 秒</div>
            </div>
          </div>
        </Popover>
        <button className="tb-icon"><Icon.Settings size={16} /></button>
        <button className="tb-icon"><Avatar name="Z" color="var(--accent)" /></button>
      </div>
    </div>
  );
}

function Sidebar({ current, onPick, pinned, onTogglePin }) {
  const [collapsed, setCollapsed] = useState({});
  const sect = (id, name, items) => {
    const isCol = collapsed[id];
    return (
      <div className="sb-section" key={id}>
        <div className={`sb-head ${isCol ? 'collapsed' : ''}`} onClick={() => setCollapsed(c => ({...c, [id]: !c[id]}))}>
          <span>{name}</span>
          <Icon.ChevDown size={12} className="chev" />
        </div>
        {!isCol && items.map(p => {
          const IconComp = p.icon;
          return (
            <div key={p.id}
                 className={`sb-item ${current === p.id ? 'active' : ''}`}
                 onClick={() => onPick(p.id)}
                 onContextMenu={(e) => { e.preventDefault(); onTogglePin(p.id); }}
                 title="右键添加到置顶">
              <IconComp size={15} />
              <span>{p.label}</span>
              {p.badge && <span className="badge">{p.badge}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const flowItems = PAGES.filter(p => p.sect === 'flow');
  const dbItems   = PAGES.filter(p => p.sect === 'db');
  const sysItems  = PAGES.filter(p => p.sect === 'sys');
  const topItems  = PAGES.filter(p => p.sect === 'top');

  return (
    <aside className="sidebar">
      <div className="sb-section">
        <div className="sb-head">
          <Icon.Pin size={11} /> <span>置顶</span>
        </div>
        {pinned.length === 0 ? (
          <div className="sb-empty">拖拽下方功能到这里收藏</div>
        ) : pinned.map(pid => {
          const p = PAGES.find(x => x.id === pid);
          if (!p) return null;
          const IconComp = p.icon;
          return (
            <div key={p.id} className={`sb-item ${current === p.id ? 'active' : ''}`} onClick={() => onPick(p.id)}>
              <IconComp size={15} />
              <span>{p.label}</span>
            </div>
          );
        })}
      </div>

      {topItems.length > 0 && sect('home', '主页', topItems)}
      {sect('flow', '🚀 工作流', flowItems)}
      {sect('db',   '📚 数据库', dbItems)}
      {sect('sys',  '⚙️ 系统',   sysItems)}

      <div style={{ padding: '14px 10px 0', color: 'var(--muted-2)', fontSize: 11 }}>
        v1.0 · 本地优先 · OneDrive 同步正常
      </div>
    </aside>
  );
}

function CmdK({ open, onClose, onPick }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef();
  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); setQ(''); setActive(0); }, [open]);

  const groups = useMemo(() => {
    const M = window.MOCK;
    const norm = q.toLowerCase();
    const filt = (xs) => norm ? xs.filter(x => (x.label || x.text || x.name || '').toLowerCase().includes(norm)) : xs.slice(0, 4);
    return [
      { name: '页面', items: filt(PAGES.map(p => ({ id: 'page-' + p.id, label: p.label, kind: 'page', target: p.id, hint: p.prio })) ) },
      { name: '标题', items: filt(M.titles.map((t, i) => ({ id: 't-' + i, label: t.text, kind: 'title', target: 'lib_titles', hint: '爆款 ' + (t.score ?? '–') }))) },
      { name: 'SKU',  items: filt(M.skus.map((s, i) => ({ id: 'sku-' + i, label: `${s.code} · ${s.name}`, kind: 'sku', target: 'lib_videos', hint: s.style }))) },
      { name: 'Skill', items: filt([...M.skills.title, ...M.skills.image, ...M.skills.script].map((s, i) => ({ id: 'sk-' + i, label: `${s.name} ${s.version}`, kind: 'skill', target: 'skills', hint: s.kind }))) },
    ].filter(g => g.items.length > 0);
  }, [q]);

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { setActive(a => Math.min(flat.length - 1, a + 1)); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { setActive(a => Math.max(0, a - 1)); e.preventDefault(); }
      else if (e.key === 'Enter' && flat[active]) { onPick(flat[active].target); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, active, onClose, onPick]);

  if (!open) return null;
  let i = 0;
  return (
    <div className="cmdk-bd" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} className="cmdk-input" placeholder="跨工作空间搜索 — 视频、标题、标签、Skill、提示词、图片…"
               value={q} onChange={e => setQ(e.target.value)} />
        <div className="cmdk-list">
          {groups.map(g => (
            <div key={g.name}>
              <div className="cmdk-group">{g.name}</div>
              {g.items.map(it => {
                const idx = i++;
                return (
                  <div key={it.id}
                       className={`cmdk-item ${idx === active ? 'active' : ''}`}
                       onMouseEnter={() => setActive(idx)}
                       onClick={() => { onPick(it.target); onClose(); }}>
                    <span style={{ width: 36, color:'var(--muted)', fontSize: 11, textTransform:'uppercase' }}>{it.kind}</span>
                    <span style={{ flex:1 }}>{it.label}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{it.hint}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>没有匹配项</div>}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--line)', display:'flex', gap: 14, fontSize: 11, color: 'var(--muted)' }}>
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> 选择</span>
          <span><span className="kbd">↵</span> 打开</span>
          <span><span className="kbd">esc</span> 关闭</span>
          <span style={{ marginLeft: 'auto' }}>仅展示当前工作空间</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PAGES, PageNav, TopBar, Sidebar, CmdK });
