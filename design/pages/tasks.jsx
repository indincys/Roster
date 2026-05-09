/* global React, Icon, StatusBadge, useToast, MOCK, Drawer, Modal, Checkbox, ChipSelect, usePopover, Popover, Empty */
const { useState, useMemo, useEffect } = React;

function TasksPage({ onNav }) {
  const toast = useToast();
  const [tasks, setTasks] = useState(MOCK.tasks);
  const [sel, setSel] = useState(new Set());
  const [configOpen, setConfigOpen] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [retitleOpen, setRetitleOpen] = useState(false);
  const [date, setDate] = useState('2026-05-07');
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('全部');

  // generation config
  const [cfg, setCfg] = useState({
    videoMode: '热门 SKU 倾向',
    skuRange: '全部 SKU',
    excludePlatforms: [],
    perDay: 5,
    platforms: { '抖音': true, '视频号': true, '小红书': true, '快手': true },
    titleStrategy: '爆款倾向',
    tagDefault: 80,
    tagTest: 20,
    anchors: ['09:00','12:00','15:00','18:00','21:00'],
    jitter: 15,
  });

  const platformsOn = Object.entries(cfg.platforms).filter(([,v]) => v).map(([k]) => k);
  const expectedRows = cfg.perDay * platformsOn.length;

  const filtered = useMemo(() => {
    if (filterStatus === '全部') return tasks;
    return tasks.filter(t => t.status === filterStatus);
  }, [tasks, filterStatus]);

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = filtered.length > 0 && filtered.every(t => sel.has(t.id));
  const toggleAll = () => setSel(s => allSelected ? new Set() : new Set(filtered.map(t => t.id)));

  const onGenerate = () => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setConfigOpen(false);
      setTasks(MOCK.tasks); // simulate fresh
      toast('任务单已生成', { kind: 'success', action: `${expectedRows} 行 · 已保存到 tasks/${date}/` });
    }, 1400);
  };

  const onExport = (kind) => {
    setExportOpen(false);
    toast(`已导出 ${kind}`, { kind: 'success', action: `/tasks/${date}/tasks.${kind.toLowerCase()}` });
  };

  const retry = (id) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: '待执行', err: null } : t));
    toast('已加入重试队列');
  };

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>任务单</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>每天一份，每行 = 1 次 RPA 上传操作</div>
        </div>
        <div className="right">
          <button className="btn"><Icon.Calendar size={14} /> 切换日期 <span className="mono" style={{ marginLeft: 4 }}>{date}</span></button>
          <button className="btn" onClick={() => onNav('cron')}><Icon.Clock size={14} /> 定时任务</button>
        </div>
      </div>

      {/* Generation config */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <Icon.Sparkle size={16} />
          <h3>生成配置</h3>
          {!configOpen && (
            <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
              {cfg.perDay} 视频 × {platformsOn.length} 平台 · {cfg.titleStrategy} · ±{cfg.jitter}min
            </span>
          )}
          <div className="right">
            <button className="btn sm" onClick={() => setConfigOpen(o => !o)}>
              {configOpen ? <><Icon.ChevUp size={12} /> 折叠</> : <><Icon.ChevDown size={12} /> 展开</>}
            </button>
          </div>
        </div>
        {configOpen && (
          <div className="card-b" style={{ display:'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, padding: 18 }}>
            {/* 1. 视频筛选 */}
            <div className="gen-panel">
              <div style={{ display:'flex', gap: 6, alignItems:'center', marginBottom: 4 }}>
                <span className="badge-s b-accent"><span className="dot" />1</span>
                <strong>视频筛选</strong>
              </div>
              <div className="gen-row">
                <span className="lab">模式</span>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {['热门 SKU 倾向','低发倾向','近期热点','自定义'].map(m =>
                    <button key={m} className={`chip ${cfg.videoMode===m?'active':''}`}
                            onClick={() => setCfg({...cfg, videoMode: m})}>{m}</button>
                  )}
                </div>
              </div>
              <div className="gen-row">
                <span className="lab">SKU 范围</span>
                <ChipSelect label="" value={cfg.skuRange} options={['全部 SKU','保温杯类','服饰类','加热垫类']} onChange={v => setCfg({...cfg, skuRange: v})} />
              </div>
              <div className="gen-row">
                <span className="lab">排除已发平台</span>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {MOCK.platforms.map(p => {
                    const on = cfg.excludePlatforms.includes(p);
                    return <button key={p} className={`chip ${on?'active':''}`}
                                   onClick={() => setCfg({...cfg, excludePlatforms: on ? cfg.excludePlatforms.filter(x => x!==p) : [...cfg.excludePlatforms, p]})}>{p}</button>;
                  })}
                </div>
              </div>
            </div>

            {/* 2. 数量与配比 */}
            <div className="gen-panel">
              <div style={{ display:'flex', gap: 6, alignItems:'center', marginBottom: 4 }}>
                <span className="badge-s b-accent"><span className="dot" />2</span>
                <strong>数量与配比</strong>
              </div>
              <div className="gen-row">
                <span className="lab">每天发布视频</span>
                <input className="input" style={{ width: 80 }} type="number" min={1} max={20} value={cfg.perDay}
                       onChange={e => setCfg({...cfg, perDay: Number(e.target.value || 1)})} />
                <span className="muted">条</span>
              </div>
              <div className="gen-row">
                <span className="lab">每个视频发布平台</span>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {MOCK.platforms.map(p => {
                    const on = cfg.platforms[p];
                    return <button key={p} className={`chip ${on?'active':''}`}
                                   onClick={() => setCfg({...cfg, platforms: {...cfg.platforms, [p]: !on}})}>
                      {on && <Icon.Check size={11} />} {p}
                    </button>;
                  })}
                </div>
              </div>
              <div className="gen-row">
                <span className="lab">预计任务行数</span>
                <strong className="mono" style={{ fontSize: 16 }}>{cfg.perDay} × {platformsOn.length} = {expectedRows}</strong>
                <span className="muted">行</span>
              </div>
            </div>

            {/* 3. 标题选择策略 */}
            <div className="gen-panel">
              <div style={{ display:'flex', gap: 6, alignItems:'center', marginBottom: 4 }}>
                <span className="badge-s b-accent"><span className="dot" />3</span>
                <strong>标题选择策略</strong>
              </div>
              <div className="gen-row">
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {['爆款倾向','新标题测试','随机自定义'].map(m =>
                    <button key={m} className={`chip ${cfg.titleStrategy===m?'active':''}`}
                            onClick={() => setCfg({...cfg, titleStrategy: m})}>{m}</button>
                  )}
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                标题来源：标题库 · 共 {MOCK.titles.length} 条可用 · 优先选爆款分 ≥ 8 的
              </div>
              <div style={{ display:'flex', gap: 6, alignItems:'center', marginTop: 4 }}>
                <strong>标签策略</strong>
                <span className="muted" style={{ marginLeft:'auto', fontSize: 12 }}>合计锁定 100%</span>
              </div>
              <div className="gen-row">
                <span className="lab">默认标签</span>
                <input type="range" min={0} max={100} value={cfg.tagDefault} className="slider"
                       onChange={e => { const v = Number(e.target.value); setCfg({...cfg, tagDefault: v, tagTest: 100 - v}); }} />
                <span className="mono" style={{ width: 36, textAlign: 'right' }}>{cfg.tagDefault}%</span>
              </div>
              <div className="gen-row">
                <span className="lab">测试标签</span>
                <input type="range" min={0} max={100} value={cfg.tagTest} className="slider"
                       onChange={e => { const v = Number(e.target.value); setCfg({...cfg, tagTest: v, tagDefault: 100 - v}); }} />
                <span className="mono" style={{ width: 36, textAlign: 'right' }}>{cfg.tagTest}%</span>
              </div>
            </div>

            {/* 4. 时间安排 */}
            <div className="gen-panel">
              <div style={{ display:'flex', gap: 6, alignItems:'center', marginBottom: 4 }}>
                <span className="badge-s b-accent"><span className="dot" />4</span>
                <strong>时间安排</strong>
              </div>
              <div className="gen-row">
                <span className="lab">每天 {cfg.perDay} 个时间锚点</span>
                <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                  {cfg.anchors.slice(0, cfg.perDay).map((t, i) =>
                    <input key={i} className="input mono" style={{ width: 76, textAlign:'center' }} value={t}
                           onChange={e => { const a = [...cfg.anchors]; a[i] = e.target.value; setCfg({...cfg, anchors: a}); }} />
                  )}
                </div>
              </div>
              <div className="gen-row">
                <span className="lab">随机抖动</span>
                <input type="range" min={0} max={60} value={cfg.jitter} className="slider"
                       onChange={e => setCfg({...cfg, jitter: Number(e.target.value)})} />
                <span className="mono" style={{ width: 60, textAlign:'right' }}>±{cfg.jitter}min</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                示例：09:00 锚点 ±15min → 实际可能 08:48 ~ 09:14
              </div>
            </div>

            {/* Actions row, full width */}
            <div style={{ gridColumn: '1 / -1', display:'flex', gap: 8, alignItems:'center', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
              <button className="btn primary lg" disabled={generating} onClick={onGenerate}>
                <Icon.Zap size={14} /> {generating ? '生成中…' : '一键生成任务单'}
              </button>
              <button className="btn lg"><Icon.Clock size={14} /> 设为定时生成</button>
              <button className="btn ghost"><Icon.Save size={14} /> 保存为预设</button>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>
                上次生成：今早 06:00 · 自动 · 20 行
              </span>
            </div>

            {generating && (
              <div style={{ gridColumn: '1 / -1', padding: 12, background: 'var(--accent-soft)', borderRadius: 6 }}>
                <div className="row"><Icon.Sparkle /> <strong>正在生成…</strong></div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  ✓ 筛选视频 · ✓ 挑选标题 · <span style={{ color: 'var(--accent-ink)' }}>正在分配时间…</span>
                </div>
                <div style={{ marginTop: 8, height: 4, background: 'rgba(0,0,0,0.05)', borderRadius: 999, overflow:'hidden' }}>
                  <div style={{ height: '100%', width: '70%', background: 'var(--accent)', animation: 'shimmer 1.4s linear infinite', backgroundSize: '200% 100%' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task table */}
      <div className="card">
        <div className="filterbar">
          <strong>当前任务单 · {date}</strong>
          <span className="muted" style={{ fontSize: 12 }}>{tasks.length} 行</span>
          <div className="gap" />
          <ChipSelect label="状态" value={filterStatus} options={['全部','待执行','执行中','成功','失败']} onChange={setFilterStatus} />
          <ChipSelect label="平台" value="全部" options={['全部', ...MOCK.platforms]} onChange={() => {}} />
          <ChipSelect label="SKU" value="全部" options={['全部', ...MOCK.skus.map(s => s.code)]} onChange={() => {}} />
          <button className="btn sm"><Icon.Refresh size={12} /> 重新生成</button>
          <button className="btn sm primary" onClick={() => setExportOpen(true)}>
            <Icon.Download size={12} /> 导出 <Icon.ChevDown size={12} />
          </button>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: 28 }}>
            <Empty icon={<Icon.Tasks />} title="今天还没有任务单"
                   desc="点击下面任一按钮开始" cta="生成今日任务单" onCta={onGenerate} />
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="check"><Checkbox checked={allSelected} onChange={toggleAll} /></th>
                  <th>任务 ID</th>
                  <th>时间</th>
                  <th>平台</th>
                  <th>账号</th>
                  <th>SKU</th>
                  <th>款式</th>
                  <th>视频</th>
                  <th style={{ width: 360 }}>标题</th>
                  <th>状态</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className={sel.has(t.id) ? 'sel' : ''}
                      onDoubleClick={() => setDrawer(t)}>
                    <td className="check"><Checkbox checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{t.id}</td>
                    <td className="mono">{t.time}</td>
                    <td>{t.platform}</td>
                    <td>{t.account}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{t.sku}</td>
                    <td>{t.style}</td>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>{t.video_file}</td>
                    <td style={{ maxWidth: 360, overflow:'hidden', textOverflow:'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>{t.title}</td>
                    <td><StatusBadge value={t.status} />{t.err && <span title={t.err} style={{ marginLeft: 6, color: 'var(--red)', fontSize: 11 }}>{t.err.slice(0, 16)}…</span>}</td>
                    <td>
                      {t.status === '失败' ? (
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); retry(t.id); }}>
                          <Icon.Refresh size={11} /> 重试
                        </button>
                      ) : (
                        <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setDrawer(t); }}>
                          <Icon.Eye size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="seltool">
          <span>已选 <strong>{sel.size}</strong> 行</span>
          <div className="right">
            <button className="btn sm" disabled={sel.size === 0}><Icon.Pencil size={12} /> 编辑</button>
            <button className="btn sm" disabled={sel.size === 0} onClick={() => setRetitleOpen(true)}><Icon.Refresh size={12} /> 换标题</button>
            <button className="btn sm" disabled={sel.size === 0}><Icon.Plus size={12} /> 添加</button>
            <button className="btn sm danger" disabled={sel.size === 0}><Icon.Trash size={12} /> 删除</button>
          </div>
        </div>
      </div>

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} title={drawer ? `任务详情 · ${drawer.id}` : ''}>
        {drawer && <TaskDetail t={drawer} onRetry={() => retry(drawer.id)} />}
      </Drawer>

      <Modal open={exportOpen} onClose={() => setExportOpen(false)} title="导出任务单">
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>导出位置固定在 <span className="mono">{`<工作空间>/tasks/${date}/`}</span></div>
        <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
          {['Excel','CSV','JSON'].map(k => (
            <button key={k} className="btn lg" style={{ justifyContent:'flex-start' }} onClick={() => onExport(k)}>
              <Icon.FileText size={14} /> {k} 格式 <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>tasks.{k.toLowerCase()}</span>
            </button>
          ))}
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            <Icon.Info size={11} /> 选”三个都要”可一次生成全部三种格式
          </div>
          <button className="btn primary" onClick={() => onExport('All')}>三个都要</button>
        </div>
      </Modal>

      <Modal open={retitleOpen} onClose={() => setRetitleOpen(false)} title="批量换标题"
             footer={<>
               <button className="btn" onClick={() => setRetitleOpen(false)}>取消</button>
               <button className="btn primary" onClick={() => { setRetitleOpen(false); toast(`已为 ${sel.size} 行重新分配标题`, { kind: 'success' }); }}>应用</button>
             </>}>
        <div className="form-row">
          <div className="lab">操作范围<div className="desc">已选 {sel.size} 行</div></div>
          <div className="muted">仅替换勾选的行，不影响其他</div>
        </div>
        <div className="form-row">
          <div className="lab">替换方式</div>
          <div style={{ display:'flex', gap: 6 }}>
            <button className="chip active">重新随机抽</button>
            <button className="chip">切换策略</button>
            <button className="chip">指定一条</button>
          </div>
        </div>
        <div className="form-row">
          <div className="lab">策略</div>
          <ChipSelect label="" value="爆款倾向" options={['爆款倾向','新标题测试','随机自定义']} onChange={() => {}} />
        </div>
      </Modal>
    </div>
  );
}

function TaskDetail({ t, onRetry }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <StatusBadge value={t.status} />
        {t.err && <div className="badge-s b-red" style={{ marginTop: 6 }}><Icon.AlertOct size={11} /> {t.err}</div>}
      </div>
      <div className="kv" style={{ rowGap: 10 }}>
        <span className="k">时间</span><span className="v mono">{t.time}（实际 ±15min）</span>
        <span className="k">平台</span><span className="v">{t.platform}</span>
        <span className="k">账号</span><span className="v">{t.account}</span>
        <span className="k">SKU</span><span className="v mono">{t.sku}</span>
        <span className="k">款式</span><span className="v">{t.style}</span>
        <span className="k">商品</span><span className="v">{t.product}</span>
        <span className="k">视频文件</span><span className="v mono" style={{ fontSize: 11 }}>{t.video_file}</span>
        <span className="k">视频路径</span><span className="v mono" style={{ fontSize: 11, wordBreak:'break-all' }}>{t.video_path}</span>
        <span className="k">封面路径</span><span className="v mono" style={{ fontSize: 11, wordBreak:'break-all' }}>{t.cover_path}</span>
        <span className="k">标题</span><span className="v">{t.title}</span>
        <span className="k">标签</span><span className="v"><div className="tag-row">{t.tags.map(x => <span key={x} className="tag">{x}</span>)}</div></span>
        {t.exec_time && <><span className="k">执行时间</span><span className="v mono" style={{ fontSize: 12 }}>{t.exec_time}</span></>}
      </div>
      <div style={{ marginTop: 16, display:'flex', gap: 6 }}>
        <button className="btn sm"><Icon.Pencil size={12} /> 编辑</button>
        <button className="btn sm"><Icon.Refresh size={12} /> 换标题</button>
        {t.status === '失败' && <button className="btn sm primary" onClick={onRetry}><Icon.Refresh size={12} /> 重试</button>}
      </div>
    </div>
  );
}

window.TasksPage = TasksPage;
