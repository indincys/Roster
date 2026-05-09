/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, StatusBadge */
const { useState } = React;

function DashboardPage({ onNav }) {
  const stats = [
    { k: '视频未发布', v: 142, sub: '其中 38 个待选封面', color: 'var(--red)',    icon: Icon.Video,  to: 'lib_videos' },
    { k: '今日任务单', v: 6,   sub: '4 个完成 · 2 个待选',  color: 'var(--accent)', icon: Icon.Layers, to: 'tickets' },
    { k: '本周生成图', v: 1284,sub: '入库率 68%',           color: 'var(--blue)',   icon: Icon.Image,  to: 'lib_images' },
    { k: '本月 LLM 调用', v: '8.4k', sub: '配额 20k · 42%', color: 'var(--green)',  icon: Icon.Zap,    to: 'settings' },
  ];

  const queue = [
    { name: '【SKU-WB-001】新视频上线 5 个',  prog: 100, status: 'done',     time: '今天 09:42', from: '@cici', detail: '生成完成 · 18 个标题、24 张主图、5 套封面建议' },
    { name: '【冬装预热】SKU-CL-001 系列',     prog: 80,  status: 'pick',     time: '今天 11:15', from: '@cici', detail: '产物已生成 · 待 cici 选品' },
    { name: '直播封面批量预生成',              prog: 60,  status: 'running',  time: '今天 13:20', from: '@定时',  detail: '正在调用 image_cover_video v1.1' },
    { name: '宝妈通勤场景标题补充',            prog: 0,   status: 'queued',   time: '今天 14:00', from: '@cici', detail: '排队中 · 预计 2 分钟后开始' },
    { name: '加热垫 SKU-HP-002 新品上架',     prog: 40,  status: 'failed',    time: '昨天 18:33', from: '@mimi', detail: '部分失败 · GPT Image 2 配额不足' },
  ];

  const lowYield = [
    { id: 'p4', text: '极简白底，红色保温杯居中放置，硬朗工业风',                      generated: 84, kept: 12, rate: 0.14 },
    { id: 'p7', text: '复古胶片风，红色保温杯放在木桌，旁边散落老照片',                generated: 56, kept: 9,  rate: 0.16 },
    { id: 'p9', text: '极简日系，红色保温杯单品摄影，纯白背景，左偏构图',              generated: 40, kept: 7,  rate: 0.18 },
  ];

  const recent = [
    { who: 'cici', what: '入库 18 条标题', skill: 'title_brand_warmlife v1.2', t: '5 分钟前' },
    { who: '定时', what: '运行成功 · 主图素材每日补充', skill: 'image_main_brand_warmlife v1.0', t: '12 分钟前' },
    { who: 'cici', what: '应用 5 个视频封面', skill: '—', t: '32 分钟前' },
    { who: 'mimi', what: '编辑 Skill', skill: 'script_oral_brand_warmlife v0.6 → v0.7', t: '1 小时前' },
    { who: '定时', what: '运行成功 · 每日早间标题任务', skill: 'title_brand_warmlife v1.2', t: '今早 09:00' },
  ];

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>暖心生活 · 主品牌 / 概览</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric', weekday:'long' })} · 看一眼这里就能开始工作
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icon.Plus size={14} /> 快速创建任务单</button>
          <button className="btn primary" onClick={() => onNav('tickets')}><Icon.Layers size={14} /> 进任务中心</button>
        </div>
      </div>

      <div className="stats-row">
        {stats.map((s, i) => {
          const I = s.icon;
          return (
            <button key={i} className="stat" onClick={() => onNav(s.to)}>
              <div className="row" style={{ marginBottom: 8 }}>
                <I size={14} style={{ color: s.color }} />
                <span className="muted" style={{ fontSize: 12 }}>{s.k}</span>
              </div>
              <div className="num" style={{ fontSize: 28, fontWeight: 600 }}>{s.v}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{s.sub}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap: 14, marginTop: 14 }}>
        {/* Task queue */}
        <div className="card">
          <div className="card-h">
            <Icon.Layers size={16} /><h3>今日任务队列</h3>
            <div className="right">
              <button className="btn ghost sm" onClick={() => onNav('tickets')}>查看全部 <Icon.ArrowRight size={11} /></button>
            </div>
          </div>
          <div className="card-b" style={{ padding: 0 }}>
            {queue.map((q, i) => (
              <div key={i} className="queue-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{q.name}</strong>
                    {q.status === 'done'    && <span className="status-pill sp-ok"  style={{ marginLeft: 8 }}><span className="dot"/>已完成</span>}
                    {q.status === 'pick'    && <span className="status-pill sp-warn" style={{ marginLeft: 8 }}><span className="dot"/>待选品</span>}
                    {q.status === 'running' && <span className="status-pill sp-ok"  style={{ marginLeft: 8 }}><span className="dot"/>运行中</span>}
                    {q.status === 'queued'  && <span className="status-pill sp-off" style={{ marginLeft: 8 }}><span className="dot"/>排队中</span>}
                    {q.status === 'failed'  && <span className="status-pill sp-warn" style={{ marginLeft: 8 }}><span className="dot"/>部分失败</span>}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{q.detail}</div>
                  <div style={{ marginTop: 6, height: 3, background:'var(--line)', borderRadius: 999, overflow:'hidden' }}>
                    <div style={{ width: `${q.prog}%`, height: '100%',
                      background: q.status === 'failed' ? 'var(--red)' : q.prog === 100 ? 'var(--green)' : 'var(--accent)' }} />
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap: 4, marginLeft: 14 }}>
                  <span className="muted mono" style={{ fontSize: 11 }}>{q.time}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{q.from}</span>
                  {q.status === 'pick'   && <button className="btn sm primary" onClick={() => onNav('tickets')}>去选品</button>}
                  {q.status === 'failed' && <button className="btn sm">查看错误</button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <div className="card-h"><Icon.Activity size={16} /><h3>最近动态</h3></div>
          <div className="card-b" style={{ padding: 0 }}>
            {recent.map((r, i) => (
              <div key={i} style={{ display:'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', alignItems:'flex-start' }}>
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 11 }}>{r.who[0].toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>@{r.who}</strong> <span className="muted">{r.what}</span>
                  </div>
                  {r.skill !== '—' && <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{r.skill}</div>}
                </div>
                <span className="muted mono" style={{ fontSize: 11, whiteSpace:'nowrap' }}>{r.t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14, marginTop: 14 }}>
        <div className="card">
          <div className="card-h"><Icon.AlertTriangle size={16} style={{ color:'var(--yellow)' }} /><h3>低产出提示词 — 建议优化或下线</h3></div>
          <div className="card-b" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>提示词</th><th>已生成</th><th>入库率</th><th></th></tr></thead>
              <tbody>
                {lowYield.map(r => (
                  <tr key={r.id}>
                    <td><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 320 }}>{r.text}</div></td>
                    <td className="num">{r.generated}</td>
                    <td>
                      <div className="row">
                        <span className="num" style={{ width: 32 }}>{Math.round(r.rate*100)}%</span>
                        <div style={{ width: 60, height: 4, background:'var(--line)', borderRadius: 999, overflow:'hidden' }}>
                          <div style={{ width: `${r.rate*100}%`, height: '100%', background: 'var(--red)' }} />
                        </div>
                      </div>
                    </td>
                    <td><button className="btn ghost sm" onClick={() => onNav('lib_prompts')}>处理</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-h"><Icon.Sparkle size={16} style={{ color:'var(--accent)' }} /><h3>常用 Skill</h3></div>
          <div className="card-b" style={{ padding: 0 }}>
            {[
              ...MOCK.skills.title.slice(0, 1),
              ...MOCK.skills.image_prompt.slice(0, 1),
              ...MOCK.skills.image_gen.slice(0, 1),
              ...MOCK.skills.script.slice(0, 1),
            ].map(s => (
              <div key={s.id} style={{ display:'flex', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)', alignItems:'center' }}>
                <Icon.Sparkle size={14} style={{ color:'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div className="mono" style={{ fontSize: 12 }}>{s.name} <span className="muted">{s.version}</span></div>
                  <div className="muted" style={{ fontSize: 11 }}>调用 {s.calls.toLocaleString()} 次 · {s.scope === 'workspace' ? '工作区私有' : '团队共享'}</div>
                </div>
                <button className="btn sm" onClick={() => onNav('skills')}><Icon.Eye size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketsPage({ onNav }) {
  const [filter, setFilter] = useState('全部');
  const [drawer, setDrawer] = useState(null);

  const tickets = [
    { id: 'T-2026-0507-001', name: '【SKU-WB-001】新视频上线 5 个',     state: 'done',    progress: 100, owner: 'cici', created: '2026-05-07 09:00', kind: '视频上线', items: '18 标题 / 24 主图 / 5 封面' },
    { id: 'T-2026-0507-002', name: '【冬装预热】SKU-CL-001 系列',         state: 'pick',    progress: 80,  owner: 'cici', created: '2026-05-07 09:10', kind: '主图素材', items: '已生成 24 张 · 待选 12' },
    { id: 'T-2026-0507-003', name: '直播封面批量预生成',                  state: 'running', progress: 60,  owner: '定时',  created: '2026-05-07 13:20', kind: '直播封面', items: '运行中 4/16' },
    { id: 'T-2026-0507-004', name: '宝妈通勤场景标题补充',                state: 'queued',  progress: 0,   owner: 'cici', created: '2026-05-07 14:00', kind: '标题',     items: '排队中' },
    { id: 'T-2026-0507-005', name: '加热垫 SKU-HP-002 新品上架',         state: 'failed',  progress: 40,  owner: 'mimi', created: '2026-05-06 18:30', kind: '上架综合', items: '部分失败 · GPT Image 配额' },
    { id: 'T-2026-0506-009', name: '【SKU-WB-002】视频封面批量',         state: 'done',    progress: 100, owner: 'cici', created: '2026-05-06 14:11', kind: '视频封面', items: '已应用封面 12 个' },
  ];
  const list = filter === '全部' ? tickets : tickets.filter(t => t.state === filter);

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>任务单</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>每条任务从「描述」到「产物」完整可追溯，跨多种内容类型</div>
        </div>
        <div className="right">
          <button className="btn primary"><Icon.Plus size={14} /> 新建任务单</button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          {[
            { k: '全部',    v: tickets.length },
            { k: 'queued',  l: '排队中', v: 1 },
            { k: 'running', l: '运行中', v: 1 },
            { k: 'pick',    l: '待选品', v: 1 },
            { k: 'done',    l: '已完成', v: 2 },
            { k: 'failed',  l: '失败',   v: 1 },
          ].map(f => (
            <button key={f.k} className={`chip ${filter === f.k ? 'active' : ''}`} onClick={() => setFilter(f.k)}>
              {f.l || f.k} ({f.v})
            </button>
          ))}
          <ChipSelect label="负责人" value="全部" options={['全部','@cici','@mimi','@定时']} onChange={() => {}} />
          <ChipSelect label="类型" value="全部" options={['全部','视频上线','视频封面','主图素材','直播封面','标题','上架综合']} onChange={() => {}} />
          <input className="input" placeholder="🔍 搜索..." style={{ width: 200, marginLeft: 'auto' }} />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th><Checkbox checked={false} onChange={() => {}} /></th>
              <th>任务编号</th>
              <th style={{ width: '32%' }}>任务名</th>
              <th>类型</th>
              <th>状态</th>
              <th>进度</th>
              <th>产物</th>
              <th>负责人</th>
              <th>创建</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map(t => (
              <tr key={t.id} onDoubleClick={() => setDrawer(t)}>
                <td><Checkbox checked={false} onChange={() => {}} /></td>
                <td className="mono" style={{ fontSize: 11 }}>{t.id}</td>
                <td><strong>{t.name}</strong></td>
                <td>{t.kind}</td>
                <td>
                  {t.state === 'done'    && <span className="status-pill sp-ok"><span className="dot"/>已完成</span>}
                  {t.state === 'pick'    && <span className="status-pill sp-warn"><span className="dot"/>待选品</span>}
                  {t.state === 'running' && <span className="status-pill sp-ok"><span className="dot"/>运行中</span>}
                  {t.state === 'queued'  && <span className="status-pill sp-off"><span className="dot"/>排队中</span>}
                  {t.state === 'failed'  && <span className="status-pill sp-warn"><span className="dot"/>失败</span>}
                </td>
                <td style={{ width: 110 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background:'var(--line)', borderRadius: 999, overflow:'hidden' }}>
                      <div style={{ width: `${t.progress}%`, height: '100%', background: t.state === 'failed' ? 'var(--red)' : t.progress === 100 ? 'var(--green)' : 'var(--accent)' }} />
                    </div>
                    <span className="num mono" style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{t.progress}%</span>
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 12 }}>{t.items}</td>
                <td><span className="avatar" style={{ width: 22, height: 22, fontSize: 10, marginRight: 6 }}>{t.owner[0].toUpperCase()}</span>@{t.owner}</td>
                <td className="muted mono" style={{ fontSize: 11 }}>{t.created}</td>
                <td><button className="btn ghost sm" onClick={() => setDrawer(t)}><Icon.Eye size={12} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && <TicketDetail ticket={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function TicketDetail({ ticket, onClose }) {
  return (
    <div className="drawer-mask" onClick={onClose}>
      <div className="drawer" style={{ width: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 14 }}>
          <span className="mono muted" style={{ fontSize: 11 }}>{ticket.id}</span>
          <h2 style={{ fontSize: 16, marginLeft: 8 }}>{ticket.name}</h2>
          <button className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon.X size={14} /></button>
        </div>

        <div className="kv" style={{ rowGap: 10, marginBottom: 14 }}>
          <span className="k">类型</span><span className="v">{ticket.kind}</span>
          <span className="k">状态</span><span className="v">{ticket.state}</span>
          <span className="k">负责人</span><span className="v">@{ticket.owner}</span>
          <span className="k">创建时间</span><span className="v mono">{ticket.created}</span>
          <span className="k">产物摘要</span><span className="v">{ticket.items}</span>
        </div>

        <h3 style={{ fontSize: 13, marginTop: 14, marginBottom: 8 }}>步骤</h3>
        <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 14, marginLeft: 6, display:'flex', flexDirection:'column', gap: 12 }}>
          {[
            { t: '09:00:12', a: '任务单创建',           note: '描述：本周新视频 5 个，需要标题、主图、封面' },
            { t: '09:00:18', a: '调用 title_brand_warmlife v1.2', note: '生成 18 条标题 · 入库 18 条' },
            { t: '09:01:42', a: '调用 image_main_brand_warmlife v1.0', note: '生成 24 张主图 · 入库 24 张' },
            { t: '09:03:28', a: '调用 cover_lifestyle_warm v1.0', note: '生成 5 套封面建议' },
            { t: '09:42:06', a: '@cici 选定产物',         note: '应用封面 5 个 · 标题打分 8.0' },
          ].map((s, i) => (
            <div key={i} style={{ position:'relative' }}>
              <div style={{ position:'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: 99, background: 'var(--accent)', border: '2px solid var(--panel)' }} />
              <div className="mono muted" style={{ fontSize: 11 }}>{s.t}</div>
              <div style={{ fontSize: 13, marginTop: 2 }}><strong>{s.a}</strong></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{s.note}</div>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: 13, marginTop: 18, marginBottom: 8 }}>产物</h3>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button className="chip" onClick={() => {}}>📝 18 条标题 →</button>
          <button className="chip">🖼️ 24 张主图 →</button>
          <button className="chip">🎬 5 套封面 →</button>
        </div>

        <div style={{ marginTop: 18, display:'flex', gap: 6 }}>
          <button className="btn primary"><Icon.Refresh size={12} /> 重新运行</button>
          <button className="btn"><Icon.Copy size={12} /> 克隆任务单</button>
          <button className="btn ghost" style={{ marginLeft: 'auto' }}><Icon.Trash size={12} /></button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DashboardPage, TicketsPage });
