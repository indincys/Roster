/* global React, Icon, useToast, MOCK */
const { useState, useEffect, useRef } = React;

function Sidebar({ page, onNav, collapsed, onCollapse }) {
  const groups = [
    { title: '工作台', items: [
      { id: 'dashboard', label: '概览',       icon: Icon.Dashboard, badge: null   },
      { id: 'tickets',   label: '任务单',     icon: Icon.Layers,    badge: 3     },
    ]},
    { title: '生成工作区', items: [
      { id: 'titles',  label: '标题',       icon: Icon.Type,      badge: null },
      { id: 'images',  label: '图片工作室', icon: Icon.Wand,      badge: 'hot' },
      { id: 'covers',  label: '封面',       icon: Icon.Crop,      badge: 38   },
      { id: 'scripts', label: '文案',       icon: Icon.FileText,  badge: null },
    ]},
    { title: '数据库', items: [
      { id: 'lib_videos',  label: '视频库',     icon: Icon.Video,    badge: null },
      { id: 'lib_tags',    label: '标签库',     icon: Icon.Tag,      badge: null },
      { id: 'lib_titles',  label: '标题库',     icon: Icon.Type,     badge: null },
      { id: 'lib_prompts', label: '提示词库',   icon: Icon.Pencil,   badge: null },
      { id: 'lib_scripts', label: '文案库',     icon: Icon.FileText, badge: null },
      { id: 'lib_images',  label: '图片库',     icon: Icon.Image,    badge: null },
    ]},
    { title: '系统', items: [
      { id: 'skills',    label: 'Skill 中心', icon: Icon.Sparkle, badge: null },
      { id: 'market',    label: 'Skill 市场', icon: Icon.Globe,   badge: null },
      { id: 'schedules', label: '定时任务',   icon: Icon.Clock,   badge: null },
      { id: 'settings',  label: '设置',       icon: Icon.Settings,badge: null },
    ]},
  ];

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="ws-switch">
        <button className="ws-btn">
          <span className="ws-icon" style={{ background: 'var(--accent)' }}>暖</span>
          {!collapsed && (
            <>
              <div style={{ flex: 1, textAlign: 'left', overflow:'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>暖心生活 · 主品牌</div>
                <div className="muted" style={{ fontSize: 11 }}>warmlife-main · 团队版</div>
              </div>
              <Icon.ChevDown size={12} style={{ color: 'var(--muted)' }} />
            </>
          )}
        </button>
      </div>

      {groups.map(g => (
        <div key={g.title} className="nav-group">
          {!collapsed && <div className="nav-group-title">{g.title}</div>}
          {g.items.map(it => {
            const I = it.icon;
            const active = page === it.id;
            return (
              <button key={it.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => onNav(it.id)}>
                <I size={14} />
                {!collapsed && (
                  <>
                    <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                    {it.badge !== null && (
                      typeof it.badge === 'number'
                        ? <span className="nav-badge">{it.badge}</span>
                        : <span className="nav-badge hot">{it.badge}</span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      ))}

      <div style={{ marginTop: 'auto', padding: 10, borderTop: '1px solid var(--line)' }}>
        <button className="btn ghost sm" style={{ width: '100%', justifyContent: 'center' }} onClick={onCollapse}>
          {collapsed ? <Icon.ChevRight size={12} /> : <><Icon.ChevLeft size={12} /> 收起</>}
        </button>
      </div>
    </nav>
  );
}

function TopBar({ onCmdK, page }) {
  const map = {
    dashboard:'概览', tickets:'任务单',
    titles:'标题', images:'图片工作室', covers:'封面', scripts:'文案',
    lib_videos:'视频库', lib_tags:'标签库', lib_titles:'标题库',
    lib_prompts:'提示词库', lib_scripts:'文案库', lib_images:'图片库',
    skills:'Skill 中心', market:'Skill 市场', schedules:'定时任务', settings:'设置',
  };
  return (
    <div className="topbar">
      <div className="brand">
        <div className="logo">P</div>
        <div className="logo-text">pillar</div>
        <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>内容生产工作台</span>
      </div>
      <div className="breadcrumb">
        <span>暖心生活</span>
        <Icon.ChevRight size={11} />
        <span>{map[page] || page}</span>
      </div>
      <button className="cmdk" onClick={onCmdK}>
        <Icon.Search size={12} />
        <span>跳转、搜索、运行 Skill...</span>
        <span className="kbd">⌘ K</span>
      </button>
      <div className="top-actions">
        <button className="btn ghost"><Icon.Bell size={14} /></button>
        <button className="btn ghost"><Icon.Help size={14} /></button>
        <span className="avatar">C</span>
      </div>
    </div>
  );
}

function CmdK({ open, onClose, onNav }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQ('');
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }
  }, [open]);

  if (!open) return null;
  const items = [
    { kind: '导航', label: '概览',         to: 'dashboard',   icon: Icon.Dashboard },
    { kind: '导航', label: '任务单',       to: 'tickets',     icon: Icon.Layers   },
    { kind: '导航', label: '标题工作区',   to: 'titles',      icon: Icon.Type     },
    { kind: '导航', label: '图片工作室',   to: 'images',      icon: Icon.Wand     },
    { kind: '导航', label: '封面工作区',   to: 'covers',      icon: Icon.Crop     },
    { kind: '导航', label: '视频库',       to: 'lib_videos',  icon: Icon.Video    },
    { kind: '导航', label: 'Skill 中心',   to: 'skills',      icon: Icon.Sparkle  },
    { kind: '动作', label: '新建任务单',   to: 'tickets',     icon: Icon.Plus     },
    { kind: '动作', label: '生成 20 条标题', to: 'titles',     icon: Icon.Zap      },
    { kind: '动作', label: '为所有视频补封面', to: 'covers',  icon: Icon.Crop     },
    { kind: '工作区', label: '切到「pillar 设计 · 配饰线」', to: 'dashboard', icon: Icon.Layers },
    { kind: '工作区', label: '切到「生活馆 · 文艺线」', to: 'dashboard', icon: Icon.Layers },
  ];
  const filtered = q
    ? items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()) || i.kind.includes(q))
    : items;

  return (
    <div className="cmdk-mask" onClick={onClose}>
      <div className="cmdk-panel" onClick={e => e.stopPropagation()}>
        <div className="cmdk-input">
          <Icon.Search size={14} />
          <input ref={inputRef} placeholder="跳转、搜索、运行 Skill..." value={q} onChange={e => setQ(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          <span className="kbd">esc</span>
        </div>
        <div className="cmdk-results">
          {filtered.map((it, i) => {
            const I = it.icon;
            return (
              <button key={i} className="cmdk-row" onClick={() => { onNav(it.to); onClose(); }}>
                <I size={14} />
                <span style={{ flex: 1, textAlign:'left' }}>{it.label}</span>
                <span className="muted" style={{ fontSize: 11 }}>{it.kind}</span>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="muted" style={{ padding: 16, textAlign:'center', fontSize: 12 }}>没有匹配项</div>}
        </div>
        <div className="cmdk-footer muted">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> 选择</span>
          <span><span className="kbd">↵</span> 进入</span>
          <span><span className="kbd">⌘</span><span className="kbd">K</span> 唤起</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [cmdk, setCmdk] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setCmdk(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const Page = ({
    dashboard:    window.DashboardPage,
    tickets:      window.TicketsPage,
    titles:       window.TitlesPage,
    images:       window.ImagesPage,
    covers:       window.CoversPage,
    scripts:      window.ScriptsPage,
    lib_videos:   window.VideosPage,
    lib_tags:     window.TagsPage,
    lib_titles:   window.TitlesLibPage,
    lib_prompts:  window.PromptsLibPage,
    lib_scripts:  window.ScriptsLibPage,
    lib_images:   window.ImagesLibPage,
    skills:       window.SkillsPage,
    market:       window.SkillMarketPage,
    schedules:    window.SchedulesPage,
    settings:     window.SettingsPage,
  })[page] || window.DashboardPage;

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <TopBar onCmdK={() => setCmdk(true)} page={page} />
      <div className="layout">
        <Sidebar page={page} onNav={setPage} collapsed={collapsed} onCollapse={() => setCollapsed(c => !c)} />
        <main className="main"><Page onNav={setPage} /></main>
      </div>
      <CmdK open={cmdk} onClose={() => setCmdk(false)} onNav={setPage} />
    </div>
  );
}

window.App = App;
