/* 动作层：导航 / 主题 / 通知 / 搜索 / 文献 / 任务 / 番茄钟 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;
  const APP = WB.app;
  const ACT = (WB.actions = {});

  /* ---------- 通用 ---------- */
  function refresh() {
    const y = window.scrollY;
    WB.UI.renderAll();
    window.scrollTo(0, y);
  }
  function go(page) {
    WB.state.page = page;
    APP.closePanels();
    APP.closeDrawers();
    WB.UI.renderAll();
    window.scrollTo(0, 0);
  }
  function togglePanel(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const open = el.hidden;
    APP.closePanels();
    if (open) {
      el.hidden = false;
      if (id === 'accentPanel') WB.UI.renderAccentSwatches();
      if (id === 'notifPanel') WB.UI.renderNotifications();
    }
  }
  function setTheme(theme) {
    WB.db.settings.theme = theme === 'dark' ? 'dark' : 'light';
    WB.save();
    APP.applyTheme();
    if (WB.state.page === 'settings' || WB.state.page === 'home') refresh();
    APP.toast(theme === 'dark' ? '已切换到深色 · 焙茶' : '已切换到浅色 · 奶盖', theme === 'dark' ? 'moon' : 'sun');
  }
  function setAccent(key) {
    if (!WB.ACCENTS[key]) return;
    WB.db.settings.accent = key;
    WB.save();
    APP.applyTheme();
    WB.UI.renderAccentSwatches();
    refresh();
    APP.toast(`强调色已换成「${WB.ACCENTS[key].name}」`, 'palette');
  }

  /* ---------- 导航 / 主题 / 通知 ---------- */
  ACT.go = (el) => go(el.dataset.page || 'home');
  ACT.settings = () => go('settings');
  ACT.themeQuick = () => setTheme(WB.db.settings.theme === 'dark' ? 'light' : 'dark');
  ACT.setTheme = (el) => setTheme(el.dataset.theme);
  ACT.setAccent = (el) => setAccent(el.dataset.accent);
  ACT.palette = () => togglePanel('accentPanel');
  ACT.notifications = () => togglePanel('notifPanel');
  ACT.sidebarToggle = () => APP.toggleSidebar();
  ACT.railToggle = () => APP.toggleRail();
  ACT.clock12 = () => {
    WB.state.clock12 = !WB.state.clock12;
    WB.UI.updateClock(true);
    APP.toast(WB.state.clock12 ? '已切换为 12 小时制' : '已切换为 24 小时制', 'clock');
  };
  ACT.extend = () => APP.toast('扩展位已预留，之后可以接入新模块', 'sparkles');

  ACT.readAll = () => {
    WB.db.notifications.forEach((n) => { n.read = true; });
    WB.save();
    WB.UI.renderNotifBadge();
    WB.UI.renderNotifications();
    APP.toast('通知已全部标记为已读', 'check');
  };
  ACT.readNotif = (el) => {
    const n = WB.db.notifications.find((x) => x.id === el.dataset.id);
    if (!n) return;
    if (!n.read) { n.read = true; WB.save(); WB.UI.renderNotifBadge(); WB.UI.renderNotifications(); }
  };

  ACT.profile = () => APP.openModal(WB.UI.profileHTML());
  ACT.shortcuts = () => APP.openModal(WB.UI.shortcutsHTML());
  ACT.closeModal = () => APP.closeModal();
  ACT.modalBackdrop = () => APP.closeModal();
  ACT.doConfirm = () => {
    const cb = APP.pendingConfirm;
    APP.pendingConfirm = null;
    APP.closeModal(true);
    if (typeof cb === 'function') cb();
  };

  /* ---------- 首次引导 ---------- */
  ACT.loadDemo = () => {
    WB.seedDemo();
    APP.applyTheme();
    WB.UI.renderAll();
    APP.toast('示例数据已就位，随处点开看看吧', 'sparkles');
  };
  ACT.startBlank = () => {
    WB.db = WB.newDB();
    WB.db.settings.onboarded = true;
    WB.save();
    APP.applyTheme();
    WB.UI.renderAll();
    APP.toast('空白工作台已准备好，从第一件小事开始', 'leaf');
  };
  ACT.importJSON = () => {
    const input = document.getElementById('jsonImport');
    if (input) input.click();
  };

  /* ---------- 搜索 ---------- */
  ACT.searchPaper = (el) => {
    APP.closePanels();
    openPaperModal(el.dataset.id);
  };
  ACT.searchTask = (el) => {
    APP.closePanels();
    const t = WB.UI.taskById(el.dataset.id);
    if (t) APP.openModal(WB.UI.taskDetailHTML(t.id));
  };
  ACT.searchExpense = (el) => {
    APP.closePanels();
    const e = WB.db.expenses.find((x) => x.id === el.dataset.id);
    if (!e) return;
    if (e.date) WB.state.expMonth = e.date.slice(0, 7);
    go('expenses');
    APP.toast(`${e.date} ${e.time || ''} · ${e.category} ¥${U.money(e.amount)}`, 'wallet');
  };

  /* ---------- 工作台名称 ---------- */
  const NAME_MIN = 2;
  const NAME_MAX = 20;
  ACT.editWorkspaceName = () => {
    const host = document.getElementById('brandText');
    if (!host || host.dataset.editing) return;
    const cur = (WB.db.settings.workspaceName || '').trim() || '茶歇工作台';
    host.dataset.editing = '1';
    host.innerHTML = `<div class="brand-edit-row">
      <input id="brandNameInput" class="brand-input" maxlength="${NAME_MAX}" value="${esc(cur)}"
        placeholder="${NAME_MIN}-${NAME_MAX} 个字符" aria-label="工作台名称">
      <button class="brand-mini ok" data-act="saveWorkspaceName" title="保存">${IC.icon('check')}</button>
      <button class="brand-mini" data-act="cancelWorkspaceName" title="取消">${IC.icon('x')}</button>
    </div>`;
    const input = document.getElementById('brandNameInput');
    if (!input) return;
    input.focus();
    input.select();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ACT.saveWorkspaceName(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ACT.cancelWorkspaceName(); }
    });
  };
  ACT.saveWorkspaceName = () => {
    const input = document.getElementById('brandNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      APP.toast(`名称长度需为 ${NAME_MIN}–${NAME_MAX} 个字符`, 'alert', 'warn');
      input.focus();
      return;
    }
    WB.db.settings.workspaceName = name;
    WB.save();
    const host = document.getElementById('brandText');
    if (host) delete host.dataset.editing;
    WB.UI.renderBrand();
    APP.toast('工作台名称已更新', 'save');
  };
  ACT.cancelWorkspaceName = () => {
    const host = document.getElementById('brandText');
    if (!host) return;
    delete host.dataset.editing;
    WB.UI.renderBrand();
  };

  /* ---------- 文献 ---------- */
  function openPaperModal(id) {
    const p = WB.UI.paperById(id);
    if (!p) return;
    APP.openModal(WB.UI.paperPreviewHTML(id));
    loadPaperPreview(id, p);
  }
  async function loadPaperPreview(id, p) {
    if (!p || !p.fileName) return;
    const file = await WB.idb.getFile(id);
    const stage = document.getElementById('paperPreviewStage');
    if (!file || !stage) return;
    if (APP.previewUrl) { try { URL.revokeObjectURL(APP.previewUrl); } catch (e) {} }
    const url = URL.createObjectURL(file);
    APP.previewUrl = url;
    const ext = (p.fileType || '').toLowerCase();
    const isPdf = ext === 'pdf' || file.type === 'application/pdf';
    const isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
    const isText = ['txt', 'md'].includes(ext);
    if (isPdf) {
      stage.innerHTML = `<iframe src="${url}#view=FitH" title="PDF 预览" style="width:100%;height:100%;min-height:420px;border:0;border-radius:10px;background:#fff"></iframe>`;
    } else if (isImg) {
      stage.innerHTML = `<img src="${url}" alt="${esc(p.title)}" style="max-width:100%;max-height:100%;border-radius:10px;object-fit:contain">`;
    } else if (isText) {
      const text = await file.text();
      stage.innerHTML = `<pre style="margin:0;white-space:pre-wrap;font-size:11px;line-height:1.8;color:var(--text-2);padding:8px;max-height:480px;overflow:auto">${esc(text.slice(0, 20000))}</pre>`;
    } else {
      stage.innerHTML = `<div class="preview-placeholder">
        <div class="pp-file">${esc((p.fileType || 'FILE').toUpperCase().slice(0, 4))}</div>
        <div><strong style="color:var(--text);font-size:12px">当前浏览器无法内嵌预览此格式</strong></div>
        <p>文件已在本地保存，可下载后用本地应用打开。</p>
        <button class="btn btn-secondary btn-sm" data-act="downloadPaper" data-id="${p.id}">${IC.icon('download')} 下载文件</button>
      </div>`;
      WBIcons.hydrate(stage);
    }
  }
  ACT.paperFullscreen = () => {
    const stage = document.querySelector('.preview-stage');
    if (!stage) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    if (!stage.requestFullscreen) { APP.toast('当前浏览器不支持全屏预览', 'alert', 'warn'); return; }
    stage.requestFullscreen().catch(() => APP.toast('全屏失败，请检查浏览器权限', 'alert', 'warn'));
  };
  document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('paperFullscreenBtn');
    if (btn) {
      const on = !!document.fullscreenElement;
      btn.innerHTML = `${IC.icon(on ? 'minimize' : 'maximize')}<span>${on ? '退出全屏' : '全屏'}</span>`;
    }
  });
  ACT.openPaper = (el) => openPaperModal(el.dataset.id);

  /* ---------- 文件夹管理 ---------- */
  ACT.openFolderMgr = () => APP.openModal(WB.UI.folderMgrHTML());

  ACT.createFolder = () => {
    const input = document.getElementById('newFolderName');
    const name = (input ? input.value : '').trim();
    if (!name) { APP.toast('请输入文件夹名称', 'alert', 'warn'); return; }
    if (!Array.isArray(WB.db.folders)) WB.db.folders = ['待分类'];
    if (WB.db.folders.includes(name)) { APP.toast('该文件夹已存在', 'alert', 'warn'); return; }
    WB.db.folders.push(name);
    WB.save();
    APP.toast(`已新建文件夹「${name}」`, 'folder');
    APP.openModal(WB.UI.folderMgrHTML());
    refresh();
  };

  ACT.renameFolder = (el) => {
    const oldName = el.dataset.old;
    const row = el.closest('.folder-row');
    const input = row ? row.querySelector('[data-folder-input]') : null;
    const newName = (input ? input.value : '').trim();
    if (!newName) { APP.toast('文件夹名称不能为空', 'alert', 'warn'); return; }
    if (newName === oldName) { APP.toast('名称没有变化', 'alert', 'warn'); return; }
    if (WB.db.folders.includes(newName)) { APP.toast('该文件夹已存在', 'alert', 'warn'); return; }
    const idx = WB.db.folders.indexOf(oldName);
    if (idx >= 0) WB.db.folders[idx] = newName;
    WB.db.papers.forEach((p) => { if (p.folder === oldName) p.folder = newName; });
    WB.save();
    if (WB.state.paperFilter && WB.state.paperFilter.folder === oldName) {
      WB.state.paperFilter.folder = newName;
    }
    APP.toast(`「${oldName}」已更名为「${newName}」`, 'folder');
    APP.openModal(WB.UI.folderMgrHTML());
    refresh();
  };

  ACT.deleteFolder = (el) => {
    const name = el.dataset.name;
    if (!name) return;
    const count = WB.db.papers.filter((p) => p.folder === name).length;
    const msg = count
      ? `「${name}」中还有 ${count} 篇文献，删除后这些文献将归入「待分类」，确定删除？`
      : `确定删除空文件夹「${name}」？`;
    APP.askConfirm('删除文件夹', msg, '删除', () => {
      WB.db.folders = WB.db.folders.filter((f) => f !== name);
      WB.db.papers.forEach((p) => { if (p.folder === name) p.folder = '待分类'; });
      if (WB.state.paperFilter && WB.state.paperFilter.folder === name) {
        WB.state.paperFilter.folder = 'all';
      }
      WB.save();
      APP.toast(`已删除文件夹「${name}」`, 'trash');
      APP.openModal(WB.UI.folderMgrHTML());
      refresh();
    });
  };

  ACT.paperView = (el) => { WB.state.paperView = el.dataset.view || 'grid'; refresh(); };
  ACT.filterStatus = (el) => { WB.state.paperFilter.status = el.dataset.status || 'all'; refresh(); };
  ACT.filterTag = (el) => { WB.state.paperFilter.tag = el.dataset.tag || 'all'; refresh(); };
  ACT.clearPaperFilters = () => {
    WB.state.paperFilter = { q: '', folder: 'all', tag: 'all', status: 'all' };
    refresh();
  };
  ACT.pickFiles = () => {
    const input = document.getElementById('paperUpload');
    if (input) input.click();
  };
  ACT.pinPaper = (el) => {
    const p = WB.UI.paperById(el.dataset.id);
    if (!p) return;
    p.pinned = !p.pinned;
    WB.save();
    refresh();
    APP.toast(p.pinned ? '已置顶这篇文献' : '已取消置顶', 'pin');
  };
  ACT.cycleStatus = (el) => {
    const p = WB.UI.paperById(el.dataset.id);
    if (!p) return;
    const order = ['unread', 'reading', 'read'];
    p.status = order[(order.indexOf(p.status) + 1) % order.length];
    WB.save();
    refresh();
    APP.toast(`已标记为「${WB.PAPER_STATUS[p.status].name}」`, 'check');
  };
  ACT.selectPaper = (el) => {
    const set = WB.state.paperSelection;
    if (el.checked) set.add(el.dataset.id); else set.delete(el.dataset.id);
    const y = window.scrollY;
    WB.UI.renderAll();
    window.scrollTo(0, y);
  };
  ACT.clearSelection = () => {
    WB.state.paperSelection.clear();
    refresh();
  };
  ACT.bulkStatus = (el) => {
    const status = el.dataset.status;
    let n = 0;
    WB.state.paperSelection.forEach((id) => {
      const p = WB.UI.paperById(id);
      if (p) { p.status = status; n++; }
    });
    WB.save();
    refresh();
    APP.toast(`已将 ${n} 篇文献标记为「${WB.PAPER_STATUS[status].name}」`, 'check');
  };
  ACT.bulkDelete = () => {
    const ids = [...WB.state.paperSelection];
    APP.askConfirm('删除选中的文献？', `将删除 ${ids.length} 篇文献条目与本地文件，此操作不可恢复。`, '删除', () => {
      ids.forEach((id) => {
        WB.db.papers = WB.db.papers.filter((p) => p.id !== id);
        WB.db.ui.paperOrder = (WB.db.ui.paperOrder || []).filter((x) => x !== id);
        WB.idb.removeFile(id);
      });
      WB.state.paperSelection.clear();
      WB.save();
      refresh();
      APP.toast(`已删除 ${ids.length} 篇文献`, 'trash');
    });
  };
  ACT.savePaper = (el) => {
    const id = el.dataset.id;
    const p = WB.UI.paperById(id);
    const form = document.getElementById('paperEditForm');
    if (!p || !form) return;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) { APP.toast('文献名称不能为空', 'alert', 'warn'); return; }
    p.title = title;
    p.author = String(fd.get('author') || '').trim();
    p.innovation = String(fd.get('innovation') || '').trim();
    p.folder = String(fd.get('folder') || '').trim() || '待分类';
    if (!Array.isArray(WB.db.folders)) WB.db.folders = ['待分类'];
    if (!WB.db.folders.includes(p.folder)) WB.db.folders.push(p.folder);
    p.status = String(fd.get('status') || 'unread');
    p.venue = String(fd.get('venue') || '').trim();
    p.year = String(fd.get('year') || '').trim();
    p.doi = String(fd.get('doi') || '').trim();
    p.tags = String(fd.get('tags') || '').split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    p.notes = String(fd.get('notes') || '');
    WB.save();
    APP.closeModal(true);
    refresh();
    APP.toast('文献条目已保存', 'save');
  };
  ACT.citePaper = (el) => {
    const p = WB.UI.paperById(el.dataset.id);
    if (p) APP.copyText(WB.UI.citationOf(p));
  };
  ACT.downloadPaper = async (el) => {
    const p = WB.UI.paperById(el.dataset.id);
    if (!p) return;
    const file = await WB.idb.getFile(p.id);
    if (file) {
      U.download(p.fileName || `${p.title}.${p.fileType || 'pdf'}`, file);
    } else {
      const text = `${p.title}\n\n${WB.UI.citationOf(p)}\n\n创新点：${p.innovation || '—'}\n\n笔记：${p.notes || '—'}\n`;
      U.download(`${String(p.title).slice(0, 24).replace(/[\\/:*?"<>|]/g, '_')}.txt`, text, 'text/plain;charset=utf-8');
      APP.toast('该条目没有附带文件，已导出文献信息', 'download');
    }
  };
  ACT.deletePaper = (el) => {
    const p = WB.UI.paperById(el.dataset.id);
    if (!p) return;
    APP.askConfirm('删除这篇文献？', `「${p.title}」及其本地文件将被删除，此操作不可恢复。`, '删除', () => {
      WB.db.papers = WB.db.papers.filter((x) => x.id !== p.id);
      WB.db.ui.paperOrder = (WB.db.ui.paperOrder || []).filter((x) => x !== p.id);
      WB.state.paperSelection.delete(p.id);
      WB.idb.removeFile(p.id);
      WB.save();
      refresh();
      APP.toast('文献已删除', 'trash');
    });
  };
  ACT.exportPapers = () => exportCSV('papers');

  /* ---------- 任务 ---------- */
  function findTask(id) { return WB.UI.taskById(id); }
  function spawnRepeat(t) {
    const pending = WB.db.tasks.some((x) => !x.done && !x.archived && x.id !== t.id && x.title === t.title);
    if (pending) return;
    const base = t.due ? U.parseKey(t.due) : new Date();
    const next = U.dateKey(U.addDays(base, t.repeat === 'weekly' ? 7 : 1));
    const clone = Object.assign({}, t, {
      id: U.uid('t'), done: false, archived: false, due: next, focusMinutes: 0,
      createdAt: new Date().toISOString(),
      subtasks: (t.subtasks || []).map((s) => ({ id: U.uid('s'), title: s.title, done: false }))
    });
    WB.db.tasks.unshift(clone);
    if (!WB.db.ui.taskOrder) WB.db.ui.taskOrder = [];
    WB.db.ui.taskOrder.unshift(clone.id);
  }
  function setDone(t, done) {
    if (t.done === done) return;
    t.done = done;
    if (done) {
      if (t.repeat && t.repeat !== 'none') spawnRepeat(t);
      APP.toast(`「${t.title.slice(0, 14)}」已完成`, 'check');
    } else {
      APP.toast('已恢复为进行中', 'undo');
    }
    WB.save();
    refresh();
  }

  ACT.newTask = () => APP.openModal(WB.UI.newTaskHTML());
  ACT.createTask = () => {
    const form = document.getElementById('newTaskForm');
    if (!form) return;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) { APP.toast('请先给任务起个名字', 'alert', 'warn'); document.getElementById('newTaskTitle') && document.getElementById('newTaskTitle').focus(); return; }
    const subs = String(fd.get('subtasks') || '').split('\n').map((s) => s.trim()).filter(Boolean)
      .map((s) => ({ id: U.uid('s'), title: s, done: false }));
    const t = {
      id: U.uid('t'), title, priority: fd.get('priority') || 'mid',
      due: String(fd.get('due') || ''), reminder: String(fd.get('reminder') || ''),
      repeat: fd.get('repeat') || 'none', progressMode: 'auto', manualProgress: 0,
      focusMinutes: 0, subtasks: subs, done: false, archived: false, pinned: false,
      createdAt: new Date().toISOString()
    };
    WB.db.tasks.unshift(t);
    if (!WB.db.ui.taskOrder) WB.db.ui.taskOrder = [];
    WB.db.ui.taskOrder.unshift(t.id);
    WB.save();
    APP.closeModal(true);
    refresh();
    APP.toast('任务已创建', 'check');
  };
  ACT.openTask = (el) => {
    const t = findTask(el.dataset.id);
    if (t) APP.openModal(WB.UI.taskDetailHTML(t.id));
  };
  ACT.toggleTask = (el) => {
    const t = findTask(el.dataset.id);
    if (t) setDone(t, !t.done);
  };
  ACT.toggleTaskDetail = (el) => {
    const id = el.dataset.id;
    syncTaskForm(id);
    const t = findTask(id);
    if (!t) return;
    setDone(t, !t.done);
    APP.openModal(WB.UI.taskDetailHTML(id));
  };
  function syncTaskForm(id) {
    const form = document.getElementById('taskEditForm');
    const t = findTask(id);
    if (!form || !t) return;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (title) t.title = title;
    t.priority = String(fd.get('priority') || t.priority || 'mid');
    t.due = String(fd.get('due') || '');
    t.reminder = String(fd.get('reminder') || '');
    t.repeat = String(fd.get('repeat') || 'none');
    t.progressMode = String(fd.get('progressMode') || 'auto');
    t.manualProgress = Math.max(0, Math.min(100, Number(fd.get('manualProgress')) || 0));
    WB.save();
  }
  ACT.saveTask = (el) => {
    const id = el.dataset.id;
    syncTaskForm(id);
    APP.closeModal(true);
    refresh();
    APP.toast('任务已保存', 'save');
  };
  ACT.archiveTask = (el) => {
    const id = el.dataset.id;
    syncTaskForm(id);
    const t = findTask(id);
    if (!t) return;
    t.archived = !t.archived;
    t.done = t.archived ? true : t.done;
    WB.save();
    APP.closeModal(true);
    refresh();
    APP.toast(t.archived ? '任务已归档' : '任务已取消归档', 'archive');
  };
  ACT.deleteTask = (el) => {
    const t = findTask(el.dataset.id);
    if (!t) return;
    APP.askConfirm('删除这个任务？', `「${t.title}」及其子任务会被删除，与任务关联的专注记录仍会保留。`, '删除', () => {
      WB.db.tasks = WB.db.tasks.filter((x) => x.id !== t.id);
      WB.db.ui.taskOrder = (WB.db.ui.taskOrder || []).filter((x) => x !== t.id);
      WB.save();
      refresh();
      APP.toast('任务已删除', 'trash');
    });
  };
  ACT.addSubtask = (el) => {
    const id = el.dataset.task;
    syncTaskForm(id);
    const t = findTask(id);
    const input = document.getElementById('newSubtaskInput');
    if (!t || !input) return;
    const title = input.value.trim();
    if (!title) { input.focus(); return; }
    t.subtasks.push({ id: U.uid('s'), title, done: false });
    WB.save();
    refresh();
    APP.openModal(WB.UI.taskDetailHTML(id));
    const ni = document.getElementById('newSubtaskInput');
    if (ni) ni.focus();
  };
  ACT.delSubtask = (el) => {
    const id = el.dataset.task, sid = el.dataset.sub;
    syncTaskForm(id);
    const t = findTask(id);
    if (!t) return;
    t.subtasks = t.subtasks.filter((s) => s.id !== sid);
    WB.save();
    refresh();
    APP.openModal(WB.UI.taskDetailHTML(id));
  };
  ACT.toggleSubtask = (el) => {
    const id = el.dataset.task, sid = el.dataset.sub;
    syncTaskForm(id);
    const t = findTask(id);
    if (!t) return;
    const s = t.subtasks.find((x) => x.id === sid);
    if (!s) return;
    s.done = el.checked;
    if (t.progressMode !== 'manual') t.progressMode = 'auto';
    WB.save();
    refresh();
    APP.openModal(WB.UI.taskDetailHTML(id));
  };
  ACT.startTaskPomodoro = (el) => APP.startTaskFocus(el.dataset.id);
  ACT.pinModule = (el) => {
    const key = el.dataset.key;
    const pins = WB.db.ui.modulePins || (WB.db.ui.modulePins = []);
    if (pins.includes(key)) WB.db.ui.modulePins = pins.filter((k) => k !== key);
    else pins.push(key);
    WB.save();
    refresh();
    APP.toast(pins.includes(key) ? '模块已置顶' : '已取消置顶', 'pin');
  };

  /* ---------- 番茄钟 ---------- */
  ACT.pomoToggle = () => {
    const st = WB.state.pomo;
    if (!st) return;
    if (st.running) APP.pausePomoTimer(); else APP.startPomoTimer();
    WB.UI.renderRail();
    WB.UI.renderNav();
  };
  ACT.pomoMode = (el) => {
    const mode = el.dataset.mode === 'break' ? 'break' : 'focus';
    if (WB.state.pomo && WB.state.pomo.running) APP.pausePomoTimer();
    WB.state.pomo = APP.makePomo(mode);
    refresh();
  };
  ACT.pomoReset = () => APP.resetPomo();
  ACT.pomoInterrupt = () => {
    const st = WB.state.pomo;
    if (!st || !st.running) { APP.toast('计时开始后才能记录打断', 'info', 'warn'); return; }
    st.interruptions = (st.interruptions || 0) + 1;
    WB.UI.updatePomoUI();
    APP.toast(`已记录第 ${st.interruptions} 次打断，慢慢拉回注意力`, 'alert');
  };
  ACT.toggleNoise = () => APP.setNoise(!WB.state.noise);
  ACT.savePomoSettings = () => {
    const form = document.getElementById('pomoSettingsForm');
    if (!form) return;
    const fd = new FormData(form);
    const f = Math.max(1, Math.min(180, Number(fd.get('focusMin')) || 25));
    const b = Math.max(1, Math.min(60, Number(fd.get('breakMin')) || 5));
    WB.db.settings.focusMin = f;
    WB.db.settings.breakMin = b;
    const st = WB.state.pomo;
    if (st && !st.running) WB.state.pomo = APP.makePomo(st.mode);
    WB.save();
    refresh();
    APP.toast(`节奏已保存：专注 ${f} 分钟 / 休息 ${b} 分钟`, 'timer');
  };

  /* ---------- 导出 CSV（由启动层补充实现） ---------- */
  function exportCSV(type) {
    if (WB.dataIO && WB.dataIO.exportCSV) WB.dataIO.exportCSV(type);
  }
  ACT.exportCSV = (el) => exportCSV(el.dataset.type);
  ACT.exportExpenses = () => exportCSV('expenses');

  /* ---------- 暴露工具 ---------- */
  WB.actionUtil = {
    refresh, go, togglePanel, setTheme, setAccent, syncTaskForm,
    syncExpForm: function () {
      const f = WB.UI.expForm();
      const amount = document.getElementById('expAmount');
      if (amount) f.amount = amount.value;
      const note = document.getElementById('expNote');
      if (note) f.note = note.value;
      const time = document.getElementById('expTime');
      if (time && time.value) {
        const parts = time.value.split('T');
        if (parts[0]) f.date = parts[0];
        if (parts[1]) f.time = parts[1];
      }
      const task = document.getElementById('expTask');
      if (task) f.taskId = task.value;
      WB.save();
      return f;
    }
  };
})();
