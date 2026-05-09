/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, StatusBadge, Drawer, Thumb */
const { useState, useMemo } = React;

function VideosPage({ onNav }) {
  const toast = useToast();
  const [filter, setFilter] = useState({ sku: '全部', style: '全部', state: '全部', cover: '全部', date: '本月' });
  const [sel, setSel] = useState(new Set());
  const [drawer, setDrawer] = useState(null);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return MOCK.videos.filter(v => {
      if (filter.sku !== '全部' && v.sku !== filter.sku) return false;
      if (filter.style !== '全部' && v.style !== filter.style) return false;
      if (filter.state !== '全部' && v.state !== filter.state) return false;
      if (filter.cover === '有封面' && !v.has_cover) return false;
      if (filter.cover === '无封面' && v.has_cover) return false;
      if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [filter, search]);

  const noCover = MOCK.videos.filter(v => !v.has_cover).length;
  const allSelected = rows.length > 0 && rows.every(r => sel.has(r.id));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>视频库</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>本地视频文件夹的索引镜像 · 共 {MOCK.videos.length} 个视频 · {noCover} 个待做封面</div>
        </div>
        <div className="right">
          <button className="btn"><Icon.Refresh size={14} /> 重新扫描</button>
          <button className="btn"><Icon.Folder size={14} /> 设置文件夹</button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          <ChipSelect label="SKU" value={filter.sku} options={['全部', ...MOCK.skus.map(s => s.code)]} onChange={v => setFilter({...filter, sku: v})} />
          <ChipSelect label="款式" value={filter.style} options={['全部', ...new Set(MOCK.skus.map(s => s.style))]} onChange={v => setFilter({...filter, style: v})} />
          <ChipSelect label="状态" value={filter.state} options={['全部','待发布','已发布','使用中']} onChange={v => setFilter({...filter, state: v})} />
          <ChipSelect label="有封面" value={filter.cover} options={['全部','有封面','无封面']} onChange={v => setFilter({...filter, cover: v})} />
          <ChipSelect label="日期" value={filter.date} options={['今天','本周','本月','全部']} onChange={v => setFilter({...filter, date: v})} />
          <input className="input" placeholder="🔍 搜索文件名..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200, marginLeft: 8 }} />
          <div className="gap" />
          <div className="subnav">
            <button className={view==='list'?'active':''} onClick={() => setView('list')}><Icon.List size={12} /> 表格</button>
            <button className={view==='grid'?'active':''} onClick={() => setView('grid')}><Icon.Grid size={12} /> 网格</button>
          </div>
        </div>

        {view === 'list' ? (
          <div style={{ overflow: 'auto', maxHeight: '60vh' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="check"><Checkbox checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map(r => r.id)))} /></th>
                  <th>缩略</th>
                  <th>SKU</th>
                  <th>款式</th>
                  <th>文件名</th>
                  <th>状态</th>
                  <th>封面</th>
                  <th>大小</th>
                  <th>时长</th>
                  <th>入库时间</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map(v => (
                  <tr key={v.id} className={sel.has(v.id) ? 'sel' : ''} onDoubleClick={() => setDrawer(v)}>
                    <td className="check"><Checkbox checked={sel.has(v.id)} onChange={() => toggle(v.id)} /></td>
                    <td>
                      <div style={{ width: 28, height: 50, background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 3, display:'flex', alignItems:'center', justifyContent:'center', color: 'var(--muted-2)', fontSize: 9 }}>▶</div>
                    </td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.sku}</td>
                    <td>{v.style}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{v.name}</td>
                    <td><StatusBadge value={v.state} /></td>
                    <td>{v.has_cover ? <Icon.Check size={14} style={{ color:'var(--green)' }} /> : <span className="muted">–</span>}</td>
                    <td className="num muted">{v.size_mb}M</td>
                    <td className="num muted">{v.duration}s</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{v.added}</td>
                    <td><button className="btn ghost sm" onClick={() => setDrawer(v)}><Icon.Eye size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 14, display:'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {rows.slice(0, 24).map(v => (
              <div key={v.id} className={`img-card ${sel.has(v.id) ? 'sel' : ''}`} onClick={() => toggle(v.id)}>
                <div className="check"><Checkbox checked={sel.has(v.id)} onChange={() => toggle(v.id)} /></div>
                <Thumb kind="video" label={v.name} corner={`${v.duration}s`} play={v.has_cover ? null : '无封面'} />
                <div className="meta"><span className="mono">{v.sku}</span><span>{v.state}</span></div>
              </div>
            ))}
          </div>
        )}

        <div className="seltool">
          <span>已选 <strong>{sel.size}</strong> 个</span>
          <div className="right">
            <button className="btn sm" disabled={!sel.size}><Icon.Pencil size={12} /> 批量改 SKU</button>
            <button className="btn sm primary" disabled={!sel.size} onClick={() => { onNav('covers'); toast(`已带 ${sel.size} 个视频到封面工作区`); }}>
              <Icon.Crop size={12} /> 去做封面
            </button>
            <button className="btn sm danger" disabled={!sel.size}><Icon.Trash size={12} /> 标记删除</button>
          </div>
        </div>
      </div>

      <Drawer open={!!drawer} onClose={() => setDrawer(null)} title={drawer ? drawer.name : ''}>
        {drawer && (
          <>
            <Thumb kind="video" label={drawer.name} corner={`${drawer.duration}s`} />
            <div className="kv" style={{ marginTop: 14, rowGap: 10 }}>
              <span className="k">SKU</span><span className="v mono">{drawer.sku}</span>
              <span className="k">款式</span><span className="v">{drawer.style}</span>
              <span className="k">文件名</span><span className="v mono">{drawer.name}</span>
              <span className="k">路径</span><span className="v mono" style={{ fontSize: 11, wordBreak:'break-all' }}>{drawer.path}</span>
              <span className="k">大小</span><span className="v">{drawer.size_mb} MB</span>
              <span className="k">时长</span><span className="v">{drawer.duration}s</span>
              <span className="k">封面</span><span className="v">{drawer.has_cover ? '已选' : '未选'}</span>
              <span className="k">状态</span><span className="v"><StatusBadge value={drawer.state} /></span>
              <span className="k">入库时间</span><span className="v mono">{drawer.added}</span>
              <span className="k">备注</span><span className="v muted-2">无</span>
            </div>
            <div style={{ marginTop: 16, display:'flex', gap: 6 }}>
              <button className="btn"><Icon.Crop size={12} /> 编辑封面</button>
              <button className="btn"><Icon.Folder size={12} /> 在文件夹打开</button>
              <button className="btn ghost" style={{ marginLeft: 'auto' }}><Icon.Trash size={12} /></button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

function TagsPage({ onNav }) {
  const [filter, setFilter] = useState('全部');
  const tagRows = MOCK.skus.map((s, i) => ({
    sku: s.code, style: s.style,
    tags: ['#保温杯','#冬日好物','#宝妈必备','#办公室生活','#平价好物'].slice(0, 5).map((t, ti) => ({
      text: t, isTest: i % 3 === 0 && ti === 4,
    })),
  }));
  return (
    <div className="page">
      <div className="page-h"><div><h1>标签库</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>SKU 一对一关联，每条 5 个标签</div></div>
        <div className="right">
          <button className="btn"><Icon.Plus size={14} /> 新增</button>
          <button className="btn"><Icon.Upload size={14} /> 导入</button>
        </div>
      </div>
      <div className="card">
        <div className="filterbar">
          <ChipSelect label="筛选" value={filter} options={['全部','含测试标签','仅默认']} onChange={setFilter} />
          <input className="input" placeholder="🔍 搜索..." style={{ width: 200, marginLeft: 'auto' }} />
        </div>
        <table className="tbl">
          <thead>
            <tr><th><Checkbox checked={false} onChange={() => {}} /></th><th>SKU</th><th>款式</th><th>标签 1-5</th><th></th></tr>
          </thead>
          <tbody>
            {tagRows.map((r, i) => (
              <tr key={i}>
                <td><Checkbox checked={false} onChange={() => {}} /></td>
                <td className="mono" style={{ fontSize: 12 }}>{r.sku}</td>
                <td>{r.style}</td>
                <td>
                  <div className="tag-row">
                    {r.tags.map((t, ti) => (
                      <span key={ti} className="tag" style={t.isTest ? { background: 'var(--yellow-soft)', color: 'oklch(0.46 0.12 80)', borderColor: 'oklch(0.85 0.07 80)' } : null}>
                        {t.text}{t.isTest && ' 🧪'}
                      </span>
                    ))}
                  </div>
                </td>
                <td><button className="btn ghost sm"><Icon.More size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TitlesLibPage({ onNav }) {
  const toast = useToast();
  const [filter, setFilter] = useState({ score: '全部', state: '全部', skill: '全部' });
  const [sel, setSel] = useState(new Set());
  const rows = useMemo(() => {
    return MOCK.titles.filter(t => {
      if (filter.state !== '全部' && t.used_state !== filter.state) return false;
      if (filter.skill !== '全部' && t.from !== filter.skill) return false;
      if (filter.score === '≥8' && (t.score == null || t.score < 8)) return false;
      if (filter.score === '<5' && (t.score == null || t.score >= 5)) return false;
      return true;
    });
  }, [filter]);
  const allSel = rows.length > 0 && rows.every(r => sel.has(r.text));
  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="page">
      <div className="page-h">
        <div><h1>标题库</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>共 {MOCK.titles.length} 条 · 任务单生成时根据爆款分数权重抽取</div></div>
        <div className="right"><button className="btn primary" onClick={() => onNav('titles')}><Icon.Sparkle size={14} /> 去生成新标题</button></div>
      </div>
      <div className="card">
        <div className="filterbar">
          <ChipSelect label="爆款分" value={filter.score} options={['全部','≥8','<5']} onChange={v => setFilter({...filter, score: v})} />
          <ChipSelect label="使用状态" value={filter.state} options={['全部','已使用','未使用','待评估']} onChange={v => setFilter({...filter, state: v})} />
          <ChipSelect label="来源 Skill" value={filter.skill} options={['全部', ...new Set(MOCK.titles.map(t => t.from))]} onChange={v => setFilter({...filter, skill: v})} />
          <input className="input" placeholder="🔍 搜索标题..." style={{ width: 220, marginLeft: 'auto' }} />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th className="check"><Checkbox checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(rows.map(r => r.text)))} /></th>
              <th style={{ width: '40%' }}>标题</th>
              <th>爆款分</th>
              <th>使用次数</th>
              <th>状态</th>
              <th>来源 Skill</th>
              <th>入库时间</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={i} className={sel.has(t.text) ? 'sel' : ''}>
                <td className="check"><Checkbox checked={sel.has(t.text)} onChange={() => toggle(t.text)} /></td>
                <td>{t.text}</td>
                <td>{t.score == null ? <span className="muted">待评估</span> : (
                  <span className="row" style={{ gap: 4 }}>
                    {Array.from({ length: 10 }, (_, k) => <span key={k} style={{ width: 5, height: 12, background: k < t.score ? 'var(--accent)' : 'var(--line)', borderRadius: 1 }} />)}
                    <span className="num mono" style={{ marginLeft: 4 }}>{t.score}</span>
                  </span>
                )}</td>
                <td className="num">{t.used}</td>
                <td><StatusBadge value={t.used_state} /></td>
                <td className="mono" style={{ fontSize: 11 }}>{t.from}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{t.date}</td>
                <td><button className="btn ghost sm"><Icon.More size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="seltool">
          <span>已选 <strong>{sel.size}</strong></span>
          <div className="right">
            <button className="btn sm"><Icon.Pencil size={12} /> 改爆款分</button>
            <button className="btn sm danger"><Icon.Trash size={12} /> 删除</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptsLibPage({ onNav }) {
  // Reuse the prompt table from images.jsx but in the database section context — link back to images studio
  return (
    <div className="page">
      <div className="page-h">
        <div><h1>提示词库</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>图片提示词专用 · 一对多关联到图片库</div></div>
        <div className="right"><button className="btn primary" onClick={() => onNav('images')}><Icon.Wand size={14} /> 去图片工作室</button></div>
      </div>
      <div className="card">
        <div className="filterbar">
          <ChipSelect label="场景" value="全部" options={['全部','视频封面','直播封面','主图素材','SKU 素材','详情页素材']} onChange={() => {}} />
          <ChipSelect label="状态" value="全部" options={['全部','优质','-','草稿','反面']} onChange={() => {}} />
          <input className="input" placeholder="🔍 搜索..." style={{ width: 220, marginLeft: 'auto' }} />
        </div>
        <table className="tbl">
          <thead>
            <tr><th><Checkbox checked={false} onChange={() => {}} /></th><th style={{ width: '46%' }}>提示词</th><th>场景</th><th>已生成</th><th>入库率</th><th>状态</th><th></th></tr>
          </thead>
          <tbody>
            {MOCK.prompts.map(r => (
              <tr key={r.id}>
                <td><Checkbox checked={false} onChange={() => {}} /></td>
                <td><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 480 }} title={r.text}>{r.text}</div></td>
                <td>{r.scene}</td>
                <td className="num">{r.generated}</td>
                <td className="num">{r.rate == null ? '–' : Math.round(r.rate * 100) + '%'}</td>
                <td><StatusBadge value={r.status} /></td>
                <td><button className="btn ghost sm"><Icon.More size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScriptsLibPage({ onNav }) {
  const rows = [
    { sku: 'SKU-WB-001', text: '【Hook】姐妹们这个保温杯…', from: 'script_oral_brand_warmlife v0.6', date: '2026-04-22', secs: 28 },
    { sku: 'SKU-WB-001', text: '【Hook】"妈，我办公室没有热水"…',     from: 'script_oral_brand_warmlife v0.6', date: '2026-04-25', secs: 25 },
    { sku: 'SKU-WB-002', text: '【Hook】30 块买的保温杯…',                from: 'script_oral_general v1.0', date: '2026-04-29', secs: 23 },
    { sku: 'SKU-CL-001', text: '【Hook】红色加绒打底衫…',                  from: 'script_oral_general v1.0', date: '2026-05-02', secs: 26 },
  ];
  return (
    <div className="page">
      <div className="page-h">
        <div><h1>文案库</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>口播脚本</div></div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th></th><th>SKU</th><th style={{ width: '60%' }}>文案预览</th><th>时长</th><th>来源 Skill</th><th>入库时间</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><Checkbox checked={false} onChange={() => {}} /></td>
                <td className="mono" style={{ fontSize: 12 }}>{r.sku}</td>
                <td>{r.text}</td>
                <td className="num">~{r.secs}s</td>
                <td className="mono" style={{ fontSize: 11 }}>{r.from}</td>
                <td className="muted mono" style={{ fontSize: 12 }}>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImagesLibPage({ onNav }) {
  const [filter, setFilter] = useState({ scene: '全部', sku: '全部', tag: '全部' });
  const [view, setView] = useState('grid');
  const items = useMemo(() => {
    const out = [];
    let id = 1;
    MOCK.prompts.slice(0, 6).forEach(p => {
      for (let i = 0; i < (p.kept || 4); i++) {
        out.push({
          id: 'img'+id++,
          ratio: i % 2 ? '1:1' : '3:4',
          model: ['GPT Image 2','Midjourney v7','Imagen 4'][i % 3],
          time: `2026-05-0${(i % 6) + 1}`,
          promptText: p.text,
          scene: p.scene,
          tag: ['白底','场景','特写'][i % 3],
        });
      }
    });
    return out;
  }, []);

  return (
    <div className="page">
      <div className="page-h">
        <div><h1>图片库</h1><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>已入库图片 · 来源提示词、模型、用途</div></div>
        <div className="right">
          <button className="btn primary" onClick={() => onNav('images')}><Icon.Sparkle size={14} /> 图片工作室</button>
        </div>
      </div>
      <div className="card">
        <div className="filterbar">
          <ChipSelect label="场景" value={filter.scene} options={['全部', ...new Set(items.map(i => i.scene))]} onChange={v => setFilter({...filter, scene: v})} />
          <ChipSelect label="SKU" value={filter.sku} options={['全部', ...MOCK.skus.map(s => s.code)]} onChange={v => setFilter({...filter, sku: v})} />
          <ChipSelect label="用途标签" value={filter.tag} options={['全部','白底','场景','特写']} onChange={v => setFilter({...filter, tag: v})} />
          <ChipSelect label="比例" value="全部" options={['全部','1:1','3:4','9:16']} onChange={() => {}} />
          <div className="gap" />
          <div className="subnav">
            <button className={view==='grid'?'active':''} onClick={() => setView('grid')}><Icon.Grid size={12} /> 网格</button>
            <button className={view==='list'?'active':''} onClick={() => setView('list')}><Icon.List size={12} /> 列表</button>
          </div>
        </div>
        <div style={{ padding: 14 }}>
          <div className="img-grid">
            {items.map(it => (
              <div key={it.id} className="img-card">
                <Thumb kind={it.ratio === '1:1' ? 'square' : 'video'} label={it.promptText.slice(0, 12)+'…'} corner={it.ratio} />
                <div className="meta">
                  <span className="muted">{it.model}</span>
                  <span className="muted">{it.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { VideosPage, TagsPage, TitlesLibPage, PromptsLibPage, ScriptsLibPage, ImagesLibPage });
