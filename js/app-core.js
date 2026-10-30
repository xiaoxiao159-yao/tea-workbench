/* 应用核心：状态 / 主题 / 弹窗 / 通知 / 番茄钟 / 定时弹窗 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;

  const S = {
    page: 'home',
    paperView: 'grid',
    paperFilter: { q: '', folder: 'all', tag: 'all', status: 'all' },
    paperSelection: new Set(),
    expForm: null,
    expMonth: null,
    statsRange: 30,
    clock12: false,
    noise: false,
    pomo: null,
    activePopup: null
  };
  WB.state = S;

  function makePomo(mode = 'focus') {
    const mins = mode === 'focus' ? (WB.db.settings.focusMin || 25) : (WB.db.settings.breakMin || 5);
    return {
      mode, duration: mins * 60, remaining: mins * 60, running: false,
      endAt: null, taskId: '', interruptions: 0
    };
  }
  S.pomo = makePomo('focus');

  /* ---------- 主题 ---------- */
  function applyTheme() {
    const s = WB.db.settings;
    const a = WB.ACCENTS[s.accent] || WB.ACCENTS.caramel;
    const dark = s.theme === 'dark';
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    const l = dark ? Math.min(78, a.l + 8) : a.l;
    const strong = dark ? Math.max(40, a.l + 2) : Math.max(28, a.l - 11);
    root.style.setProperty('--accent', `hsl(${a.h} ${a.s}% ${l}%)`);
    root.style.setProperty('--accent-strong', `hsl(${a.h} ${Math.min(60, a.s + 4)}% ${strong}%)`);
    root.style.setProperty('--accent-soft', `hsl(${a.h} ${Math.max(16, a.s - 4)}% ${dark ? 24 : 92}%)`);
    root.style.setProperty('--accent-faint', `hsl(${a.h} ${Math.max(18, a.s)}% ${dark ? 28 : 96}%)`);
    root.style.setProperty('--accent-ink', dark ? `hsl(${a.h} 40% 82%)` : `hsl(${a.h} 36% 30%)`);
    root.style.setProperty('--accent-contrast', dark ? '#fff7ee' : '#fffaf4');
    const q = document.getElementById('themeQuick');
    if (q) {
      q.innerHTML = IC.icon(dark ? 'sun' : 'moon');
      q.title = dark ? '切换到浅色' : '切换到深色';
    }
    document.querySelectorAll('.mode-chip').forEach((el) => el.classList.toggle('active', el.dataset.mode === s.theme));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#1f1a18' : '#f3eae0';
  }

  /* ---------- 提示 ---------- */
  function toast(msg, icon = 'check', kind = '') {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = `<span class="t-ico">${IC.icon(icon)}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 220); }, 3000);
  }
  function systemNotify(title, body) {
    if (!WB.db.settings.notifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, { body }); } catch (e) { /* ignore */ }
  }
  function requestNotifyPermission() {
    if (!('Notification' in window)) {
      toast('当前浏览器不支持系统通知', 'info', 'warn');
      return;
    }
    if (Notification.permission === 'granted') {
      toast('系统通知已开启', 'bell');
      return;
    }
    Notification.requestPermission().then((p) => {
      toast(p === 'granted' ? '系统通知已开启' : '系统通知被拒绝，可在浏览器设置中开启', 'bell', p === 'granted' ? '' : 'warn');
    });
  }
  function notify(title, body, type = 'system', quiet = false) {
    WB.db.notifications.unshift({
      id: U.uid('n'), type, title, body, ts: new Date().toISOString(), read: false
    });
    WB.db.notifications = WB.db.notifications.slice(0, 60);
    WB.save();
    WB.UI.renderNotifBadge();
    WB.UI.renderNotifications();
    systemNotify(title, body);
    if (!quiet) toast(body, type === 'due' ? 'flag' : type === 'focus' ? 'timer' : 'bell');
  }

  /* ---------- 模态 ---------- */
  let forcedModal = false;
  let pendingConfirm = null;
  let previewUrl = null;
  let lastFocus = null;

  function hydrateModal() {
    const slot = document.getElementById('modalSlot');
    WBIcons.hydrate(slot);
  }
  function openModal(html, opts = {}) {
    const layer = document.getElementById('modalLayer');
    const slot = document.getElementById('modalSlot');
    if (!layer || !slot) return;
    closePanels();
    if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) {} previewUrl = null; }
    layer.hidden = false;
    slot.innerHTML = html;
    forcedModal = !!opts.forced;
    document.body.classList.add('modal-open');
    hydrateModal();
    setTimeout(() => {
      const first = slot.querySelector('input:not([type="hidden"]):not([type="range"]), textarea, select');
      if (first && !forcedModal) first.focus();
      if (opts.onOpen) opts.onOpen();
    }, 30);
  }
  function closeModal(force = false) {
    const layer = document.getElementById('modalLayer');
    if (!layer || layer.hidden) return;
    if (forcedModal && !force) {
      toast('请完成全部必填项后再关闭', 'lock', 'warn');
      return;
    }
    layer.hidden = true;
    document.getElementById('modalSlot').innerHTML = '';
    forcedModal = false;
    WB.state.activePopup = null;
    document.body.classList.remove('modal-open');
    if (previewUrl) { try { URL.revokeObjectURL(previewUrl); } catch (e) {} previewUrl = null; }
  }
  function askConfirm(title, desc, okText, cb, danger = true) {
    pendingConfirm = cb;
    openModal(WB.UI.modalShell({
      eyebrow: '请确认', title,
      body: `<p style="font-size:12px;line-height:1.8;color:var(--text-2)">${desc}</p>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="doConfirm">${esc(okText || '确定')}</button>`
    }).replace('modal-card ', 'modal-card confirm-card '));
    setTimeout(() => {
      const slot = document.getElementById('modalSlot');
      if (slot) {
        const card = slot.querySelector('.modal-card');
        if (card) card.style.width = 'min(440px, 94vw)';
      }
    }, 0);
  }

  /* ---------- 面板 / 抽屉 ---------- */
  function closePanels() {
    ['notifPanel', 'accentPanel', 'searchPanel'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  }
  function closeDrawers() {
    const sb = document.getElementById('sidebar');
    const rail = document.getElementById('rail');
    if (sb) sb.classList.remove('open');
    if (rail) rail.classList.remove('open');
    const mask = document.getElementById('drawerMask');
    if (mask) { mask.hidden = true; mask.classList.remove('show-rail'); }
  }
  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    const on = sb.classList.toggle('open');
    const rail = document.getElementById('rail');
    if (rail) rail.classList.remove('open');
    const mask = document.getElementById('drawerMask');
    if (mask) { mask.hidden = !on; mask.classList.toggle('show-rail', false); }
  }
  function toggleRail() {
    const rail = document.getElementById('rail');
    if (!rail) return;
    const on = rail.classList.toggle('open');
    const sb = document.getElementById('sidebar');
    if (sb) sb.classList.remove('open');
    const mask = document.getElementById('drawerMask');
    if (mask) { mask.hidden = !on; mask.classList.toggle('show-rail', on); }
  }

  /* ---------- 搜索面板 ---------- */
  function renderSearch(q) {
    const panel = document.getElementById('searchPanel');
    if (!panel) return;
    if (!q.trim()) { panel.hidden = true; panel.innerHTML = ''; return; }
    panel.innerHTML = WB.UI.searchResults(q);
    panel.hidden = false;
    WBIcons.hydrate(panel);
  }

  /* ---------- 剪贴板 ---------- */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      toast('已复制到剪贴板', 'quote');
    } catch (e) {
      toast('复制失败，请手动选择文本', 'alert', 'error');
    }
  }

  /* ---------- 番茄钟 ---------- */
  function startPomoTimer() {
    const st = S.pomo;
    if (!st || st.running) return;
    if (st.remaining <= 0) {
      const mins = st.mode === 'focus' ? (WB.db.settings.focusMin || 25) : (WB.db.settings.breakMin || 5);
      st.duration = mins * 60; st.remaining = mins * 60;
    }
    st.running = true;
    st.endAt = Date.now() + st.remaining * 1000;
    WB.UI.updatePomoUI();
    toast(st.mode === 'focus' ? '专注开始，慢慢来。' : '休息一下，喝口水。', st.mode === 'focus' ? 'flame' : 'coffee');
  }
  function pausePomoTimer() {
    const st = S.pomo;
    if (!st || !st.running) return;
    st.remaining = Math.max(0, Math.ceil((st.endAt - Date.now()) / 1000));
    st.running = false;
    st.endAt = null;
    WB.UI.updatePomoUI();
    toast('已暂停，随时可以继续', 'pause');
  }
  function resetPomo(render = true) {
    S.pomo = makePomo(S.pomo ? S.pomo.mode : 'focus');
    if (render) WB.UI.renderAll();
    else WB.UI.updatePomoUI();
  }
  function tickPomo() {
    const st = S.pomo;
    if (!st || !st.running || !st.endAt) return;
    const remain = Math.ceil((st.endAt - Date.now()) / 1000);
    if (remain <= 0) {
      st.remaining = 0;
      finishPomo();
      return;
    }
    st.remaining = remain;
    if (S.page === 'pomodoro') WB.UI.updatePomoUI();
  }
  function finishPomo() {
    const st = S.pomo;
    if (!st) return;
    st.running = false;
    st.endAt = null;
    const wasFocus = st.mode === 'focus';
    if (wasFocus) {
      const minutes = Math.round(st.duration / 60);
      const rec = {
        id: U.uid('f'), date: U.dateKey(), time: U.timeKey(),
        minutes, taskId: st.taskId || '', interruptions: st.interruptions || 0,
        createdAt: new Date().toISOString()
      };
      WB.db.focus.push(rec);
      if (st.taskId) {
        const t = WB.UI.taskById(st.taskId);
        if (t) t.focusMinutes = (Number(t.focusMinutes) || 0) + minutes;
      }
      WB.save();
      notify('专注完成', `${minutes} 分钟专注已完成，休息 ${WB.db.settings.breakMin} 分钟吧。`, 'focus');
      S.pomo = makePomo('break');
      toast(`完成一个番茄，休息 ${WB.db.settings.breakMin} 分钟`, 'coffee');
      WB.UI.renderAll();
    } else {
      notify('休息结束', '休息时间结束，准备好再开始下一个专注。', 'focus');
      S.pomo = makePomo('focus');
      toast('休息结束，回到桌前吧', 'timer');
      WB.UI.renderAll();
    }
  }
  function startTaskFocus(taskId) {
    closeModal(true);
    S.page = 'pomodoro';
    S.pomo = makePomo('focus');
    S.pomo.taskId = taskId;
    S.pomo.running = true;
    S.pomo.endAt = Date.now() + S.pomo.remaining * 1000;
    WB.save();
    WB.UI.renderAll();
    const t = WB.UI.taskById(taskId);
    toast(t ? `开始专注「${t.title.slice(0, 16)}」` : '开始专注', 'flame');
  }

  /* ---------- 音频白噪音 ---------- */
  let audioCtx = null, noiseSrc = null, noiseGain = null;
  function setNoise(on) {
    try {
      if (on) {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (noiseSrc) { S.noise = true; return; }
        const dur = 2;
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noiseSrc = audioCtx.createBufferSource();
        noiseSrc.buffer = buffer;
        noiseSrc.loop = true;
        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 750;
        noiseGain = audioCtx.createGain();
        noiseGain.gain.value = 0.12;
        noiseSrc.connect(lp).connect(noiseGain).connect(audioCtx.destination);
        noiseSrc.start();
        S.noise = true;
        toast('白噪音已开启 · 雨声', 'volume');
      } else {
        if (noiseSrc) { try { noiseSrc.stop(); } catch (e) {} noiseSrc = null; }
        S.noise = false;
        toast('白噪音已关闭', 'volume');
      }
      WB.UI.updatePomoUI();
    } catch (e) {
      toast('当前浏览器无法播放白噪音', 'alert', 'error');
      S.noise = false;
    }
  }

  /* ---------- 定时弹窗 ---------- */
  function repeatMatches(p, d = new Date()) {
    if (!p.repeat || p.repeat === 'daily') return true;
    if (p.repeat === 'workday') return d.getDay() >= 1 && d.getDay() <= 5;
    if (p.repeat === 'custom') return (p.days || []).includes(d.getDay());
    return true;
  }
  function triggerPopup(id, manual = false) {
    const p = (WB.db.popups || []).find((x) => x.id === id) || (WB.db.popups || [])[0];
    if (!p && !manual) return;
    if (!manual) {
      if (!p.enabled || !repeatMatches(p)) return;
      if (p.lastRun === U.dateKey()) return;
      p.lastRun = U.dateKey();
      WB.save();
      notify('定时弹窗', `${p.title} 已弹出，请完成填写。`, 'popup');
    } else {
      toast('测试模式：这是一次手动触发的弹窗', 'info');
      WB.UI.renderNotifications();
    }
    S.activePopup = p ? p.id : '';
    const layer = document.getElementById('modalLayer');
    if (layer && !layer.hidden && forcedModal) return;
    openModal(WB.UI.popupHTML(p ? p.id : ''), { forced: true });
    setTimeout(() => WB.UI.validatePopup(), 30);
  }
  function checkScheduledPopups() {
    if (!WB.db.settings.onboarded) return;
    const layer = document.getElementById('modalLayer');
    if (layer && !layer.hidden && forcedModal) return;
    const now = new Date();
    const hm = U.timeKey(now);
    const p = (WB.db.popups || []).find((x) => x.enabled && x.time === hm && x.lastRun !== U.dateKey() && repeatMatches(x, now));
    if (p) triggerPopup(p.id, false);
  }
  function checkDueTasks() {
    if (!WB.db.settings.onboarded) return;
    const now = new Date();
    const today = U.dateKey(now);
    const hm = U.timeKey(now);
    const notified = WB.db.ui.notified || (WB.db.ui.notified = {});
    WB.db.tasks.filter((t) => !t.done && !t.archived && t.due).forEach((t) => {
      const key = `due_${t.id}_${today}`;
      if (notified[key]) return;
      const isToday = t.due === today;
      const overdue = t.due < today;
      if (isToday && (!t.reminder || hm >= t.reminder)) {
        notified[key] = true;
        notify('任务今天到期', `「${t.title}」${t.reminder ? ` · 提醒时间 ${t.reminder}` : ''}`, 'due');
      } else if (overdue) {
        notified[key] = true;
        notify('任务已经逾期', `「${t.title}」已逾期 ${Math.abs(Math.round((U.parseKey(t.due) - U.parseKey(today)) / 86400000))} 天`, 'due');
      }
    });
    const keys = Object.keys(notified);
    if (keys.length > 120) {
      Object.keys(notified).forEach((k) => { if (!k.endsWith(today)) delete notified[k]; });
    }
    WB.save();
  }

  WB.app = {
    S, makePomo, applyTheme, toast, notify, systemNotify, requestNotifyPermission,
    openModal, closeModal, askConfirm, closePanels, closeDrawers, toggleSidebar, toggleRail,
    renderSearch, copyText, startPomoTimer, pausePomoTimer, resetPomo, tickPomo, finishPomo,
    startTaskFocus, setNoise, triggerPopup, checkScheduledPopups, checkDueTasks, repeatMatches,
    get forcedModal() { return forcedModal; },
    get pendingConfirm() { return pendingConfirm; },
    set pendingConfirm(v) { pendingConfirm = v; },
    get previewUrl() { return previewUrl; },
    set previewUrl(v) { previewUrl = v; },
    get lastFocus() { return lastFocus; },
    set lastFocus(v) { lastFocus = v; }
  };
})();
