/* 数据层：本地持久化 / 示例数据 / 工具函数 */
(function () {
  const KEY = 'tea_workbench_v1';

  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const timeKey = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMinutes = (d, n) => new Date(d.getTime() + n * 60000);
  const parseKey = (k) => new Date(`${k}T00:00:00`);
  const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekdayCN = (d = new Date()) => WEEKDAYS[d.getDay()];

  const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const money = (n) => {
    const v = Number(n) || 0;
    return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };
  const minsText = (m) => {
    const v = Math.max(0, Math.round(Number(m) || 0));
    if (v < 60) return `${v} 分`;
    const h = Math.floor(v / 60), mm = v % 60;
    return mm ? `${h} 小时 ${mm} 分` : `${h} 小时`;
  };
  const minsShort = (m) => {
    const v = Math.max(0, Math.round(Number(m) || 0));
    if (v < 60) return `${v}m`;
    return `${Math.floor(v / 60)}h${v % 60 ? ` ${v % 60}m` : ''}`;
  };
  const relDay = (k) => {
    const today = dateKey();
    const diff = Math.round((parseKey(k) - parseKey(today)) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
    const d = parseKey(k);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };
  const fmtDateTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const TONES = ['mint', 'peach', 'lilac', 'butter', 'cocoa', 'sky'];
  const toneFor = (s) => {
    let h = 0;
    for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 997;
    return TONES[h % TONES.length];
  };

  const ACCENTS = {
    caramel: { name: '焦糖', h: 28, s: 42, l: 57 },
    matcha: { name: '抹茶', h: 94, s: 20, l: 52 },
    taro: { name: '芋泥', h: 268, s: 22, l: 64 },
    peach: { name: '蜜桃', h: 13, s: 48, l: 68 },
    cocoa: { name: '可可', h: 18, s: 25, l: 47 }
  };

  const EXPENSE_CATS = [
    { name: '餐饮', color: '#c99a7b' },
    { name: '学习', color: '#a9b79c' },
    { name: '通勤', color: '#a9b7c4' },
    { name: '购物', color: '#c7b09a' },
    { name: '娱乐', color: '#b9a5c1' },
    { name: '房租', color: '#b58f6f' },
    { name: '医疗', color: '#9db8aa' },
    { name: '其他', color: '#b8ada0' }
  ];
  const INCOME_CATS = [
    { name: '工资', color: '#8fa98a' },
    { name: '兼职', color: '#b6a06f' },
    { name: '理财', color: '#9aaec1' },
    { name: '其他', color: '#b3a99c' }
  ];
  const DRINK_CATS = [
    { name: '奶茶', color: '#c49a72', soft: '#f3e3d2' },
    { name: '咖啡', color: '#a9866a', soft: '#ecdfcf' },
    { name: '果茶', color: '#c78f7c', soft: '#f6e2da' },
    { name: '其他', color: '#a5a094', soft: '#ece8de' }
  ];
  function defaultDrinkFields() {
    return [
      { id: 'f_size', label: '杯型', options: ['中杯', '大杯', '超大杯'] },
      { id: 'f_sweet', label: '甜度', options: ['无糖', '三分', '五分', '七分', '全糖'] },
      { id: 'f_ice', label: '冰度', options: ['热饮', '去冰', '少冰', '正常冰'] }
    ];
  }

  const PRIORITIES = {
    high: { name: '高', color: '#c07a6d', soft: '#f6e2dd' },
    mid: { name: '中', color: '#c09a5d', soft: '#f6ecd8' },
    low: { name: '低', color: '#8fa083', soft: '#e8eee2' }
  };
  const PAPER_STATUS = {
    unread: { name: '未读', cls: 'unread' },
    reading: { name: '在读', cls: 'reading' },
    read: { name: '已读', cls: 'read' }
  };

  const catColor = (name) => {
    const all = [...EXPENSE_CATS, ...INCOME_CATS];
    const f = all.find((c) => c.name === name);
    return f ? f.color : '#b8ada0';
  };

  function defaultTemplates() {
    return [
      {
        id: 'tpl_daily', name: '每日复盘', icon: 'moon',
        fields: [
          { label: '今天完成了什么？', type: 'textarea', required: true, hint: '写两三件具体的小事就好' },
          { label: '今日专注时长（分钟）', type: 'number', required: true },
          { label: '今天状态满意吗？', type: 'checkbox', required: true, hint: '确认后再关闭弹窗' },
          { label: '明天最重要的一件事', type: 'textarea', required: true }
        ]
      },
      {
        id: 'tpl_week', name: '周计划', icon: 'calendar',
        fields: [
          { label: '本周最重要的目标', type: 'textarea', required: true },
          { label: '需要推进的三件事', type: 'textarea', required: true },
          { label: '预判的风险与调整', type: 'textarea', required: false }
        ]
      },
      {
        id: 'tpl_budget', name: '月度支出核对', icon: 'wallet',
        fields: [
          { label: '本月支出合计（元）', type: 'number', required: true },
          { label: '超支或意外的项目', type: 'textarea', required: false },
          { label: '下月调整计划', type: 'textarea', required: true }
        ]
      }
    ];
  }

  function newDB() {
    return {
      version: 1,
      papers: [],
      folders: ['计算机视觉', '自然语言处理', '多模态', '待分类'],
      tasks: [],
      expenses: [],
      drinks: [],
      drinkFields: defaultDrinkFields(),
      focus: [],
      popups: [],
      templates: defaultTemplates(),
      popupHistory: [],
      notifications: [],
      settings: {
        theme: 'light',
        accent: 'caramel',
        workspaceName: '茶歇工作台',
        focusMin: 25,
        breakMin: 5,
        dailyBudget: 120,
        monthlyBudget: 2600,
        notifications: true,
        onboarded: false,
        cloudAutoSync: false
      },
      ui: {
        statOrder: ['tasks', 'focus', 'spend', 'papers'],
        moduleOrder: ['focus', 'expense', 'tasks', 'papers'],
        modulePins: [],
        paperOrder: [],
        notified: {},
        taskOrder: []
      }
    };
  }

  function buildDemo() {
    const db = newDB();
    const now = new Date();
    const today = dateKey(now);
    db.settings.onboarded = true;

    const paper = (i, o) => ({
      id: `p_${i}`, fileName: '', fileType: 'pdf', notes: '',
      createdAt: addDays(now, -i * 3).toISOString(), pinned: false,
      ...o
    });
    db.papers = [
      paper(1, {
        title: 'DETR: End-to-End Object Detection with Transformers',
        author: 'Carion, N. et al.', innovation: '把目标检测转化为集合预测问题，去掉 NMS 等手工组件。',
        folder: '计算机视觉', tags: ['Transformer', '目标检测', '精读'], status: 'reading',
        venue: 'ECCV', year: 2020, doi: '10.1007/978-3-030-58452-8_13', pinned: true
      }),
      paper(2, {
        title: 'Attention Is All You Need',
        author: 'Vaswani, A. et al.', innovation: '仅用注意力机制构建序列模型，奠定大模型基础架构。',
        folder: '自然语言处理', tags: ['Transformer', '基础架构'], status: 'read',
        venue: 'NeurIPS', year: 2017, doi: '10.48550/arXiv.1706.03762'
      }),
      paper(3, {
        title: 'Segment Anything',
        author: 'Kirillov, A. et al.', innovation: '构建十亿级掩码数据与可提示分割模型，实现零样本迁移。',
        folder: '计算机视觉', tags: ['分割', '大模型', '零样本'], status: 'unread',
        venue: 'ICCV', year: 2023, doi: '10.1109/ICCV51070.2023.00371'
      }),
      paper(4, {
        title: 'Deep Residual Learning for Image Recognition',
        author: 'He, K. et al.', innovation: '残差连接让极深网络可训练，成为视觉骨干网络范式。',
        folder: '计算机视觉', tags: ['ResNet', '经典'], status: 'read',
        venue: 'CVPR', year: 2016, doi: '10.1109/CVPR.2016.90'
      }),
      paper(5, {
        title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
        author: 'Wei, J. et al.', innovation: '用中间推理步骤的示例提示，显著提升大模型复杂推理能力。',
        folder: '自然语言处理', tags: ['大模型', '推理', '提示工程'], status: 'reading',
        venue: 'NeurIPS', year: 2022, doi: '10.48550/arXiv.2201.11903'
      }),
      paper(6, {
        title: 'A Survey on Multimodal Large Language Models',
        author: 'Yin, S. et al.', innovation: '系统梳理多模态大模型的架构、训练范式与评测体系。',
        folder: '多模态', tags: ['综述', '多模态', '大模型'], status: 'unread',
        venue: 'arXiv', year: 2024, doi: '10.48550/arXiv.2306.13549'
      })
    ];

    const sub = (id, title, done) => ({ id, title, done: !!done });
    const task = (i, o) => ({
      id: `t_${i}`, done: false, archived: false, repeat: 'none', reminder: '',
      progressMode: 'auto', manualProgress: 0, focusMinutes: 0,
      createdAt: now.toISOString(), pinned: false, subtasks: [], ...o
    });
    db.tasks = [
      task(1, {
        title: '整理《Vision Transformer》精读笔记', priority: 'high', due: today,
        subtasks: [sub('s11', '重读 Method 部分', true), sub('s12', '整理关键公式', false), sub('s13', '写 300 字总结', false)],
        focusMinutes: 50
      }),
      task(2, {
        title: '撰写小论文 Method 章节', priority: 'high', due: dateKey(addDays(now, 2)),
        subtasks: [sub('s21', '列章节提纲', true), sub('s22', '补实验设置', true), sub('s23', '绘制框架图', false), sub('s24', '润色英文', false)],
        focusMinutes: 75
      }),
      task(3, {
        title: '跑消融实验并记录结果', priority: 'mid', due: dateKey(addDays(now, 3)),
        subtasks: [sub('s31', '配置实验脚本', false), sub('s32', '跑 3 组基线', false)],
        focusMinutes: 25
      }),
      task(4, {
        title: '每周组会材料整理', priority: 'mid', repeat: 'weekly', due: dateKey(addDays(now, 1)),
        subtasks: [sub('s41', '汇总本周进展', false), sub('s42', '准备 5 页 slides', false)]
      }),
      task(5, {
        title: '阅读 2 篇推荐论文', priority: 'low', repeat: 'daily', due: today, reminder: '20:00',
        subtasks: [sub('s51', '读第一篇并记笔记', true), sub('s52', '读第二篇并记笔记', false)]
      }),
      task(6, {
        title: '回复审稿意见（第二轮）', priority: 'high', due: dateKey(addDays(now, -1)),
        subtasks: [sub('s61', '逐条拆解意见', true), sub('s62', '撰写 response', false)]
      }),
      task(7, {
        title: '报销差旅费用', priority: 'low', due: dateKey(addDays(now, 5)),
        subtasks: [sub('s71', '整理发票', false), sub('s72', '提交系统', false)]
      }),
      task(8, {
        title: '整理实验数据集', priority: 'mid', done: true, due: dateKey(addDays(now, -2)),
        subtasks: [sub('s81', '清洗数据', true), sub('s82', '划分训练集/验证集', true)]
      })
    ];

    const exp = (i, date, time, amount, category, note, type = 'expense', taskId = '') => ({
      id: `e_${i}`, date, time, amount, category, note, type, taskId,
      createdAt: `${date}T${time}:00`
    });
    db.expenses = [
      exp(1, today, '08:20', 12, '餐饮', '早餐 · 豆浆油条'),
      exp(2, today, '10:10', 22, '餐饮', '拿铁一杯，续命', 'expense', 't_1'),
      exp(3, today, '12:30', 32, '餐饮', '午餐 · 番茄牛腩饭'),
      exp(4, today, '15:05', 6, '学习', '打印文献 3 份', 'expense', 't_2'),
      exp(5, dateKey(addDays(now, -1)), '09:15', 18, '餐饮', '早餐'),
      exp(6, dateKey(addDays(now, -1)), '13:40', 45, '餐饮', '和同学聚餐'),
      exp(7, dateKey(addDays(now, -1)), '19:20', 88, '购物', '护手霜与香薰'),
      exp(8, dateKey(addDays(now, -2)), '08:40', 6, '通勤', '地铁'),
      exp(9, dateKey(addDays(now, -2)), '12:10', 28, '餐饮', '食堂'),
      exp(10, dateKey(addDays(now, -2)), '21:30', 32, '娱乐', '电影票'),
      exp(11, dateKey(addDays(now, -3)), '11:00', 129, '学习', '买了两本参考书'),
      exp(12, dateKey(addDays(now, -4)), '07:50', 6, '通勤', '地铁'),
      exp(13, dateKey(addDays(now, -4)), '18:25', 36, '餐饮', '晚饭'),
      exp(14, dateKey(addDays(now, -5)), '14:20', 58, '医疗', '感冒药与维C'),
      exp(15, dateKey(addDays(now, -6)), '10:30', 24, '餐饮', '咖啡 + 面包'),
      exp(16, dateKey(addDays(now, -6)), '20:15', 66, '娱乐', '和朋友桌游'),
      exp(17, dateKey(addDays(now, -8)), '00:00', 2200, '房租', '本月房租'),
      exp(18, dateKey(addDays(now, -9)), '12:00', 300, '兼职', '周末助教收入', 'income'),
      exp(19, dateKey(addDays(now, -10)), '09:00', 42, '餐饮', '早午餐'),
      exp(20, dateKey(addDays(now, -12)), '16:40', 210, '购物', '换季衬衫')
    ];

    const drink = (i, offset, time, name, category, price, meta) => ({
      id: `d_${i}`, date: dateKey(addDays(now, offset)), time, name, category, price,
      meta: meta || {}, createdAt: now.toISOString()
    });
    db.drinks = [
      drink(1, 0, '09:40', '冰美式', '咖啡', 15, { f_size: '大杯', f_sweet: '无糖', f_ice: '少冰' }),
      drink(2, 0, '15:20', '桂花乌龙奶茶', '奶茶', 16, { f_size: '中杯', f_sweet: '五分', f_ice: '正常冰' }),
      drink(3, -1, '14:10', '生椰拿铁', '咖啡', 19, { f_size: '大杯', f_sweet: '三分', f_ice: '少冰' }),
      drink(4, -2, '16:30', '杨枝甘露', '果茶', 22, { f_size: '大杯', f_sweet: '七分', f_ice: '正常冰' }),
      drink(5, -3, '10:15', '美式咖啡', '咖啡', 12, { f_size: '中杯', f_sweet: '无糖', f_ice: '热饮' }),
      drink(6, -3, '20:40', '茉莉奶绿', '奶茶', 15, { f_size: '中杯', f_sweet: '五分', f_ice: '去冰' }),
      drink(7, -5, '13:50', '芝芝莓莓', '果茶', 26, { f_size: '超大杯', f_sweet: '五分', f_ice: '少冰' }),
      drink(8, -6, '09:05', '燕麦拿铁', '咖啡', 21, { f_size: '大杯', f_sweet: '无糖', f_ice: '热饮' }),
      drink(9, -8, '15:45', '珍珠奶茶', '奶茶', 18, { f_size: '大杯', f_sweet: '七分', f_ice: '正常冰' }),
      drink(10, -9, '11:20', '柠檬气泡水', '其他', 9, { f_size: '中杯', f_sweet: '三分', f_ice: '正常冰' }),
      drink(11, -11, '14:30', '抹茶拿铁', '奶茶', 20, { f_size: '中杯', f_sweet: '三分', f_ice: '热饮' }),
      drink(12, -13, '10:40', '冷萃咖啡', '咖啡', 23, { f_size: '中杯', f_sweet: '无糖', f_ice: '少冰' })
    ];

    const focus = [];
    let fi = 1;
    const pushFocus = (date, hh, mm, minutes, taskId, interruptions) => {
      focus.push({
        id: `f_${fi++}`, date, time: `${pad(hh)}:${pad(mm)}`,
        minutes, taskId: taskId || '', interruptions: interruptions || 0,
        createdAt: `${date}T${pad(hh)}:${pad(mm)}:00`
      });
    };
    pushFocus(today, 9, 10, 25, 't_1', 1);
    pushFocus(today, 10, 40, 30, 't_1', 0);
    pushFocus(today, 14, 5, 25, 't_2', 2);
    pushFocus(today, 16, 20, 25, 't_2', 0);
    let seed = 17;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 1; i <= 69; i++) {
      const day = dateKey(addDays(now, -i));
      const n = Math.floor(rnd() * 4);
      for (let j = 0; j < n; j++) {
        pushFocus(day, 9 + Math.floor(rnd() * 10), Math.floor(rnd() * 12) * 5,
          25, `t_${1 + Math.floor(rnd() * 4)}`, Math.floor(rnd() * 3));
      }
    }
    db.focus = focus;

    db.templates = defaultTemplates();
    db.popups = [{
      id: 'pop_daily', title: '今日复盘 · 睡前十分钟', time: '22:30',
      repeat: 'daily', days: [], templateId: 'tpl_daily',
      enabled: true, lastRun: dateKey(addDays(now, -1)), createdAt: now.toISOString()
    }];
    db.popupHistory = [{
      id: 'ph_1', popupId: 'pop_daily', title: '今日复盘 · 睡前十分钟',
      ts: addDays(now, -1).toISOString(),
      answers: {
        '今天完成了什么？': '整理了两篇文献笔记，跑通一组基线实验。',
        '今日专注时长（分钟）': '95',
        '今天状态满意吗？': true,
        '明天最重要的一件事': '完成 Method 章节提纲。'
      }
    }, {
      id: 'ph_2', popupId: 'pop_daily', title: '今日复盘 · 睡前十分钟',
      ts: addDays(now, -2).toISOString(),
      answers: {
        '今天完成了什么？': '读完了 DETR 的 Method 部分。',
        '今日专注时长（分钟）': '75',
        '今天状态满意吗？': true,
        '明天最重要的一件事': '画出论文框架图。'
      }
    }];

    db.notifications = [{
      id: uid('n'), type: 'focus', title: '专注完成',
      body: '25 分钟专注已完成，起来伸个懒腰吧。',
      ts: addMinutes(now, -35).toISOString(), read: false
    }, {
      id: uid('n'), type: 'due', title: '任务即将到期',
      body: '「撰写小论文 Method 章节」将在 2 天后到期。',
      ts: addMinutes(now, -130).toISOString(), read: false
    }, {
      id: uid('n'), type: 'popup', title: '昨晚的复盘已归档',
      body: '今日复盘记录已保存，可在设置中导出。',
      ts: addDays(now, -1).toISOString(), read: true
    }];

    db.ui.paperOrder = db.papers.map((p) => p.id);
    db.ui.taskOrder = db.tasks.map((t) => t.id);
    return db;
  }

  function normalize(d) {
    const base = newDB();
    if (!d || typeof d !== 'object') return base;
    const out = Object.assign(base, d);
    out.settings = Object.assign(base.settings, d.settings || {});
    if (typeof out.settings.cloudAutoSync !== 'boolean') out.settings.cloudAutoSync = false;
    out.ui = Object.assign(base.ui, d.ui || {});
    ['papers', 'tasks', 'expenses', 'focus', 'popups', 'templates', 'popupHistory', 'notifications']
      .forEach((k) => { if (!Array.isArray(out[k])) out[k] = base[k]; });
    if (!Array.isArray(out.drinks)) out.drinks = [];
    if (!Array.isArray(out.drinkFields) || !out.drinkFields.length) out.drinkFields = defaultDrinkFields();
    if (!out.templates.length) out.templates = defaultTemplates();
    // 兼容旧数据：如果没有 folders，从文献与默认列表推导
    if (!Array.isArray(out.folders)) {
      const set = new Set(base.folders);
      (out.papers || []).forEach((p) => { if (p && p.folder) set.add(p.folder); });
      out.folders = [...set];
    } else if (!out.folders.includes('待分类')) {
      out.folders.push('待分类');
    }
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('读取本地数据失败', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(WB.db));
      return true;
    } catch (e) {
      console.warn('保存本地数据失败', e);
      return false;
    }
  }

  function resetAll() {
    WB.db = newDB();
    save();
  }

  function seedDemo() {
    WB.db = buildDemo();
    save();
  }

  /* ---------- IndexedDB 文件存储 ---------- */
  let idbPromise = null;
  function openFiles() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('当前浏览器不支持 IndexedDB')); return; }
      const req = indexedDB.open('tea_workbench_files', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }
  async function putFile(id, file) {
    try {
      const db = await openFiles();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').put(file, id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('文件存储失败', e);
      return false;
    }
  }
  async function getFile(id) {
    try {
      const db = await openFiles();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const r = tx.objectStore('files').get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    } catch (e) { return null; }
  }
  async function removeFile(id) {
    try {
      const db = await openFiles();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        tx.objectStore('files').delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) { return false; }
  }

  /* ---------- 导出工具 ---------- */
  function download(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function toCSV(rows) {
    return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
  function parseCSV(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (q) {
        if (c === '"') {
          if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
    }
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  }

  window.WB = {
    KEY, util: {
      pad, dateKey, timeKey, addDays, addMinutes, parseKey, weekdayCN,
      uid, esc, money, minsText, minsShort, relDay, fmtDateTime,
      toneFor, catColor, download, toCSV, parseCSV, csvCell
    },
    ACCENTS, EXPENSE_CATS, INCOME_CATS, PRIORITIES, PAPER_STATUS, WEEKDAYS, DRINK_CATS,
    newDB, load, save, resetAll, seedDemo, normalize,
    idb: { putFile, getFile, removeFile, openFiles },
    db: load() || newDB()
  };
})();
