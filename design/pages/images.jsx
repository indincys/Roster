/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, StatusBadge, Thumb, Modal */
const { useState, useMemo } = React;

const SCENES = [
  { id: 'cover_video', name: '视频封面', skill: 'image_cover_video v1.1', ratio: '3:4', folder: 'images/covers' },
  { id: 'cover_live',  name: '直播封面', skill: 'image_main_brand_warmlife v1.0', ratio: '9:16', folder: 'images/live' },
  { id: 'main',        name: '主图素材', skill: 'image_main_brand_warmlife v1.0', ratio: '1:1',  folder: 'images/main',  current: true },
  { id: 'sku',         name: 'SKU 素材', skill: 'image_main_general v2.0', ratio: '3:4', folder: 'images/sku' },
  { id: 'detail',      name: '详情页素材', skill: 'image_main_general v2.0', ratio: '1:1', folder: 'images/detail' },
  { id: 'composite',   name: '拼接素材',   skill: 'image_lifestyle v1.2', ratio: '4:3', folder: 'images/composite' },
];

function ImagesPage({ onNav }) {
  const [tab, setTab] = useState('prompt'); // 'prompt' | 'lib' | 'gen'
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>图片工作室</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>提示词生成 · 提示词库 · 图片生成 三 tab 联动</div>
        </div>
        <div className="right">
          <button className="btn" onClick={() => onNav('lib_images')}><Icon.Database size={14} /> 图片库</button>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', borderBottom: '1px solid var(--line)' }}>
          <button className={`tab ${tab==='prompt'?'active':''}`} onClick={() => setTab('prompt')}>
            <Icon.Pencil size={14} /> 提示词生成
          </button>
          <button className={`tab ${tab==='lib'?'active':''}`} onClick={() => setTab('lib')}>
            <Icon.Database size={14} /> 提示词库
          </button>
          <button className={`tab ${tab==='gen'?'active':''}`} onClick={() => setTab('gen')}>
            <Icon.Sparkle size={14} /> 图片生成
          </button>
          <span className="muted" style={{ marginLeft:'auto', alignSelf:'center', padding: '0 14px', fontSize: 12 }}>
            <Icon.Info size={11} /> 数据流：Tab1 入提示词库 → Tab2 选提示词 → Tab3 出图入图片库
          </span>
        </div>

        {tab === 'prompt' && <PromptGenTab onJumpLib={() => setTab('lib')} />}
        {tab === 'lib'    && <PromptLibTab onJumpGen={(rows) => setTab('gen')} />}
        {tab === 'gen'    && <ImageGenTab onJumpLib={() => setTab('lib')} />}
      </div>
    </div>
  );
}

function PromptGenTab({ onJumpLib }) {
  const toast = useToast();
  const [scene, setScene] = useState('main');
  const [seed, setSeed] = useState('突出冬天的保暖感，多种生活场景');
  const [count, setCount] = useState(20);
  const [model, setModel] = useState('Claude Opus');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);

  const cur = SCENES.find(s => s.id === scene);

  const onGen = () => {
    setGenerating(true); setResults(null);
    setTimeout(() => {
      setResults([
        { id:'r1', text: '雪山日出，蒸汽袅袅升起的红色保温杯放在岩石上，背景是粉色的天空，电影感画面', picked: true },
        { id:'r2', text: '晨跑女孩戴着白色手套握着保温杯，城市公园背景，柔和光线，治愈感',                  picked: true },
        { id:'r3', text: '办公室桌面，电脑旁边的红色保温杯，文件、键盘、绿植散落，俯拍视角，温暖',           picked: false },
        { id:'r4', text: '厨房窗台，蒸汽弥漫，冬日清晨，红色保温杯特写，景深虚化背景',                       picked: true },
        { id:'r5', text: '通勤地铁车厢内，年轻女性手握保温杯靠窗，窗外朦胧城市，胶片质感',                   picked: true },
        { id:'r6', text: '幼儿园门口宝妈递保温杯给孩子，秋冬阳光柔和，纪实风格',                            picked: true },
        { id:'r7', text: '书桌灯下深夜学习，手边的红色保温杯特写，暖色调',                                   picked: false },
      ]);
      setGenerating(false);
    }, 1200);
  };

  const togglePick = (id) => setResults(r => r.map(x => x.id === id ? { ...x, picked: !x.picked } : x));
  const picked = results ? results.filter(x => x.picked).length : 0;

  return (
    <>
      {/* Scene tabs */}
      <div style={{ display:'flex', alignItems:'center', gap: 4, padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--panel-2)', overflowX: 'auto' }}>
        {SCENES.map(s => (
          <button key={s.id}
                  className={`chip ${scene===s.id ? 'active' : ''}`}
                  onClick={() => setScene(s.id)}>
            {s.name}
            {s.id === 'main' && <span className="badge-s b-yellow" style={{ marginLeft: 4 }}>常用</span>}
          </button>
        ))}
        <button className="chip"><Icon.Plus size={11} /> 新增场景</button>
      </div>

      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18 }}>
        <div className="card" style={{ background: 'var(--panel-2)' }}>
          <div className="card-h" style={{ paddingBottom: 8, paddingTop: 10 }}>
            <h3 style={{ fontSize: 13 }}>当前预设</h3>
            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{cur.name}</span>
          </div>
          <div className="card-b" style={{ padding: '10px 14px' }}>
            <div className="kv">
              <span className="k">关联 Skill</span><span className="v mono" style={{ fontSize: 11 }}>{cur.skill}</span>
              <span className="k">默认比例</span><span className="v mono">{cur.ratio}</span>
              <span className="k">输出文件夹</span><span className="v mono" style={{ fontSize: 11 }}>{cur.folder}</span>
              <span className="k">每条 × 张数</span><span className="v mono">4</span>
              <span className="k">图片模型</span><span className="v">GPT Image 2</span>
            </div>
            <button className="btn sm" style={{ marginTop: 10 }}><Icon.Eye size={12} /> 预览 Skill</button>
          </div>
        </div>

        <div>
          <div className="gen-row">
            <span className="lab">种子描述</span>
            <textarea className="textarea" rows={2} style={{ flex: 1 }} value={seed} onChange={e => setSeed(e.target.value)} />
          </div>
          <div className="gen-row" style={{ marginTop: 8 }}>
            <span className="lab">生成数量</span>
            <input className="input" type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value || 10))} style={{ width: 80 }} />
            <span className="muted">条提示词</span>
            <span className="lab" style={{ marginLeft: 16 }}>调用模型</span>
            <ChipSelect label="" value={model} options={['Claude Opus','GPT-5','Gemini 2.5']} onChange={setModel} />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn primary lg" disabled={generating} onClick={onGen}>
              <Icon.Zap size={14} /> {generating ? '生成中…' : '生成提示词'}
            </button>
            <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>
              <Icon.Info size={11} /> 此 tab 只调用 LLM 生成文字提示词，不调用图片 API
            </span>
          </div>

          {/* Results */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <div className="row">
              <strong>生成结果（待入库）</strong>
              {results && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{results.length} 条 · 已选 {picked}</span>}
              <div style={{ marginLeft: 'auto', display:'flex', gap: 6 }}>
                <button className="btn sm" onClick={onGen} disabled={generating}><Icon.Refresh size={12} /> 重新生成</button>
                <button className="btn sm danger"><Icon.Trash size={12} /> 丢弃</button>
                <button className="btn sm primary" disabled={!picked}
                        onClick={() => { toast(`${picked} 条提示词已入库`, { kind:'success', action:'切到「提示词库」查看' }); onJumpLib(); }}>
                  <Icon.Check size={12} /> 入提示词库 ({picked})
                </button>
              </div>
            </div>

            {!results && !generating && (
              <div className="empty" style={{ marginTop: 12 }}>
                <div className="ico"><Icon.Wand /></div>
                <h3>还没有结果</h3>
                <div>选择场景 → 输入种子描述 → 生成提示词</div>
              </div>
            )}
            {generating && (
              <div style={{ marginTop: 12, display:'flex', flexDirection:'column', gap: 8 }}>
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk" style={{ height: 18, width: `${50 + Math.random()*40}%` }} />)}
              </div>
            )}
            {results && (
              <div style={{ marginTop: 12, display:'flex', flexDirection:'column', gap: 4 }}>
                {results.map(r => (
                  <label key={r.id} style={{ display:'flex', alignItems:'flex-start', gap: 8, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', background: r.picked ? 'var(--accent-soft)' : 'transparent', border: '1px solid var(--line)' }}>
                    <Checkbox checked={r.picked} onChange={() => togglePick(r.id)} />
                    <span style={{ flex: 1 }}>{r.text}</span>
                    <button className="btn ghost sm"><Icon.Eye size={12} /></button>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function PromptLibTab({ onJumpGen }) {
  const toast = useToast();
  const [filter, setFilter] = useState({ scene: '全部', skill: '全部', status: '全部' });
  const [sel, setSel] = useState(new Set(['p1','p5','p6']));
  const [sortBy, setSortBy] = useState('入库率↓');

  const rows = useMemo(() => {
    let r = [...MOCK.prompts];
    if (filter.scene  !== '全部') r = r.filter(x => x.scene === filter.scene);
    if (filter.status !== '全部') r = r.filter(x => x.status === filter.status);
    if (sortBy === '入库率↓') r.sort((a,b) => (b.rate ?? 0) - (a.rate ?? 0));
    return r;
  }, [filter, sortBy]);

  const toggle = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && rows.every(r => sel.has(r.id));

  return (
    <>
      <div className="filterbar">
        <strong>提示词库</strong>
        <span className="muted" style={{ fontSize: 12 }}>{MOCK.prompts.length} 条</span>
        <ChipSelect label="场景" value={filter.scene} options={['全部', ...SCENES.map(s => s.name)]} onChange={v => setFilter({...filter, scene: v})} />
        <ChipSelect label="Skill" value={filter.skill} options={['全部', ...new Set(MOCK.prompts.map(p => p.skill))]} onChange={v => setFilter({...filter, skill: v})} />
        <ChipSelect label="状态" value={filter.status} options={['全部','优质','-','草稿','反面']} onChange={v => setFilter({...filter, status: v})} />
        <ChipSelect label="排序" value={sortBy} options={['入库率↓','入库率↑','已生成↓','创建时间↓']} onChange={setSortBy} />
        <input className="input" placeholder="搜索提示词..." style={{ marginLeft: 8, width: 220 }} />
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th className="check"><Checkbox checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(rows.map(r=>r.id)))} /></th>
            <th style={{ width: '48%' }}>提示词</th>
            <th>场景</th>
            <th>已生成</th>
            <th>入库率</th>
            <th>状态</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className={sel.has(r.id) ? 'sel' : ''}>
              <td className="check"><Checkbox checked={sel.has(r.id)} onChange={() => toggle(r.id)} /></td>
              <td><div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth: 480 }} title={r.text}>{r.text}</div></td>
              <td>{r.scene}</td>
              <td className="num">{r.generated}</td>
              <td className="num">
                {r.rate == null ? '–' : (
                  <div className="row">
                    <span style={{ width: 36, textAlign: 'right' }}>{Math.round(r.rate * 100)}%</span>
                    <div style={{ width: 60, height: 4, background: 'var(--line)', borderRadius: 999, overflow:'hidden' }}>
                      <div style={{ width: `${r.rate*100}%`, height: '100%', background: r.rate >= 0.5 ? 'var(--green)' : r.rate < 0.2 ? 'var(--red)' : 'var(--yellow)' }} />
                    </div>
                  </div>
                )}
              </td>
              <td><StatusBadge value={r.status} /></td>
              <td><button className="btn ghost sm"><Icon.More size={14} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="seltool">
        <span>已选 <strong>{sel.size}</strong> 条</span>
        <div className="right">
          <button className="btn sm"><Icon.Pencil size={12} /> 编辑</button>
          <button className="btn sm danger"><Icon.Trash size={12} /> 删除</button>
          <button className="btn sm primary" disabled={sel.size === 0}
                  onClick={() => { toast(`已带 ${sel.size} 条提示词到图片生成`); onJumpGen(); }}>
            <Icon.Sparkle size={12} /> 用选中提示词去生成图 ({sel.size})
          </button>
        </div>
      </div>
    </>
  );
}

function ImageGenTab({ onJumpLib }) {
  const toast = useToast();
  const [model, setModel]  = useState('GPT Image 2');
  const [ratio, setRatio]  = useState('1:1');
  const [perPrompt, setPp] = useState(4);
  const [view, setView]    = useState('grid');
  const [filter, setFilter] = useState('全部');

  const promptIds = ['p1','p5','p6'];
  const promptsInBatch = MOCK.prompts.filter(p => promptIds.includes(p.id));

  // Build mock images
  const [images, setImages] = useState(() => {
    const out = [];
    promptsInBatch.forEach((p, pi) => {
      for (let i = 0; i < perPrompt; i++) {
        out.push({
          id: `img-${pi}-${i}`,
          promptId: p.id,
          promptText: p.text,
          model: 'GPT Image 2',
          time: `2026-05-07 14:${(32 + i + pi * 4).toString().padStart(2, '0')}`,
          ratio: '1:1',
          state: i === 1 && pi === 1 ? 'soft-deleted' : i === 0 && pi === 0 ? 'kept' : 'pending',
          sel: false,
          label: `${p.text.slice(0, 6)}…${i+1}`,
        });
      }
    });
    return out;
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(8);

  const visible = images.filter(i => filter === '全部' ? true : filter === '已入库' ? i.state === 'kept' : filter === '已软删' ? i.state === 'soft-deleted' : true);

  const start = () => {
    setRunning(true);
    let p = progress;
    const t = setInterval(() => {
      p += 1;
      setProgress(p);
      if (p >= images.length) { setRunning(false); clearInterval(t); }
    }, 250);
  };

  const grouped = useMemo(() => {
    const g = {};
    visible.forEach(i => { (g[i.promptId] = g[i.promptId] || []).push(i); });
    return g;
  }, [visible]);

  const selCount = images.filter(i => i.sel).length;
  const toggleSel = (id) => setImages(xs => xs.map(x => x.id === id ? { ...x, sel: !x.sel } : x));
  const action = (id, state) => setImages(xs => xs.map(x => x.id === id ? { ...x, state, sel: false } : x));

  return (
    <>
      <div style={{ padding: 14, borderBottom: '1px solid var(--line)', background: 'var(--panel-2)' }}>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <strong>当前批次</strong>
          <span className="muted" style={{ fontSize: 12 }}>来自提示词库 {promptIds.length} 条</span>
          {promptsInBatch.map(p => (
            <span key={p.id} className="tag" title={p.text}>
              {p.text.slice(0, 14)}…
              <button className="btn ghost sm" style={{ marginLeft: 4, padding: 0, height: 'auto' }}><Icon.X size={11} /></button>
            </span>
          ))}
          <button className="chip" onClick={onJumpLib}><Icon.Plus size={11} /> 选择更多</button>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
          <ChipSelect label="模型" value={model} options={['GPT Image 2','Midjourney v7','Imagen 4','SD 3.5']} onChange={setModel} />
          <ChipSelect label="比例" value={ratio} options={['1:1','3:4','9:16','16:9']} onChange={setRatio} />
          <span className="chip"><span className="lbl">每条 ×</span><input className="input" type="number" min={1} max={8} value={perPrompt} onChange={e => setPp(Number(e.target.value || 1))} style={{ width: 36, height: 22, padding: '0 4px', border: 'none', background: 'transparent' }} /> 张</span>
          {!running ? (
            <button className="btn primary" onClick={start}><Icon.Play size={12} /> 开始生成</button>
          ) : (
            <button className="btn"><Icon.Pause size={12} /> 暂停</button>
          )}
          <span className="muted mono" style={{ fontSize: 12 }}>进度 {progress}/{images.length}</span>
          <div style={{ flex: 1 }} />
          <div className="subnav">
            <button className={view==='grid'?'active':''} onClick={() => setView('grid')}><Icon.Grid size={12} /> 网格</button>
            <button className={view==='list'?'active':''} onClick={() => setView('list')}><Icon.List size={12} /> 列表</button>
          </div>
          <ChipSelect label="筛选" value={filter} options={['全部','已入库','已软删','待处理']} onChange={setFilter} />
        </div>
      </div>

      <div style={{ padding: 14 }}>
        {Object.entries(grouped).map(([pid, imgs]) => {
          const promptText = imgs[0].promptText;
          return (
            <div key={pid} style={{ marginBottom: 18 }}>
              <div className="row" style={{ marginBottom: 8 }}>
                <span className="muted" style={{ fontSize: 12, marginRight: 6 }}>提示词</span>
                <span style={{ fontSize: 13 }}>{promptText.slice(0, 80)}{promptText.length > 80 ? '…' : ''}</span>
                <button className="btn ghost sm" onClick={onJumpLib} title="跳到此提示词在提示词库的位置">
                  <Icon.ArrowRight size={11} /> 跳转
                </button>
                <span className="muted mono" style={{ fontSize: 12, marginLeft: 'auto' }}>{imgs.length} 张</span>
              </div>
              <div className="img-grid">
                {imgs.map(img => (
                  <div key={img.id} className={`img-card ${img.sel ? 'sel' : ''}`} onClick={() => toggleSel(img.id)}>
                    <div className="check">
                      <Checkbox checked={img.sel} onChange={() => toggleSel(img.id)} />
                    </div>
                    <Thumb kind="square" label={img.label} corner={img.ratio} />
                    <div className="actions">
                      <div style={{ display:'flex', gap: 6, justifyContent:'flex-end' }}>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); action(img.id, 'kept'); }}>
                          <Icon.Check size={11}/> 入库
                        </button>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); }}>
                          <Icon.Refresh size={11}/>
                        </button>
                        <button className="btn sm" onClick={(e) => { e.stopPropagation(); action(img.id, 'soft-deleted'); }}>
                          <Icon.Trash size={11}/>
                        </button>
                      </div>
                    </div>
                    <div className="meta">
                      <span title={img.model}>{img.model}</span>
                      <span>
                        {img.state === 'kept' && <span className="badge-s b-success"><span className="dot"/>已入库</span>}
                        {img.state === 'soft-deleted' && <span className="badge-s b-red"><span className="dot"/>已软删</span>}
                        {img.state === 'pending' && <span className="badge-s b-gray"><span className="dot"/>待选</span>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="seltool">
        <span>已选 <strong>{selCount}</strong> 张</span>
        <span className="muted">入库率自动写回提示词库 · 软删某条提示词全部图片时建议将其标为反面</span>
        <div className="right">
          <button className="btn sm" disabled={!selCount}><Icon.Refresh size={12} /> 批量重生成</button>
          <button className="btn sm danger" disabled={!selCount}><Icon.Trash size={12} /> 批量软删</button>
          <button className="btn sm primary" disabled={!selCount}
                  onClick={() => { toast(`${selCount} 张图入库`, { kind:'success' }); setImages(xs => xs.map(x => x.sel ? {...x, sel: false, state: 'kept'} : x)); }}>
            <Icon.Check size={12} /> 批量入库
          </button>
        </div>
      </div>
    </>
  );
}

window.ImagesPage = ImagesPage;
