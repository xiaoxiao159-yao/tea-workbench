/* 阅读器：双模式翻页 / 设置记忆 / 目录书签搜索 / 进度保存 / 划线摘抄 / 番茄钟联动 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;
  const APP = WB.app;

  const BG_NAMES = { milk: '奶茶', paper: '羊皮纸', eye: '护眼绿', night: '夜间' };
  const FONT_NAMES = { serif: '衬线', sans: '黑体', kai: '楷体' };

  /* ---------- 运行时状态 ---------- */
  const R = {
    book: null, chapters: [], chapter: 0, ratio: 0,
    pdfUrl: '', root: null, timer: null, totalSeconds: 0, lastTick: 0,
    pdfBlob: null, pdfDoc: null, pdfPage: 1, pdfZoom: 1, pdfTotal: 0, pdfTask: null,
    pomo: null, sideTab: '', saveT: null, bound: false
  };

  function settings() {
    if (!WB.db.readerSettings) WB.db.readerSettings = { mode: 'swipe', font: 'serif', fontSize: 17, lineHeight: 1.8, bg: 'paper', margin: 24 };
    return WB.db.readerSettings;
  }

  /* ---------- 打开 ---------- */
  async function open(bookId) {
    const book = WB.readApi.bookById(bookId);
    if (!book) return;
    if (R.book) close(true);
    if (!book.fileId) {
      APP.toast('这本书还没有内容文件，请先在详情中导入 EPUB / PDF / TXT', 'alert', 'warn');
      APP.openModal(WB.UI.bookDetailHTML(bookId));
      return;
    }
    const file = await WB.idb.getFile(book.fileId);
    if (!file) { APP.toast('内容文件缺失，请重新导入', 'alert', 'warn'); return; }

    R.book = book;
    R.chapter = 0; R.ratio = 0; R.totalSeconds = 0; R.pomo = null; R.sideTab = '';
    book.status = book.status === 'unread' ? 'reading' : book.status;
    book.lastReadAt = new Date().toISOString();

    if (book.format === 'pdf') {
      const blob = normalizePdfBlob(file);
      if (!blob) {
        APP.toast('PDF 文件读取失败，请重新导入', 'alert', 'warn');
        R.book = null;
        return;
      }
      R.pdfBlob = blob;
      R.pdfUrl = URL.createObjectURL(blob);
      R.pdfPage = Math.max(1, Number(book.readPage) || 1);
      R.pdfZoom = 1;
      R.pdfDoc = null;
      R.pdfTotal = 0;
      R.chapters = [];
    } else {
      let data = null;
      try { data = JSON.parse(await file.text()); } catch (e) {}
      if (!data || !Array.isArray(data.chapters) || !data.chapters.length) {
        APP.toast('内容解析失败，请重新导入', 'alert', 'warn');
        R.book = null;
        return;
      }
      R.chapters = data.chapters;
      const pos = book.readPos || {};
      if (Number.isFinite(pos.chapter) && pos.chapter >= 0 && pos.chapter < R.chapters.length) {
        R.chapter = pos.chapter;
        R.ratio = Math.max(0, Math.min(1, Number(pos.ratio) || 0));
      }
    }
    WB.save();
    buildDOM();
    bind();
    applySettings(false);
    if (book.format === 'pdf') renderPdf();
    else renderChapter();
    startPassiveTimer();
    const pos = book.readPos;
    APP.toast(pos && (pos.chapter > 0 || pos.ratio > 0.01) ? '已回到上次的阅读位置' : `开始阅读《${book.title}》`, 'bookOpen');
  }

  /* ---------- DOM ---------- */
  function buildDOM() {
    const b = R.book;
    const root = document.createElement('div');
    root.id = 'readerRoot';
    root.className = 'reader-root';
    const isPdf = b.format === 'pdf';
    root.innerHTML = `
      <header class="rd-top">
        <button class="rd-btn rd-close" data-rd="close" title="返回书架 (Esc)">${IC.icon('arrowLeft')}<span>书架</span></button>
        <div class="rd-title"><b>${esc(b.title)}</b><span id="rdChapterName">${isPdf ? 'PDF 阅读' : ''}</span></div>
        <div class="rd-tools">
          <button class="rd-btn" data-rd="pomo" id="rdPomoBtn" title="开始阅读番茄钟">${IC.icon('timer')}</button>
          ${isPdf
            ? `<button class="rd-btn rd-zoom" data-rd="zoomOut" title="缩小">A−</button>
               <button class="rd-btn rd-zoom" data-rd="zoomIn" title="放大">A＋</button>`
            : `<button class="rd-btn" data-rd="bookmark" id="rdMarkBtn" title="添加书签">${IC.icon('bookmark')}</button>
          <button class="rd-btn" data-rd="side" title="目录 · 书签 · 搜索">${IC.icon('list')}</button>`}
          <button class="rd-btn" data-rd="set" title="阅读设置">${IC.icon('settings')}</button>
        </div>
      </header>
      <div class="rd-main">
        <div class="rd-body" id="rdBody"></div>
        <aside class="rd-side" id="rdSide" hidden></aside>
      </div>
      <footer class="rd-foot">
        ${isPdf
          ? `<button class="rd-btn" data-rd="prev" title="上一页">${IC.icon('chevronL')}</button>
             <input id="rdProgress" type="range" min="0" max="1000" value="${Math.round((Number(b.progress) || 0) * 1000)}" aria-label="阅读进度">
             <span class="rd-pct" id="rdPct">${Math.round((Number(b.progress) || 0) * 100)}%</span>
             <button class="rd-btn" data-rd="next" title="下一页">${IC.icon('chevronR')}</button>`
          : `<button class="rd-btn" data-rd="prev" title="上一页">${IC.icon('chevronL')}</button>
             <input id="rdProgress" type="range" min="0" max="1000" value="0" aria-label="阅读进度">
             <span class="rd-pct" id="rdPct">0%</span>
             <button class="rd-btn" data-rd="next" title="下一页">${IC.icon('chevronR')}</button>`}
      </footer>
      <div class="rd-sel-tools" id="rdSelTools" hidden></div>
      <div class="rd-set-panel" id="rdSetPanel" hidden></div>
      <div class="rd-pomo" id="rdPomo" hidden></div>`;
    document.body.appendChild(root);
    document.body.classList.add('reader-open');
    R.root = root;
    renderSetPanel();
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    if (R.bound) return;
    R.bound = true;
    R.root.addEventListener('click', onRootClick);
    R.root.querySelector('#rdProgress').addEventListener('input', onSlider);
    document.addEventListener('keydown', onKey);
    document.addEventListener('selectionchange', onSelection);
    bindGestures();
  }
  function unbind() {
    if (!R.bound) return;
    R.bound = false;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('selectionchange', onSelection);
  }

  const RD_ACT = {
    close: () => close(),
    prev: () => turn(-1),
    next: () => turn(1),
    set: () => { const p = document.getElementById('rdSetPanel'); if (p) p.hidden = !p.hidden; },
    side: () => toggleSide('toc'),
    bookmark: () => toggleBookmark(),
    pomo: () => (R.pomo ? stopPomo(true) : startPomo()),
    toc: () => toggleSide('toc'),
    marks: () => toggleSide('marks'),
    searchTab: () => toggleSide('search'),
    mode: (v) => { settings().mode = v; WB.save(); applySettings(); anchorScroll(); },
    font: (v) => { settings().font = v; WB.save(); applySettings(); },
    bg: (v) => { settings().bg = v; WB.save(); applySettings(); },
    fsDown: () => { const s = settings(); s.fontSize = Math.max(13, s.fontSize - 1); WB.save(); applySettings(); anchorScroll(); },
    fsUp: () => { const s = settings(); s.fontSize = Math.min(28, s.fontSize + 1); WB.save(); applySettings(); anchorScroll(); },
    lhDown: () => { const s = settings(); s.lineHeight = Math.max(1.4, Math.round((s.lineHeight - 0.1) * 10) / 10); WB.save(); applySettings(); },
    lhUp: () => { const s = settings(); s.lineHeight = Math.min(2.4, Math.round((s.lineHeight + 0.1) * 10) / 10); WB.save(); applySettings(); },
    mgDown: () => { const s = settings(); s.margin = Math.max(8, s.margin - 4); WB.save(); applySettings(); anchorScroll(); },
    mgUp: () => { const s = settings(); s.margin = Math.min(72, s.margin + 4); WB.save(); applySettings(); anchorScroll(); },
    gotoChapter: (el) => gotoChapter(Number(el.dataset.chapter) || 0, 0),
    gotoMark: (el) => {
      gotoChapter(Number(el.dataset.chapter) || 0, Number(el.dataset.ratio) || 0);
    },
    delMark: (el) => {
      const i = (WB.db.bookMarks || []).findIndex((m) => m.id === el.dataset.id);
      if (i >= 0) { WB.db.bookMarks.splice(i, 1); WB.save(); renderSide(); APP.toast('书签已删除', 'bookmark'); }
    },
    gotoHit: (el) => {
      const ci = Number(el.dataset.chapter) || 0;
      const pos = Number(el.dataset.pos) || 0;
      const len = (R.chapters[ci] && R.chapters[ci].text.length) || 1;
      gotoChapter(ci, Math.min(0.98, pos / len));
    },
    hl: (el) => highlightSelection(el.dataset.color || 'key'),
    noteSel: () => noteFromSelection(),
    zoomIn: () => pdfZoom(0.15),
    zoomOut: () => pdfZoom(-0.15),
    embedPdf: () => embedPdf()
  };

  function onRootClick(e) {
    const el = e.target.closest('[data-rd]');
    if (!el || !R.root.contains(el)) return;
    const fn = RD_ACT[el.dataset.rd];
    if (fn) { e.preventDefault(); fn(el, el.dataset.v); }
  }

  function onKey(e) {
    if (!R.root) return;
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'Escape') {
      const layer = document.getElementById('modalLayer');
      if (layer && !layer.classList.contains('hidden')) return; // 让全局关闭弹窗
      const sp = document.getElementById('rdSetPanel');
      if (sp && !sp.hidden) { sp.hidden = true; e.stopPropagation(); return; }
      const side = document.getElementById('rdSide');
      if (side && !side.hidden) { side.hidden = true; e.stopPropagation(); return; }
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowLeft') { turn(-1); }
    else if (e.key === 'ArrowRight') { turn(1); }
  }

  /* ---------- 章节渲染 ---------- */
  function chapterExcerpts() {
    return (WB.db.bookExcerpts || []).filter((x) => x.bookId === R.book.id && x.source === 'reader');
  }
  function markIntoParagraph(p) {
    const norm = p.replace(/\s+/g, ' ').trim();
    let html = esc(p);
    const list = chapterExcerpts()
      .filter((x) => x.page === (R.chapters[R.chapter] || {}).title)
      .sort((a, b) => b.text.length - a.text.length);
    for (const x of list) {
      const t = x.text.replace(/\s+/g, ' ').trim();
      if (t.length < 4 || !norm.includes(t)) continue;
      const needle = esc(x.text).replace(/\s+/g, ' ');
      const idx = html.indexOf(needle);
      if (idx === -1) continue;
      html = html.slice(0, idx) +
        `<mark class="mk-${x.color}" data-ex="${x.id}">${needle}</mark>` +
        html.slice(idx + needle.length);
    }
    return html;
  }
  function renderChapter() {
    const ch = R.chapters[R.chapter];
    if (!ch) return;
    const body = document.getElementById('rdBody');
    if (!body) return;
    const paras = String(ch.text || '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    body.innerHTML = `<article class="rd-text" id="rdText">
      <h2 class="rd-ch-title">${esc(ch.title || `第 ${R.chapter + 1} 章`)}</h2>
      ${paras.map((p) => `<p>${markIntoParagraph(p)}</p>`).join('')}
      <div class="rd-ch-end">${R.chapter < R.chapters.length - 1 ? '下滑 / 右滑进入下一章' : '全书完 · 感谢阅读'}</div>
    </article>`;
    const nameEl = document.getElementById('rdChapterName');
    if (nameEl) nameEl.textContent = ch.title || '';
    body.scrollTop = 0; body.scrollLeft = 0;
    bindScrollProgress();
    requestAnimationFrame(() => { applyMode(); anchorScroll(); updateProgressUI(); });
    if (R.sideTab) renderSide();
  }

  function applyMode() {
    const body = document.getElementById('rdBody');
    if (!body || R.book.format === 'pdf') return;
    body.classList.toggle('mode-swipe', settings().mode === 'swipe');
    body.classList.toggle('mode-scroll', settings().mode === 'scroll');
  }
  function anchorScroll() {
    const body = document.getElementById('rdBody');
    if (!body || R.book.format === 'pdf') return;
    requestAnimationFrame(() => {
      if (settings().mode === 'swipe') {
        const max = body.scrollWidth - body.clientWidth;
        body.scrollLeft = Math.max(0, max * R.ratio);
      } else {
        const max = body.scrollHeight - body.clientHeight;
        body.scrollTop = Math.max(0, max * R.ratio);
      }
    });
  }

  /* ---------- PDF 阅读（pdf.js 渲染，兼容移动端） ---------- */
  const PDFJS_VER = '3.11.174';
  const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VER}`;

  function normalizePdfBlob(file) {
    if (!file) return null;
    let blob = file;
    if (!(blob instanceof Blob)) {
      if (blob instanceof ArrayBuffer || ArrayBuffer.isView(blob)) {
        blob = new Blob([blob], { type: 'application/pdf' });
      } else return null;
    }
    if (blob.type !== 'application/pdf') {
      try { blob = new Blob([blob], { type: 'application/pdf' }); } catch (e) { return null; }
    }
    return blob;
  }

  let pdfLibLoading = null;
  function loadPdfjs() {
    if (window.pdfjsLib) {
      if (window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
      }
      return Promise.resolve(window.pdfjsLib);
    }
    if (pdfLibLoading) return pdfLibLoading;
    pdfLibLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${PDFJS_BASE}/pdf.min.js`;
      s.onload = () => {
        if (!window.pdfjsLib) { reject(new Error('pdf.js 未就绪')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.js`;
        resolve(window.pdfjsLib);
      };
      s.onerror = () => reject(new Error('pdf.js 加载失败'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('pdf.js 加载超时')), 15000);
    });
    pdfLibLoading.catch(() => { pdfLibLoading = null; });
    return pdfLibLoading;
  }

  function renderPdf() {
    const body = document.getElementById('rdBody');
    if (!body) return;
    body.className = 'rd-body pdf-mode';
    body.innerHTML = `<div class="rd-pdf-wrap" id="rdPdfWrap">
      <div class="rd-pdf-loading"><span class="rd-pdf-spin"></span><p>正在加载 PDF…</p></div>
    </div>`;
    openPdfDoc();
  }

  async function openPdfDoc() {
    let lib = null;
    try { lib = await loadPdfjs(); } catch (e) { lib = null; }
    if (!R.book) return;
    if (!lib) { renderPdfFallback('PDF 组件加载失败（可能网络不可用）'); return; }
    try {
      const data = await R.pdfBlob.arrayBuffer();
      R.pdfDoc = await lib.getDocument({ data, isEvalSupported: false }).promise;
    } catch (e) {
      console.warn('[reader] PDF 解析失败', e);
      renderPdfFallback('PDF 解析失败，文件可能损坏或已加密');
      return;
    }
    R.pdfTotal = R.pdfDoc.numPages || 1;
    if (R.pdfPage > R.pdfTotal) R.pdfPage = R.pdfTotal;
    if (R.pdfPage < 1) R.pdfPage = 1;
    const nameEl = document.getElementById('rdChapterName');
    if (nameEl) nameEl.textContent = `PDF · 共 ${R.pdfTotal} 页`;
    const pct = document.getElementById('rdPct');
    if (pct) pct.textContent = `${Math.round((R.pdfPage / R.pdfTotal) * 100)}%`;
    pdfRenderPage(R.pdfPage);
  }

  async function pdfRenderPage(n) {
    const wrap = document.getElementById('rdPdfWrap');
    if (!wrap || !R.pdfDoc || !R.book) return;
    const total = R.pdfDoc.numPages || 1;
    n = Math.max(1, Math.min(total, n));
    R.pdfPage = n;
    try {
      const page = await R.pdfDoc.getPage(n);
      const baseWidth = Math.max(240, (wrap.clientWidth || 360) - 24);
      const scale = (baseWidth / page.getViewport({ scale: 1 }).width) * (R.pdfZoom || 1);
      const vp = page.getViewport({ scale });
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-canvas';
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      canvas.style.width = `${Math.floor(vp.width)}px`;
      canvas.style.height = `${Math.floor(vp.height)}px`;
      const ctx = canvas.getContext('2d');
      if (R.pdfTask) { try { R.pdfTask.cancel(); } catch (e) { /* ignore */ } R.pdfTask = null; }
      const task = page.render({ canvasContext: ctx, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
      R.pdfTask = task;
      await task.promise;
      if (R.pdfTask === task) R.pdfTask = null;
      if (!R.book) return;
      wrap.innerHTML = '';
      wrap.appendChild(canvas);
      const foot = document.createElement('div');
      foot.className = 'rd-pdf-page-no';
      foot.textContent = `${n} / ${total}`;
      wrap.appendChild(foot);
      wrap.scrollTop = 0;
      syncPdfSlider();
      saveProgress();
    } catch (e) {
      if (e && e.name === 'RenderingCancelledException') return;
      console.warn('[reader] PDF 页渲染失败', e);
    }
  }

  function syncPdfSlider() {
    const total = R.pdfTotal || 1;
    const slider = document.getElementById('rdProgress');
    const pct = document.getElementById('rdPct');
    const p = total > 1 ? (R.pdfPage - 1) / (total - 1) : 1;
    if (slider && document.activeElement !== slider) slider.value = Math.round(p * 1000);
    if (pct) pct.textContent = `${Math.round((R.pdfPage / total) * 100)}%`;
  }

  function pdfGo(n) {
    if (!R.pdfDoc) return;
    const total = R.pdfDoc.numPages || 1;
    if (n < 1) { APP.toast('已经是第一页', 'book'); return; }
    if (n > total) { APP.toast('已经是最后一页', 'book'); return; }
    pdfRenderPage(n);
  }

  function pdfZoom(delta) {
    if (!R.pdfDoc) return;
    R.pdfZoom = Math.max(0.6, Math.min(3, Math.round((R.pdfZoom + delta) * 100) / 100));
    pdfRenderPage(R.pdfPage);
  }

  function renderPdfFallback(msg) {
    const body = document.getElementById('rdBody');
    if (!body) return;
    body.className = 'rd-body pdf-mode';
    body.innerHTML = `<div class="rd-pdf-fail">
      <div class="rd-pdf-fail-ic">${IC.icon('file')}</div>
      <p>${esc(msg)}</p>
      <div class="rd-pdf-fail-acts">
        <a class="rd-pdf-act" href="${R.pdfUrl}" target="_blank" rel="noopener">在新窗口打开</a>
        <button class="rd-pdf-act" data-rd="embedPdf">用内嵌查看器打开</button>
      </div>
    </div>`;
  }

  function embedPdf() {
    const body = document.getElementById('rdBody');
    if (!body || !R.pdfUrl) return;
    body.className = 'rd-body pdf-mode';
    body.innerHTML = `<iframe src="${R.pdfUrl}#view=FitH" title="PDF 阅读" class="rd-pdf"></iframe>`;
    APP.toast('已切换为浏览器内嵌查看器', 'file');
  }

  /* ---------- 翻页与进度 ---------- */
  function ratioNow() {
    const body = document.getElementById('rdBody');
    if (!body) return 0;
    if (settings().mode === 'swipe') {
      const max = body.scrollWidth - body.clientWidth;
      return max > 2 ? Math.min(1, Math.max(0, body.scrollLeft / max)) : 0;
    }
    const max = body.scrollHeight - body.clientHeight;
    return max > 2 ? Math.min(1, Math.max(0, body.scrollTop / max)) : 0;
  }
  function turn(dir) {
    if (!R.book) return;
    if (R.book.format === 'pdf') { pdfGo(R.pdfPage + dir); return; }
    const body = document.getElementById('rdBody');
    if (!body) return;
    const s = settings();
    if (s.mode === 'swipe') {
      const max = body.scrollWidth - body.clientWidth;
      const target = body.scrollLeft + dir * body.clientWidth;
      if (target < -4) return gotoChapter(R.chapter - 1, 1);
      if (target > max + 4) return gotoChapter(R.chapter + 1, 0);
      body.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      const max = body.scrollHeight - body.clientHeight;
      const target = body.scrollTop + dir * body.clientHeight * 0.92;
      if (target < -4) return gotoChapter(R.chapter - 1, 1);
      if (target > max + 4) return gotoChapter(R.chapter + 1, 0);
      body.scrollTo({ top: target, behavior: 'smooth' });
    }
  }
  function gotoChapter(i, ratio = 0) {
    if (i < 0) { APP.toast('已经是第一章', 'book'); return; }
    if (i >= R.chapters.length) { APP.toast('已经是最后一章', 'book'); return; }
    R.chapter = i; R.ratio = ratio;
    renderChapter();
    scheduleSave();
  }
  function updateProgressUI() {
    if (!R.book || R.book.format === 'pdf') return;
    const total = R.chapters.length || 1;
    const p = Math.min(1, (R.chapter + R.ratio) / total);
    const slider = document.getElementById('rdProgress');
    const pct = document.getElementById('rdPct');
    if (slider && document.activeElement !== slider) slider.value = Math.round(p * 1000);
    if (pct) pct.textContent = `${Math.round(p * 100)}%`;
  }
  function onSlider(e) {
    if (!R.book) return;
    const v = (Number(e.target.value) || 0) / 1000;
    if (R.book.format === 'pdf') {
      const total = (R.pdfDoc && R.pdfDoc.numPages) || 0;
      if (!total) return;
      const page = Math.max(1, Math.min(total, Math.round(v * (total - 1)) + 1));
      const pct = document.getElementById('rdPct');
      if (pct) pct.textContent = `${Math.round((page / total) * 100)}%`;
      if (page !== R.pdfPage) pdfRenderPage(page);
      return;
    }
    const total = R.chapters.length || 1;
    const ci = Math.min(total - 1, Math.floor(v * total));
    R.chapter = ci;
    R.ratio = Math.min(0.99, v * total - ci);
    renderChapter();
    scheduleSave();
  }
  function scheduleSave() {
    clearTimeout(R.saveT);
    R.saveT = setTimeout(saveProgress, 400);
  }
  function saveProgress() {
    const b = R.book;
    if (!b) return;
    if (b.format === 'pdf') {
      const total = (R.pdfDoc && R.pdfDoc.numPages) || R.pdfTotal || 0;
      b.readPage = R.pdfPage || 1;
      b.progress = total > 1 ? Math.min(1, (R.pdfPage || 1) / total) : (total ? 1 : Number(b.progress) || 0);
      if (b.progress >= 0.999 && b.status !== 'read') {
        b.status = 'read';
        b.finishedAt = U.dateKey();
        APP.toast('已读完，自动标记为「已读」', 'check');
        if (WB.actionUtil && WB.actionUtil.refresh) WB.actionUtil.refresh();
      }
    } else {
      b.readPos = { chapter: R.chapter, ratio: R.ratio };
      b.progress = Math.min(1, (R.chapter + R.ratio) / (R.chapters.length || 1));
      if (b.progress >= 0.999 && b.status !== 'read') {
        b.status = 'read';
        b.finishedAt = U.dateKey();
        APP.toast('已读完，自动标记为「已读」', 'check');
      }
    }
    b.lastReadAt = new Date().toISOString();
    WB.save();
  }

  /* 滚动驱动进度更新 */
  function bindScrollProgress() {
    const body = document.getElementById('rdBody');
    if (!body || body.dataset.boundScroll) return;
    body.dataset.boundScroll = '1';
    let t = null;
    body.addEventListener('scroll', () => {
      if (!R.book || R.book.format === 'pdf') return;
      R.ratio = ratioNow();
      clearTimeout(t);
      t = setTimeout(() => { updateProgressUI(); scheduleSave(); }, 300);
    }, { passive: true });
  }

  /* ---------- 划线摘抄 ---------- */
  let selText = '';
  function onSelection() {
    if (!R.root || !R.book || R.book.format === 'pdf') return;
    const tools = document.getElementById('rdSelTools');
    if (!tools) return;
    clearTimeout(onSelection._t);
    onSelection._t = setTimeout(() => {
      const sel = window.getSelection();
      const body = document.getElementById('rdBody');
      if (!sel || sel.isCollapsed || !body) { tools.hidden = true; return; }
      const range = sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!range || !body.contains(range.commonAncestorContainer)) { tools.hidden = true; return; }
      const text = sel.toString().replace(/\s+/g, ' ').trim();
      if (text.length < 2) { tools.hidden = true; return; }
      selText = text;
      const rect = range.getBoundingClientRect();
      tools.innerHTML = `
        <button class="rd-hl mk-key" data-rd="hl" data-v="key" title="重点"></button>
        <button class="rd-hl mk-question" data-rd="hl" data-v="question" title="疑问"></button>
        <button class="rd-hl mk-quote" data-rd="hl" data-v="quote" title="金句"></button>
        <button class="rd-note" data-rd="noteSel">${IC.icon('edit')} 笔记</button>`;
      tools.style.left = `${Math.max(8, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 100))}px`;
      tools.style.top = `${Math.max(56, rect.top - 46)}px`;
      tools.hidden = false;
    }, 150);
  }
  function highlightSelection(color) {
    if (!selText || !R.book) return;
    WB.readApi.addExcerpt({
      bookId: R.book.id, text: selText.slice(0, 800), note: '',
      page: (R.chapters[R.chapter] || {}).title || '', color, source: 'reader'
    });
    const tools = document.getElementById('rdSelTools');
    if (tools) tools.hidden = true;
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
    renderChapter();
  }
  function noteFromSelection() {
    if (!selText || !R.book) return;
    const tools = document.getElementById('rdSelTools');
    if (tools) tools.hidden = true;
    APP.openModal(WB.UI.excerptFormHTML(null, {
      bookId: R.book.id, text: selText.slice(0, 800),
      page: (R.chapters[R.chapter] || {}).title || '', color: 'key'
    }));
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  /* ---------- 书签 ---------- */
  function toggleBookmark() {
    if (!R.book || R.book.format === 'pdf') return;
    if (!Array.isArray(WB.db.bookMarks)) WB.db.bookMarks = [];
    const found = WB.db.bookMarks.find((m) =>
      m.bookId === R.book.id && m.chapter === R.chapter && Math.abs((m.ratio || 0) - R.ratio) < 0.02);
    if (found) {
      WB.db.bookMarks = WB.db.bookMarks.filter((m) => m.id !== found.id);
      WB.save();
      APP.toast('已取消此处书签', 'bookmark');
    } else {
      WB.db.bookMarks.push({
        id: U.uid('bm'), bookId: R.book.id, chapter: R.chapter,
        title: (R.chapters[R.chapter] || {}).title || `第 ${R.chapter + 1} 章`,
        ratio: R.ratio, createdAt: new Date().toISOString()
      });
      WB.save();
      APP.toast('书签已添加', 'bookmarkFill');
    }
    if (R.sideTab === 'marks') renderSide();
  }

  /* ---------- 侧栏：目录 / 书签 / 搜索 ---------- */
  function toggleSide(tab) {
    const side = document.getElementById('rdSide');
    if (!side) return;
    if (R.sideTab === tab && !side.hidden) { side.hidden = true; R.sideTab = ''; return; }
    R.sideTab = tab;
    side.hidden = false;
    renderSide();
    const si = document.getElementById('rdSearchInput');
    if (tab === 'search' && si) si.focus();
  }
  function renderSide() {
    const side = document.getElementById('rdSide');
    if (!side || side.hidden || !R.book) return;
    const tab = R.sideTab || 'toc';
    const marks = (WB.db.bookMarks || []).filter((m) => m.bookId === R.book.id);
    let bodyHtml = '';
    if (tab === 'toc') {
      bodyHtml = `<ul class="rd-toc">
        ${R.chapters.map((c, i) => `<li>
          <button class="${i === R.chapter ? 'active' : ''}" data-rd="gotoChapter" data-chapter="${i}">
            <span class="toc-no">${i + 1}</span>${esc(c.title || `第 ${i + 1} 章`)}
          </button></li>`).join('')}
      </ul>`;
    } else if (tab === 'marks') {
      bodyHtml = marks.length ? `<ul class="rd-marks">
        ${marks.map((m) => `<li>
          <button data-rd="gotoMark" data-chapter="${m.chapter}" data-ratio="${m.ratio}">
            ${IC.icon('bookmarkFill')}<span>${esc(m.title)}</span><em>${Math.round(((m.chapter + m.ratio) / (R.chapters.length || 1)) * 100)}%</em>
          </button>
          <button class="rd-mark-del" data-rd="delMark" data-id="${m.id}" title="删除书签">${IC.icon('x')}</button>
        </li>`).join('')}
      </ul>` : `<div class="rd-side-empty">还没有书签，点击顶栏书签按钮添加</div>`;
    } else {
      bodyHtml = `<div class="rd-search-box">
          <input id="rdSearchInput" type="text" placeholder="全书搜索关键词…" autocomplete="off">
        </div>
        <div class="rd-search-res" id="rdSearchRes"><div class="rd-side-empty">输入关键词开始全书搜索</div></div>`;
    }
    side.innerHTML = `
      <nav class="rd-side-tabs">
        <button class="${tab === 'toc' ? 'active' : ''}" data-rd="toc">目录</button>
        <button class="${tab === 'marks' ? 'active' : ''}" data-rd="marks">书签 ${marks.length ? `<i>${marks.length}</i>` : ''}</button>
        <button class="${tab === 'search' ? 'active' : ''}" data-rd="searchTab">搜索</button>
      </nav>
      <div class="rd-side-body">${bodyHtml}</div>`;
    if (tab === 'search') {
      const si = document.getElementById('rdSearchInput');
      if (si && !si.dataset.bound) {
        si.dataset.bound = '1';
        si.addEventListener('input', () => runSearch(si.value));
      }
    }
  }
  function runSearch(q) {
    const res = document.getElementById('rdSearchRes');
    if (!res) return;
    q = (q || '').trim();
    if (!q) { res.innerHTML = '<div class="rd-side-empty">输入关键词开始全书搜索</div>'; return; }
    const lq = q.toLowerCase();
    const hits = [];
    for (let ci = 0; ci < R.chapters.length && hits.length < 30; ci++) {
      const text = R.chapters[ci].text || '';
      const lt = text.toLowerCase();
      let pos = 0;
      while (hits.length < 30) {
        const idx = lt.indexOf(lq, pos);
        if (idx === -1) break;
        hits.push({
          ci, pos: idx,
          snippet: text.slice(Math.max(0, idx - 18), idx + q.length + 22).replace(/\s+/g, ' ')
        });
        pos = idx + q.length;
      }
    }
    res.innerHTML = hits.length ? hits.map((h) => `
      <button class="rd-hit" data-rd="gotoHit" data-chapter="${h.ci}" data-pos="${h.pos}">
        <span class="rd-hit-ch">${esc(R.chapters[h.ci].title || '')}</span>
        <span class="rd-hit-snippet">${esc(h.snippet).replace(esc(q), `<mark>${esc(q)}</mark>`)}</span>
      </button>`).join('')
      : '<div class="rd-side-empty">没有找到相关内容</div>';
  }

  /* ---------- 设置面板 ---------- */
  function renderSetPanel() {
    const p = document.getElementById('rdSetPanel');
    if (!p) return;
    const s = settings();
    p.innerHTML = `
      <div class="rd-set-group">
        <span class="rd-set-label">翻页方式</span>
        <div class="segmented rd-seg">
          ${[['swipe', '左右翻页'], ['scroll', '上下滚动']].map(([v, l]) =>
            `<button class="${s.mode === v ? 'active' : ''}" data-rd="mode" data-v="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="rd-set-group">
        <span class="rd-set-label">字体</span>
        <div class="segmented rd-seg">
          ${Object.entries(FONT_NAMES).map(([v, l]) =>
            `<button class="${s.font === v ? 'active' : ''}" data-rd="font" data-v="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="rd-set-group">
        <span class="rd-set-label">字号 <b id="rdFsVal">${s.fontSize}</b></span>
        <div class="rd-stepper">
          <button data-rd="fsDown">A−</button><i></i><button data-rd="fsUp">A＋</button>
        </div>
      </div>
      <div class="rd-set-group">
        <span class="rd-set-label">行距 <b id="rdLhVal">${s.lineHeight}</b></span>
        <div class="rd-stepper">
          <button data-rd="lhDown">−</button><i></i><button data-rd="lhUp">＋</button>
        </div>
      </div>
      <div class="rd-set-group">
        <span class="rd-set-label">页边距 <b id="rdMgVal">${s.margin}</b></span>
        <div class="rd-stepper">
          <button data-rd="mgDown">−</button><i></i><button data-rd="mgUp">＋</button>
        </div>
      </div>
      <div class="rd-set-group">
        <span class="rd-set-label">背景</span>
        <div class="rd-bg-row">
          ${Object.entries(BG_NAMES).map(([v, l]) =>
            `<button class="rd-bg bg-${v} ${s.bg === v ? 'active' : ''}" data-rd="bg" data-v="${v}" title="${l}"></button>`).join('')}
        </div>
      </div>`;
  }
  function applySettings(render = true) {
    const s = settings();
    const root = R.root;
    if (!root) return;
    root.className = `reader-root bg-${s.bg}`;
    root.dataset.font = s.font;
    root.style.setProperty('--rd-fs', `${s.fontSize}px`);
    root.style.setProperty('--rd-lh', s.lineHeight);
    root.style.setProperty('--rd-mg', `${s.margin}px`);
    if (render) renderSetPanel();
    applyMode();
  }

  /* ---------- 番茄钟与时长 ---------- */
  function startPassiveTimer() {
    R.lastTick = Date.now();
    R.timer = setInterval(() => {
      const now = Date.now();
      const delta = Math.min(10, (now - R.lastTick) / 1000);
      R.lastTick = now;
      if (!document.hidden) R.totalSeconds += delta;
      if (R.pomo) tickPomo();
    }, 5000);
  }
  function flushPassiveTime() {
    const mins = Math.round(R.totalSeconds / 60);
    if (mins >= 1 && R.book) WB.readApi.recordSession(R.book.id, mins);
    R.totalSeconds = 0;
  }
  function startPomo() {
    const mins = Number(WB.db.settings.focusMin) || 25;
    R.pomo = { endsAt: Date.now() + mins * 60000, mins, left: mins * 60 };
    const btn = document.getElementById('rdPomoBtn');
    if (btn) btn.classList.add('running');
    renderPomo();
    APP.toast(`阅读番茄钟启动，专注 ${mins} 分钟`, 'timer');
  }
  function tickPomo() {
    R.pomo.left = Math.max(0, Math.round((R.pomo.endsAt - Date.now()) / 1000));
    renderPomo();
    if (R.pomo.left <= 0) finishPomo();
  }
  function renderPomo() {
    const el = document.getElementById('rdPomo');
    if (!el) return;
    if (!R.pomo) { el.hidden = true; return; }
    const m = Math.floor(R.pomo.left / 60), s = R.pomo.left % 60;
    el.hidden = false;
    el.innerHTML = `${IC.icon('timer')}<b>${m}:${String(s).padStart(2, '0')}</b>
      <button data-rd="pomo" title="结束番茄钟">${IC.icon('x')}</button>`;
  }
  function finishPomo() {
    const mins = R.pomo.mins;
    R.pomo = null;
    const btn = document.getElementById('rdPomoBtn');
    if (btn) btn.classList.remove('running');
    renderPomo();
    WB.readApi.recordSession(R.book.id, mins);
    if (!Array.isArray(WB.db.focus)) WB.db.focus = [];
    const now = new Date();
    WB.db.focus.unshift({
      id: U.uid('f'), date: U.dateKey(), time: `${U.pad(now.getHours())}:${U.pad(now.getMinutes())}`,
      minutes: mins, taskId: '', interruptions: 0, createdAt: now.toISOString()
    });
    R.totalSeconds = 0; // 番茄钟时长已单独记录，避免双计
    WB.save();
    APP.notify('阅读番茄钟完成', `《${R.book.title}》专注 ${mins} 分钟已计入阅读统计`, 'success');
  }
  function stopPomo(manual) {
    if (!R.pomo) return;
    R.pomo = null;
    const btn = document.getElementById('rdPomoBtn');
    if (btn) btn.classList.remove('running');
    renderPomo();
    if (manual) APP.toast('番茄钟已结束（未完成的时段不计入统计）', 'timer');
  }

  /* ---------- 手势 ---------- */
  function bindGestures() {
    const body = document.getElementById('rdBody');
    if (!body) return;
    let sx = 0, sy = 0, st = 0;
    body.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });
    body.addEventListener('touchend', (e) => {
      if (!R.book) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy, dt = Date.now() - st;
      if (dt > 600) return;
      if (R.book.format === 'pdf') {
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          pdfGo(R.pdfPage + (dx < 0 ? 1 : -1));
        }
        return;
      }
      if (settings().mode === 'swipe' && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        turn(dx < 0 ? 1 : -1);
      } else if (settings().mode === 'scroll' && dx > 70 && Math.abs(dy) < 40 && sx < 28) {
        close(); // 左缘右滑返回书架
      }
    }, { passive: true });
  }

  /* ---------- 关闭 ---------- */
  function close(silent) {
    if (!R.root) return;
    saveProgress();
    flushPassiveTime();
    if (R.pomo) stopPomo(false);
    clearInterval(R.timer);
    unbind();
    if (R.pdfTask) { try { R.pdfTask.cancel(); } catch (e) { /* ignore */ } R.pdfTask = null; }
    if (R.pdfDoc) { try { R.pdfDoc.destroy(); } catch (e) { /* ignore */ } R.pdfDoc = null; }
    if (R.pdfUrl) { try { URL.revokeObjectURL(R.pdfUrl); } catch (e) {} R.pdfUrl = ''; }
    R.pdfBlob = null; R.pdfPage = 1; R.pdfZoom = 1; R.pdfTotal = 0;
    R.root.remove();
    R.root = null;
    R.book = null;
    R.chapters = [];
    R.sideTab = '';
    document.body.classList.remove('reader-open');
    if (!silent) WB.actionUtil.refresh();
  }

  WB.Reader = { open, close, isOpen: () => !!R.root };
})();
