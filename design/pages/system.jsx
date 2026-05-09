/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, StatusBadge, Modal, Drawer */
const { useState, useMemo } = React;

function SkillsPage({ onNav }) {
  const toast = useToast();
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [editor, setEditor] = useState(null);

  const all = useMemo(() => {
    const flat = [];
    Object.entries(MOCK.skills).forEach(([k, list]) => {
      list.forEach(s => flat.push({ ...s, category: k }));
    });
    return flat;
  }, []);

  const filtered = all.filter(s => {
    if (cat !== 'all' && s.category !== cat) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const cats = [
    { id: 'all',     label: '全部',     color: 'var(--ink)',    count: all.length },
    { id: 'title',   label: '标题',     color: 'var(--accent)', count: MOCK.skills.title.length },
    { id: 'image_prompt', label: '图片提示词', color: 'var(--purple)', count: MOCK.skills.image_prompt.length },
    { id: 'image_gen',    label: '图片生成',   color: 'var(--blue)',   count: MOCK.skills.image_gen.length },
    { id: 'script', label: '文案',     color: 'var(--green)',  count: MOCK.skills.script.length },
    { id: 'cover',  label: '封面策略', color: 'var(--yellow)', count: MOCK.skills.cover.length },
  ];

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>Skill 中心</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            所有 LLM 调用都通过 Skill 进入 — Skill = 提示词 + 模型 + 输出契约 + 版本
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icon.Globe size={14} /> Skill 市场</button>
          <button className="btn primary" onClick={() => setEditor({})}><Icon.Plus size={14} /> 新建 Skill</button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          {cats.map(c => (
            <button key={c.id} className={`chip ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
              <span className="dot" style={{ background: c.color }} />
              {c.label} ({c.count})
            </button>
          ))}
          <input className="input" placeholder="🔍 搜索 Skill..." style={{ width: 220, marginLeft: 'auto' }}
                 value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div style={{ padding: 14, display:'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {filtered.map(s => (
            <div key={s.id} className="card" style={{ padding: 14, cursor: 'pointer', background: 'var(--panel)' }}
                 onClick={() => setDrawer(s)}>
              <div className="row" style={{ marginBottom: 8 }}>
                <Icon.Sparkle size={16} style={{ color: 'var(--accent)' }} />
                <strong className="mono" style={{ fontSize: 13 }}>{s.name}</strong>
                <span className="badge-s b-gray mono" style={{ marginLeft: 'auto' }}>{s.version}</span>
              </div>
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.6, minHeight: 36 }}>{s.desc}</div>
              <div className="row" style={{ marginTop: 10, fontSize: 11 }}>
                <span className="muted">分类</span>
                <span>{cats.find(c => c.id === s.category)?.label}</span>
                <span className="muted" style={{ marginLeft: 12 }}>调用</span>
                <span className="mono">{s.calls.toLocaleString()}</span>
                <span className="muted" style={{ marginLeft: 12 }}>更新</span>
                <span className="mono">{s.updated}</span>
              </div>
              <div className="row" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', fontSize: 11 }}>
                <span className={`status-pill ${s.scope === 'workspace' ? 'sp-warn' : 'sp-ok'}`}>
                  <span className="dot"/>{s.scope === 'workspace' ? '工作区私有' : '团队共享'}
                </span>
                <div style={{ marginLeft: 'auto', display:'flex', gap: 4 }}>
                  <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setEditor(s); }}><Icon.Pencil size={12} /></button>
                  <button className="btn ghost sm" onClick={(e) => e.stopPropagation()}><Icon.Play size={12} /></button>
                  <button className="btn ghost sm" onClick={(e) => e.stopPropagation()}><Icon.More size={12} /></button>
                </div>
              </div>
            </div>
          ))}

          {/* New skill card */}
          <div className="card" style={{ padding: 24, border: '1px dashed var(--line)', display:'flex', alignItems:'center', justifyContent:'center', cursor: 'pointer', background: 'transparent', minHeight: 160 }} onClick={() => setEditor({})}>
            <div style={{ textAlign:'center' }}>
              <Icon.Plus size={20} style={{ color:'var(--muted-2)' }} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>新建 Skill</div>
            </div>
          </div>
        </div>
      </div>

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} title={drawer ? `${drawer.name} ${drawer.version}` : ''}>
        {drawer && <SkillDetail skill={drawer} onEdit={() => { setEditor(drawer); setDrawer(null); }} />}
      </Drawer>

      <Modal open={!!editor} onClose={() => setEditor(null)} title={editor && editor.id ? '编辑 Skill' : '新建 Skill'} width={760}
             footer={<>
               <button className="btn" onClick={() => setEditor(null)}>取消</button>
               <button className="btn"><Icon.Play size={12} /> 测试运行</button>
               <button className="btn primary" onClick={() => { toast('已保存为新版本'); setEditor(null); }}>
                 <Icon.Check size={12} /> 保存为新版本
               </button>
             </>}>
        <SkillEditor skill={editor || {}} />
      </Modal>
    </div>
  );
}

function SkillDetail({ skill, onEdit }) {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <div className="kv" style={{ rowGap: 10, marginBottom: 14 }}>
        <span className="k">分类</span><span className="v">{skill.category}</span>
        <span className="k">范围</span><span className="v">{skill.scope === 'workspace' ? '工作区私有' : '团队共享'}</span>
        <span className="k">默认模型</span><span className="v mono">{skill.model}</span>
        <span className="k">调用总数</span><span className="v mono">{skill.calls.toLocaleString()}</span>
        <span className="k">最近更新</span><span className="v mono">{skill.updated}</span>
        <span className="k">作者</span><span className="v">@{skill.author || 'cici'}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 12 }}>
        {['overview','prompt','versions','metrics'].map(t => (
          <button key={t} className={`tab ${tab===t?'active':''}`} onClick={() => setTab(t)} style={{ padding: '8px 12px' }}>
            {{overview: '概览', prompt: '提示词', versions: '版本历史', metrics: '指标'}[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>描述</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{skill.desc}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 6 }}>输入参数（占位符）</div>
          <div style={{ display:'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="tag mono" style={{ fontSize: 11 }}>{'{{seed}}'}</span>
            <span className="tag mono" style={{ fontSize: 11 }}>{'{{count}}'}</span>
            <span className="tag mono" style={{ fontSize: 11 }}>{'{{taskPrompt?}}'}</span>
            <span className="tag mono" style={{ fontSize: 11 }}>{'{{sku?}}'}</span>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 6 }}>输出契约</div>
          <div className="code-block" style={{ fontSize: 11 }}>
{`{
  "items": [
    { "text": string, "score?": number }
  ]
}`}
          </div>
        </div>
      )}
      {tab === 'prompt' && (
        <div className="code-block" style={{ maxHeight: 360, overflow: 'auto' }}>
{`<role>
你是品牌「暖心生活」的标题文案。
品牌定位：保温杯 / 餐具 / 加热垫，主打温馨、家庭、平价。
</role>

<context>
{{taskPrompt}}
</context>

<style_rules>
- 标题 ≤ 18 个汉字
- 避免过度营销词：神器、秒杀、爆款 …
- 鼓励生活化场景：宝妈、通勤、办公室 …
- 鼓励数字与对比
</style_rules>

<good_examples>
- 冬日暖心保温杯，宝妈通勤必备
- 保温 12 小时，办公室一杯到下班
</good_examples>

<task>
请根据上述风格规则，生成 {{count}} 条不重复的标题。
</task>`}
        </div>
      )}
      {tab === 'versions' && (
        <table className="tbl">
          <thead><tr><th>版本</th><th>变更摘要</th><th>调用</th><th>作者</th><th>时间</th><th></th></tr></thead>
          <tbody>
            <tr><td className="mono">{skill.version}</td><td>当前版本：增加禁用词列表</td><td className="num">{skill.calls.toLocaleString()}</td><td>@cici</td><td className="muted mono" style={{ fontSize: 12 }}>{skill.updated}</td><td><button className="btn ghost sm"><Icon.Eye size={12} /></button></td></tr>
            <tr><td className="mono">v1.1</td><td>调整示例集</td><td className="num">2,341</td><td>@cici</td><td className="muted mono" style={{ fontSize: 12 }}>2026-03-14</td><td><button className="btn ghost sm"><Icon.RotateCcw size={12} /></button></td></tr>
            <tr><td className="mono">v1.0</td><td>初版</td><td className="num">1,205</td><td>@cici</td><td className="muted mono" style={{ fontSize: 12 }}>2026-02-02</td><td><button className="btn ghost sm"><Icon.RotateCcw size={12} /></button></td></tr>
          </tbody>
        </table>
      )}
      {tab === 'metrics' && (
        <div>
          <div className="kv" style={{ rowGap: 10 }}>
            <span className="k">7 日调用</span><span className="v mono">{Math.floor(skill.calls * 0.18).toLocaleString()}</span>
            <span className="k">入库通过率</span><span className="v">68%</span>
            <span className="k">平均输出条数</span><span className="v">12.3 / 次</span>
            <span className="k">平均 Token</span><span className="v">入 380 / 出 1,240</span>
            <span className="k">平均时延</span><span className="v">3.1s</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
        <button className="btn primary" onClick={onEdit}><Icon.Pencil size={12} /> 编辑</button>
        <button className="btn"><Icon.Play size={12} /> 测试运行</button>
        <button className="btn"><Icon.Copy size={12} /> 复制</button>
        <button className="btn ghost" style={{ marginLeft: 'auto' }}><Icon.Trash size={12} /></button>
      </div>
    </>
  );
}

function SkillEditor({ skill }) {
  const [name, setName] = useState(skill.name || 'skill_new_xxx');
  const [model, setModel] = useState(skill.model || 'Claude Opus');
  const [scope, setScope] = useState(skill.scope || 'workspace');
  const [text, setText] = useState(skill.prompt || '<role>\n你是 …\n</role>\n\n<task>\n请根据 {{seed}} 生成 {{count}} 条 …\n</task>');
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 14 }}>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>名称</div>
        <input className="input" value={name} onChange={e => setName(e.target.value)} />
        <div className="muted" style={{ fontSize: 12, marginBottom: 4, marginTop: 10 }}>分类</div>
        <ChipSelect label="" value="标题" options={['标题','图片提示词','图片生成','文案','封面策略']} onChange={() => {}} />
        <div className="muted" style={{ fontSize: 12, marginBottom: 4, marginTop: 10 }}>默认模型</div>
        <ChipSelect label="" value={model} options={['Claude Opus','GPT-5','Gemini 2.5','GPT Image 2','Midjourney v7']} onChange={setModel} />
        <div className="muted" style={{ fontSize: 12, marginBottom: 4, marginTop: 10 }}>范围</div>
        <div style={{ display:'flex', gap: 6 }}>
          <button className={`chip ${scope==='workspace'?'active':''}`} onClick={() => setScope('workspace')}>仅本工作区</button>
          <button className={`chip ${scope==='team'?'active':''}`} onClick={() => setScope('team')}>团队共享</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4, marginTop: 10 }}>输出契约</div>
        <textarea className="textarea mono" rows={4} defaultValue={`{ "items": [ { "text": string, "score?": number } ] }`} />
      </div>
      <div>
        <div className="row" style={{ marginBottom: 4 }}>
          <span className="muted" style={{ fontSize: 12 }}>提示词</span>
          <span className="muted" style={{ marginLeft:'auto', fontSize: 11 }}>支持 {'{{seed}}'} {'{{count}}'} 等变量</span>
        </div>
        <textarea className="textarea mono" rows={16} value={text} onChange={e => setText(e.target.value)} style={{ fontSize: 12, lineHeight: 1.6 }} />
      </div>
    </div>
  );
}

function SkillMarketPage({ onNav }) {
  const toast = useToast();
  const teamSkills = [
    { name: 'title_brand_lifeful v3.0',     team: '生活馆',   author: 'aki',   downloads: 1240, rating: 4.8, desc: '文艺生活类品牌专用标题，强调慢生活' },
    { name: 'image_main_minimal v2.4',      team: 'pillar 设计', author: 'leon', downloads: 982, rating: 4.7, desc: '极简白底主图，电商通用' },
    { name: 'script_oral_funny v1.8',       team: '直播一组',  author: 'mimi', downloads: 756, rating: 4.5, desc: '搞笑口播脚本' },
    { name: 'cover_lifestyle_warm v1.0',    team: '内容部',    author: 'cici', downloads: 410, rating: 4.6, desc: '温馨生活封面取帧建议' },
    { name: 'image_main_brand_warmlife v1.0', team: '我的工作区', author: 'cici', downloads: '—', rating: '—', desc: '本工作区已发布 / 公开 待审核', mine: true },
  ];
  return (
    <div className="page">
      <div className="page-h">
        <div><h1>Skill 市场</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>团队共享 · 安装到本工作区</div></div>
        <div className="right">
          <button className="btn"><Icon.Upload size={14} /> 上传我的 Skill</button>
        </div>
      </div>
      <div className="card">
        <div className="filterbar">
          <ChipSelect label="分类" value="全部" options={['全部','标题','图片提示词','图片生成','文案','封面策略']} onChange={() => {}} />
          <ChipSelect label="团队" value="全部" options={['全部','生活馆','pillar 设计','直播一组']} onChange={() => {}} />
          <ChipSelect label="排序" value="下载量↓" options={['下载量↓','评分↓','最新']} onChange={() => {}} />
          <input className="input" placeholder="🔍 搜索市场..." style={{ width: 220, marginLeft: 'auto' }} />
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {teamSkills.map((s, i) => (
            <div key={i} className="card" style={{ padding: 14, background: 'var(--panel)' }}>
              <div className="row">
                <Icon.Sparkle size={16} style={{ color: 'var(--purple)' }} />
                <strong className="mono" style={{ fontSize: 13 }}>{s.name}</strong>
                {s.mine && <span className="badge-s b-yellow" style={{ marginLeft: 8 }}>我的</span>}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.6, minHeight: 36 }}>{s.desc}</div>
              <div className="row" style={{ marginTop: 10, fontSize: 11 }}>
                <span className="muted">@{s.author}</span>
                <span className="muted">· {s.team}</span>
                <span style={{ marginLeft: 'auto' }}>★ {s.rating}</span>
                <span className="muted">· ⬇ {s.downloads}</span>
              </div>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line)', display:'flex', gap: 6 }}>
                <button className="btn sm"><Icon.Eye size={12} /> 预览</button>
                <button className="btn sm primary" onClick={() => toast(`已安装到本工作区：${s.name}`, { kind: 'success' })}>
                  <Icon.Download size={12} /> 安装到工作区
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SchedulesPage({ onNav }) {
  const items = [
    { name: '每日早间标题任务', cron: '每天 09:00', skill: 'title_brand_warmlife v1.2', target: '标题库', status: 'on', lastRun: '2026-05-07 09:00', nextRun: '2026-05-08 09:00', failures: 0 },
    { name: '主图素材每日补充', cron: '每天 22:00', skill: 'image_main_brand_warmlife v1.0', target: '图片库', status: 'on', lastRun: '2026-05-06 22:01', nextRun: '2026-05-07 22:00', failures: 0 },
    { name: '周末标签巡检',      cron: '周日 08:00', skill: 'tag_audit_general v0.9', target: '标签库', status: 'on', lastRun: '2026-05-04 08:02', nextRun: '2026-05-11 08:00', failures: 1 },
    { name: '直播封面预生成',    cron: '每天 06:00', skill: 'image_cover_video v1.1', target: '图片库', status: 'paused', lastRun: '2026-05-03 06:00', nextRun: '已暂停', failures: 0 },
  ];
  return (
    <div className="page">
      <div className="page-h">
        <div><h1>定时任务</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>每个工作区可配置多条定时任务，常驻产出沉淀到对应数据库</div></div>
        <div className="right">
          <button className="btn primary"><Icon.Plus size={14} /> 新建定时任务</button>
        </div>
      </div>

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>任务名</th><th>触发</th><th>调用 Skill</th><th>目标库</th><th>状态</th>
              <th>上次运行</th><th>下次运行</th><th>近 7 日失败</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td><strong>{it.name}</strong></td>
                <td className="mono" style={{ fontSize: 12 }}>{it.cron}</td>
                <td className="mono" style={{ fontSize: 11 }}>{it.skill}</td>
                <td>{it.target}</td>
                <td>
                  {it.status === 'on'
                    ? <span className="status-pill sp-ok"><span className="dot"/>启用</span>
                    : <span className="status-pill sp-off"><span className="dot"/>已暂停</span>}
                </td>
                <td className="muted mono" style={{ fontSize: 12 }}>{it.lastRun}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{it.nextRun}</td>
                <td>{it.failures > 0 ? <span style={{ color:'var(--red)' }}>{it.failures}</span> : <span className="muted">0</span>}</td>
                <td>
                  <div style={{ display:'flex', gap: 4 }}>
                    <button className="btn ghost sm" title="立即运行"><Icon.Play size={12} /></button>
                    <button className="btn ghost sm" title="暂停"><Icon.Pause size={12} /></button>
                    <button className="btn ghost sm"><Icon.More size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-h"><Icon.Activity size={16} /><h3>最近运行日志</h3></div>
        <div className="card-b" style={{ padding: 0 }}>
          <table className="tbl">
            <thead><tr><th>时间</th><th>任务</th><th>结果</th><th>产出</th><th>耗时</th><th></th></tr></thead>
            <tbody>
              {[
                ['2026-05-07 09:00:32', '每日早间标题任务',     '成功', '入库 18 条 / 待评估 2 条', '12.4s'],
                ['2026-05-07 06:00:01', '直播封面预生成（已暂停）', '已跳过', '—',                       '—'],
                ['2026-05-06 22:01:08', '主图素材每日补充',     '成功', '入库 9 张 / 软删 3 张',     '52.1s'],
                ['2026-05-06 09:00:18', '每日早间标题任务',     '成功', '入库 16 条',              '11.8s'],
                ['2026-05-04 08:02:55', '周末标签巡检',         '部分失败', '检测 28 条 · 失败 1',  '7.3s'],
              ].map((r, i) => (
                <tr key={i}>
                  <td className="muted mono" style={{ fontSize: 12 }}>{r[0]}</td>
                  <td>{r[1]}</td>
                  <td>{r[2] === '成功' ? <span className="status-pill sp-ok"><span className="dot"/>{r[2]}</span>
                          : r[2].includes('失败') ? <span className="status-pill sp-warn"><span className="dot"/>{r[2]}</span>
                          : <span className="status-pill sp-off"><span className="dot"/>{r[2]}</span>}</td>
                  <td className="muted">{r[3]}</td>
                  <td className="num muted">{r[4]}</td>
                  <td><button className="btn ghost sm"><Icon.Eye size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsPage({ onNav }) {
  const [tab, setTab] = useState('workspace');
  const tabs = [
    { id: 'workspace', label: '工作区',  icon: Icon.Layers },
    { id: 'paths',     label: '本地路径', icon: Icon.Folder },
    { id: 'tags',      label: '标签字段', icon: Icon.Tag },
    { id: 'models',    label: '模型连接', icon: Icon.Plug },
    { id: 'team',      label: '成员',    icon: Icon.Users },
    { id: 'billing',   label: '配额计费', icon: Icon.Coin },
  ];

  return (
    <div className="page">
      <div className="page-h">
        <div><h1>设置</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>当前工作区：暖心生活 · 主品牌</div></div>
      </div>
      <div className="card" style={{ display:'grid', gridTemplateColumns:'200px 1fr', minHeight: 520 }}>
        <div style={{ borderRight: '1px solid var(--line)', padding: 8 }}>
          {tabs.map(t => {
            const I = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                      className={`v-tab ${tab===t.id?'active':''}`}>
                <I size={14} /> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ padding: 24 }}>
          {tab === 'workspace' && <WorkspaceSettings />}
          {tab === 'paths' && <PathSettings />}
          {tab === 'tags' && <TagFieldSettings />}
          {tab === 'models' && <ModelSettings />}
          {tab === 'team' && <TeamSettings />}
          {tab === 'billing' && <BillingSettings />}
        </div>
      </div>
    </div>
  );
}

function WorkspaceSettings() {
  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>工作区</h2>
      <div className="form-row"><span className="lbl">名称</span><input className="input" defaultValue="暖心生活 · 主品牌" /></div>
      <div className="form-row"><span className="lbl">slug</span><input className="input mono" defaultValue="warmlife-main" /></div>
      <div className="form-row"><span className="lbl">品牌定位</span><textarea className="textarea" rows={3} defaultValue="保温杯、餐具、加热垫，主打温馨家庭、平价生活" /></div>
      <div className="form-row"><span className="lbl">默认人设</span><textarea className="textarea" rows={2} defaultValue="25-35 岁宝妈 / 通勤族" /></div>
      <div className="form-row"><span className="lbl">主推词 / 禁用词</span>
        <div style={{ flex: 1 }}>
          <div style={{ display:'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {['#保温','#防水','#宝妈','#平价'].map(t => <span key={t} className="tag" style={{ background:'var(--green-soft)' }}>{t}</span>)}
          </div>
          <div style={{ display:'flex', gap: 6, flexWrap: 'wrap' }}>
            {['神器','秒杀','爆款','顶级'].map(t => <span key={t} className="tag" style={{ background:'var(--red-soft)' }}>🚫 {t}</span>)}
          </div>
        </div>
      </div>
      <div className="form-row"><span className="lbl">危险区</span>
        <div>
          <button className="btn danger sm"><Icon.Trash size={12} /> 删除此工作区</button>
        </div>
      </div>
    </div>
  );
}

function PathSettings() {
  const rows = [
    ['videos',   '/Users/cici/contents/warmlife/videos',   '✓ 142 个视频', '正常'],
    ['covers',   '/Users/cici/contents/warmlife/covers',   '✓ 98 张',       '正常'],
    ['images',   '/Users/cici/contents/warmlife/images',   '✓ 1.2k 张',     '正常'],
    ['exports',  '/Users/cici/contents/warmlife/exports',  '空',           '正常'],
    ['archive',  '/Users/cici/contents/warmlife/archive',  '⚠ 路径不存在',  '错误'],
  ];
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>本地路径</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>所有产物只在本机生成，云端只存元数据</div>
      <table className="tbl">
        <thead><tr><th>用途</th><th>路径</th><th>状态</th><th>检测</th><th></th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="mono">{r[0]}</td>
              <td className="mono" style={{ fontSize: 12 }}>{r[1]}</td>
              <td>{r[2]}</td>
              <td>{r[3] === '正常' ? <span className="status-pill sp-ok"><span className="dot"/>{r[3]}</span> : <span className="status-pill sp-warn"><span className="dot"/>{r[3]}</span>}</td>
              <td><button className="btn ghost sm"><Icon.Pencil size={12} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn sm" style={{ marginTop: 10 }}><Icon.Plus size={12} /> 新增路径</button>
    </div>
  );
}

function TagFieldSettings() {
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>标签字段定义</h2>
      <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>用于 SKU 标签库的字段约束</div>
      <table className="tbl">
        <thead><tr><th>字段</th><th>类型</th><th>必填</th><th>默认</th><th></th></tr></thead>
        <tbody>
          {[
            ['标签 1','文本','是','—'],
            ['标签 2','文本','是','—'],
            ['标签 3','文本','是','—'],
            ['标签 4','文本','否','—'],
            ['标签 5','文本（实验）','否','—'],
          ].map((r, i) => (
            <tr key={i}><td className="mono">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className="muted">{r[3]}</td><td><button className="btn ghost sm"><Icon.More size={14} /></button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelSettings() {
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>模型连接</h2>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
        {[
          { name: 'Anthropic / Claude', model: 'claude-opus-4', state: 'ok',   used: '128k tokens / 月' },
          { name: 'OpenAI',              model: 'gpt-5',         state: 'ok',   used: '94k tokens / 月' },
          { name: 'Google / Gemini',     model: 'gemini-2.5-pro',state: 'ok',   used: '12k tokens / 月' },
          { name: 'GPT Image 2',         model: 'gpt-image-2',   state: 'ok',   used: '342 张 / 月' },
          { name: 'Midjourney',          model: 'mj-v7',         state: 'warn', used: '配额告警' },
          { name: 'Stable Diffusion 自部署', model: 'sd-3.5-local',state: 'off', used: '未启用' },
        ].map((m, i) => (
          <div key={i} className="card" style={{ padding: 14 }}>
            <div className="row"><strong>{m.name}</strong>
              {m.state === 'ok' && <span className="status-pill sp-ok" style={{ marginLeft: 'auto' }}><span className="dot"/>已连接</span>}
              {m.state === 'warn' && <span className="status-pill sp-warn" style={{ marginLeft: 'auto' }}><span className="dot"/>告警</span>}
              {m.state === 'off' && <span className="status-pill sp-off" style={{ marginLeft: 'auto' }}><span className="dot"/>未启用</span>}
            </div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>{m.model}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>本月用量 · {m.used}</div>
            <div style={{ marginTop: 10, display:'flex', gap: 6 }}>
              <button className="btn sm">配置</button>
              <button className="btn sm">测试</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamSettings() {
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>成员</h2>
      <table className="tbl">
        <thead><tr><th>成员</th><th>角色</th><th>权限</th><th>最近活跃</th><th></th></tr></thead>
        <tbody>
          {[
            ['cici', '所有者', '全部',         '现在'],
            ['mimi', '编辑',  'Skill 编辑、任务单', '2 小时前'],
            ['leon', '查看',  '只读',          '昨天'],
          ].map((r, i) => (
            <tr key={i}>
              <td><span className="avatar" style={{ width: 22, height: 22, fontSize: 11, marginRight: 8 }}>{r[0][0].toUpperCase()}</span>@{r[0]}</td>
              <td>{r[1]}</td>
              <td className="muted" style={{ fontSize: 12 }}>{r[2]}</td>
              <td className="muted mono" style={{ fontSize: 12 }}>{r[3]}</td>
              <td><button className="btn ghost sm"><Icon.More size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn sm" style={{ marginTop: 10 }}><Icon.Plus size={12} /> 邀请成员</button>
    </div>
  );
}

function BillingSettings() {
  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 14 }}>本月用量</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          ['LLM 调用', '8.4k', '配额 20k', 0.42],
          ['图片生成', '342',  '配额 1k',  0.34],
          ['存储',     '4.2 GB','配额 50 GB', 0.08],
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: 14 }}>
            <div className="muted" style={{ fontSize: 12 }}>{s[0]}</div>
            <div className="num" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>{s[1]}</div>
            <div className="muted" style={{ fontSize: 11 }}>{s[2]}</div>
            <div style={{ marginTop: 10, height: 4, background: 'var(--line)', borderRadius: 999, overflow:'hidden' }}>
              <div style={{ width: `${s[3]*100}%`, height: '100%', background: s[3] > 0.8 ? 'var(--red)' : 'var(--accent)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="muted" style={{ fontSize: 12 }}>当前套餐：<strong>团队版</strong> · 续期 2026-12-01</div>
    </div>
  );
}

Object.assign(window, { SkillsPage, SkillMarketPage, SchedulesPage, SettingsPage });
