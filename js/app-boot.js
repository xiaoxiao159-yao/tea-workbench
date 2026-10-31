/* 启动层：数据导入导出 / 文件上传 / 事件绑定 / 定时器 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const APP = WB.app;
  const ACT = WB.actions;
  const AU = WB.actionUtil;
  WB.toast = APP.toast;

  /* ---------- 数据导入导出 ---------- */
  function pdfText(p) { return WB.PAPER_STATUS[p.status] ? WB.PAPER_STATUS[p.status].name : '未读'; }

  function exportCSV(type) {
    let rows = [];
    let name = '导出';
    if (type === 'papers') {
      name = '文献目录';
      rows = [['标题', '作者', '创新点', '文件夹', '标签', '阅读状态', '期刊/会议', '年份', 'DOI', '本地文件']];
      WB.db.papers.forEach((p) => rows.push([
        p.title, p.author || '', p.innovation || '', p.folder || '',
        (p.tags || []).join(' / '), pdfText(p), p.venue || '', p.year || '', p.doi || '',
        p.fileName ? p.fileName : '无'
      ]));
    } else if (type === 'tasks') {
      name = '任务清单';
      rows = [['任务', '优先级', '状态', '截止日期', '提醒', '重复', '进度', '累计专注(分钟)', '子任务']];
      WB.db.tasks.forEach((t) => rows.push([
        t.title, (WB.PRIORITIES[t.priority] || WB.PRIORITIES.mid).name,
        t.archived ? '已归档' : t.done ? '已完成' : '进行中',
        t.due || '', t.reminder || '', WB.UI.repeatText ? WB.UI.repeatText(t) : (t.repeat || '不重复'),
        WB.UI.progressOf(t) + '%', Number(t.focusMinutes) || 0,
        (t.subtasks || []).map((s) => `${s.done ? '✓' : '○'} ${s.title}`).join(' / ')
      ]));
    } else if (type === 'expenses') {
      name = '支出记录';
      rows = [['日期', '时间', '类型', '金额', '类别', '备注', '关联任务']];
      WB.db.expenses.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((e) => rows.push([
        e.date, e.time || '', e.type === 'income' ? '收入' : '支出', Number(e.amount) || 0,
        e.category || '', e.note || '', e.taskId ? ((WB.UI.taskById(e.taskId) || {}).title || '') : ''
      ]));
    } else if (type === 'focus') {
      name = '专注记录';
      rows = [['日期', '时间', '专注分钟', '关联任务', '打断次数']];
      WB.db.focus.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((f) => rows.push([
        f.date, f.time || '', Number(f.minutes) || 0,
        f.taskId ? ((WB.UI.taskById(f.taskId) || {}).title || '') : '独立专注', Number(f.interruptions) || 0
      ]));
    } else return;
    U.download(`${name}_${U.dateKey()}.csv`, '\ufeff' + U.toCSV(rows), 'text/csv;charset=utf-8');
    APP.toast(`已导出「${name}」CSV`, 'download');
  }

  function exportJSON() {
    const json = JSON.stringify(WB.db, null, 2);
    U.download(`茶歇工作台备份_${U.dateKey()}.json`, json, 'application/json;charset=utf-8');
    APP.toast('JSON 备份已导出', 'database');
  }
  WB.dataIO = { exportCSV, exportJSON };

  /* ---------- 文献上传 ---------- */
  async function handlePaperFiles(files) {
    if (!files || !files.length) return;
    const arr = [...files];
    let stored = 0;
    for (const file of arr) {
      const id = U.uid('p');
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const paper = {
        id, title: file.name.replace(/\.\w+$/, '') || file.name, author: '', innovation: '',
        folder: '待分类', tags: [], status: 'unread', venue: '', year: '', doi: '', notes: '',
        fileName: file.name, fileType: ext, size: file.size,
        createdAt: new Date().toISOString(), pinned: false
      };
      WB.db.papers.unshift(paper);
      if (!WB.db.ui.paperOrder) WB.db.ui.paperOrder = [];
      WB.db.ui.paperOrder.unshift(id);
      const ok = await WB.idb.putFile(id, file);
      if (ok) stored++;
    }
    WB.save();
    WB.UI.renderAll();
    if (stored === arr.length) APP.toast(`已上传 ${arr.length} 篇文献，文件保存在本地`, 'upload');
    else APP.toast(`已添加 ${arr.length} 篇条目，${arr.length - stored} 个文件未能写入本地存储`, 'alert', 'warn');
  }

  /* ---------- 支出 CSV 导入 ---------- */
  async function importExpenseCSV(file) {
    let text = '';
    try { text = await file.text(); } catch (e) { APP.toast('无法读取该文件', 'alert', 'error'); return; }
    const rows = U.parseCSV(text);
    if (rows.length < 2) { APP.toast('CSV 内容为空', 'info', 'warn'); return; }
    const header = rows[0].map((h) => String(h).trim());
    const idx = {};
    header.forEach((h, i) => {
      if (/日期|date/i.test(h) && idx.date == null) idx.date = i;
      else if (/时间|time/i.test(h) && idx.time == null) idx.time = i;
      else if (/金额|amount/i.test(h) && idx.amount == null) idx.amount = i;
      else if (/类别|category/i.test(h) && idx.category == null) idx.category = i;
      else if (/备注|note/i.test(h) && idx.note == null) idx.note = i;
      else if (/类型|type/i.test(h) && idx.type == null) idx.type = i;
      else if (/任务|task/i.test(h) && idx.task == null) idx.task = i;
    });
    if (idx.amount == null) {
      APP.toast('CSV 需要包含「金额 / amount」列', 'alert', 'error');
      return;
    }
    let n = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const amount = Number(String(r[idx.amount] || '').replace(/[¥,$，\s]/g, ''));
      if (!isFinite(amount) || amount <= 0) continue;
      let date = idx.date != null ? String(r[idx.date] || '').trim() : U.dateKey();
      date = date.replace(/[/.]/g, '-');
      const dm = date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      date = dm ? `${dm[1]}-${U.pad(dm[2])}-${U.pad(dm[3])}` : U.dateKey();
      let time = idx.time != null ? String(r[idx.time] || '').trim() : '12:00';
      const tm = time.match(/(\d{1,2}):(\d{2})/);
      time = tm ? `${U.pad(tm[1])}:${tm[2]}` : '12:00';
      const typeRaw = idx.type != null ? String(r[idx.type] || '') : '';
      const type = /收入|income/i.test(typeRaw) ? 'income' : 'expense';
      const category = (idx.category != null ? String(r[idx.category] || '').trim() : '') || '其他';
      const note = idx.note != null ? String(r[idx.note] || '').trim() : '';
      let taskId = '';
      if (idx.task != null) {
        const tv = String(r[idx.task] || '').trim();
        const t = WB.db.tasks.find((x) => x.id === tv || x.title === tv);
        if (t) taskId = t.id;
      }
      WB.db.expenses.push({
        id: U.uid('e'), type, amount: Math.round(amount * 100) / 100,
        date, time, category, note, taskId, createdAt: new Date().toISOString()
      });
      n++;
    }
    WB.save();
    WB.state.expMonth = U.dateKey().slice(0, 7);
    WB.UI.renderAll();
    APP.toast(n ? `已导入 ${n} 条记录` : '没有可导入的有效行', n ? 'check' : 'info', n ? '' : 'warn');
  }

  /* ---------- 点击动作 ---------- */
  const SKIP_CLICK = new Set(['selectPaper', 'toggleSubtask']);
  document.addEventListener('click', (e) => {
    const actEl = e.target.closest('[data-act]');
    if (actEl) {
      const act = actEl.dataset.act;
      if (SKIP_CLICK.has(act)) return;
      if (typeof ACT[act] === 'function') {
        ACT[act](actEl, e);
      }
      return;
    }
    if (!e.target.closest('#notifBtn') && !e.target.closest('#notifPanel') &&
        !e.target.closest('#paletteBtn') && !e.target.closest('#accentPanel')) {
      ['notifPanel', 'accentPanel'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.hidden = true;
      });
    }
    if (!e.target.closest('.search-wrap')) {
      const p = document.getElementById('searchPanel');
      if (p) p.hidden = true;
    }
  });

  /* ---------- 变更 ---------- */
  let paperTimer = null;
  document.addEventListener('change', (e) => {
    const el = e.target;
    const act = el.dataset ? el.dataset.act : '';
    if (act === 'selectPaper') { ACT.selectPaper(el); return; }
    if (act === 'toggleSubtask') { ACT.toggleSubtask(el); return; }
    if (act === 'bulkMove') { ACT.bulkMove(el); return; }
    if (el.id === 'filterFolder') { WB.state.paperFilter.folder = el.value; AU.refresh(); return; }
    if (el.id === 'filterTag') { WB.state.paperFilter.tag = el.value; AU.refresh(); return; }
    if (el.id === 'expMonth') { WB.state.expMonth = el.value || WB.state.expMonth; AU.refresh(); return; }
    if (el.id === 'pomoTaskSelect') {
      WB.state.pomo.taskId = el.value;
      WB.UI.updatePomoUI();
      return;
    }
    if (el.id === 'popupRepeat') {
      const box = document.getElementById('customDaysBox');
      if (box) box.style.display = el.value === 'custom' ? '' : 'none';
      return;
    }
  });

  /* ---------- 输入 ---------- */
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.id === 'globalSearch') {
      APP.renderSearch(el.value);
      return;
    }
    if (el.id === 'paperSearch') {
      WB.state.paperFilter.q = el.value;
      clearTimeout(paperTimer);
      paperTimer = setTimeout(() => {
        AU.refresh();
        const ni = document.getElementById('paperSearch');
        if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
      }, 260);
      return;
    }
    if (el.hasAttribute('data-popup-field')) {
      WB.UI.validatePopup();
      return;
    }
    if (el.name === 'manualProgress' && el.closest('#taskEditForm')) {
      const num = document.getElementById('tdProgressNum');
      const fill = document.getElementById('tdProgressFill');
      if (num) num.textContent = `${el.value}%`;
      if (fill) fill.style.width = `${el.value}%`;
    }
  });

  /* ---------- 表单 ---------- */
  document.addEventListener('submit', (e) => {
    const form = e.target;
    e.preventDefault();
    switch (form.id) {
      case 'expenseForm': ACT.submitExpense(); break;
      case 'pomoSettingsForm': ACT.savePomoSettings(); break;
      case 'settingsPrefs': ACT.savePrefs(); break;
      case 'budgetForm': ACT.saveBudget(); break;
      case 'budgetModalForm': ACT.saveBudget(); break;
      case 'newTaskForm': ACT.createTask(); break;
      case 'taskEditForm': AU.syncTaskForm(form.dataset.id); APP.toast('已保存', 'save'); break;
      case 'paperEditForm': ACT.savePaper({ dataset: { id: form.dataset.id } }); break;
      case 'popupForm': ACT.submitPopup(); break;
      case 'drinkForm': ACT.saveDrink(); break;
      case 'drinkFieldForm': ACT.addDrinkField(); break;
      default: break;
    }
  });

  /* ---------- 搜索键盘 ---------- */
  const searchInput = document.getElementById('globalSearch');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = document.querySelector('#searchPanel .sr-item');
        if (first) first.click();
      } else if (e.key === 'Escape') {
        const p = document.getElementById('searchPanel');
        if (p) p.hidden = true;
        searchInput.value = '';
        searchInput.blur();
      }
    });
  }

  /* ---------- 全局快捷键 ---------- */
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      if (APP.forcedModal) { APP.toast('请完成全部必填项后再关闭', 'lock', 'warn'); return; }
      const layer = document.getElementById('modalLayer');
      if (layer && !layer.hidden) { APP.closeModal(); return; }
      const p = document.getElementById('searchPanel');
      if (p && !p.hidden) { p.hidden = true; return; }
      APP.closePanels();
      APP.closeDrawers();
      return;
    }
    const layer = document.getElementById('modalLayer');
    if (layer && !layer.hidden) return;
    if (typing || (t && t.isContentEditable)) return;
    if (!WB.db.settings.onboarded) return;
    if (/^[nN]$/.test(e.key)) { e.preventDefault(); ACT.newTask(); }
    else if (/^[pP]$/.test(e.key)) {
      e.preventDefault();
      if (WB.state.page !== 'pomodoro') { AU.go('pomodoro'); APP.startPomoTimer(); }
      else ACT.pomoToggle();
    } else if (/^[tT]$/.test(e.key)) { ACT.themeQuick(); }
    else if (/^[rR]$/.test(e.key)) {
      const p = WB.db.popups.find((x) => x.enabled);
      if (p) APP.triggerPopup(p.id, true);
      else APP.toast('还没有启用中的定时弹窗', 'info', 'warn');
    } else if (/^[eE]$/.test(e.key)) { AU.go('expenses'); }
    else if (/^[sS]$/.test(e.key)) { AU.go('stats'); }
    else if (e.key === '/') {
      e.preventDefault();
      const s = document.getElementById('globalSearch');
      if (s) s.focus();
    } else if (e.key === '?') { ACT.shortcuts(); }
  });

  /* ---------- 拖拽排序 ---------- */
  let drag = null;
  function clearDragMarks() {
    document.querySelectorAll('.dragging, .drag-over').forEach((el) => el.classList.remove('dragging', 'drag-over'));
  }
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest('[data-drag]');
    if (!el) return;
    drag = { type: el.dataset.drag, key: el.dataset.key || el.dataset.id };
    el.classList.add('dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.key);
    } catch (err) { /* ignore */ }
  });
  document.addEventListener('dragend', () => { clearDragMarks(); drag = null; });
  document.addEventListener('dragover', (e) => {
    const dz = e.target.closest('#paperDropzone');
    if (dz) {
      const hasFiles = e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
      if (hasFiles) { e.preventDefault(); dz.classList.add('over'); return; }
    }
    const fdrop = e.target.closest('[data-folder-drop]');
    if (fdrop) {
      if (!drag || drag.type !== 'paper') return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
      document.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
      fdrop.classList.add('drag-over');
      return;
    }
    const el = e.target.closest('[data-drag]');
    if (!drag || !el || el.dataset.drag !== drag.type) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* ignore */ }
    document.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over'));
    el.classList.add('drag-over');
  });
  document.addEventListener('dragleave', (e) => {
    const dz = e.target.closest('#paperDropzone');
    if (dz) dz.classList.remove('over');
    const fdrop = e.target.closest('[data-folder-drop]');
    if (fdrop) fdrop.classList.remove('drag-over');
    const el = e.target.closest('[data-drag]');
    if (el) el.classList.remove('drag-over');
  });
  document.addEventListener('drop', (e) => {
    const dz = e.target.closest('#paperDropzone');
    if (dz && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      e.preventDefault();
      dz.classList.remove('over');
      handlePaperFiles(e.dataTransfer.files);
      return;
    }
    const fdrop = e.target.closest('[data-folder-drop]');
    if (fdrop && drag && drag.type === 'paper') {
      e.preventDefault();
      const folder = fdrop.dataset.folderDrop;
      const set = WB.state.paperSelection;
      const ids = (set && set.has(drag.key)) ? [...set] : [drag.key];
      let moved = 0;
      ids.forEach((id) => {
        const p = WB.UI.paperById(id);
        if (p && p.folder !== folder) { p.folder = folder; moved++; }
      });
      if (!Array.isArray(WB.db.folders)) WB.db.folders = ['待分类'];
      if (!WB.db.folders.includes(folder)) WB.db.folders.push(folder);
      WB.save();
      AU.refresh();
      APP.toast(moved ? `已移动 ${moved} 篇文献到「${folder}」` : `文献已在「${folder}」中`, 'folder');
      drag = null;
      clearDragMarks();
      return;
    }
    const el = e.target.closest('[data-drag]');
    if (!drag || !el || el.dataset.drag !== drag.type) return;
    e.preventDefault();
    const key = drag.key;
    const target = el.dataset.key || el.dataset.id;
    if (key && target && key !== target) {
      const arr = drag.type === 'stat' ? WB.db.ui.statOrder
        : drag.type === 'module' ? WB.db.ui.moduleOrder : WB.db.ui.paperOrder;
      const from = arr.indexOf(key);
      if (from === -1) return;
      arr.splice(from, 1);
      let to = arr.indexOf(target);
      if (to === -1) to = arr.length;
      const rect = el.getBoundingClientRect();
      const after = rect.width >= rect.height
        ? e.clientX > rect.left + rect.width / 2
        : e.clientY > rect.top + rect.height / 2;
      arr.splice(after ? to + 1 : to, 0, key);
      WB.save();
      AU.refresh();
      APP.toast(drag.type === 'paper' ? '文献顺序已更新' : '排序已更新', 'grid');
    }
    drag = null;
    clearDragMarks();
  });

  /* ---------- 文件选择 ---------- */
  const paperInput = document.getElementById('paperUpload');
  if (paperInput) {
    paperInput.addEventListener('change', (e) => {
      const files = e.target.files;
      handlePaperFiles(files);
      e.target.value = '';
    });
  }
  const expInput = document.getElementById('expenseImport');
  if (expInput) {
    expInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) importExpenseCSV(file);
    });
  }
  const jsonInput = document.getElementById('jsonImport');
  if (jsonInput) {
    jsonInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        WB.db = WB.normalize(data);
        WB.db.settings.onboarded = true;
        WB.save();
        WB.state.paperSelection.clear();
        WB.state.pomo = APP.makePomo('focus');
        APP.applyTheme();
        WB.UI.renderAll();
        APP.toast('备份已导入，数据已恢复', 'database');
      } catch (err) {
        APP.toast('导入失败：文件不是有效的 JSON 备份', 'alert', 'error');
      }
    });
  }

  /* ---------- 初始化 ---------- */
  APP.applyTheme();
  WB.UI.renderAll();
  WBIcons.hydrate(document);

  setInterval(() => {
    WB.UI.updateClock();
    APP.tickPomo();
  }, 1000);
  setInterval(() => APP.checkScheduledPopups(), 30000);
  setInterval(() => APP.checkDueTasks(), 300000);
  setTimeout(() => APP.checkDueTasks(), 1800);
  setTimeout(() => APP.checkScheduledPopups(), 4000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) APP.tickPomo();
  });
})();
