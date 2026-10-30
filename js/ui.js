/* 界面核心：图标、侧栏、右侧常驻区、首页、搜索 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const CH = WBCharts;
  const ico = (name, cls = '') => `<span class="ico ${cls}">${IC.icon(name)}</span>`;
  const esc = U.esc;

  /* ---------- 统计小工具 ---------- */
  function focusOn(date, taskId) {
    return WB.db.focus
      .filter((f) => f.date === date && (!taskId || f.taskId === taskId))
      .reduce((s, f) => s + (Number(f.minutes) || 0), 0);
  }
  function todayFocus() { return focusOn(U.dateKey()); }
  function weekFocus(offset = 0) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += focusOn(U.dateKey(U.addDays(new Date(), offset * 7 - i)));
    return sum;
  }
  function streakDays() {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const d = U.dateKey(U.addDays(new Date(), -i));
      if (focusOn(d) > 0) n++;
      else break;
    }
    return n;
  }
  function todayExpenses() {
    const k = U.dateKey();
    return WB.db.expenses.filter((e) => e.date === k);
  }
  function sumAmount(list, type) {
    return list.filter((e) => e.type === type).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }
  function activeTasks() {
    return WB.db.tasks.filter((t) => !t.done && !t.archived);
  }
  function progressOf(t) {
    if (t.progressMode === 'manual') return Math.max(0, Math.min(100, Number(t.manualProgress) || 0));
    if (t.subtasks && t.subtasks.length) {
      return Math.round((t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100);
    }
    return t.done ? 100 : Math.max(0, Math.min(100, Number(t.manualProgress) || 0));
  }
  function taskById(id) { return WB.db.tasks.find((t) => t.id === id); }
  function paperById(id) { return WB.db.papers.find((p) => p.id === id); }
  function sortedTasks() {
    const order = WB.db.ui.taskOrder || [];
    const list = WB.db.tasks.filter((t) => !t.archived);
    const rank = { high: 0, mid: 1, low: 2 };
    return list.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      const pa = rank[a.priority] ?? 1, pb = rank[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return String(a.due || '').localeCompare(String(b.due || ''));
    });
  }
  function papersSorted() {
    const order = WB.db.ui.paperOrder || [];
    return WB.db.papers.slice().sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }
  function syncOrder() {
    const ids = WB.db.tasks.map((t) => t.id);
    if (!WB.db.ui.taskOrder) WB.db.ui.taskOrder = ids;
  }

  /* ---------- 侧栏 ---------- */
  const NAV = [
    { page: 'home', label: '首页仪表盘', icon: 'home' },
    { page: 'papers', label: '文献存储', icon: 'book' },
    { page: 'pomodoro', label: '番茄钟', icon: 'timer' },
    { page: 'expenses', label: '每日支出', icon: 'wallet' },
    { page: 'drinks', label: '饮品记录', icon: 'coffee' },
    { page: 'stats', label: '数据统计', icon: 'chart' },
    { page: 'settings', label: '设置', icon: 'settings' }
  ];

  function renderNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    nav.innerHTML = NAV.map((n) => `
      <button class="nav-item ${WB.state.page === n.page ? 'active' : ''}" data-act="go" data-page="${n.page}">
        <span class="nav-ico">${IC.icon(n.icon)}</span>
        <span class="nav-name">${n.label}</span>
        ${n.page === 'papers' ? `<span class="nav-tag">${WB.db.papers.filter((p) => p.status !== 'read').length}</span>` : ''}
        ${n.page === 'expenses' && todayExpenses().length ? `<span class="nav-tag">${todayExpenses().length}</span>` : ''}
        ${n.page === 'drinks' && (WB.db.drinks || []).filter((d) => d.date === U.dateKey()).length ? `<span class="nav-tag">${WB.db.drinks.filter((d) => d.date === U.dateKey()).length}</span>` : ''}
      </button>`).join('');
    const foot = document.getElementById('sideFoot');
    if (foot) {
      const wk = weekFocus();
      const goal = 600;
      const pct = Math.min(100, Math.round((wk / goal) * 100));
      const streak = streakDays();
      foot.innerHTML = `
        <div class="sf-title"><span>THIS WEEK</span><span>${weekFocus(-1) ? '↗' : ''}</span></div>
        <div class="sf-row"><span class="sf-num">${wk}</span><span class="sf-unit">分钟专注</span></div>
        <div class="sf-line"><i style="width:${pct}%"></i></div>
        <div class="sf-title" style="margin-top:2px"><span>连续 ${streak} 天</span><span>目标 10h</span></div>`;
    }
  }

  /* ---------- 翻页时钟 ---------- */
  function digitHTML(key, val) {
    return `<span class="digit" data-dkey="${key}" data-value="${val}">
      <span class="d-face d-top"><b>${val}</b></span>
      <span class="d-face d-bottom"><b>${val}</b></span>
    </span>`;
  }
  function setDigit(el, val) {
    if (!el) return;
    if (el.dataset.value === val) return;
    const old = el.dataset.value;
    el.dataset.value = val;
    const top = el.querySelector('.d-top b');
    const bot = el.querySelector('.d-bottom b');
    if (!top || !bot) return;
    if (old === undefined || old === null || old === '') {
      top.textContent = val; bot.textContent = val; return;
    }
    top.textContent = val;
    const ft = document.createElement('span');
    ft.className = 'flap flap-top';
    ft.innerHTML = `<b>${old}</b>`;
    const fb = document.createElement('span');
    fb.className = 'flap flap-bottom';
    fb.innerHTML = `<b>${val}</b>`;
    el.appendChild(ft);
    el.appendChild(fb);
    setTimeout(() => { bot.textContent = val; ft.remove(); }, 190);
    setTimeout(() => { if (fb.parentNode) fb.remove(); }, 400);
  }
  function updateClock(rebuild = false) {
    const d = new Date();
    const use12 = WB.state.clock12;
    let h = d.getHours();
    if (use12) h = h % 12 || 12;
    const hh = U.pad(h), mm = U.pad(d.getMinutes()), ss = U.pad(d.getSeconds());
    if (rebuild) {
      const box = document.getElementById('flipClock');
      if (box) {
        box.innerHTML = `
          <div class="digit-group">${digitHTML('h1', hh[0])}${digitHTML('h2', hh[1])}</div>
          <span class="clock-colon">:</span>
          <div class="digit-group">${digitHTML('m1', mm[0])}${digitHTML('m2', mm[1])}</div>
          <span class="clock-colon">:</span>
          <div class="digit-group">${digitHTML('s1', ss[0])}${digitHTML('s2', ss[1])}</div>`;
      }
    } else {
      const box = document.getElementById('flipClock');
      if (!box) return;
      const map = { h1: hh[0], h2: hh[1], m1: mm[0], m2: mm[1], s1: ss[0], s2: ss[1] };
      Object.keys(map).forEach((k) => setDigit(box.querySelector(`[data-dkey="${k}"]`), map[k]));
    }
    const dateEl = document.getElementById('clockDate');
    if (dateEl) dateEl.textContent = `${d.getFullYear()}.${U.pad(d.getMonth() + 1)}.${U.pad(d.getDate())} · ${U.weekdayCN(d)}`;
    const ampm = document.getElementById('clockAmpm');
    if (ampm) ampm.textContent = use12 ? (d.getHours() < 12 ? 'AM' : 'PM') : '24H';
  }

  /* ---------- 右侧常驻区 ---------- */
  function renderRail() {
    const rail = document.getElementById('rail');
    if (!rail) return;
    const now = new Date();
    const tf = todayFocus();
    const tExp = sumAmount(todayExpenses(), 'expense');
    const pend = activeTasks().filter((t) => !t.archived);
    const dueToday = pend.filter((t) => t.due === U.dateKey()).length;

    rail.innerHTML = `
      <div class="clock-card">
        <div class="clock-top">
          <div>
            <div class="ct-label">LOCAL TIME</div>
            <div class="ct-date" id="clockDate"></div>
          </div>
          <div class="clock-controls">
            <button class="clock-btn" data-act="clock12" title="切换 12/24 小时">${IC.icon('repeat')}</button>
            <button class="clock-btn" data-act="go" data-page="pomodoro" title="去专注">${IC.icon('timer')}</button>
          </div>
        </div>
        <div class="flip-clock" id="flipClock"></div>
        <div class="clock-bottom">
          <span class="cb-left"><i class="cb-dot"></i> 时间正在流淌</span>
          <span class="clock-sec" id="clockAmpm">24H</span>
        </div>
      </div>

      <div class="rail-card overview-card">
        <div class="ov-top">
          <div class="ov-date">
            <span class="d1">${now.getMonth() + 1}月${now.getDate()}日</span>
            <span class="d2">${U.weekdayCN(now)} · ${now.getFullYear()}</span>
          </div>
          <span class="ov-weather">${IC.icon('leaf')} 宜专注</span>
        </div>
        <div class="ov-list">
          <button class="ov-row" data-act="go" data-page="home">
            <span class="ov-ico">${IC.icon('flag')}</span>
            <span class="ov-label">今日待办</span>
            <span class="ov-val">${pend.length}<small>项 · 今天到期 ${dueToday}</small></span>
          </button>
          <button class="ov-row" data-act="go" data-page="pomodoro">
            <span class="ov-ico">${IC.icon('timer')}</span>
            <span class="ov-label">今日专注</span>
            <span class="ov-val accent">${tf}<small>分钟</small></span>
          </button>
          <button class="ov-row" data-act="go" data-page="expenses">
            <span class="ov-ico">${IC.icon('wallet')}</span>
            <span class="ov-label">今日支出</span>
            <span class="ov-val">¥${U.money(tExp)}</span>
          </button>
        </div>
      </div>

      <div class="rail-card tasks-card">
        <div class="rail-head">
          <h3>任务栏 · ${pend.length}</h3>
          <div class="flex gap-4">
            <button class="link" data-act="go" data-page="home">概览 ${IC.icon('chevronRight')}</button>
            <button class="task-add" data-act="newTask" title="新建任务">${IC.icon('plus')}</button>
          </div>
        </div>
        ${tasksCardHTML(pend)}
        <form class="task-quick-add" id="railQuickForm">
          <span style="color:var(--muted)">${IC.icon('plus')}</span>
          <input id="railQuickInput" placeholder="快速添加一个任务，回车保存" autocomplete="off">
          <button type="submit" title="添加">${IC.icon('arrowRight')}</button>
        </form>
      </div>`;

    updateClock(true);
    const quick = document.getElementById('railQuickForm');
    if (quick) {
      quick.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('railQuickInput');
        const title = input.value.trim();
        if (!title) return;
        const t = {
          id: U.uid('t'), title, priority: 'mid', due: U.dateKey(), repeat: 'none',
          reminder: '', progressMode: 'auto', manualProgress: 0, focusMinutes: 0,
          subtasks: [], done: false, archived: false, createdAt: new Date().toISOString()
        };
        WB.db.tasks.unshift(t);
        WB.db.ui.taskOrder.unshift(t.id);
        WB.save();
        WB.UI.renderAll();
        WB.toast('任务已加入今天', 'check');
        const ni = document.getElementById('railQuickInput');
        if (ni) ni.focus();
      });
    }
  }

  function tasksCardHTML(list) {
    if (!list.length) {
      return `<div class="task-empty">
        <div class="te-art">${IC.icon('coffee')}</div>
        今天还没有进行中的任务。<br>给自己安排一件小事，慢慢开始。
      </div>`;
    }
    return `<div class="task-list">${list.slice(0, 8).map((t) => {
      const p = progressOf(t);
      const pr = WB.PRIORITIES[t.priority] || WB.PRIORITIES.mid;
      const overdue = t.due && t.due < U.dateKey();
      return `<div class="task-row ${t.done ? 'done' : ''}" data-act="openTask" data-id="${t.id}">
        <button class="checkbox" data-act="toggleTask" data-id="${t.id}" aria-label="完成">${IC.icon('check')}</button>
        <div class="task-main">
          <div class="task-title-line">
            <span class="task-flag" style="background:${pr.color}"></span>
            <span class="task-title">${esc(t.title)}</span>
          </div>
          <div class="task-meta">
            <span style="color:${pr.color}">${pr.name}优先</span>
            ${t.due ? `<span class="due ${overdue ? 'overdue' : ''}">${IC.icon('calendar')}${overdue ? U.relDay(t.due) : U.relDay(t.due)}</span>` : ''}
            ${t.repeat && t.repeat !== 'none' ? `<span class="repeat-ico" title="重复任务">${IC.icon('repeat')}</span>` : ''}
            ${t.focusMinutes ? `<span>· ${U.minsShort(t.focusMinutes)} 投入</span>` : ''}
          </div>
          <div class="task-progress">
            <span class="bar"><i style="width:${p}%;background:${p >= 100 ? 'var(--good)' : 'var(--accent)'}"></i></span>
            <span class="pct ${p >= 100 ? 'full' : ''}">${p}%</span>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
  }

  /* ---------- 首页 ---------- */
  const STAT_META = {
    tasks: { icon: 'flag', kind: '', label: '今日待办', href: 'home' },
    focus: { icon: 'timer', kind: 'timer', label: '专注时长', href: 'pomodoro' },
    spend: { icon: 'wallet', kind: 'wallet', label: '今日支出', href: 'expenses' },
    papers: { icon: 'book', kind: 'book', label: '待读文献', href: 'papers' }
  };

  function statCardsHTML() {
    const order = (WB.db.ui.statOrder && WB.db.ui.statOrder.length) ? WB.db.ui.statOrder : Object.keys(STAT_META);
    const active = activeTasks();
    const dueToday = active.filter((t) => t.due === U.dateKey()).length;
    const tf = todayFocus();
    const spent = sumAmount(todayExpenses(), 'expense');
    const dailyBudget = Number(WB.db.settings.dailyBudget) || 0;
    const unread = WB.db.papers.filter((p) => p.status !== 'read').length;
    const reading = WB.db.papers.filter((p) => p.status === 'reading').length;
    const values = {
      tasks: {
        value: active.length, unit: '项', badge: dueToday ? `${dueToday} 项今天到期` : '按节奏来',
        foot: active.filter((t) => t.priority === 'high').length ? `${active.filter((t) => t.priority === 'high').length} 件高优先` : '没有高优先事项',
        kind: ''
      },
      focus: {
        value: Math.round(tf), unit: '分钟', badge: `目标 120 分`,
        foot: `本周 ${U.minsShort(weekFocus())} · 连续 ${streakDays()} 天`,
        kind: ''
      },
      spend: {
        value: U.money(spent), unit: '元', badge: dailyBudget ? `预算 ¥${U.money(dailyBudget)}` : '未设预算',
        foot: dailyBudget && spent > dailyBudget ? '已超出今日预算' : dailyBudget ? `剩余 ¥${U.money(Math.max(0, dailyBudget - spent))}` : '记一笔，心里有数',
        kind: spent > dailyBudget ? 'bad' : ''
      },
      papers: {
        value: unread, unit: '篇', badge: `在读 ${reading}`,
        foot: `共 ${WB.db.papers.length} 篇 · ${WB.db.papers.filter((p) => p.status === 'read').length} 篇已读`,
        kind: 'book'
      }
    };
    return order.filter((k) => STAT_META[k]).map((k) => {
      const m = STAT_META[k], v = values[k];
      return `<button class="stat-card" draggable="true" data-drag="stat" data-key="${k}" data-act="go" data-page="${m.href}">
        <div class="sc-top">
          <span class="sc-ico" data-kind="${m.kind}">${IC.icon(m.icon)}</span>
          <span class="sc-badge">${v.badge}</span>
        </div>
        <div class="sc-value">${v.value}<small>${v.unit}</small></div>
        <div class="sc-foot"><span style="${v.kind === 'bad' ? 'color:var(--bad)' : ''}">${v.foot}</span>
          <span class="arrow">${IC.icon('arrowUpRight')}</span>
        </div>
      </button>`;
    }).join('');
  }

  function modulesHTML() {
    const order = (WB.db.ui.moduleOrder && WB.db.ui.moduleOrder.length) ? WB.db.ui.moduleOrder : ['focus', 'expense', 'tasks', 'papers'];
    const pins = WB.db.ui.modulePins || [];
    const sorted = order.slice().sort((a, b) => (pins.includes(b) ? 1 : 0) - (pins.includes(a) ? 1 : 0));
    return sorted.map((key) => moduleHTML(key, pins.includes(key))).join('');
  }

  function moduleHTML(key, pinned) {
    const pinBtn = `<button class="pin-btn ${pinned ? 'on' : ''}" data-act="pinModule" data-key="${key}" title="${pinned ? '取消置顶' : '置顶'}">${IC.icon('pin')}</button>`;
    if (key === 'focus') {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const d = U.addDays(new Date(), -i);
        data.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: focusOn(U.dateKey(d)) });
      }
      const wk = weekFocus(), prev = weekFocus(-1);
      const delta = prev ? Math.round(((wk - prev) / prev) * 100) : (wk ? 100 : 0);
      const insight = prev ? `${delta >= 0 ? '比上周多' : '比上周少'} ${Math.abs(delta)}%` : '本周刚刚开始';
      return `<div class="dash-module ${pinned ? 'pinned' : ''}" draggable="true" data-drag="module" data-key="focus">
        <div class="dm-head">
          <div class="dm-title"><h3>专注趋势</h3><span class="sub">最近 7 天</span></div>
          <div class="flex gap-4"><span class="dm-insight">${insight}</span>${pinBtn}</div>
        </div>
        <div class="dm-body">${CH.barChart({ data, height: 168, yFmt: (v) => Math.round(v) + 'm', aria: '近七天专注时长' })}</div>
        <div class="dm-foot"><span>本周累计 ${U.minsText(wk)}</span><button class="card-link" data-act="go" data-page="stats">完整统计 ${IC.icon('chevronRight')}</button></div>
      </div>`;
    }
    if (key === 'expense') {
      const items = {};
      todayExpenses().filter((e) => e.type === 'expense').forEach((e) => {
        items[e.category] = (items[e.category] || 0) + Number(e.amount || 0);
      });
      const arr = Object.keys(items).map((k) => ({ label: k, value: items[k], color: U.catColor(k) }))
        .sort((a, b) => b.value - a.value);
      const total = arr.reduce((s, d) => s + d.value, 0);
      return `<div class="dash-module ${pinned ? 'pinned' : ''}" draggable="true" data-drag="module" data-key="expense">
        <div class="dm-head">
          <div class="dm-title"><h3>今日支出</h3><span class="sub">按类别</span></div>
          <div class="flex gap-4">${pinBtn}</div>
        </div>
        <div class="dm-body">
          ${total ? `<div class="donut-wrap">
            <div style="width:45%;max-width:140px;flex:none">${CH.donutChart({ items: arr, size: 150, thickness: 18, centerLabel: '今日合计', centerValue: '¥' + U.money(total) })}</div>
            <div class="chart-legend">${arr.slice(0, 4).map((d) => `<span class="lg"><i style="background:${d.color}"></i>${esc(d.label)} <b>¥${U.money(d.value)}</b></span>`).join('')}</div>
          </div>` : `<div class="chart-empty">${IC.icon('wallet')}还没有今天的支出记录<br><button class="card-link" data-act="go" data-page="expenses">去记一笔 ${IC.icon('chevronRight')}</button></div>`}
        </div>
        <div class="dm-foot"><span>${todayExpenses().length} 笔记录</span><button class="card-link" data-act="go" data-page="expenses">查看明细 ${IC.icon('chevronRight')}</button></div>
      </div>`;
    }
    if (key === 'tasks') {
      const list = activeTasks().slice()
        .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 4);
      return `<div class="dash-module ${pinned ? 'pinned' : ''}" draggable="true" data-drag="module" data-key="tasks">
        <div class="dm-head">
          <div class="dm-title"><h3>今日任务</h3><span class="sub">${activeTasks().length} 项进行中</span></div>
          <div class="flex gap-4">${pinBtn}</div>
        </div>
        <div class="dm-body">
          ${list.length ? `<div class="mini-task-list">${list.map((t) => {
            const pr = WB.PRIORITIES[t.priority] || WB.PRIORITIES.mid;
            return `<div class="mini-task" data-act="openTask" data-id="${t.id}">
              <span class="mt-dot" style="background:${pr.color}"></span>
              <span class="mt-name">${esc(t.title)}</span>
              <span class="mt-due" style="${t.due < U.dateKey() ? 'color:var(--bad)' : ''}">${t.due ? U.relDay(t.due) : '无期限'}</span>
              <span class="mt-pct">${progressOf(t)}%</span>
            </div>`;
          }).join('')}</div>` : `<div class="chart-empty">${IC.icon('check')}今天还没有任务<br><button class="card-link" data-act="newTask">新建一个 ${IC.icon('chevronRight')}</button></div>`}
        </div>
        <div class="dm-foot"><span>点击任务查看子任务与专注投入</span><button class="card-link" data-act="newTask">新建 ${IC.icon('plus')}</button></div>
      </div>`;
    }
    const list = papersSorted().filter((p) => p.status !== 'read').slice(0, 3);
    return `<div class="dash-module ${pinned ? 'pinned' : ''}" draggable="true" data-drag="module" data-key="papers">
      <div class="dm-head">
        <div class="dm-title"><h3>最近文献</h3><span class="sub">待读与在读</span></div>
        <div class="flex gap-4">${pinBtn}</div>
      </div>
      <div class="dm-body">
        ${list.length ? `<div class="mini-paper-list">${list.map((p) => `
          <div class="mini-paper" data-act="openPaper" data-id="${p.id}">
            <span class="mp-ico">${IC.icon('file')}</span>
            <div class="mp-body">
              <div class="mp-title">${esc(p.title)}</div>
              <div class="mp-meta"><span>${esc(p.author)}</span><span>·</span><span>${esc(p.venue || '')} ${p.year || ''}</span></div>
            </div>
          </div>`).join('')}</div>` : `<div class="chart-empty">${IC.icon('book')}所有文献都读完啦<br><button class="card-link" data-act="go" data-page="papers">管理文献 ${IC.icon('chevronRight')}</button></div>`}
      </div>
      <div class="dm-foot"><span>${WB.db.papers.length} 篇收藏 · ${WB.db.papers.filter((p) => p.status === 'read').length} 篇已读</span><button class="card-link" data-act="go" data-page="papers">文献库 ${IC.icon('chevronRight')}</button></div>
    </div>`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return '夜深了';
    if (h < 11) return '早安';
    if (h < 14) return '午安';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  function renderHome() {
    const now = new Date();
    const tf = todayFocus();
    const doneToday = WB.db.tasks.filter((t) => t.done).length;
    const focusGoalPct = Math.min(100, Math.round((tf / 120) * 100));
    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>MY DESK · 个人工作台</span>
          <h1 class="page-title">${greeting()}，柚子。<br>今天也要慢慢来。</h1>
          <div class="home-date-line">
            <span>${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日</span>
            <span class="sep"></span>
            <span class="weather">${IC.icon('leaf')} 已专注 ${U.minsText(tf)} · 目标完成 ${focusGoalPct}%</span>
            <span class="sep"></span>
            <span>${doneToday} 件已完成</span>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-act="shortcuts">${IC.icon('keyboard')} 快捷键</button>
          <button class="btn btn-primary" data-act="newTask">${IC.icon('plus')} 新建任务</button>
        </div>
      </div>
      <div class="stat-grid">${statCardsHTML()}</div>
      <div class="section-title"><h2>数据速览</h2><span class="line"></span><span class="drag-hint">${IC.icon('grid')} 可拖拽排序 · 置顶</span></div>
      <div class="dash-grid">${modulesHTML()}</div>
      <div class="section-title"><h2>近 7 天记录</h2><span class="line"></span><span class="sub">专注与支出 · 一眼看过一周</span></div>
      <div class="grid-2">
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>专注耗时</h3><span class="sub">分钟 / 天</span></div><button class="card-link" data-act="go" data-page="stats">详情 ${IC.icon('chevronRight')}</button></div>
          ${CH.barChart({
            data: Array.from({ length: 7 }, (_, i) => {
              const d = U.addDays(new Date(), i - 6);
              return { label: U.weekdayCN(d).replace('期', ''), value: focusOn(U.dateKey(d)) };
            }), height: 150, yFmt: (v) => Math.round(v) + 'm', showValues: true, aria: '近七天专注'
          })}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>支出曲线</h3><span class="sub">元 / 天</span></div><button class="card-link" data-act="go" data-page="stats">详情 ${IC.icon('chevronRight')}</button></div>
          ${CH.lineChart({
            labels: Array.from({ length: 7 }, (_, i) => { const d = U.addDays(new Date(), i - 6); return `${d.getMonth() + 1}/${d.getDate()}`; }),
            values: Array.from({ length: 7 }, (_, i) => {
              const k = U.dateKey(U.addDays(new Date(), i - 6));
              return sumAmount(WB.db.expenses.filter((e) => e.date === k), 'expense');
            }), height: 150, fmt: (v) => '¥' + U.money(v), aria: '近七天支出'
          })}
        </div>
      </div>
    </div>`;
  }

  /* ---------- 全局搜索 ---------- */
  function highlight(text, q) {
    const safe = esc(text);
    if (!q) return safe;
    try {
      const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      return safe.replace(re, '<mark>$1</mark>');
    } catch (e) { return safe; }
  }
  function searchResults(q) {
    const query = q.trim();
    if (!query) return '';
    const lq = query.toLowerCase();
    const match = (s) => String(s || '').toLowerCase().includes(lq);
    const papers = WB.db.papers.filter((p) => match(p.title) || match(p.author) || match(p.innovation) || match(p.folder) || (p.tags || []).some(match)).slice(0, 4);
    const tasks = WB.db.tasks.filter((t) => match(t.title) || (t.subtasks || []).some((s) => match(s.title))).slice(0, 4);
    const expenses = WB.db.expenses.filter((e) => match(e.note) || match(e.category) || match(e.date)).slice(0, 4);
    if (!papers.length && !tasks.length && !expenses.length) {
      return `<div class="sr-empty">没有找到「${esc(query)}」<br><span style="font-size:10.5px">试试文献作者、任务关键词或支出备注</span></div>
        <div class="sr-tip"><span><kbd>N</kbd> 新建任务</span><span><kbd>P</kbd> 开始专注</span></div>`;
    }
    const section = (title, icon, items) => items.length ? `<div class="sr-group">
      <div class="sr-group-head">${IC.icon(icon)}<b>${title}</b><span class="count">${items.length} 条</span></div>
      ${items.join('')}</div>` : '';

    const paperRows = papers.map((p) => `<button class="sr-item" data-act="searchPaper" data-id="${p.id}">
      <span class="sr-ico">${IC.icon('book')}</span>
      <span class="sr-main"><strong>${highlight(p.title, query)}</strong><span>${highlight(p.author, query)} · ${esc(p.venue || '')} ${p.year || ''} · ${WB.PAPER_STATUS[p.status]?.name || '未读'}</span></span>
    </button>`);
    const taskRows = tasks.map((t) => `<button class="sr-item" data-act="searchTask" data-id="${t.id}">
      <span class="sr-ico">${IC.icon('check')}</span>
      <span class="sr-main"><strong>${highlight(t.title, query)}</strong><span>${t.done ? '已完成' : '进行中'} · ${t.due ? U.relDay(t.due) : '无截止'} · 进度 ${progressOf(t)}%</span></span>
    </button>`);
    const expRows = expenses.map((e) => `<button class="sr-item" data-act="searchExpense" data-id="${e.id}">
      <span class="sr-ico">${IC.icon('wallet')}</span>
      <span class="sr-main"><strong>${e.type === 'income' ? '+' : '−'} ¥${U.money(e.amount)} · ${highlight(e.note || e.category, query)}</strong><span>${esc(e.category)} · ${e.date} ${e.time}</span></span>
    </button>`);
    return `${section('文献', 'book', paperRows)}${section('任务', 'flag', taskRows)}${section('支出记录', 'wallet', expRows)}
      <div class="sr-tip"><span><kbd>N</kbd> 新建任务</span><span><kbd>P</kbd> 开始专注</span><span><kbd>Esc</kbd> 关闭</span></div>`;
  }

  /* ---------- 主题面板 ---------- */
  function renderAccentSwatches() {
    const box = document.getElementById('accentSwatches');
    if (!box) return;
    box.innerHTML = Object.entries(WB.ACCENTS).map(([key, a]) => {
      const on = WB.db.settings.accent === key;
      return `<button class="swatch ${on ? 'active' : ''}" data-act="setAccent" data-accent="${key}" title="${a.name}" style="background:hsl(${a.h} ${a.s}% ${a.l}%)"></button>`;
    }).join('');
    document.querySelectorAll('.mode-chip').forEach((el) => {
      el.classList.toggle('active', el.dataset.mode === WB.db.settings.theme);
    });
  }

  function renderNotifBadge() {
    const unread = WB.db.notifications.filter((n) => !n.read).length;
    const b = document.getElementById('notifBadge');
    if (b) {
      b.textContent = unread > 9 ? '9+' : String(unread);
      b.hidden = unread === 0;
    }
  }

  function renderNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;
    const items = WB.db.notifications.slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 12);
    if (!items.length) {
      list.innerHTML = `<div class="notif-empty">暂时没有通知<br><span style="font-size:10.5px">番茄钟结束、任务到期与定时弹窗会汇总在这里</span></div>`;
    } else {
      list.innerHTML = `<div class="notif-list">${items.map((n) => {
        const iconMap = { focus: 'timer', due: 'flag', popup: 'note', system: 'info' };
        return `<div class="notif-item ${n.read ? '' : 'unread'}" data-act="readNotif" data-id="${n.id}">
          <span class="notif-ico ${n.type === 'due' ? 'due' : n.type === 'popup' ? 'miss' : ''}">${IC.icon(iconMap[n.type] || 'bell')}</span>
          <span class="notif-main"><strong>${esc(n.title)}</strong><p>${esc(n.body)}</p><time>${U.fmtDateTime(n.ts)}</time></span>
        </div>`;
      }).join('')}</div>`;
    }
  }

  /* ---------- 工作台名称 ---------- */
  function renderBrand() {
    const host = document.getElementById('brandText');
    if (!host || host.dataset.editing) return;
    const name = (WB.db.settings.workspaceName || '').trim() || '茶歇工作台';
    host.innerHTML = `<div class="brand-name-row">
      <strong class="brand-name" title="${esc(name)}">${esc(name)}</strong>
      <button class="brand-edit" data-act="editWorkspaceName" title="修改工作台名称" aria-label="修改工作台名称">
        <span class="ico" data-icon="edit"></span>
      </button>
    </div>
    <span class="brand-sub">TEA TIME STUDIO</span>`;
    WBIcons.hydrate(host);
    document.title = `${name} · 个人工作台`;
  }

  /* ---------- 汇总渲染 ---------- */
  function renderAll() {
    renderBrand();
    renderNav();
    renderRail();
    const main = document.getElementById('main');
    if (main) main.innerHTML = renderPage();
    renderNotifBadge();
    renderNotifications();
    renderAccentSwatches();
    WBIcons.hydrate(document);
    if (WB.state.page === 'pomodoro') WB.UI.updatePomoUI && WB.UI.updatePomoUI();
    if (WB.state.page === 'settings') WB.UI.afterSettings && WB.UI.afterSettings();
    if (WB.state.page === 'expenses') WB.UI.afterExpenses && WB.UI.afterExpenses();
    if (WB.state.page === 'papers') WB.UI.afterPapers && WB.UI.afterPapers();
  }

  function renderPage() {
    if (!WB.db.settings.onboarded) return WB.UI.onboardingHTML();
    switch (WB.state.page) {
      case 'papers': return WB.UI.papersHTML();
      case 'pomodoro': return WB.UI.pomodoroHTML();
      case 'expenses': return WB.UI.expensesHTML();
      case 'drinks': return WB.UI.drinksHTML();
      case 'stats': return WB.UI.statsHTML();
      case 'settings': return WB.UI.settingsHTML();
      default: return renderHome();
    }
  }

  WB.UI = {
    ico, focusOn, todayFocus, weekFocus, streakDays, todayExpenses, sumAmount,
    activeTasks, progressOf, taskById, paperById, sortedTasks, papersSorted,
    renderNav, renderRail, renderAll, renderPage, renderHome, renderBrand,
    updateClock, searchResults, highlight, renderNotifBadge, renderNotifications,
    renderAccentSwatches, tasksCardHTML, statCardsHTML, moduleHTML
  };
})();
