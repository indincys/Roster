// Mock data for short video ops workbench

window.MOCK = (() => {
  const workspaces = [
    { id: 'wsA', name: '暖心生活', desc: '家居保温杯 / 餐具 / 加热垫', color: 'oklch(0.62 0.13 35)' },
    { id: 'wsB', name: '精致时刻', desc: '女士配饰 / 丝巾 / 耳环', color: 'oklch(0.62 0.13 320)' },
    { id: 'wsC', name: '野趣户外', desc: '露营 / 徒步装备', color: 'oklch(0.55 0.10 145)' },
  ];

  const platforms = ['抖音', '视频号', '小红书', '快手'];

  const accounts = [
    { platform: '抖音', name: '@暖心小张' },
    { platform: '抖音', name: '@暖心严选官方' },
    { platform: '视频号', name: '暖心生活' },
    { platform: '小红书', name: '暖心生活旗舰店' },
    { platform: '快手', name: '暖心严选' },
  ];

  const skus = [
    { code: 'SKU-WB-001', style: '红色经典款', name: '暖心生活 保温杯 500ml 经典款', cat: '保温杯' },
    { code: 'SKU-WB-002', style: '蓝色都市款', name: '暖心生活 保温杯 500ml 都市款', cat: '保温杯' },
    { code: 'SKU-WB-003', style: '大容量款',   name: '暖心生活 保温壶 1L 户外款',   cat: '保温壶' },
    { code: 'SKU-CL-001', style: '红色长袖',   name: '暖心生活 加绒打底衫 红色',     cat: '服饰' },
    { code: 'SKU-CL-002', style: '黑色短袖',   name: '暖心生活 速干短袖 黑色',       cat: '服饰' },
    { code: 'SKU-MT-001', style: '加热款',     name: '暖心生活 智能加热垫',         cat: '加热垫' },
  ];

  const titles = [
    { text: '冬日暖心保温杯，宝妈通勤必备',          score: 9, used: 32, used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-04-21' },
    { text: '你妈再也不用念叨多喝热水了',              score: 8, used: 21, used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-04-21' },
    { text: '这杯子让我老婆直接说真香',                score: 7, used: 18, used_state: '已使用', from: 'title_general v1.3',        date: '2026-04-23' },
    { text: '保温 12 小时，办公室一杯到下班',          score: 9, used: 29, used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-04-25' },
    { text: '30 块买的保温杯，竟然秒杀星巴克',         score: 9, used: 16, used_state: '已使用', from: 'title_general v1.3',        date: '2026-04-25' },
    { text: '打工人的第二个胃，全靠它',                score: 8, used: 12, used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-04-27' },
    { text: '露营带它，温度比心情还稳',                score: 7, used: 5,  used_state: '待评估', from: 'title_general v1.3',        date: '2026-05-01' },
    { text: '一杯热水暖整个冬天',                      score: 8, used: 9,  used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-05-02' },
    { text: '宝妈实测：装热汤都不烫手',                score: 6, used: 0,  used_state: '未使用', from: 'title_general v1.3',        date: '2026-05-03' },
    { text: '北方冬天上班人手一只',                    score: 7, used: 0,  used_state: '未使用', from: 'title_brand_warmlife v1.2', date: '2026-05-04' },
    { text: '出差也能喝到家里那口热水',                score: null, used: 0, used_state: '待评估', from: 'title_general v1.3',      date: '2026-05-06' },
    { text: '一手哄娃一手保温杯，宝妈日常',             score: 8, used: 4, used_state: '已使用', from: 'title_brand_warmlife v1.2', date: '2026-05-06' },
  ];

  const tags = ['#保温杯','#冬日好物','#宝妈必备','#办公室生活','#露营装备','#平价好物','#送女友','#送妈妈','#通勤必备','#真香现场'];

  const prompts = [
    { id: 'p1', text: '雪山日出，蒸汽袅袅升起的红色保温杯放在岩石上，背景是粉色的天空，电影感画面', scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 8, kept: 6, rate: 0.75, status: '优质' },
    { id: 'p2', text: '晨跑女孩戴着白色手套握着保温杯，城市公园背景，柔和光线，治愈感',                  scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 4, kept: 2, rate: 0.50, status: '-' },
    { id: 'p3', text: '办公室桌面，电脑旁边的红色保温杯，文件、键盘、绿植散落，俯拍视角，温暖',           scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 0, kept: 0, rate: null, status: '草稿' },
    { id: 'p4', text: '厨房窗台，蒸汽弥漫，冬日清晨，红色保温杯特写，景深虚化背景',                       scene: '主图素材', skill: 'image_main_general v2.0',         generated: 12, kept: 1, rate: 0.08, status: '反面' },
    { id: 'p5', text: '直播间桌上摆 3 只不同色保温杯，柔光，主播手部入镜',                                scene: '直播封面', skill: 'image_main_brand_warmlife v1.0', generated: 8, kept: 5, rate: 0.63, status: '优质' },
    { id: 'p6', text: '露营帐篷前的木桌上放着保温杯，夜晚营地灯泡光，杯口冒热气',                         scene: '主图素材', skill: 'image_main_general v2.0',         generated: 10, kept: 7, rate: 0.70, status: '优质' },
    { id: 'p7', text: '宝妈在儿童房窗边给孩子倒热水，画面温馨，逆光柔和',                                scene: '视频封面', skill: 'image_main_brand_warmlife v1.0', generated: 4, kept: 3, rate: 0.75, status: '优质' },
    { id: 'p8', text: '咖啡馆窗边，红色保温杯与笔电、笔记本一起，秋季氛围',                              scene: '主图素材', skill: 'image_main_general v2.0',         generated: 6, kept: 0, rate: 0.00, status: '反面' },
  ];

  const skills = {
    title: [
      { id:'sk1', name:'title_general',                version:'v1.3', kind:'official', type:'title', desc:'通用版标题生成 Skill' },
      { id:'sk2', name:'title_brand_warmlife',         version:'v1.2', kind:'fork',     type:'title', desc:'品牌 A 暖心生活定制版', parent:'title_general@v1.0' },
      { id:'sk3', name:'title_brand_jingzhi',          version:'v1.0', kind:'fork',     type:'title', desc:'品牌 B 精致时刻定制版' },
      { id:'sk4', name:'title_live_general',           version:'v1.0', kind:'official', type:'title', desc:'直播标题专用' },
      { id:'sk5', name:'title_warmlife_holiday',       version:'v0.4', kind:'self',     type:'title', desc:'节日营销标题' },
    ],
    image: [
      { id:'sk6', name:'image_main_general',           version:'v2.0', kind:'official', type:'image', desc:'通用主图提示词' },
      { id:'sk7', name:'image_main_brand_warmlife',    version:'v1.0', kind:'fork',     type:'image', desc:'品牌 A 主图提示词' },
      { id:'sk8', name:'image_cover_video',            version:'v1.1', kind:'official', type:'image', desc:'视频封面提示词' },
      { id:'sk9', name:'image_lifestyle',              version:'v1.2', kind:'self',     type:'image', desc:'生活场景图自建' },
    ],
    script: [
      { id:'sk10', name:'script_oral_general',         version:'v1.0', kind:'official', type:'script', desc:'通用口播脚本' },
      { id:'sk11', name:'script_oral_brand_warmlife',  version:'v0.6', kind:'fork',     type:'script', desc:'品牌 A 口播脚本' },
      { id:'sk12', name:'script_unboxing',             version:'v1.0', kind:'self',     type:'script', desc:'开箱体验脚本' },
    ],
  };

  const market = [
    { name:'标题通用版',  v:'v1.3', type:'title',  match:'通用',   installed:true,  upd:'v1.4', desc:'适合各品类的标题文案 Skill' },
    { name:'主图通用版',  v:'v2.0', type:'image',  match:'电商',   installed:false, desc:'电商主图提示词，覆盖白底 / 场景 / 特写'},
    { name:'直播标题版',  v:'v1.0', type:'title',  match:'直播',   installed:false, desc:'直播间封面标题，强 CTA 倾向' },
    { name:'口播通用版',  v:'v1.0', type:'script', match:'通用',   installed:true,  desc:'30 秒以内口播脚本 Skill' },
    { name:'生活方式版',  v:'v1.2', type:'image',  match:'生活',   installed:false, desc:'生活场景化构图，适合家居 / 美食' },
    { name:'促销标题版',  v:'v0.9', type:'title',  match:'促销',   installed:false, desc:'大促 / 折扣场景的标题，beta' },
    { name:'封面 Hook 版',  v:'v1.1', type:'image',  match:'封面',   installed:false, desc:'强吸睛视频封面提示词' },
    { name:'测评脚本版',  v:'v1.0', type:'script', match:'测评',   installed:false, desc:'横向测评 / 对比类口播' },
  ];

  // Build a videos library
  const videos = (() => {
    const list = [];
    let idx = 0;
    skus.forEach(sku => {
      const styles = ['style_a', 'style_b', 'style_c', 'style_d'];
      styles.forEach((s, i) => {
        idx += 1;
        const has_cover = !(idx % 5 === 0 || idx % 7 === 0);
        const states = ['待发布','已发布','已发布','待发布','使用中'];
        list.push({
          id: `v${idx}`,
          sku: sku.code,
          style: sku.style,
          name: `${s}.mp4`,
          path: `D:\\OneDrive\\品牌A\\videos\\${sku.code}\\${s}.mp4`,
          size_mb: (8 + (idx % 9) * 1.7).toFixed(1),
          duration: 15 + (idx % 6) * 3,
          state: states[idx % states.length],
          has_cover,
          added: `2026-04-${String(((idx % 25) + 1)).padStart(2,'0')}`,
        });
      });
    });
    return list;
  })();

  // Build today's task list
  const tasks = (() => {
    const list = [];
    const useSkus = skus.slice(0, 5);
    const useTitles = titles.slice(0, 5);
    const accs = [
      { platform:'抖音',   name:'@暖心小张' },
      { platform:'视频号', name:'暖心生活' },
      { platform:'小红书', name:'暖心生活旗舰店' },
      { platform:'快手',   name:'暖心严选' },
    ];
    const anchors = ['09:08','09:11','09:14','09:18','12:03','12:07','12:14','12:21','15:02','15:09','15:13','15:21','18:04','18:11','18:18','18:24','21:02','21:07','21:14','21:19'];
    let i = 0;
    for (let v = 0; v < 5; v++) {
      const sku = useSkus[v];
      const title = useTitles[v];
      accs.forEach(a => {
        i += 1;
        const id = `T20260507-${String(i).padStart(3,'0')}`;
        const status = i === 4 ? '失败' : i <= 8 ? (i % 3 === 0 ? '成功' : i % 3 === 1 ? '成功' : '执行中') : '待执行';
        const err = status === '失败' ? '账号风控：抖音 - 视频审核未通过' : null;
        const exec_time = (status === '成功' || status === '失败') ? `2026-05-07 ${anchors[i-1]}:${String(20 + i).padStart(2,'0')}` : null;
        list.push({
          id, time: anchors[i-1], platform: a.platform, account: a.name,
          sku: sku.code, style: sku.style, product: sku.name,
          video_file: `style_${'abcde'[v]}.mp4`,
          video_path: `D:\\OneDrive\\品牌A\\videos\\${sku.code}\\style_${'abcde'[v]}.mp4`,
          cover_path: `D:\\OneDrive\\品牌A\\covers\\${sku.code}\\style_${'abcde'[v]}__3x4.jpg`,
          title: title.text, tags: ['#保温杯','#冬日好物','#宝妈必备','#平价好物','#送妈妈'],
          status, err, exec_time,
        });
      });
    }
    return list;
  })();

  const schedules = [
    { id:1, status:'green', name:'生成今日任务单',        type:'任务单生成', cron:'每天 23:00', next:'今晚 23:00',     last:'昨日 23:00 · 成功' },
    { id:2, status:'green', name:'生成 50 条新标题',     type:'标题生成',   cron:'每天 08:00', next:'明天 08:00',     last:'今早 08:00 · 成功' },
    { id:3, status:'yellow',name:'主图素材定时生成',    type:'图片生成',   cron:'每周一 09:00', next:'暂停中',        last:'05-04 · 成功' },
    { id:4, status:'red',   name:'视频文案生成',        type:'文案生成',   cron:'每天 10:00', next:'执行失败',       last:'今早 10:00 · 失败 · API 超时' },
    { id:5, status:'green', name:'封面定时清洗',        type:'封面整理',   cron:'每周日 22:00', next:'2026-05-10 22:00', last:'05-03 · 成功' },
    { id:6, status:'green', name:'生成 30 条直播标题',  type:'标题生成',   cron:'每周三 09:00', next:'2026-05-13 09:00', last:'2026-05-06 · 成功' },
  ];

  return { workspaces, platforms, accounts, skus, titles, tags, prompts, skills, market, videos, tasks, schedules };
})();
