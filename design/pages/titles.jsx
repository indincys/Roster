/* global React, Icon, useToast, MOCK, ChipSelect, Checkbox, Modal */
const { useState, useMemo } = React;

function TitlesPage({ onNav }) {
  const toast = useToast();
  const [skill, setSkill] = useState('title_brand_warmlife v1.2');
  const [models, setModels] = useState({ 'Claude Opus': true, 'GPT-5': true, 'Gemini 2.5': false });
  const [taskPrompt, setTaskPrompt] = useState('本批主打防水功能，针对 25-35 岁宝妈，避免使用过度营销词');
  const [count, setCount] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const [skillPreview, setSkillPreview] = useState(false);
  const [scoreModalRows, setScoreModalRows] = useState(null);
  const [configOpen, setConfigOpen] = useState(true);

  const onGen = () => {
    setGenerating(true);
    setResults(null);
    const seed = MOCK.titles.map(t => t.text);
    setTimeout(() => {
      const claude = [
        '冬日暖心保温杯，宝妈通勤必备',
        '你妈再不用念叨多喝热水了',
        '保温 12 小时，办公室一杯到下班',
        '一手哄娃一手保温杯，宝妈日常',
        '北方冬天上班人手一只',
        '出差也能喝到家里那口热水',
        '宝妈实测：装热汤都不烫手',
        '通勤 1 小时，到办公室还冒热气',
      ].map((text, i) => ({ id: 'c'+i, text, picked: i < 4 }));
      const gpt = [
        '一杯热水暖整个冬天',
        '30 块买的保温杯，竟然秒杀星巴克',
        '这杯子让我老婆直接说真香',
        '打工人的第二个胃，全靠它',
        '露营带它，温度比心情还稳',
        '红色长款，穿搭小白也能驾驭',
        '通勤包必备，喝水更省事',
        '一杯下肚，整个上午都暖暖',
      ].map((text, i) => ({ id: 'g'+i, text, picked: i < 3 }));
      setResults({ 'Claude Opus': claude, 'GPT-5': gpt });
      setGenerating(false);
    }, 1200);
  };

  const togglePick = (model, id) => {
    setResults(r => ({ ...r, [model]: r[model].map(x => x.id === id ? { ...x, picked: !x.picked } : x) }));
  };

  const totalPicked = results ? Object.values(results).flat().filter(x => x.picked).length : 0;

  const onSubmitToLib = () => {
    if (totalPicked === 0) { toast('未选中任何条目', { kind: 'error' }); return; }
    const rows = Object.entries(results).flatMap(([m, items]) =>
      items.filter(x => x.picked).map(x => ({ ...x, model: m, score: 8 }))
    );
    setScoreModalRows(rows);
  };

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <h1>标题工作区</h1>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>通过 Skill + 任务提示词生成标题，多模型对比，批量入库</div>
        </div>
        <div className="right">
          <button className="btn" onClick={() => onNav('lib_titles')}><Icon.Database size={14} /> 标题库</button>
          <button className="btn"><Icon.Clock size={14} /> 设为定时任务</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-h">
          <Icon.Sparkle size={16} />
          <h3>生成配置</h3>
          {!configOpen && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{skill} · {Object.entries(models).filter(([,v])=>v).length} 个模型 · {count} 条</span>}
          <div className="right">
            <button className="btn sm" onClick={() => setConfigOpen(o => !o)}>
              {configOpen ? <Icon.ChevUp size={12} /> : <Icon.ChevDown size={12} />}
            </button>
          </div>
        </div>
        {configOpen && (
        <div className="card-b" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18, padding: 18 }}>
          <div className="col">
            <div className="gen-row">
              <span className="lab">调用 Skill</span>
              <ChipSelect label="" value={skill} options={MOCK.skills.title.map(s => `${s.name} ${s.version}`)} onChange={setSkill} width={220} />
              <button className="btn sm" onClick={() => setSkillPreview(true)}><Icon.Eye size={12} /> 预览</button>
            </div>
            <div className="gen-row">
              <span className="lab">模型</span>
              <div style={{ display:'flex', gap: 6, flexWrap:'wrap' }}>
                {Object.keys(models).map(m =>
                  <button key={m} className={`chip ${models[m]?'active':''}`}
                          onClick={() => setModels({...models, [m]: !models[m]})}>
                    {models[m] && <Icon.Check size={11} />} {m}
                  </button>
                )}
              </div>
            </div>
            <div className="gen-row">
              <span className="lab">生成数量</span>
              <input className="input" type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value || 10))} style={{ width: 80 }} />
              <span className="muted">条 / 模型</span>
            </div>
          </div>

          <div className="col">
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>本次任务提示词（可选）</div>
              <textarea className="textarea" rows={3} value={taskPrompt} onChange={e => setTaskPrompt(e.target.value)} />
              <div style={{ display:'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <button className="chip" onClick={() => setTaskPrompt(p => p + ' #聚焦')}>#聚焦</button>
                <button className="chip" onClick={() => setTaskPrompt(p => p + ' #人群')}>#人群</button>
                <button className="chip" onClick={() => setTaskPrompt(p => p + ' #风格')}>#风格</button>
                <button className="chip" onClick={() => setTaskPrompt(p => p + ' #禁用词')}>#禁用词</button>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: '1/-1', borderTop: '1px solid var(--line)', paddingTop: 14, display:'flex', gap: 8 }}>
            <button className="btn primary lg" disabled={generating} onClick={onGen}>
              <Icon.Zap size={14} /> {generating ? '生成中…' : '生成'}
            </button>
            <button className="btn lg"><Icon.Clock size={14} /> 设为定时任务</button>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>预估调用 {Object.values(models).filter(Boolean).length * count} 次 LLM</span>
          </div>
        </div>
        )}
      </div>

      {/* Results */}
      <div className="card">
        <div className="card-h">
          <Icon.Inbox size={16} />
          <h3>生成结果（待入库）</h3>
          {results && <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>共 {Object.values(results).flat().length} 条 · 已选 {totalPicked}</span>}
          <div className="right">
            <button className="btn sm" onClick={onGen} disabled={generating}><Icon.Refresh size={12} /> 重新生成</button>
            <button className="btn sm"><Icon.Copy size={12} /> 复制</button>
            <button className="btn sm danger"><Icon.Trash size={12} /> 全部丢弃</button>
            <button className="btn sm primary" onClick={onSubmitToLib} disabled={totalPicked === 0}>
              <Icon.Check size={12} /> 选中入标题库 ({totalPicked})
            </button>
          </div>
        </div>
        <div className="card-b">
          {!results && !generating && (
            <div className="empty">
              <div className="ico"><Icon.Sparkle /></div>
              <h3>还没有生成结果</h3>
              <div>选好 Skill 和模型，点”生成”开始。多选模型时结果会分列对比。</div>
            </div>
          )}
          {generating && (
            <div style={{ display:'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {Object.keys(models).filter(m => models[m]).map(m => (
                <div key={m} className="card" style={{ padding: 12 }}>
                  <div className="row"><strong>{m}</strong><span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>流式中…</span></div>
                  <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap: 8 }}>
                    {Array.from({ length: 6 }, (_, i) => <div key={i} className="sk" style={{ height: 14, width: `${60 + Math.random()*30}%` }} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
          {results && (
            <div style={{ display:'grid', gridTemplateColumns: `repeat(${Object.keys(results).length}, 1fr)`, gap: 12 }}>
              {Object.entries(results).map(([model, items]) => {
                const picked = items.filter(x => x.picked).length;
                return (
                  <div key={model} className="card" style={{ padding: 0, background: 'var(--panel-2)' }}>
                    <div style={{ padding: 10, borderBottom: '1px solid var(--line)', display:'flex', alignItems:'center' }}>
                      <strong>{model}</strong>
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{picked}/{items.length} 选中</span>
                      <button className="btn ghost sm" style={{ marginLeft: 'auto' }}
                              onClick={() => setResults(r => ({...r, [model]: r[model].map(x => ({...x, picked: !x.picked}))}))}>
                        全选/全不选
                      </button>
                    </div>
                    <div style={{ padding: 4 }}>
                      {items.map(it => (
                        <label key={it.id} style={{ display:'flex', alignItems:'flex-start', gap: 8, padding: '8px 10px', borderRadius: 5, cursor: 'pointer', background: it.picked ? 'var(--accent-soft)' : 'transparent' }}>
                          <Checkbox checked={it.picked} onChange={() => togglePick(model, it.id)} />
                          <span style={{ flex: 1 }}>{it.text}</span>
                          <span className="muted mono" style={{ fontSize: 11 }}>{it.text.length}字</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal open={skillPreview} onClose={() => setSkillPreview(false)} title={`${skill} · 完整提示词预览`} width={700}
             footer={<button className="btn" onClick={() => setSkillPreview(false)}>关闭</button>}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>这是 Skill 展开后实际发给模型的完整提示词，用于排错</div>
        <div className="code-block">
{`<role>
你是品牌「暖心生活」的标题文案。
品牌定位：保温杯 / 餐具 / 加热垫，主打温馨、家庭、平价。
</role>

<context>
${taskPrompt || '（无任务提示词）'}
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
- 30 块买的保温杯，竟然秒杀星巴克
</good_examples>

<task>
请根据上述风格规则，生成 ${count} 条不重复的标题。
</task>`}
        </div>
      </Modal>

      <Modal open={!!scoreModalRows} onClose={() => setScoreModalRows(null)} title="入库前打爆款分数" width={560}
             footer={<>
               <button className="btn" onClick={() => setScoreModalRows(null)}>取消</button>
               <button className="btn primary" onClick={() => {
                 toast(`已入库 ${scoreModalRows.length} 条标题`, { kind: 'success', action: '已自动出现在标题库筛选最前' });
                 setScoreModalRows(null); setResults(null);
               }}>入库</button>
             </>}>
        {scoreModalRows && (
          <div style={{ display:'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto' }}>
            {scoreModalRows.map((r, i) => (
              <div key={i} className="row" style={{ padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6 }}>
                <span className="muted mono" style={{ fontSize: 11, width: 60 }}>{r.model}</span>
                <span style={{ flex: 1 }}>{r.text}</span>
                <ChipSelect label="分" value={r.score} options={[1,2,3,4,5,6,7,8,9,10,'待评估']} onChange={() => {}} />
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

window.TitlesPage = TitlesPage;
