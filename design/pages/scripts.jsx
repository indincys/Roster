/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox */
const { useState } = React;

function ScriptsPage({ onNav }) {
  const toast = useToast();
  const [skill, setSkill] = useState('script_oral_brand_warmlife v0.6');
  const [sku, setSku] = useState('SKU-WB-001 红色经典款');
  const [seed, setSeed] = useState('30 秒以内，强调防水保温，主推宝妈通勤场景');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);

  const onGen = () => {
    setGenerating(true); setResults(null);
    setTimeout(() => {
      setResults([
        { id: 's1', text: '【Hook】姐妹们，我跟你们讲，这个杯子真的——不是我夸张——刚倒进去的开水，到下班还能烫嘴。\n【Body】我是去年冬天买的，500ml 的，刚好放进我通勤包侧袋。早上送娃完倒一杯，到公司打开还冒热气。\n【CTA】链接已经放在评论区了，今天直播间叠了券，比我那时候买便宜。', secs: 28, words: 96, picked: true },
        { id: 's2', text: '【Hook】"妈，我办公室没有热水。"——这句话我女儿再也不用说了。\n【Body】这个保温杯我买了两个，一个给她带学校，一个我自己用。早上 7 点装开水，下午 4 点打开还能烫嘴。\n【CTA】点购物车第一个，给孩子也安排一个吧。', secs: 25, words: 88, picked: false },
        { id: 's3', text: '【Hook】30 块买的保温杯，被我嘲笑了一冬天，今天我要替它正名。\n【Body】我之前用过 200 多的，三个月就漏。这个 30 块的，用了一年，密封圈还是新的。\n【CTA】别再花冤枉钱了，朋友，链接放评论区。', secs: 23, words: 76, picked: true },
      ]);
      setGenerating(false);
    }, 1100);
  };

  const togglePick = (id) => setResults(r => r.map(x => x.id === id ? {...x, picked: !x.picked} : x));
  const picked = results ? results.filter(x => x.picked).length : 0;

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>文案工作区</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>视频口播脚本生成 · 简版 v1（详细工作流后续版本）</div>
        </div>
        <div className="right">
          <button className="btn" onClick={() => onNav('lib_scripts')}><Icon.Database size={14} /> 文案库</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h"><Icon.FileText size={16} /><h3>生成配置</h3></div>
        <div className="card-b" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18 }}>
          <div className="col">
            <div className="gen-row"><span className="lab">Skill</span>
              <ChipSelect label="" value={skill} options={MOCK.skills.script.map(s => `${s.name} ${s.version}`)} onChange={setSkill} width={240} />
            </div>
            <div className="gen-row"><span className="lab">关联 SKU（可选）</span>
              <ChipSelect label="" value={sku} options={['（无）', ...MOCK.skus.map(s => `${s.code} ${s.style}`)]} onChange={setSku} width={240} />
            </div>
          </div>
          <div className="col">
            <div className="muted" style={{ fontSize: 12 }}>种子描述</div>
            <textarea className="textarea" rows={3} value={seed} onChange={e => setSeed(e.target.value)} />
          </div>
          <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <button className="btn primary lg" onClick={onGen} disabled={generating}>
              <Icon.Zap size={14} /> {generating ? '生成中…' : '生成脚本'}
            </button>
            <span className="muted" style={{ marginLeft: 12, fontSize: 12 }}>v1 仅做基础生成 + 入库</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <Icon.Inbox size={16} />
          <h3>生成结果（待入库）</h3>
          <div className="right">
            <button className="btn sm primary" disabled={!picked}
                    onClick={() => { toast(`${picked} 条文案已入库`, { kind:'success' }); setResults(null); }}>
              <Icon.Check size={12} /> 入库 ({picked})
            </button>
          </div>
        </div>
        <div className="card-b">
          {!results && !generating && (
            <div className="empty">
              <div className="ico"><Icon.FileText /></div>
              <h3>还没有生成结果</h3>
              <div>填好配置 → 点”生成脚本”</div>
            </div>
          )}
          {generating && Array.from({length:3}, (_,i) => <div key={i} className="sk" style={{height: 60, marginBottom: 8}}/>)}
          {results && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap: 10 }}>
              {results.map(r => (
                <label key={r.id} className="card" style={{ padding: 12, cursor:'pointer', background: r.picked ? 'var(--accent-soft)' : 'var(--panel-2)', borderColor: r.picked ? 'var(--accent)' : 'var(--line)' }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <Checkbox checked={r.picked} onChange={() => togglePick(r.id)} />
                    <span className="muted mono" style={{ fontSize: 11 }}>~{r.secs}s · {r.words} 字</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7 }}>{r.text}</div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

window.ScriptsPage = ScriptsPage;
