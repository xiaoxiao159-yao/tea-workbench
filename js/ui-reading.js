/* 阅读书房页：统计栏 / 双层书架 / 进度条 / 摘抄 / 弹窗 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const ico = (n) => `<span class="ico">${IC.icon(n)}</span>`;
  const esc = U.esc;

  /* ---------- 状态与查询 ---------- */
  function bfilter() {
    if (!WB.state.bookFilter) WB.state.bookFilter = { q: '', status: 'all', category: 'all', rating: 'all', sort: 'shelf' };
    return WB.state.bookFilter;
  }
  function exfilter() {
    if (!WB.state.exFilter) WB.state.exFilter = { q: '', book: 'all', tag: 'all', time: 'all' };
    return WB.state.exFilter;
  }
  function bookById(id) { return (WB.db.books || []).find((b) => b.id === id); }
  function categories() {
    const set = new Set();
    (WB.db.books || []).forEach((b) => { if (b.category) set.add(b.category); });
    ['文学', '历史', '成长', '科幻', '心理', '社科'].forEach((c) => set.add(c));
    return [...set];
  }
  function shelfBooks(n) {
    return (WB.db.books || []).filter((b) => (b.shelf || 1) === n)
      .slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  function filteredBooks(n) {
    const f = bfilter();
    const q = f.q.trim().toLowerCase();
    let list = shelfBooks(n).filter((b) => {
      if (f.status !== 'all' && b.status !== f.status) return false;
      if (f.category !== 'all' && b.category !== f.category) return false;
      if (f.rating !== 'all' && (Number(b.rating) || 0) < Number(f.rating)) return false;
      if (!q) return true;
      return [b.title, b.author, b.category, b.intro].join(' ').toLowerCase().includes(q);
    });
    if (f.sort !== 'shelf') {
      const sorters = {
        recent: (a, b) => String(b.lastReadAt || '').localeCompare(String(a.lastReadAt || '')),
        added: (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
        rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0),
        title: (a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN')
      };
      if (sorters[f.sort]) list = list.slice().sort(sorters[f.sort]);
    }
    return list;
  }
  function excerptsOf(bookId) {
    return (WB.db.bookExcerpts || []).filter((x) => x.bookId === bookId);
  }
  function marksOf(bookId) {
    return (WB.db.bookMarks || []).filter((m) => m.bookId === bookId);
  }

  /* ---------- 统计 ---------- */
  function monthKey(d = new Date()) { return `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`; }
  function monthSessions() {
    const mk = monthKey();
    return (WB.db.readingSessions || []).filter((s) => String(s.date || '').startsWith(mk));
  }
  function monthMinutes() { return monthSessions().reduce((s, x) => s + (Number(x.minutes) || 0), 0); }
  function monthFinished() {
    const mk = monthKey();
    return (WB.db.books || []).filter((b) => b.status === 'read' && String(b.finishedAt || '').startsWith(mk)).length;
  }
  function readStreak() {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const k = U.dateKey(U.addDays(new Date(), -i));
      const has = (WB.db.readingSessions || []).some((s) => s.date === k && Number(s.minutes) > 0);
      if (has) n++;
      else if (i === 0) continue; // 今天还没读不算断
      else break;
    }
    return n;
  }
  function todayMinutes() {
    const k = U.dateKey();
    return (WB.db.readingSessions || []).filter((s) => s.date === k).reduce((s, x) => s + (Number(x.minutes) || 0), 0);
  }

  /* ---------- 封面 ---------- */
  const TMPL_NAMES = ['焦糖拿铁', '抹茶奶绿', '芋泥啵啵', '蜜桃乌龙', '可可摩卡', '云朵奶盖'];
  function coverHTML(b, cls = '') {
    if (b.coverId) {
      return `<div class="bk-cover ${cls} has-img"><img data-cover-id="${b.coverId}" alt="${esc(b.title)}"></div>`;
    }
    const t = Number(b.coverTmpl) || 0;
    return `<div class="bk-cover cover-tmpl-${t} ${cls}">
      <div class="bc-spine"></div>
      <div class="bc-body">
        <div class="bc-title">${esc(b.title || '未命名')}</div>
        <div class="bc-author">${esc(b.author || '')}</div>
      </div>
      <div class="bc-foot">${esc(b.category || '')}</div>
    </div>`;
  }
  function stars(v, cls = '') {
    v = Number(v) || 0;
    return `<span class="stars ${cls}">${[1, 2, 3, 4, 5].map((i) =>
      `<i class="${i <= v ? 'on' : ''}">${IC.icon('star')}</i>`).join('')}</span>`;
  }

  /* ---------- 区块一：统计栏 ---------- */
  function statBar() {
    const books = WB.db.books || [];
    const read = books.filter((b) => b.status === 'read').length;
    const reading = books.filter((b) => b.status === 'reading').length;
    const mMin = monthMinutes();
    const fin = monthFinished();
    const streak = readStreak();
    const goal = WB.db.readingGoal || {};
    const cards = [
      { icon: 'check', label: '已读书籍', val: `${read}<small>本</small>` },
      { icon: 'bookOpen', label: '正在阅读', val: `${reading}<small>本</small>` },
      { icon: 'bookshelf', label: '总藏书', val: `${books.length}<small>本</small>` },
      { icon: 'clock', label: '本月阅读', val: U.minsText(mMin) },
      { icon: 'flag', label: '本月读完', val: `${fin}<small>本</small>` },
      { icon: 'flame', label: '连续阅读', val: `${streak}<small>天</small>` }
    ];
    const goalPct = goal.monthly ? Math.min(100, Math.round((fin / goal.monthly) * 100)) : 0;
    const dailyPct = goal.dailyMin ? Math.min(100, Math.round((todayMinutes() / goal.dailyMin) * 100)) : 0;
    return `<section class="rd-stats">
      ${cards.map((c) => `<div class="rd-stat">
        <span class="rd-stat-ico">${IC.icon(c.icon)}</span>
        <div class="rd-stat-main"><b>${c.val}</b><span>${c.label}</span></div>
      </div>`).join('')}
      <button class="rd-goal" data-act="bkGoal" title="点击设置阅读目标">
        <span class="rd-goal-ico">${IC.icon('target')}</span>
        <div class="rd-goal-info">
          <span class="rd-goal-title">阅读目标</span>
          <span class="rd-goal-line">本月 ${fin}/${goal.monthly || 4} 本 · 今日 ${todayMinutes()}/${goal.dailyMin || 30} 分钟</span>
          <span class="rd-goal-bars">
            <i class="bar"><i style="width:${goalPct}%"></i></i>
            <i class="bar daily"><i style="width:${dailyPct}%"></i></i>
          </span>
        </div>
      </button>
    </section>`;
  }

  /* ---------- 区块二：双层书架 ---------- */
  function toolbar() {
    const f = bfilter();
    const all = WB.db.books || [];
    return `<div class="rd-toolbar">
      <label class="search-box rd-search">
        <span class="search-ico">${IC.icon('search')}</span>
        <input id="bookSearch" type="text" placeholder="搜索书名、作者、类别…" value="${esc(f.q)}" autocomplete="off">
      </label>
      <div class="segmented status-seg">
        ${[['all', '全部'], ['unread', '未读'], ['reading', '在读'], ['read', '已读']].map(([v, l]) =>
          `<button class="${f.status === v ? 'active' : ''}" data-act="bkStatus" data-v="${v}">${l}</button>`).join('')}
      </div>
      <select class="filter-select" data-act="bkSelect" data-key="category" aria-label="按类别筛选">
        <option value="all">全部类别</option>
        ${categories().map((c) => `<option value="${esc(c)}" ${f.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <select class="filter-select" data-act="bkSelect" data-key="rating" aria-label="按评分筛选">
        <option value="all">全部评分</option>
        <option value="5" ${f.rating === '5' ? 'selected' : ''}>五星</option>
        <option value="4" ${f.rating === '4' ? 'selected' : ''}>四星及以上</option>
        <option value="3" ${f.rating === '3' ? 'selected' : ''}>三星及以上</option>
        <option value="1" ${f.rating === '1' ? 'selected' : ''}>有评分</option>
      </select>
      <select class="filter-select" data-act="bkSelect" data-key="sort" aria-label="排序方式">
        <option value="shelf" ${f.sort === 'shelf' ? 'selected' : ''}>书架排列</option>
        <option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>最近阅读</option>
        <option value="added" ${f.sort === 'added' ? 'selected' : ''}>添加时间</option>
        <option value="rating" ${f.sort === 'rating' ? 'selected' : ''}>评分优先</option>
        <option value="title" ${f.sort === 'title' ? 'selected' : ''}>书名</option>
      </select>
      <span class="filter-count"><b>${all.length}</b> 本藏书</span>
      <div class="rd-toolbar-actions">
        <button class="btn btn-soft btn-sm" data-act="bkImport" title="导入 EPUB / PDF / TXT，自动解析书名与封面">${IC.icon('upload')} 导入图书</button>
        <button class="btn btn-primary btn-sm" data-act="bkAdd">${IC.icon('plus')} 添加书籍</button>
      </div>
    </div>`;
  }

  function bookCard(b) {
    const st = { unread: '未读', reading: '在读', read: '已读' }[b.status] || '未读';
    const pct = Math.round((Number(b.progress) || 0) * 100);
    return `<article class="book-card" draggable="true" data-drag="book" data-id="${b.id}" title="${esc(b.title)}">
      <button class="book-open" data-act="bkOpen" data-id="${b.id}">
        ${coverHTML(b)}
        <span class="bk-status ${b.status}">${st}</span>
        ${b.fileId ? `<span class="bk-file" title="已关联内容">${IC.icon('file')}</span>` : ''}
      </button>
      <div class="book-meta">
        <button class="book-title" data-act="bkOpen" data-id="${b.id}">${esc(b.title)}</button>
        <span class="book-author">${esc(b.author || '佚名')}</span>
        <div class="book-foot">
          ${stars(b.rating, 'sm')}
          ${b.status !== 'unread' ? `<span class="book-pct">${pct}%</span>` : ''}
        </div>
      </div>
    </article>`;
  }

  function shelfLayer(n) {
    const list = filteredBooks(n);
    const f = bfilter();
    const filtering = f.q || f.status !== 'all' || f.category !== 'all' || f.rating !== 'all' || f.sort !== 'shelf';
    return `<div class="shelf-layer" data-shelf-drop="${n}">
      <div class="shelf-label"><span>第 ${n === 1 ? '一' : '二'} 层</span><em>${list.length} 本</em></div>
      <div class="shelf-scroll">
        <div class="shelf-books">
          ${list.map(bookCard).join('')}
          ${!list.length && !filtering && !shelfBooks(n).length ? `
            <button class="shelf-empty" data-act="bkAdd">
              ${IC.icon('plus')}<span>${n === 1 ? '点击添加你的第一本书' : '这一层还空着，放几本书吧'}</span>
            </button>` : ''}
          ${!list.length && (filtering || shelfBooks(n).length) ? `<div class="shelf-none">本层没有符合筛选的书</div>` : ''}
        </div>
        <div class="shelf-board"><i></i></div>
      </div>
    </div>`;
  }
  function shelfHTML() {
    return `<section class="card rd-shelf-card">
      <div class="card-head">
        <div class="ch-main">
          <span class="eyebrow"><span class="dotline"></span>BOOKSHELF</span>
          <h3>双层书架</h3>
          <p>拖拽书本可以调整位置，也可以换层摆放。</p>
        </div>
        <span class="mini-label">${IC.icon('grip')} 拖动书卡即可整理</span>
      </div>
      ${toolbar()}
      <div class="shelf">
        ${shelfLayer(1)}
        ${shelfLayer(2)}
      </div>
    </section>`;
  }

  /* ---------- 区块三：阅读进度 ---------- */
  function progressHTML() {
    const list = (WB.db.books || [])
      .filter((b) => b.status === 'reading' || ((Number(b.progress) || 0) > 0 && b.status !== 'read'))
      .sort((a, b) => String(b.lastReadAt || '').localeCompare(String(a.lastReadAt || '')));
    return `<section class="card rd-progress-card">
      <div class="card-head">
        <div class="ch-main">
          <span class="eyebrow"><span class="dotline"></span>READING</span>
          <h3>阅读进度</h3>
          <p>在读的每一本，都知道读到了哪里。</p>
        </div>
        <span class="mini-label">${list.length} 本在读</span>
      </div>
      ${list.length ? `<div class="rd-progress-list">
        ${list.map((b) => {
          const pct = Math.round((Number(b.progress) || 0) * 100);
          return `<button class="rd-progress-row" data-act="bkRead" data-id="${b.id}" title="继续阅读《${esc(b.title)}》">
            ${coverHTML(b, 'thumb')}
            <div class="rpr-main">
              <div class="rpr-top"><b>${esc(b.title)}</b><span>${esc(b.author || '')}</span></div>
              <div class="rpr-bar"><i style="width:${pct}%"></i></div>
            </div>
            <span class="rpr-pct">${pct}%</span>
          </button>`;
        }).join('')}
      </div>` : `<div class="rd-progress-empty">
        <span>${IC.icon('bookOpen')}</span>
        <p>还没有在读的书。从书架上挑一本，点「开始阅读」吧。</p>
      </div>`}
    </section>`;
  }

  /* ---------- 区块四：摘抄 ---------- */
  const EX_TAGS = ['金句', '疑问', '重点', '素材', '灵感'];
  const EX_COLORS = { key: '重点', question: '疑问', quote: '金句' };
  function exColor(c) { return EX_COLORS[c] ? c : 'key'; }
  function filteredExcerpts() {
    const f = exfilter();
    const q = f.q.trim().toLowerCase();
    const now = Date.now();
    let list = (WB.db.bookExcerpts || []).filter((x) => {
      if (f.book !== 'all' && x.bookId !== f.book) return false;
      if (f.tag !== 'all' && !(x.tags || []).includes(f.tag) && x.color !== f.tag) return false;
      if (f.time === 'week' && now - new Date(x.createdAt).getTime() > 7 * 86400000) return false;
      if (f.time === 'month' && now - new Date(x.createdAt).getTime() > 30 * 86400000) return false;
      if (!q) return true;
      const b = bookById(x.bookId);
      return [x.text, x.note, b ? b.title : '', (x.tags || []).join(' ')].join(' ').toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
  }
  function excerptCard(x) {
    const b = bookById(x.bookId);
    return `<article class="ex-card ex-${exColor(x.color)} ${x.pinned ? 'pinned' : ''}">
      <div class="ex-quote">${IC.icon('quote')}</div>
      <p class="ex-text">${esc(x.text)}</p>
      ${x.note ? `<p class="ex-note"><i>${IC.icon('edit')}</i>${esc(x.note)}</p>` : ''}
      <div class="ex-meta">
        <span class="ex-book">${b ? esc(b.title) : '未关联书籍'}</span>
        ${x.page ? `<span class="ex-page">${esc(x.page)}</span>` : ''}
        <span class="ex-color-tag">${EX_COLORS[exColor(x.color)]}</span>
        ${(x.tags || []).map((t) => `<span class="ex-tag">${esc(t)}</span>`).join('')}
        <span class="ex-time">${U.fmtDateTime(x.createdAt)}</span>
      </div>
      <div class="ex-actions">
        <button class="icon-btn ${x.pinned ? 'active' : ''}" data-act="bkExPin" data-id="${x.id}" title="${x.pinned ? '取消置顶' : '收藏置顶'}">${IC.icon('pin')}</button>
        <button class="icon-btn" data-act="bkExCopy" data-id="${x.id}" title="复制">${IC.icon('copy')}</button>
        <button class="icon-btn" data-act="bkExShare" data-id="${x.id}" title="生成分享图片">${IC.icon('share')}</button>
        <button class="icon-btn" data-act="bkExToTask" data-id="${x.id}" title="加入灵感箱 / 转为任务">${IC.icon('sparkles')}</button>
        <button class="icon-btn" data-act="bkExEdit" data-id="${x.id}" title="编辑">${IC.icon('edit')}</button>
        <button class="icon-btn danger" data-act="bkExDel" data-id="${x.id}" title="删除">${IC.icon('trash')}</button>
      </div>
    </article>`;
  }
  function excerptHTML() {
    const f = exfilter();
    const list = filteredExcerpts();
    const all = WB.db.bookExcerpts || [];
    const booksWithEx = [...new Set(all.map((x) => x.bookId))];
    return `<section class="card rd-excerpt-card">
      <div class="card-head">
        <div class="ch-main">
          <span class="eyebrow"><span class="dotline"></span>EXCERPTS</span>
          <h3>摘抄与笔记</h3>
          <p>阅读时划线的句子会自动汇集到这里，也可以手动记录。</p>
        </div>
        <div class="flex gap-6">
          <button class="btn btn-soft btn-sm" data-act="bkExExportMD" ${all.length ? '' : 'disabled'}>${IC.icon('download')} 导出 Markdown</button>
          <button class="btn btn-primary btn-sm" data-act="bkExAdd">${IC.icon('plus')} 写摘抄</button>
        </div>
      </div>
      <div class="ex-toolbar">
        <label class="search-box rd-search sm">
          <span class="search-ico">${IC.icon('search')}</span>
          <input id="exSearch" type="text" placeholder="搜索摘抄内容…" value="${esc(f.q)}" autocomplete="off">
        </label>
        <select class="filter-select" data-act="bkSelect" data-key="exBook">
          <option value="all">全部书籍</option>
          ${booksWithEx.map((id) => { const b = bookById(id); return b ? `<option value="${id}" ${f.book === id ? 'selected' : ''}>${esc(b.title)}</option>` : ''; }).join('')}
        </select>
        <select class="filter-select" data-act="bkSelect" data-key="exTag">
          <option value="all">全部标签</option>
          ${['金句', '疑问', '重点', '素材', '灵感'].map((t) => `<option value="${esc(t)}" ${f.tag === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
        </select>
        <select class="filter-select" data-act="bkSelect" data-key="exTime">
          <option value="all" ${f.time === 'all' ? 'selected' : ''}>全部时间</option>
          <option value="week" ${f.time === 'week' ? 'selected' : ''}>近 7 天</option>
          <option value="month" ${f.time === 'month' ? 'selected' : ''}>近 30 天</option>
        </select>
        <span class="filter-count"><b>${list.length}</b> 条</span>
      </div>
      ${list.length ? `<div class="ex-grid">${list.map(excerptCard).join('')}</div>` : `
        <div class="rd-progress-empty">
          <span>${IC.icon('quote')}</span>
          <p>${all.length ? '没有符合筛选的摘抄。' : '还没有摘抄。阅读时选中文字划线，或点右上「写摘抄」手动记录。'}</p>
        </div>`}
    </section>`;
  }

  /* ---------- 页面 ---------- */
  function readingHTML() {
    return `<div class="page reading-page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>READING ROOM</span>
          <h2>阅读书房</h2>
          <p>书架、进度与摘抄，都在一杯茶的距离里。</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-soft btn-sm" data-act="bkReport">${IC.icon('chart')} 月度报告</button>
          <button class="btn btn-soft btn-sm" data-act="bkExportData">${IC.icon('download')} 导出备份</button>
        </div>
      </div>
      ${statBar()}
      ${shelfHTML()}
      ${progressHTML()}
      ${excerptHTML()}
    </div>`;
  }

  /* ---------- 弹窗：添加/编辑书籍 ---------- */
  function bookFormHTML(id) {
    const b = id ? bookById(id) : null;
    const rating = b ? Number(b.rating) || 0 : 0;
    return WB.UI.modalShell({
      cls: 'book-form-modal', eyebrow: b ? '编辑书籍' : '添加书籍',
      title: b ? `《${esc(b.title)}》` : '把一本新书放上书架',
      sub: '填写基本信息，封面可以上传图片，也可以挑一个默认模板。',
      body: `<form id="bookForm" data-id="${b ? b.id : ''}" class="set-body">
        <div class="bk-form-grid">
          <div class="bk-form-cover">
            <div id="bkCoverPreview">${b ? coverHTML(b) : coverHTML({ title: '书名', author: '作者', coverTmpl: 0 })}</div>
            <input type="hidden" name="coverTmpl" id="bkCoverTmpl" value="${b ? Number(b.coverTmpl) || 0 : 0}">
            <input type="hidden" name="coverId" id="bkCoverId" value="${b ? esc(b.coverId || '') : ''}">
            <input type="hidden" name="rating" id="bkRatingInput" value="${rating}">
            <div class="bk-tmpl-row" id="bkTmplRow">
              ${TMPL_NAMES.map((n, i) => `<button type="button" class="bk-tmpl cover-tmpl-${i} ${(!b || !b.coverId) && (b ? Number(b.coverTmpl) || 0 : 0) === i ? 'active' : ''}" data-act="bkTmplPick" data-v="${i}" title="${n}"></button>`).join('')}
            </div>
            <div class="flex gap-6" style="justify-content:center">
              <button type="button" class="btn btn-soft btn-sm" data-act="bkPickCover">${IC.icon('image')} 上传封面</button>
              ${b && b.coverId ? `<button type="button" class="btn btn-ghost btn-sm" data-act="bkClearCover">用回模板</button>` : ''}
            </div>
          </div>
          <div class="bk-form-fields">
            <div class="field"><label>书名 <span class="req">*</span></label><input class="input" name="title" id="bkTitleInput" value="${b ? esc(b.title) : ''}" placeholder="例如：人类简史" autocomplete="off"></div>
            <div class="input-row">
              <div class="field"><label>作者</label><input class="input" name="author" value="${b ? esc(b.author) : ''}" placeholder="佚名"></div>
              <div class="field"><label>类别</label><input class="input" name="category" list="bkCatList" value="${b ? esc(b.category) : ''}" placeholder="文学 / 历史 / 成长…">
                <datalist id="bkCatList">${categories().map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
              </div>
            </div>
            <div class="input-row">
              <div class="field"><label>阅读状态</label>
                <select class="select" name="status">
                  <option value="unread" ${!b || b.status === 'unread' ? 'selected' : ''}>未读</option>
                  <option value="reading" ${b && b.status === 'reading' ? 'selected' : ''}>在读</option>
                  <option value="read" ${b && b.status === 'read' ? 'selected' : ''}>已读</option>
                </select>
              </div>
              <div class="field"><label>评分</label>
                <div class="bk-rate-row" id="bkRateRow">
                  ${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="bk-rate ${i <= rating ? 'on' : ''}" data-act="bkRatePick" data-v="${i}">${IC.icon('star')}</button>`).join('')}
                  <button type="button" class="bk-rate-clear" data-act="bkRatePick" data-v="0" title="清除评分">${IC.icon('x')}</button>
                </div>
              </div>
            </div>
            <div class="field"><label>简介</label><textarea class="textarea" name="intro" rows="2" placeholder="这本书讲了什么？">${b ? esc(b.intro) : ''}</textarea></div>
            <div class="field"><label>读后感</label><textarea class="textarea" name="review" rows="2" placeholder="读完之后，想留下点什么？">${b ? esc(b.review) : ''}</textarea></div>
            <div class="bk-file-row">
              ${b && b.fileId
                ? `<span class="chip" data-tone="mint">${IC.icon('file')} 已关联 ${esc((b.format || '').toUpperCase())} 内容</span>
                   <button type="button" class="btn btn-ghost btn-sm" data-act="bkImportFor" data-id="${b.id}">重新导入</button>`
                : `<button type="button" class="btn btn-soft btn-sm" data-act="bkImportFor" data-id="${b ? b.id : ''}">${IC.icon('upload')} 导入 EPUB / PDF / TXT</button>
                   <span class="mini-label">自动解析封面、书名、作者与目录</span>`}
            </div>
          </div>
        </div>
      </form>`,
      foot: `<button class="btn btn-secondary btn-sm" data-act="closeModal">取消</button>
        <button class="btn btn-primary btn-sm" data-act="bkSaveBook">${IC.icon('save')} ${b ? '保存修改' : '放上书架'}</button>`
    });
  }

  /* ---------- 弹窗：书籍详情 ---------- */
  function bookDetailHTML(id) {
    const b = bookById(id);
    if (!b) return '';
    const pct = Math.round((Number(b.progress) || 0) * 100);
    const exs = excerptsOf(id);
    const notes = exs.filter((x) => x.note);
    const marks = marksOf(id);
    const toc = Array.isArray(b.tocTitles) ? b.tocTitles : [];
    const mins = (WB.db.readingSessions || []).filter((s) => s.bookId === id).reduce((s, x) => s + (Number(x.minutes) || 0), 0);
    return `<div class="modal-card book-detail" style="width:min(760px,96vw)">
      <div class="modal-head">
        <div class="mh-main">
          <span class="eyebrow"><span class="dotline"></span>书籍详情</span>
          <h2>《${esc(b.title)}》</h2>
          <div class="sub">${esc(b.author || '佚名')} · ${esc(b.category || '未分类')} · 加入于 ${new Date(b.createdAt).toLocaleDateString('zh-CN')}</div>
        </div>
        <button class="modal-close" data-act="closeModal">${IC.icon('x')}</button>
      </div>
      <div class="modal-body">
        <div class="bk-detail-grid">
          <div class="bk-detail-side">
            ${coverHTML(b, 'lg')}
            <div class="bk-detail-rate">${stars(b.rating)}</div>
            <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center" data-act="bkRead" data-id="${b.id}">${IC.icon('bookOpen')} ${b.status === 'unread' ? '开始阅读' : '继续阅读'}</button>
          </div>
          <div class="bk-detail-main">
            <div class="bk-detail-status">
              ${[['unread', '未读'], ['reading', '在读'], ['read', '已读']].map(([v, l]) =>
                `<button class="status-chip ${b.status === v ? 'active' : ''}" data-act="bkSetStatus" data-id="${b.id}" data-v="${v}">${l}</button>`).join('')}
            </div>
            <div class="bk-detail-progress">
              <div class="bdp-top"><span>阅读进度</span><b>${pct}%</b></div>
              <div class="rpr-bar lg"><i style="width:${pct}%"></i></div>
              <div class="bdp-meta">累计阅读 ${U.minsText(mins)} · ${b.lastReadAt ? `最近 ${U.fmtDateTime(b.lastReadAt)}` : '还没开始读'}</div>
            </div>
            ${b.intro ? `<div class="bk-detail-sec"><h4>${ico('info')} 简介</h4><p>${esc(b.intro)}</p></div>` : ''}
            <div class="bk-detail-counts">
              <span>${IC.icon('quote')} 摘抄 ${exs.length}</span>
              <span>${IC.icon('edit')} 笔记 ${notes.length}</span>
              <span>${IC.icon('bookmark')} 书签 ${marks.length}</span>
              ${b.format ? `<span>${IC.icon('file')} ${esc(b.format.toUpperCase())}</span>` : ''}
            </div>
            ${toc.length ? `<div class="bk-detail-sec"><h4>${IC.icon('list')} 目录 · ${toc.length} 章</h4>
              <div class="bk-toc">${toc.slice(0, 8).map((t, i) => `<span class="bk-toc-item">${i + 1}. ${esc(t)}</span>`).join('')}${toc.length > 8 ? `<span class="bk-toc-item muted">… 共 ${toc.length} 章</span>` : ''}</div>
            </div>` : ''}
            <div class="bk-detail-sec">
              <h4>${ico('edit')} 读后感</h4>
              <textarea class="textarea" id="bkReviewInput" rows="3" placeholder="写点读后的想法…">${esc(b.review || '')}</textarea>
              <div style="display:flex;justify-content:flex-end;margin-top:6px">
                <button class="btn btn-soft btn-sm" data-act="bkSaveReview" data-id="${b.id}">${IC.icon('save')} 保存读后感</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost btn-sm" data-act="bkEdit" data-id="${b.id}">${IC.icon('edit')} 编辑信息</button>
        ${!b.fileId ? `<button class="btn btn-soft btn-sm" data-act="bkImportFor" data-id="${b.id}">${IC.icon('upload')} 导入内容</button>` : ''}
        <button class="btn btn-danger btn-sm" data-act="bkDelete" data-id="${b.id}">${IC.icon('trash')} 删除</button>
        <span class="foot-note">删除书籍会同时移除其摘抄与书签</span>
      </div>
    </div>`;
  }

  /* ---------- 弹窗：摘抄编辑 ---------- */
  function excerptFormHTML(id, prefill) {
    const x = id ? (WB.db.bookExcerpts || []).find((e) => e.id === id) : null;
    const p = prefill || {};
    const books = WB.db.books || [];
    const curBook = x ? x.bookId : (p.bookId || (books[0] && books[0].id) || '');
    const curColor = x ? exColor(x.color) : (p.color || 'key');
    const curTags = x ? (x.tags || []) : [];
    return WB.UI.modalShell({
      cls: 'ex-form-modal', eyebrow: x ? '编辑摘抄' : '写摘抄',
      title: x ? '修改这条摘抄' : '记下打动你的句子',
      body: `<form id="excerptForm" data-id="${x ? x.id : ''}" class="set-body">
        <div class="field"><label>摘抄内容 <span class="req">*</span></label>
          <textarea class="textarea" name="text" rows="3" placeholder="原文摘抄…">${esc(x ? x.text : (p.text || ''))}</textarea></div>
        <div class="input-row">
          <div class="field"><label>关联书籍</label>
            <select class="select" name="bookId">
              <option value="">不关联</option>
              ${books.map((b) => `<option value="${b.id}" ${curBook === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}
            </select></div>
          <div class="field"><label>页码 / 位置</label><input class="input" name="page" value="${esc(x ? x.page : (p.page || ''))}" placeholder="如：第 3 章 / P.42"></div>
        </div>
        <div class="field"><label>标记颜色</label>
          <div class="ex-color-row">
            ${Object.entries(EX_COLORS).map(([k, n]) => `<label class="ex-color-opt ex-${k}">
              <input type="radio" name="color" value="${k}" ${curColor === k ? 'checked' : ''}><span>${n}</span></label>`).join('')}
          </div></div>
        <div class="field"><label>标签</label>
          <div class="ex-tag-row">
            ${EX_TAGS.map((t) => `<label class="ex-tag-opt"><input type="checkbox" name="tags" value="${esc(t)}" ${curTags.includes(t) ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
          </div></div>
        <div class="field"><label>个人笔记（与原文分开记录）</label>
          <textarea class="textarea" name="note" rows="2" placeholder="我的想法…">${esc(x ? x.note : '')}</textarea></div>
      </form>`,
      foot: `<button class="btn btn-secondary btn-sm" data-act="closeModal">取消</button>
        <button class="btn btn-primary btn-sm" data-act="bkSaveExcerpt">${IC.icon('save')} 保存</button>`
    });
  }

  /* ---------- 弹窗：阅读目标 ---------- */
  function goalHTML() {
    const g = WB.db.readingGoal || {};
    return WB.UI.modalShell({
      cls: 'goal-modal', eyebrow: '阅读目标', title: '给阅读定一个小目标',
      sub: '目标未完成时，晚间会收到提醒。',
      body: `<form id="goalForm" class="set-body">
        <div class="input-row">
          <div class="field"><label>每月读完（本）</label><input class="input" type="number" min="1" max="60" name="monthly" value="${Number(g.monthly) || 4}"></div>
          <div class="field"><label>每日阅读（分钟）</label><input class="input" type="number" min="5" max="600" step="5" name="dailyMin" value="${Number(g.dailyMin) || 30}"></div>
        </div>
        <label class="goal-remind"><input type="checkbox" name="remind" ${g.remind !== false ? 'checked' : ''}> 目标未完成时提醒我（晚间 20:00 后）</label>
      </form>`,
      foot: `<button class="btn btn-secondary btn-sm" data-act="closeModal">取消</button>
        <button class="btn btn-primary btn-sm" data-act="bkSaveGoal">${IC.icon('save')} 保存目标</button>`
    });
  }

  /* ---------- 弹窗：月度报告 / 热力图 ---------- */
  function reportHTML() {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const days = new Date(y, mo + 1, 0).getDate();
    const firstDow = new Date(y, mo, 1).getDay();
    const map = {};
    (WB.db.readingSessions || []).forEach((s) => { map[s.date] = (map[s.date] || 0) + (Number(s.minutes) || 0); });
    const max = Math.max(30, ...Object.values(map));
    let cells = '';
    for (let i = 0; i < firstDow; i++) cells += '<i class="hm-cell empty"></i>';
    for (let d = 1; d <= days; d++) {
      const k = `${y}-${U.pad(mo + 1)}-${U.pad(d)}`;
      const v = map[k] || 0;
      const lv = v === 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((v / max) * 4)));
      cells += `<i class="hm-cell lv${lv}" title="${mo + 1}月${d}日 · ${v ? U.minsText(v) : '未阅读'}"></i>`;
    }
    const mMin = monthMinutes();
    const fin = (WB.db.books || []).filter((b) => b.status === 'read' && String(b.finishedAt || '').startsWith(monthKey()));
    const exCount = (WB.db.bookExcerpts || []).filter((x) => String(x.createdAt || '').startsWith(monthKey())).length;
    const readDays = Object.keys(map).filter((k) => k.startsWith(monthKey())).length;
    const top = {};
    (WB.db.readingSessions || []).filter((s) => String(s.date).startsWith(monthKey())).forEach((s) => { top[s.bookId] = (top[s.bookId] || 0) + s.minutes; });
    const topId = Object.entries(top).sort((a, b) => b[1] - a[1])[0];
    const topBook = topId ? bookById(topId[0]) : null;
    return WB.UI.modalShell({
      cls: 'report-modal', eyebrow: '月度阅读报告', title: `${y} 年 ${mo + 1} 月`,
      sub: `本月阅读 ${U.minsText(mMin)} · ${readDays} 天有阅读 · 读完 ${fin.length} 本 · 新增摘抄 ${exCount} 条`,
      body: `<div class="hm-wrap">
        <div class="hm-dow">${['日', '一', '二', '三', '四', '五', '六'].map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="hm-grid">${cells}</div>
        <div class="hm-legend"><span>少</span><i class="hm-cell lv0"></i><i class="hm-cell lv1"></i><i class="hm-cell lv2"></i><i class="hm-cell lv3"></i><i class="hm-cell lv4"></i><span>多</span></div>
      </div>
      ${topBook ? `<div class="hm-top">${IC.icon('flame')} 本月读得最多的是《${esc(topBook.title)}》（${U.minsText(topId[1])}）</div>` : ''}
      ${fin.length ? `<div class="hm-fin"><h4>本月读完</h4>${fin.map((b) => `<span class="chip" data-tone="butter">${esc(b.title)}</span>`).join('')}</div>` : ''}`,
      foot: `<button class="btn btn-primary btn-sm" data-act="closeModal">好的</button>`
    });
  }

  /* ---------- afterRender：加载封面 ---------- */
  async function afterReading() {
    const imgs = document.querySelectorAll('img[data-cover-id]:not([src])');
    if (imgs.length) {
      for (const img of imgs) {
        try {
          const blob = await WB.idb.getFile(img.dataset.coverId);
          if (blob) img.src = URL.createObjectURL(blob);
          else img.closest('.bk-cover') && img.closest('.bk-cover').classList.add('no-img');
        } catch (e) { /* 忽略单个封面失败 */ }
      }
    }
    // 阅读目标提醒（20:00 后且今日未达标，每天一次）
    try {
      const g = WB.db.readingGoal || {};
      const now = new Date();
      if (g.remind !== false && now.getHours() >= 20 && todayMinutes() < (Number(g.dailyMin) || 30)) {
        WB.db.ui = WB.db.ui || {};
        WB.db.ui.notified = WB.db.ui.notified || {};
        const key = `read_${U.dateKey()}`;
        if (!WB.db.ui.notified[key]) {
          WB.db.ui.notified[key] = true;
          WB.save();
          APP.notify && APP.notify('今天的阅读目标还没完成', `目标 ${g.dailyMin || 30} 分钟，已读 ${todayMinutes()} 分钟。睡前翻几页吧。`, 'due');
        }
      }
    } catch (e) { /* 提醒失败不影响页面 */ }
  }

  Object.assign(WB.UI, {
    readingHTML, bookFormHTML, bookDetailHTML, excerptFormHTML, goalHTML, reportHTML,
    afterReading, bookById, coverHTML, excerptsOf, marksOf
  });
  WB.READ_EX_TAGS = EX_TAGS;
  WB.READ_EX_COLORS = EX_COLORS;
})();
