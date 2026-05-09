/* Mock data for pillar content production workbench */
const SKUs = [
  { code: 'SKU-WB-001', style: '红色经典款', cat: '保温杯' },
  { code: 'SKU-WB-002', style: '粉色少女款', cat: '保温杯' },
  { code: 'SKU-WB-003', style: '蓝色商务款', cat: '保温杯' },
  { code: 'SKU-CL-001', style: '红色加绒打底', cat: '冬装' },
  { code: 'SKU-CL-002', style: '驼色羊毛大衣', cat: '冬装' },
  { code: 'SKU-HP-001', style: '电热饭盒', cat: '加热垫' },
  { code: 'SKU-HP-002', style: '远红外加热垫', cat: '加热垫' },
];

const STYLES_OF = (sku) => SKUs.find(s => s.code === sku)?.style || '默认款';

function makeVideos() {
  const out = [];
  let id = 1;
  SKUs.forEach((s, si) => {
    const n = [22, 18, 14, 24, 16, 20, 28][si];
    for (let i = 0; i < n; i++) {
      const has = (si * 3 + i) % 5 < 2;
      out.push({
        id: 'v' + (id++),
        sku: s.code, style: s.style,
        name: `${s.code.toLowerCase().replace('-','_')}_${(i+1).toString().padStart(3,'0')}.mp4`,
        path: `/Users/cici/contents/warmlife/videos/${s.code}/${(i+1).toString().padStart(3,'0')}.mp4`,
        size_mb: 12 + (i % 9) * 4 + (si % 3),
        duration: 14 + (i % 23),
        has_cover: has,
        state: has ? (i % 4 === 0 ? '已发布' : (i % 3 === 0 ? '使用中' : '待发布')) : '待发布',
        added: `2026-04-${(20 + (i % 12)).toString().padStart(2, '0')} ${(8 + i % 10)}:${((i*7) % 60).toString().padStart(2,'0')}`,
      });
    }
  });
  return out;
}

const TITLES = [
  { text: '冬日暖心保温杯，宝妈通勤必备', score: 9, used: 12, used_state: '已使用',  date: '2026-04-22', from: 'title_brand_warmlife v1.2' },
  { text: '保温 12 小时，办公室一杯到下班', score: 9, used: 8,  used_state: '已使用',  date: '2026-04-22', from: 'title_brand_warmlife v1.2' },
  { text: '你妈再不用念叨多喝热水了',           score: 8, used: 5,  used_state: '已使用',  date: '2026-04-23', from: 'title_brand_warmlife v1.2' },
  { text: '一杯热水暖整个冬天',                  score: 8, used: 3,  used_state: '已使用',  date: '2026-04-23', from: 'title_brand_warmlife v1.1' },
  { text: '一手哄娃一手保温杯，宝妈日常',      score: 8, used: 0,  used_state: '未使用',  date: '2026-05-01', from: 'title_brand_warmlife v1.2' },
  { text: '北方冬天上班人手一只',                score: 7, used: 0,  used_state: '未使用',  date: '2026-05-01', from: 'title_brand_warmlife v1.2' },
  { text: '出差也能喝到家里那口热水',           score: 7, used: 0,  used_state: '未使用',  date: '2026-05-02', from: 'title_brand_warmlife v1.2' },
  { text: '宝妈实测：装热汤都不烫手',           score: 7, used: 1,  used_state: '已使用',  date: '2026-05-03', from: 'title_general v0.9' },
  { text: '通勤 1 小时，到办公室还冒热气',      score: 6, used: 0,  used_state: '未使用',  date: '2026-05-03', from: 'title_general v0.9' },
  { text: '红色长款，穿搭小白也能驾驭',        score: 6, used: 2,  used_state: '已使用',  date: '2026-05-04', from: 'title_brand_warmlife v1.2' },
  { text: '通勤包必备，喝水更省事',              score: 5, used: 0,  used_state: '未使用',  date: '2026-05-04', from: 'title_brand_warmlife v1.2' },
  { text: '一杯下肚，整个上午都暖暖',           score: 5, used: 0,  used_state: '未使用',  date: '2026-05-05', from: 'title_brand_warmlife v1.2' },
  { text: '30 块买的保温杯，竟然秒杀星巴克',    score: 4, used: 0,  used_state: '未使用',  date: '2026-05-05', from: 'title_general v0.9' },
  { text: '这杯子让我老婆直接说真香',           score: 3, used: 0,  used_state: '未使用',  date: '2026-05-06', from: 'title_general v0.9' },
  { text: '打工人的第二个胃，全靠它',           score: null, used: 0, used_state: '待评估', date: '2026-05-07', from: 'title_brand_warmlife v1.2' },
  { text: '露营带它，温度比心情还稳',           score: null, used: 0, used_state: '待评估', date: '2026-05-07', from: 'title_brand_warmlife v1.2' },
];

const PROMPTS = [
  { id: 'p1', text: '雪山日出，蒸汽袅袅升起的红色保温杯放在岩石上，背景是粉色的天空，电影感画面', scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 24, kept: 18, rate: 0.75, status: '优质' },
  { id: 'p2', text: '极简白底，红色保温杯居中放置，干净灯光，淘宝主图风',                            scene: '主图素材', skill: 'image_main_general v2.0',      generated: 12, kept: 8,  rate: 0.66, status: '-' },
  { id: 'p3', text: '冬日清晨厨房，蒸汽弥漫，红色保温杯特写，景深虚化背景',                          scene: '视频封面', skill: 'image_cover_video v1.1',       generated: 18, kept: 9,  rate: 0.50, status: '-' },
  { id: 'p4', text: '极简白底，红色保温杯居中放置，硬朗工业风',                                       scene: '主图素材', skill: 'image_main_general v2.0',      generated: 84, kept: 12, rate: 0.14, status: '反面' },
  { id: 'p5', text: '通勤地铁车厢内，年轻女性手握保温杯靠窗，窗外朦胧城市，胶片质感',               scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 16, kept: 14, rate: 0.87, status: '优质' },
  { id: 'p6', text: '幼儿园门口宝妈递保温杯给孩子，秋冬阳光柔和，纪实风格',                          scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 12, kept: 10, rate: 0.83, status: '优质' },
  { id: 'p7', text: '复古胶片风，红色保温杯放在木桌，旁边散落老照片',                                scene: '主图素材', skill: 'image_main_general v2.0',      generated: 56, kept: 9,  rate: 0.16, status: '反面' },
  { id: 'p8', text: '直播间封面，9:16 竖版，红色保温杯特写 + 醒目折扣价',                            scene: '直播封面', skill: 'image_main_brand_warmlife v1.0', generated: 8,  kept: 6,  rate: 0.75, status: '-' },
  { id: 'p9', text: '极简日系，红色保温杯单品摄影，纯白背景，左偏构图',                              scene: '主图素材', skill: 'image_main_general v2.0',      generated: 40, kept: 7,  rate: 0.18, status: '反面' },
  { id: 'p10', text: '办公室桌面俯拍，电脑旁红色保温杯，文件、键盘、绿植散落',                       scene: '主图素材', skill: 'image_main_brand_warmlife v1.0', generated: 0, kept: 0, rate: null, status: '草稿' },
];

const SKILLS = {
  title: [
    { id: 'sk1', name: 'title_brand_warmlife', version: 'v1.2', desc: '暖心生活品牌专用标题，强调家庭、平价、生活化，禁用过度营销词', model: 'Claude Opus', calls: 4280, scope: 'workspace', updated: '2026-04-12', author: 'cici', category: 'title' },
    { id: 'sk2', name: 'title_general',         version: 'v0.9', desc: '通用标题生成器，所有品类可用', model: 'GPT-5', calls: 1840, scope: 'team', updated: '2026-03-08', author: 'mimi' },
    { id: 'sk3', name: 'title_brand_warmlife_funny', version: 'v0.3', desc: '实验：暖心生活搞笑变体',  model: 'Claude Opus', calls: 142, scope: 'workspace', updated: '2026-05-05', author: 'cici' },
  ],
  image_prompt: [
    { id: 'sk4', name: 'image_prompt_lifestyle',     version: 'v1.0', desc: '生活场景主图提示词',      model: 'Claude Opus', calls: 902,  scope: 'workspace', updated: '2026-04-20', author: 'cici' },
    { id: 'sk5', name: 'image_prompt_minimal_white', version: 'v0.7', desc: '极简白底主图提示词',      model: 'GPT-5',       calls: 612,  scope: 'team',      updated: '2026-04-02', author: 'leon' },
  ],
  image_gen: [
    { id: 'sk6', name: 'image_main_brand_warmlife', version: 'v1.0', desc: '暖心生活主图风格生成（GPT Image 2）', model: 'GPT Image 2', calls: 1240, scope: 'workspace', updated: '2026-04-22', author: 'cici' },
    { id: 'sk7', name: 'image_main_general',         version: 'v2.0', desc: '通用主图生成（MJ v7）',                model: 'Midjourney v7', calls: 2810, scope: 'team',      updated: '2026-03-20', author: 'leon' },
    { id: 'sk8', name: 'image_cover_video',           version: 'v1.1', desc: '视频封面专用比例 + 排版',              model: 'GPT Image 2', calls: 540,  scope: 'workspace', updated: '2026-04-30', author: 'cici' },
    { id: 'sk9', name: 'image_lifestyle',             version: 'v1.2', desc: '生活场景拼接素材',                       model: 'Imagen 4',    calls: 320,  scope: 'workspace', updated: '2026-04-15', author: 'cici' },
  ],
  script: [
    { id: 'sk10', name: 'script_oral_brand_warmlife', version: 'v0.6', desc: '暖心生活口播脚本，30s 以内', model: 'Claude Opus', calls: 380, scope: 'workspace', updated: '2026-04-28', author: 'cici' },
    { id: 'sk11', name: 'script_oral_general',         version: 'v1.0', desc: '通用口播脚本',                model: 'GPT-5',       calls: 220, scope: 'team',      updated: '2026-03-30', author: 'mimi' },
  ],
  cover: [
    { id: 'sk12', name: 'cover_lifestyle_warm', version: 'v1.0', desc: '温馨生活类视频取帧建议（LLM-only，不出图）', model: 'Claude Opus', calls: 96, scope: 'workspace', updated: '2026-04-10', author: 'cici' },
  ],
};

window.MOCK = {
  skus: SKUs,
  videos: makeVideos(),
  titles: TITLES,
  prompts: PROMPTS,
  skills: SKILLS,
};
