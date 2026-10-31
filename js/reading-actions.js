/* 阅读模块动作：书籍 CRUD / 封面 / 导入解析(EPUB·PDF·TXT) / 摘抄 / 目标 / 备份 */
(function () {
  const U = WB.util;
  const APP = WB.app;
  const ACT = WB.actions;

  function refresh() { WB.actionUtil.refresh(); }
  function books() { return WB.db.books || (WB.db.books = []); }
  function excerpts() { return WB.db.bookExcerpts || (WB.db.bookExcerpts = []); }
  function bookById(id) { return books().find((b) => b.id === id); }
  function readApi_addExcerpt(data) {
    const x = Object.assign({
      id: U.uid('bex'), bookId: '', text: '', note: '', page: '',
      color: 'key', tags: [], pinned: false, source: 'reader', createdAt: new Date().toISOString()
    }, data);
    excerpts().unshift(x);
    WB.save();
    return x;
  }
  function recordSession(bookId, minutes) {
    minutes = Math.round(Number(minutes) || 0);
    if (minutes < 1) return;
    (WB.db.readingSessions = WB.db.readingSessions || []).push({
      id: U.uid('rs'), bookId, date: U.dateKey(), minutes, createdAt: new Date().toISOString()
    });
    WB.save();
  }
  function moveBook(id, shelf, beforeId) {
    const b = bookById(id);
    if (!b) return;
    const oldShelf = b.shelf || 1;
    b.shelf = shelf;
    const mates = books().filter((x) => x.id !== id && (x.shelf || 1) === shelf)
      .sort((a, c) => (a.order || 0) - (c.order || 0));
    let idx = beforeId ? mates.findIndex((x) => x.id === beforeId) : -1;
    if (idx < 0) idx = mates.length;
    mates.splice(idx, 0, b);
    mates.forEach((x, i) => { x.order = i + 1; });
    if (oldShelf !== shelf) {
      books().filter((x) => x.id !== id && (x.shelf || 1) === oldShelf)
        .sort((a, c) => (a.order || 0) - (c.order || 0))
        .forEach((x, i) => { x.order = i + 1; });
    }
    if (WB.state.bookFilter) WB.state.bookFilter.sort = 'shelf';
    WB.save();
    refresh();
  }
  WB.readApi = { addExcerpt: readApi_addExcerpt, recordSession, bookById, moveBook };

  /* ============ 书籍弹窗 ============ */
  ACT.bkAdd = () => APP.openModal(WB.UI.bookFormHTML());
  ACT.bkEdit = (el) => APP.openModal(WB.UI.bookFormHTML(el.dataset.id));
  ACT.bkOpen = (el) => APP.openModal(WB.UI.bookDetailHTML(el.dataset.id));

  ACT.bkSaveBook = () => {
    const form = document.getElementById('bookForm');
    if (!form) return;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    if (!title) {
      APP.toast('请填写书名', 'alert', 'warn');
      const ti = document.getElementById('bkTitleInput');
      if (ti) ti.focus();
      return;
    }
    const id = form.dataset.id;
    let b = id ? bookById(id) : null;
    const isNew = !b;
    const oldCover = b ? (b.coverId || '') : '';
    if (isNew) {
      b = {
        id: U.uid('b'), fileId: '', format: '', progress: 0, shelf: 1,
        order: books().filter((x) => (x.shelf || 1) === 1).length + 1,
        tocTitles: [], totalChapters: 0, readPos: null, lastReadAt: '',
        createdAt: new Date().toISOString(), finishedAt: ''
      };
    }
    b.title = title;
    b.author = String(fd.get('author') || '').trim();
    b.category = String(fd.get('category') || '').trim();
    b.status = String(fd.get('status') || 'unread');
    b.intro = String(fd.get('intro') || '').trim();
    b.review = String(fd.get('review') || '').trim();
    b.coverTmpl = Number(fd.get('coverTmpl')) || 0;
    b.coverId = String(fd.get('coverId') || '');
    b.rating = Math.max(0, Math.min(5, Number(fd.get('rating')) || 0));
    if (b.status === 'read') { b.progress = 1; if (!b.finishedAt) b.finishedAt = U.dateKey(); }
    else { b.finishedAt = ''; if (b.status === 'unread') b.progress = 0; }
    if (isNew) books().push(b);
    if (oldCover && oldCover !== b.coverId) WB.idb.removeFile(oldCover).catch(() => {});
    WB.save();
    APP.closeModal();
    refresh();
    APP.toast(isNew ? `《${title}》已放上书架` : '书籍信息已保存', 'check');
  };

  ACT.bkStatus = (el) => {
    const f = WB.state.bookFilter || (WB.state.bookFilter = { q: '', status: 'all', category: 'all', rating: 'all', sort: 'shelf' });
    f.status = el.dataset.v || 'all';
    refresh();
  };

  ACT.bkSelect = (el, e) => {
    if (e && e.type === 'click') return; // select 的 click 不处理，交给 change
    const key = el.dataset.key;
    const v = el.value;
    const bf = WB.state.bookFilter || (WB.state.bookFilter = { q: '', status: 'all', category: 'all', rating: 'all', sort: 'shelf' });
    const ef = WB.state.exFilter || (WB.state.exFilter = { q: '', book: 'all', tag: 'all', time: 'all' });
    if (key === 'category') bf.category = v;
    else if (key === 'rating') bf.rating = v;
    else if (key === 'sort') bf.sort = v;
    else if (key === 'exBook') ef.book = v;
    else if (key === 'exTag') ef.tag = v;
    else if (key === 'exTime') ef.time = v;
    else return;
    refresh();
  };

  ACT.bkRatePick = (el) => {
    const v = Number(el.dataset.v) || 0;
    const input = document.getElementById('bkRatingInput');
    if (input) input.value = v;
    const row = document.getElementById('bkRateRow');
    if (row) row.querySelectorAll('.bk-rate').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) <= v));
  };

  ACT.bkTmplPick = (el) => {
    const v = Number(el.dataset.v) || 0;
    const t = document.getElementById('bkCoverTmpl');
    const cid = document.getElementById('bkCoverId');
    const ti = document.getElementById('bkTitleInput');
    if (t) t.value = v;
    if (cid) cid.value = '';
    document.querySelectorAll('#bkTmplRow .bk-tmpl').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === v));
    const prev = document.getElementById('bkCoverPreview');
    if (prev) prev.innerHTML = WB.UI.coverHTML({ title: (ti && ti.value.trim()) || '书名', author: '作者', coverTmpl: v });
  };

  ACT.bkPickCover = () => {
    const i = document.getElementById('coverUpload');
    if (i) i.click();
  };
  ACT.bkClearCover = () => {
    const cid = document.getElementById('bkCoverId');
    if (cid) cid.value = '';
    const t = document.getElementById('bkCoverTmpl');
    const ti = document.getElementById('bkTitleInput');
    const prev = document.getElementById('bkCoverPreview');
    if (prev) prev.innerHTML = WB.UI.coverHTML({ title: (ti && ti.value.trim()) || '书名', author: '作者', coverTmpl: Number(t && t.value) || 0 });
    document.querySelectorAll('#bkTmplRow .bk-tmpl').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === (Number(t && t.value) || 0)));
    APP.toast('已切回默认封面模板', 'image');
  };

  async function onCoverPicked(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) { APP.toast('请选择图片文件', 'alert', 'warn'); return; }
    if (file.size > 8 * 1024 * 1024) { APP.toast('图片过大，请选择 8MB 以内的图片', 'alert', 'warn'); return; }
    const id = U.uid('c');
    await WB.idb.putFile(id, file);
    const cid = document.getElementById('bkCoverId');
    if (cid) cid.value = id;
    document.querySelectorAll('#bkTmplRow .bk-tmpl').forEach((b) => b.classList.remove('active'));
    const prev = document.getElementById('bkCoverPreview');
    if (prev) prev.innerHTML = `<div class="bk-cover has-img"><img src="${URL.createObjectURL(file)}" alt="封面预览"></div>`;
    APP.toast('封面已设置，保存后生效', 'image');
  }

  /* ============ 状态 / 详情 / 删除 ============ */
  ACT.bkRead = (el) => {
    const id = el.dataset.id;
    APP.closeModal(true);
    if (WB.Reader && WB.Reader.open) WB.Reader.open(id);
    else APP.toast('阅读器加载中，请稍后再试', 'alert', 'warn');
  };

  ACT.bkSetStatus = (el) => {
    const b = bookById(el.dataset.id);
    if (!b) return;
    const v = el.dataset.v;
    const prev = b.status;
    b.status = v;
    if (v === 'read') {
      b.progress = 1;
      if (!b.finishedAt) b.finishedAt = U.dateKey();
      if (prev !== 'read') APP.toast('恭喜读完！进度已同步为 100%', 'check');
    } else if (v === 'reading') {
      b.finishedAt = '';
      if ((Number(b.progress) || 0) >= 1) { b.progress = 0.99; APP.toast('原进度 100%，已回退为 99%', 'info'); }
    } else {
      b.progress = 0; b.finishedAt = ''; b.readPos = null;
    }
    WB.save();
    refresh();
    APP.openModal(WB.UI.bookDetailHTML(b.id));
  };

  ACT.bkSaveReview = (el) => {
    const b = bookById(el.dataset.id);
    const ta = document.getElementById('bkReviewInput');
    if (!b || !ta) return;
    b.review = ta.value.trim();
    WB.save();
    APP.toast('读后感已保存', 'save');
  };

  ACT.bkDelete = (el) => {
    const b = bookById(el.dataset.id);
    if (!b) return;
    APP.askConfirm('删除书籍', `确定删除《${b.title}》吗？其摘抄、书签与阅读记录会一并移除，且不可恢复。`, '删除', async () => {
      WB.db.books = books().filter((x) => x.id !== b.id);
      WB.db.bookExcerpts = excerpts().filter((x) => x.bookId !== b.id);
      WB.db.bookMarks = (WB.db.bookMarks || []).filter((x) => x.bookId !== b.id);
      WB.db.readingSessions = (WB.db.readingSessions || []).filter((x) => x.bookId !== b.id);
      if (b.coverId) await WB.idb.removeFile(b.coverId).catch(() => {});
      if (b.fileId) await WB.idb.removeFile(b.fileId).catch(() => {});
      WB.save();
      APP.closeModal(true);
      refresh();
      APP.toast(`《${b.title}》已删除`, 'trash');
    });
  };

  /* ============ 目标 / 报告 / 备份 ============ */
  ACT.bkGoal = () => APP.openModal(WB.UI.goalHTML());
  ACT.bkSaveGoal = () => {
    const form = document.getElementById('goalForm');
    if (!form) return;
    const fd = new FormData(form);
    WB.db.readingGoal = {
      monthly: Math.max(1, Math.min(60, Number(fd.get('monthly')) || 4)),
      dailyMin: Math.max(5, Math.min(600, Number(fd.get('dailyMin')) || 30)),
      remind: fd.get('remind') === 'on'
    };
    WB.save();
    APP.closeModal();
    refresh();
    APP.toast('阅读目标已保存', 'target');
  };

  ACT.bkReport = () => APP.openModal(WB.UI.reportHTML());

  ACT.bkExportData = () => {
    const data = {
      type: 'reading-backup', version: 1, exportedAt: new Date().toISOString(),
      books: WB.db.books || [], bookExcerpts: WB.db.bookExcerpts || [],
      bookMarks: WB.db.bookMarks || [], readingSessions: WB.db.readingSessions || [],
      readingGoal: WB.db.readingGoal || {}, readerSettings: WB.db.readerSettings || {}
    };
    U.download(`阅读书房备份-${U.dateKey()}.json`, JSON.stringify(data, null, 2), 'application/json');
    APP.toast('备份已导出（不含封面与书籍文件本体）', 'download');
  };

  /* ============ 摘抄 ============ */
  ACT.bkExAdd = () => APP.openModal(WB.UI.excerptFormHTML());
  ACT.bkExEdit = (el) => APP.openModal(WB.UI.excerptFormHTML(el.dataset.id));

  ACT.bkSaveExcerpt = () => {
    const form = document.getElementById('excerptForm');
    if (!form) return;
    const fd = new FormData(form);
    const text = String(fd.get('text') || '').trim();
    if (!text) { APP.toast('请填写摘抄内容', 'alert', 'warn'); return; }
    const id = form.dataset.id;
    let x = id ? excerpts().find((e) => e.id === id) : null;
    const isNew = !x;
    if (isNew) x = { id: U.uid('ex'), pinned: false, source: 'manual', createdAt: new Date().toISOString() };
    x.text = text;
    x.bookId = String(fd.get('bookId') || '');
    x.page = String(fd.get('page') || '').trim();
    x.color = String(fd.get('color') || 'key');
    x.tags = fd.getAll('tags').map(String);
    x.note = String(fd.get('note') || '').trim();
    if (isNew) excerpts().unshift(x);
    WB.save();
    APP.closeModal();
    refresh();
    APP.toast('摘抄已保存', 'quote');
  };

  ACT.bkExPin = (el) => {
    const x = excerpts().find((e) => e.id === el.dataset.id);
    if (!x) return;
    x.pinned = !x.pinned;
    WB.save();
    refresh();
    APP.toast(x.pinned ? '已收藏置顶' : '已取消置顶', 'pin');
  };

  ACT.bkExDel = (el) => {
    const x = excerpts().find((e) => e.id === el.dataset.id);
    if (!x) return;
    APP.askConfirm('删除摘抄', '确定删除这条摘抄吗？不可恢复。', '删除', () => {
      WB.db.bookExcerpts = excerpts().filter((e) => e.id !== x.id);
      WB.save();
      refresh();
      APP.toast('摘抄已删除', 'trash');
    });
  };

  ACT.bkExCopy = async (el) => {
    const x = excerpts().find((e) => e.id === el.dataset.id);
    if (!x) return;
    const b = bookById(x.bookId);
    const text = `${x.text}${b ? `\n——《${b.title}》` : ''}${x.page ? ` ${x.page}` : ''}`;
    try {
      await navigator.clipboard.writeText(text);
      APP.toast('已复制到剪贴板', 'copy');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); APP.toast('已复制到剪贴板', 'copy'); }
      catch (e2) { APP.toast('复制失败，请手动选择复制', 'alert', 'warn'); }
      ta.remove();
    }
  };

  ACT.bkExToTask = (el) => {
    const x = excerpts().find((e) => e.id === el.dataset.id);
    if (!x) return;
    const b = bookById(x.bookId);
    const t = {
      id: U.uid('t'),
      title: `【灵感】${x.text.slice(0, 40)}${x.text.length > 40 ? '…' : ''}`,
      priority: 'mid', due: '', reminder: '', repeat: 'none',
      progressMode: 'auto', manualProgress: 0, focusMinutes: 0,
      subtasks: [{
        id: U.uid('st'),
        title: `来源：${b ? '《' + b.title + '》' : '未关联书籍'}${x.page ? ' · ' + x.page : ''}${x.note ? '｜笔记：' + x.note.slice(0, 60) : ''}`,
        done: false
      }],
      done: false, archived: false, pinned: false,
      createdAt: new Date().toISOString()
    };
    WB.db.tasks.unshift(t);
    if (WB.db.ui && Array.isArray(WB.db.ui.taskOrder)) WB.db.ui.taskOrder.unshift(t.id);
    WB.save();
    APP.toast('已加入灵感箱（任务列表顶部）', 'sparkles');
  };

  ACT.bkExExportMD = () => {
    const list = excerpts().slice().sort((a, b2) => String(a.createdAt).localeCompare(String(b2.createdAt)));
    if (!list.length) { APP.toast('还没有摘抄可导出', 'info', 'warn'); return; }
    const CN = WB.READ_EX_COLORS || { key: '重点', question: '疑问', quote: '金句' };
    const byBook = {};
    list.forEach((x) => {
      const b = bookById(x.bookId);
      const k = b ? `《${b.title}》${b.author ? ' · ' + b.author : ''}` : '未关联书籍';
      (byBook[k] = byBook[k] || []).push(x);
    });
    let md = `# 阅读摘抄合集\n\n> 导出于 ${new Date().toLocaleString('zh-CN')} · 共 ${list.length} 条\n`;
    Object.entries(byBook).forEach(([k, xs]) => {
      md += `\n## ${k}\n`;
      xs.forEach((x) => {
        md += `\n> ${x.text.replace(/\n/g, '\n> ')}\n\n`;
        md += `- 标记：${CN[x.color] || '重点'}${x.page ? `｜位置：${x.page}` : ''}${(x.tags || []).length ? `｜标签：${x.tags.join('、')}` : ''}\n`;
        if (x.note) md += `- 笔记：${x.note.replace(/\n/g, ' ')}\n`;
      });
    });
    U.download(`阅读摘抄-${U.dateKey()}.md`, md, 'text/markdown;charset=utf-8');
    APP.toast('Markdown 已导出', 'download');
  };

  /* ---------- 摘抄分享图 ---------- */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function wrapText(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }
  ACT.bkExShare = (el) => {
    const x = excerpts().find((e) => e.id === el.dataset.id);
    if (!x) return;
    const b = bookById(x.bookId);
    const W = 900, H = 1200;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#f6ecdf'); g.addColorStop(0.55, '#efdfcc'); g.addColorStop(1, '#e7d3bd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(184,142,102,0.10)';
    ctx.beginPath(); ctx.arc(120, 140, 180, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(800, 1060, 220, 0, 7); ctx.fill();
    const cx = 80, cy = 150, cw = W - 160, ch = H - 300;
    ctx.shadowColor = 'rgba(120,85,50,0.25)';
    ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = 'rgba(255,252,247,0.96)';
    roundRect(ctx, cx, cy, cw, ch, 36);
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#c79b6d';
    ctx.font = '120px Georgia, "Times New Roman", serif';
    ctx.fillText('\u201C', cx + 36, cy + 130);
    ctx.fillStyle = '#4a3a2e';
    ctx.font = '34px "PingFang SC", "Microsoft YaHei", serif';
    const lines = wrapText(ctx, x.text, cw - 160);
    const lh = 56;
    const maxLines = Math.max(3, Math.floor((ch - 330) / lh));
    let ty = cy + 210;
    lines.slice(0, maxLines).forEach((ln, i) => {
      let t = ln;
      if (i === maxLines - 1 && lines.length > maxLines) t = t.replace(/[，。、；…\s]*$/, '') + '…';
      ctx.fillText(t, cx + 80, ty);
      ty += lh;
    });
    ctx.strokeStyle = 'rgba(184,142,102,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + 80, cy + ch - 130); ctx.lineTo(cx + 200, cy + ch - 130); ctx.stroke();
    ctx.fillStyle = '#8a6d52';
    ctx.font = '28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`——《${b ? b.title : '未关联书籍'}》${x.page ? ' · ' + x.page : ''}`, cx + 80, cy + ch - 80);
    ctx.fillStyle = '#b39b80';
    ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(`茶歇工作台 · 阅读书房 · ${new Date().toLocaleDateString('zh-CN')}`, cx + 80, cy + ch - 40);
    cv.toBlob((blob) => {
      if (!blob) { APP.toast('生成图片失败', 'alert', 'warn'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `摘抄-${(b ? b.title : '分享').replace(/[\\/:*?"<>|]/g, '').slice(0, 12)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      APP.toast('分享图片已生成', 'image');
    }, 'image/png');
  };

  /* ============ 导入解析 ============ */
  let importTargetId = null; // null=工具栏批量；''=添加表单；其他=书籍 id
  ACT.bkImport = () => {
    importTargetId = null;
    const i = document.getElementById('bookFileInput');
    if (i) i.click();
  };
  ACT.bkImportFor = (el) => {
    importTargetId = el.dataset.id || '';
    const i = document.getElementById('bookFileInput');
    if (i) i.click();
  };

  function reopenAfterImport(id) {
    const slot = document.getElementById('modalSlot');
    if (!slot || !slot.firstChild) return;
    if (slot.querySelector('.book-detail') && id) APP.openModal(WB.UI.bookDetailHTML(id));
    else if (slot.querySelector('.book-form-modal')) APP.openModal(WB.UI.bookFormHTML(id || undefined));
  }

  async function onBookFiles(input) {
    const files = [...(input.files || [])];
    input.value = '';
    if (!files.length) return;
    APP.toast(files.length > 1 ? `正在解析 ${files.length} 个文件…` : `正在解析「${files[0].name}」…`, 'upload');
    let ok = 0, fail = 0;
    let firstId = importTargetId || null;
    for (const file of files) {
      try {
        const b = await importOneBook(file, firstId || undefined);
        if (b) { ok++; if (!firstId) firstId = b.id; }
      } catch (e) {
        console.warn('[reading] 导入失败', file.name, e);
        fail++;
      }
    }
    WB.save();
    refresh();
    reopenAfterImport(firstId);
    const last = firstId ? bookById(firstId) : null;
    if (fail && !ok) APP.toast('导入失败：文件可能损坏或格式不受支持', 'alert', 'warn');
    else if (fail) APP.toast(`成功导入 ${ok} 本，${fail} 个文件失败`, 'alert', 'warn');
    else APP.toast(ok > 1 ? `已导入 ${ok} 本书` : `《${last ? last.title : ''}》已导入`, 'check');
    importTargetId = null;
  }

  async function importOneBook(file, targetId) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['epub', 'pdf', 'txt', 'md'].includes(ext)) throw new Error('不支持的格式：' + ext);
    let b = targetId ? bookById(targetId) : null;
    const isNew = !b;
    if (isNew) {
      b = {
        id: U.uid('b'), title: file.name.replace(/\.[^.]+$/, ''), author: '', category: '',
        status: 'unread', rating: 0, intro: '', review: '',
        coverTmpl: Math.floor(Math.random() * 6), coverId: '', fileId: '', format: '',
        progress: 0, shelf: 1, order: books().filter((x) => (x.shelf || 1) === 1).length + 1,
        tocTitles: [], totalChapters: 0, readPos: null, lastReadAt: '',
        createdAt: new Date().toISOString(), finishedAt: ''
      };
    }
    if (ext === 'epub') {
      const meta = await parseEpub(file);
      if (isNew) { b.title = meta.title || b.title; b.author = meta.author || ''; }
      else if (!b.author && meta.author) b.author = meta.author;
      if (meta.cover && !b.coverId) {
        b.coverId = U.uid('c');
        await WB.idb.putFile(b.coverId, meta.cover);
      }
      if (!meta.chapters.length) throw new Error('EPUB 中没有可读章节');
      if (b.fileId) await WB.idb.removeFile(b.fileId).catch(() => {});
      b.fileId = U.uid('bk');
      await WB.idb.putFile(b.fileId, new Blob([JSON.stringify({ chapters: meta.chapters })], { type: 'application/json' }));
      b.format = 'epub';
      b.tocTitles = meta.tocTitles;
      b.totalChapters = meta.chapters.length;
    } else if (ext === 'txt' || ext === 'md') {
      const text = await readTextFile(file);
      const chapters = splitChapters(text);
      if (b.fileId) await WB.idb.removeFile(b.fileId).catch(() => {});
      b.fileId = U.uid('bk');
      await WB.idb.putFile(b.fileId, new Blob([JSON.stringify({ chapters })], { type: 'application/json' }));
      b.format = ext;
      b.tocTitles = chapters.map((c) => c.title);
      b.totalChapters = chapters.length;
    } else { // pdf
      const meta = await parsePdfMeta(file).catch(() => ({}));
      if (isNew) {
        if (meta.title) b.title = meta.title;
        if (meta.author) b.author = meta.author;
      } else if (!b.author && meta.author) b.author = meta.author;
      if (b.fileId) await WB.idb.removeFile(b.fileId).catch(() => {});
      b.fileId = U.uid('bk');
      await WB.idb.putFile(b.fileId, file);
      b.format = 'pdf';
      b.tocTitles = [];
      b.totalChapters = 0;
    }
    if (isNew) books().push(b);
    return b;
  }

  /* ---------- 文本读取（UTF-8 / GBK 自适应） ---------- */
  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) {
      try { return new TextDecoder('gbk').decode(buf); }
      catch (e2) { return new TextDecoder('utf-8').decode(buf); }
    }
  }

  /* ---------- TXT/MD 章节切分 ---------- */
  function splitChapters(text) {
    text = String(text || '').replace(/\r\n?/g, '\n');
    const re = /(^|\n)[ \t]*(第[0-9一二三四五六七八九十百千零两]+[章节卷回部篇][^\n]{0,40})/g;
    const marks = [];
    let m;
    while ((m = re.exec(text))) marks.push({ idx: m.index + m[1].length, title: m[2].trim() });
    if (!marks.length) return [{ title: '全文', text: text.trim() }];
    const chapters = [];
    if (marks[0].idx > 0 && text.slice(0, marks[0].idx).trim().length > 50) {
      chapters.push({ title: '卷首', text: text.slice(0, marks[0].idx).trim() });
    }
    for (let i = 0; i < marks.length; i++) {
      const start = marks[i].idx;
      const end = i + 1 < marks.length ? marks[i + 1].idx : text.length;
      const body = text.slice(start, end).trim();
      if (body) chapters.push({ title: marks[i].title, text: body });
    }
    return chapters.length ? chapters : [{ title: '全文', text: text.trim() }];
  }

  /* ---------- HTML → 纯文本 ---------- */
  function htmlToText(html) {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article|tr)>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/[ \t ]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* ---------- ZIP 读取（DecompressionStream 原生解压） ---------- */
  async function unzip(buf) {
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65536); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 EPUB(ZIP) 文件');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    const files = {};
    for (let i = 0; i < count; i++) {
      if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
      const method = dv.getUint16(off + 10, true);
      const csize = dv.getUint32(off + 20, true);
      const nameLen = dv.getUint16(off + 28, true);
      const extraLen = dv.getUint16(off + 30, true);
      const cmtLen = dv.getUint16(off + 32, true);
      const localOff = dv.getUint32(off + 42, true);
      const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
      if (localOff + 30 <= u8.length && dv.getUint32(localOff, true) === 0x04034b50) {
        const lNameLen = dv.getUint16(localOff + 26, true);
        const lExtraLen = dv.getUint16(localOff + 28, true);
        const dataStart = localOff + 30 + lNameLen + lExtraLen;
        files[name] = { method, raw: u8.subarray(dataStart, Math.min(u8.length, dataStart + csize)) };
      }
      off += 46 + nameLen + extraLen + cmtLen;
    }
    async function read(name) {
      const f = files[name];
      if (!f) return null;
      if (f.method === 0) return f.raw;
      const stream = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const ab = await new Response(stream).arrayBuffer();
      return new Uint8Array(ab);
    }
    return { names: Object.keys(files), read };
  }

  /* ---------- EPUB 解析 ---------- */
  async function parseEpub(file) {
    const buf = await file.arrayBuffer();
    const zip = await unzip(buf);
    const dec = new TextDecoder();
    const readText = async (n) => { const d = await zip.read(n); return d ? dec.decode(d) : null; };
    const container = await readText('META-INF/container.xml');
    if (!container) throw new Error('EPUB 缺少 container.xml');
    const opfPath = (container.match(/full-path=["']([^"']+)["']/) || [])[1];
    if (!opfPath) throw new Error('EPUB 缺少 OPF 路径');
    const opf = await readText(opfPath);
    if (!opf) throw new Error('OPF 读取失败');
    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const pick = (re) => { const m = opf.match(re); return m ? m[1].trim() : ''; };
    const title = htmlToText(pick(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/)) || file.name.replace(/\.epub$/i, '');
    const author = htmlToText(pick(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/));
    // manifest
    const manifest = {};
    const itemRe = /<item\s[^>]*>/gi;
    let m;
    while ((m = itemRe.exec(opf))) {
      const tag = m[0];
      const id = (tag.match(/id=["']([^"']+)["']/) || [])[1];
      const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
      const mt = (tag.match(/media-type=["']([^"']+)["']/) || [])[1] || '';
      const props = (tag.match(/properties=["']([^"']+)["']/) || [])[1] || '';
      if (id && href) manifest[id] = { href, mt, props };
    }
    // 封面
    let cover = null;
    const coverMeta = pick(/<meta\s+name=["']cover["']\s+content=["']([^"']+)["']/) ||
      pick(/<meta\s+content=["']([^"']+)["']\s+name=["']cover["']/);
    let coverItem = coverMeta && manifest[coverMeta];
    if (!coverItem) coverItem = Object.values(manifest).find((it) => it.props.includes('cover-image'));
    if (!coverItem) coverItem = Object.values(manifest).find((it) => /^image\//.test(it.mt) && /cover/i.test(it.href));
    if (coverItem) {
      try {
        const data = await zip.read(baseDir + coverItem.href);
        if (data) cover = new Blob([data], { type: coverItem.mt || 'image/jpeg' });
      } catch (e) { /* 封面读取失败不阻塞 */ }
    }
    // spine 顺序
    const spine = [];
    const irefRe = /<itemref\s[^>]*idref=["']([^"']+)["'][^>]*>/gi;
    while ((m = irefRe.exec(opf))) spine.push(m[1]);
    // 目录：NCX 优先，其次 EPUB3 nav
    let tocTitles = [];
    const ncxItem = Object.values(manifest).find((it) => it.mt.includes('ncx'));
    if (ncxItem) {
      const ncx = await readText(baseDir + ncxItem.href);
      if (ncx) {
        tocTitles = [...ncx.matchAll(/<navLabel>[\s\S]*?<text[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>/g)]
          .map((x) => htmlToText(x[1])).filter(Boolean);
      }
    }
    if (!tocTitles.length) {
      const navItem = Object.values(manifest).find((it) => it.props.includes('nav'));
      if (navItem) {
        const nav = await readText(baseDir + navItem.href);
        if (nav) {
          const navBlock = (nav.match(/<nav[^>]*toc[^>]*>([\s\S]*?)<\/nav>/i) || [])[1] || nav;
          tocTitles = [...navBlock.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/gi)].map((x) => htmlToText(x[1])).filter(Boolean);
        }
      }
    }
    // 章节正文
    const chapters = [];
    const docs = spine.map((id) => manifest[id]).filter((it) => it && /xhtml|html/i.test(it.mt + ' ' + it.href));
    for (let i = 0; i < docs.length; i++) {
      const txt = await readText(baseDir + docs[i].href);
      if (!txt) continue;
      const text = htmlToText(txt);
      if (!text || text.length < 10) continue;
      chapters.push({ title: tocTitles[chapters.length] || `第 ${chapters.length + 1} 节`, text });
      if (chapters.length >= 500) break;
    }
    if (!tocTitles.length) tocTitles = chapters.map((c) => c.title);
    return { title, author, cover, chapters, tocTitles };
  }

  /* ---------- PDF 元数据（尽力而为） ---------- */
  function decodePdfStr(s) {
    if (s.charCodeAt(0) === 0xFE && s.charCodeAt(1) === 0xFF) {
      let out = '';
      for (let i = 2; i + 1 < s.length; i += 2) out += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
      return out;
    }
    return s;
  }
  async function parsePdfMeta(file) {
    const buf = await file.arrayBuffer();
    const head = new TextDecoder('latin1').decode(buf.slice(0, 400 * 1024));
    const pickM = (key) => {
      const m = head.match(new RegExp('/' + key + '\\s*\\(([^)]*)\\)'));
      return m ? decodePdfStr(m[1].replace(/\\([()\\])/g, '$1')).trim() : '';
    };
    return { title: pickM('Title'), author: pickM('Author') };
  }

  /* ---------- 隐藏文件输入（自包含监听） ---------- */
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.type !== 'file') return;
    if (t.id === 'coverUpload') onCoverPicked(t);
    else if (t.id === 'bookFileInput') onBookFiles(t);
  });
})();
