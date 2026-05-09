/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, StatusBadge, Thumb */
const { useState, useMemo } = React;

function CoversPage({ onNav }) {
  const toast = useToast();
  const videos = useMemo(() => MOCK.videos.slice(0, 32).map((v, i) => ({
    ...v,
    cover_state: v.has_cover ? '已选封面' : (i % 6 === 0 ? '默认首帧' : '待选'),
  })), []);
  const [activeId, setActiveId] = useState(videos[2]?.id || videos[0].id);
  const active = videos.find(v => v.id === activeId);
  const [activeFrame, setActiveFrame] = useState(8);
  const [ratio, setRatio] = useState('3:4');
  const [filter, setFilter] = useState('全部');

  const filtered = filter === '全部' ? videos : videos.filter(v => v.cover_state === filter);
  const next = () => {
    const idx = filtered.findIndex(v => v.id === activeId);
    if (idx < filtered.length - 1) setActiveId(filtered[idx + 1].id);
  };
  const prev = () => {
    const idx = filtered.findIndex(v => v.id === activeId);
    if (idx > 0) setActiveId(filtered[idx - 1].id);
  };

  const apply = () => {
    toast(`封面已应用 · ${active.sku}/${active.name.replace('.mp4','')}__${ratio.replace(':','x')}.jpg`, { kind: 'success' });
    next();
  };

  return (
    <div className="page" style={{ maxWidth: 1600 }}>
      <div className="page-h">
        <div>
          <h1>封面工作区</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            手动拉时间轴定帧 · 等距预渲 60 帧 · 鼠标悬浮即时预览
          </div>
        </div>
        <div className="right">
          <button className="btn"><Icon.Layers size={14} /> 批量应用首帧</button>
          <button className="btn"><Icon.Download size={14} /> 批量导出现有封面</button>
        </div>
      </div>

      <div className="card" style={{ display:'grid', gridTemplateColumns:'320px 1fr', minHeight: 640 }}>
        {/* Left list */}
        <div style={{ borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column' }}>
          <div className="filterbar" style={{ borderBottom: '1px solid var(--line)' }}>
            <strong>待处理 {videos.length}</strong>
            <ChipSelect label="筛选" value={filter} options={['全部','已选封面','默认首帧','待选']} onChange={setFilter} />
          </div>
          <div style={{ overflow:'auto', flex: 1, paddingBottom: 8 }}>
            {filtered.map(v => (
              <div key={v.id} className={`cover-list-row ${v.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(v.id)}>
                <Checkbox checked={false} onChange={() => {}} />
                <div className="mini-thumb">▶ 0:{String(v.duration).padStart(2,'0')}</div>
                <div>
                  <div className="mono" style={{ fontSize: 12 }}>{v.name}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{v.sku} · {v.style}</div>
                </div>
                <StatusBadge value={v.cover_state} />
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--line)', padding: 10, display:'flex', gap: 6, alignItems: 'center' }}>
            <span className="kbd">J</span><span className="kbd">K</span> <span className="muted" style={{ fontSize: 12 }}>上一个 / 下一个</span>
          </div>
        </div>

        {/* Right editor */}
        {active && (
          <div style={{ padding: 18, display:'flex', flexDirection:'column' }}>
            <div className="row" style={{ marginBottom: 12 }}>
              <Icon.Video />
              <strong className="mono">{active.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>({active.sku} {active.style})</span>
              <div style={{ marginLeft:'auto', display:'flex', gap: 6 }}>
                <button className="btn sm" onClick={prev}><Icon.ChevLeft size={12} /></button>
                <button className="btn sm" onClick={next}>下一个 <Icon.ArrowRight size={12} /></button>
              </div>
            </div>

            {/* Preview */}
            <div style={{
              flex: 1, minHeight: 320,
              background: 'var(--bg-soft)', border: '1px solid var(--line)', borderRadius: 8,
              position: 'relative', display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              {/* video frame placeholder */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `repeating-linear-gradient(45deg, oklch(0.94 0.01 90) 0 12px, oklch(0.96 0.01 90) 12px 24px)`
              }} />
              <div style={{
                position: 'relative', height: '78%', aspectRatio: ratio === '3:4' ? '3/4' : ratio === '9:16' ? '9/16' : ratio === '1:1' ? '1/1' : '4/3',
                background: 'oklch(0.85 0.02 60)',
                border: '2px solid var(--ink)', boxShadow: '0 0 0 9999px rgba(0,0,0,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)',
                fontFamily: 'monospace'
              }}>
                <div style={{ textAlign:'center', padding: 24 }}>
                  <div style={{ fontSize: 13, opacity: 0.7 }}>预览：第 {activeFrame} 帧</div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>{ratio} 裁剪框 · 可拖动定位</div>
                </div>
                <div style={{ position:'absolute', top: -22, right: 0, fontSize: 10, fontFamily: 'monospace' }} className="muted">{ratio} crop</div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ marginTop: 14 }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <span className="muted mono" style={{ fontSize: 11 }}>0s</span>
                <div style={{ flex: 1 }} />
                <span className="muted mono" style={{ fontSize: 11 }}>{Math.floor(active.duration/2)}s</span>
                <div style={{ flex: 1 }} />
                <span className="muted mono" style={{ fontSize: 11 }}>{active.duration}s</span>
              </div>
              <div className="timeline">
                {Array.from({ length: 30 }, (_, i) => (
                  <div key={i} className={`tl-frame ${i === activeFrame ? 'active' : ''}`}
                       onClick={() => setActiveFrame(i)} title={`第 ${i} 帧`}>
                    f{i}
                  </div>
                ))}
              </div>
            </div>

            {/* Ratio + actions */}
            <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
              <span className="muted" style={{ fontSize: 12 }}>比例</span>
              {['3:4','9:16','1:1','自定义'].map(r => (
                <button key={r} className={`chip ${ratio===r?'active':''}`} onClick={() => setRatio(r)}>
                  {r === '3:4' && <Icon.Star size={10} />} {r}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button className="btn"><Icon.Refresh size={14} /> 重选</button>
              <button className="btn primary" onClick={apply}><Icon.Check size={14} /> 应用此封面</button>
            </div>

            <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>
              保存路径：<span className="mono">covers/{active.sku}/{active.name.replace('.mp4','')}__{ratio.replace(':','x')}.jpg</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.CoversPage = CoversPage;
