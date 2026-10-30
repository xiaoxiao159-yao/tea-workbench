/* 文献存储页 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const ico = (n) => `<span class="ico">${IC.icon(n)}</span>`;
  const esc = U.esc;

  function filters() {
    if (!WB.state.paperFilter) WB.state.paperFilter = { q: '', folder: 'all', tag: 'all', status: 'all' };
    return WB.state.paperFilter;
  }
  function folders() {
    const list = Array.isArray(WB.db.folders) ? WB.db.folders.slice() : [];
    if (!list.includes('待分类')) list.push('待分类');
    return list;
  }
  function tags() {
    const set = new Set();
    WB.db.papers.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return [...set].slice(0, 18);
  }
  function selectedSet() {
    if (!WB.state.paperSelection) WB.state.paperSelection = new Set();
    return WB.state.paperSelection;
  }
  function filtered() {
    const f = filters();
    const q = f.q.trim().toLowerCase();
    return WB.UI.papersSorted().filter((p) => {
      if (f.folder !== 'all' && p.folder !== f.folder) return false;
      if (f.tag !== 'all' && !(p.tags || []).includes(f.tag)) return false;
      if (f.status !== 'all' && p.status !== f.status) return false;
      if (!q) return true;
      return [p.title, p.author, p.innovation, p.folder, (p.tags || []).join(' ')].join(' ').toLowerCase().includes(q);
    });
  }

  function statusBtn(p) {
    const st = WB.PAPER_STATUS[p.status] || WB.PAPER_STATUS.unread;
    return `<button class="status-btn ${st.cls}" data-act="cycleStatus" data-id="${p.id}" title="点击切换阅读状态">
      <i class="dot" style="background:${p.status === 'read' ? 'var(--good)' : p.status === 'reading' ? 'var(--accent)' : 'var(--muted)'}"></i>${st.name}
    </button>`;
  }

  function paperCard(p) {
    const sel = selectedSet().has(p.id);
    return `<article class="paper-card ${p.pinned ? 'pinned' : ''}" draggable="true" data-drag="paper" data-id="${p.id}">
      <div class="pc-top">
        <label class="check"><input class="file-check" type="checkbox" data-act="selectPaper" data-id="${p.id}" ${sel ? 'checked' : ''} aria-label="选择文献"></label>
        <div class="pc-top-actions">
          <button class="icon-btn ${p.pinned ? 'active' : ''}" data-act="pinPaper" data-id="${p.id}" title="${p.pinned ? '取消置顶' : '置顶'}">${IC.icon('pin')}</button>
          <button class="icon-btn" data-act="downloadPaper" data-id="${p.id}" title="下载">${IC.icon('download')}</button>
          <button class="icon-btn" data-act="openPaper" data-id="${p.id}" title="预览与编辑">${IC.icon('note')}</button>
        </div>
      </div>
      <h3 data-act="openPaper" data-id="${p.id}">${esc(p.title)}</h3>
      <div class="pc-author">${esc(p.author || '作者待补充')}</div>
      <div class="pc-innov"><b>创新点</b> · ${esc(p.innovation || '还没有记录创新点，点开补充一条。')}</div>
      <div class="pc-tags">
        ${(p.tags || []).slice(0, 3).map((t) => `<button class="chip" data-tone="${U.toneFor(t)}" data-act="filterTag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}
        ${(p.tags || []).length > 3 ? `<span class="chip">+${p.tags.length - 3}</span>` : ''}
      </div>
      <div class="pc-foot">
        ${statusBtn(p)}
        <span class="pc-meta">${esc(p.venue || '未标注')} · ${p.year || '—'}</span>
      </div>
    </article>`;
  }

  function paperRow(p) {
    const sel = selectedSet().has(p.id);
    return `<div class="paper-row" data-act="openPaper" data-id="${p.id}">
      <span class="file-badge">${(p.fileType || 'PDF').toUpperCase().slice(0, 4)}</span>
      <div style="min-width:0">
        <div class="pr-title">${esc(p.title)}</div>
        <div class="pr-sub">${esc(p.innovation || '未记录创新点')}</div>
      </div>
      <div class="pr-author">${esc(p.author || '—')}</div>
      <div class="pr-tags">${(p.tags || []).slice(0, 2).map((t) => `<span class="chip" data-tone="${U.toneFor(t)}">${esc(t)}</span>`).join('') || '<span class="muted" style="font-size:9.5px">—</span>'}</div>
      <div class="pr-status">${statusBtn(p)}</div>
      <div class="pr-actions">
        <button class="icon-btn" data-act="openPaper" data-id="${p.id}" title="预览">${IC.icon('bookOpen')}</button>
        <button class="icon-btn" data-act="deletePaper" data-id="${p.id}" title="删除">${IC.icon('trash')}</button>
      </div>
    </div>`;
  }

  function papersHTML() {
    const f = filters();
    const list = filtered();
    const all = WB.db.papers;
    const counts = {
      unread: all.filter((p) => p.status === 'unread').length,
      reading: all.filter((p) => p.status === 'reading').length,
      read: all.filter((p) => p.status === 'read').length
    };
    const view = WB.state.paperView || 'grid';
    const sel = selectedSet();

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>LIBRARY · 文献存储</span>
          <h1 class="page-title">文献，慢慢读。</h1>
          <p class="page-sub">把找到的文章、灵感和批注收在这里。支持 PDF / Word 批量上传，卡片按文件夹与标签归档。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-act="exportPapers">${IC.icon('download')} 导出目录</button>
          <button class="btn btn-primary" data-act="pickFiles">${IC.icon('upload')} 批量上传</button>
        </div>
      </div>

      <div class="paper-summary">
        <span class="paper-stat"><b>${all.length}</b> 篇收藏</span>
        <span class="paper-stat"><b>${counts.unread}</b> 未读</span>
        <span class="paper-stat"><b>${counts.reading}</b> 在读</span>
        <span class="paper-stat"><b>${counts.read}</b> 已读</span>
        <span class="paper-stat"><b>${folders().length}</b> 个文件夹</span>
      </div>

      <div class="card filter-card">
        <div class="filter-row">
          <div class="filter-search">
            ${ico('search')}
            <input id="paperSearch" placeholder="筛选标题、作者、创新点…" value="${esc(f.q)}" autocomplete="off">
          </div>
          <select class="filter-select" id="filterFolder">
            <option value="all">全部文件夹</option>
            ${folders().map((x) => `<option value="${esc(x)}" ${f.folder === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" data-act="openFolderMgr" title="新建 / 重命名 / 删除文件夹">${IC.icon('folder')} 管理</button>
          <select class="filter-select" id="filterTag">
            <option value="all">全部标签</option>
            ${tags().map((x) => `<option value="${esc(x)}" ${f.tag === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
          </select>
          <div class="segmented status-seg">
            ${[['all', '全部'], ['unread', '未读'], ['reading', '在读'], ['read', '已读']].map(([v, l]) =>
              `<button class="${f.status === v ? 'active' : ''}" data-act="filterStatus" data-status="${v}">${l}</button>`).join('')}
          </div>
          <div class="view-toggle">
            <button class="${view === 'grid' ? 'active' : ''}" data-act="paperView" data-view="grid" title="卡片视图">${IC.icon('grid')}</button>
            <button class="${view === 'list' ? 'active' : ''}" data-act="paperView" data-view="list" title="列表视图">${IC.icon('list')}</button>
          </div>
          <span class="filter-count">显示 <b>${list.length}</b> / ${all.length}</span>
        </div>
      </div>

      <div class="dropzone" id="paperDropzone" data-act="pickFiles">
        <span class="dz-ico">${IC.icon('upload')}</span>
        <div class="dz-main">
          <strong>把文献拖到这里，或点击选择文件</strong>
          <span>支持 PDF、Word、Markdown、TXT · 可一次选择多份 · 文件保存在本地浏览器</span>
        </div>
        <div class="dz-actions">
          <span class="chip" data-tone="mint">安全本地存储</span>
          <button class="btn btn-soft btn-sm" data-act="pickFiles">${IC.icon('folder')} 选择文件</button>
        </div>
      </div>

      ${sel.size ? `<div class="paper-bulkbar">
        <span>已选择 <b>${sel.size}</b> 篇</span>
        <button class="btn btn-sm btn-secondary" data-act="bulkStatus" data-status="read">${IC.icon('check')} 标记已读</button>
        <button class="btn btn-sm btn-secondary" data-act="bulkStatus" data-status="reading">标记在读</button>
        <button class="btn btn-sm btn-danger" data-act="bulkDelete">${IC.icon('trash')} 删除</button>
        <button class="btn btn-sm btn-ghost" data-act="clearSelection">取消选择</button>
      </div>` : ''}

      ${list.length ? (view === 'grid'
        ? `<div class="paper-grid">${list.map(paperCard).join('')}</div>`
        : `<div class="paper-list">
            <div class="paper-list-head"><span></span><span>文献</span><span>作者</span><span>标签</span><span>状态</span><span>操作</span></div>
            ${list.map(paperRow).join('')}
          </div>`)
        : `<div class="card empty">
            <div class="empty-art">${IC.icon('book')}</div>
            <h4>${all.length ? '没有符合条件的文献' : '书架还空着'}</h4>
            <p>${all.length ? '换一个文件夹、标签或阅读状态试试，也可以清空筛选。' : '把第一篇想读的论文放进来吧。支持批量拖拽上传，所有文件只保存在你这台设备上。'}</p>
            <div class="empty-actions">
              ${all.length ? `<button class="btn btn-secondary btn-sm" data-act="clearPaperFilters">清除筛选</button>` : ''}
              <button class="btn btn-primary btn-sm" data-act="pickFiles">${IC.icon('upload')} 上传文献</button>
            </div>
          </div>`}
    </div>`;
  }

  function citationOf(p) {
    const author = (p.author || '佚名').replace(/\.$/, '');
    const type = /会议|ECCV|CVPR|ICCV|NeurIPS|ACL|AAAI/i.test(p.venue || '') ? 'C' : 'J';
    const venue = p.venue || '未标注出版物';
    const year = p.year || 'n.d.';
    return `${author}. ${p.title}[${type}]. ${venue}, ${year}.${p.doi ? ` DOI: ${p.doi}.` : ''}`;
  }

  function paperPreviewHTML(id) {
    const p = WB.UI.paperById(id);
    if (!p) return '';
    return `<div class="modal-card preview-modal">
      <div class="modal-head">
        <div class="mh-main">
          <span class="eyebrow"><span class="dotline"></span>文献详情</span>
          <h2>${esc(p.title)}</h2>
          <div class="sub">${esc(p.author || '作者待补充')} · ${p.status === 'read' ? '已读' : p.status === 'reading' ? '在读' : '未读'} · ${esc(p.folder || '未分类')}</div>
        </div>
        <button class="modal-close" data-act="closeModal">${IC.icon('x')}</button>
      </div>
      <div class="modal-body">
        <div class="preview-layout">
          <div class="preview-stage">
            <div class="ps-head">
              <span id="paperStageName">${esc(p.fileName || '尚未关联本地文件')}</span>
              <div class="ps-head-right">
                <span>${(p.fileType || 'PDF').toUpperCase()}</span>
                <button type="button" class="ps-fs-btn" id="paperFullscreenBtn" data-act="paperFullscreen" title="全屏阅读文献">${IC.icon('maximize')}<span>全屏</span></button>
              </div>
            </div>
            <div class="ps-body" id="paperPreviewStage">
              <div class="preview-placeholder">
                <div class="pp-file">${(p.fileType || 'PDF').toUpperCase().slice(0, 4)}</div>
                <div><strong style="color:var(--text);font-size:12px">${p.fileName ? '正在读取本地文件…' : '仅存有文献条目信息'}</strong></div>
                <p>${p.fileName ? '文件从本地 IndexedDB 读取，不会上传到云端。' : '示例条目没有附带文件。你可以下载或替换为本地文件后预览。'}</p>
                <button class="btn btn-secondary btn-sm" data-act="downloadPaper" data-id="${p.id}">${IC.icon('download')} 下载文件</button>
              </div>
            </div>
          </div>
          <form class="preview-form" id="paperEditForm" data-id="${p.id}">
            <div class="field"><label>文献名称</label><input class="input" name="title" value="${esc(p.title)}"></div>
            <div class="field"><label>作者</label><input class="input" name="author" value="${esc(p.author || '')}"></div>
            <div class="field"><label>创新点 · 一句话记住它</label><textarea class="textarea" name="innovation" style="min-height:62px">${esc(p.innovation || '')}</textarea></div>
            <div class="input-row">
              <div class="field"><label>文件夹</label><input class="input" name="folder" value="${esc(p.folder || '')}" list="folderOptions">
                <datalist id="folderOptions">${folders().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
              </div>
              <div class="field"><label>阅读状态</label><select class="select" name="status">
                ${Object.entries(WB.PAPER_STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.name}</option>`).join('')}
              </select></div>
            </div>
            <div class="input-row">
              <div class="field"><label>期刊 / 会议</label><input class="input" name="venue" value="${esc(p.venue || '')}"></div>
              <div class="field"><label>年份</label><input class="input" name="year" type="number" value="${p.year || ''}"></div>
            </div>
            <div class="field"><label>DOI</label><input class="input" name="doi" value="${esc(p.doi || '')}"></div>
            <div class="field"><label>标签（用逗号分隔）</label><input class="input" name="tags" value="${esc((p.tags || []).join(', '))}"></div>
            <div class="field"><label>笔记批注</label><textarea class="textarea note-area" name="notes" placeholder="记下值得回看的句子、疑问和想法…">${esc(p.notes || '')}</textarea></div>
            <div class="citation-box" id="citationBox"><b style="color:var(--accent-strong)">引用</b> ${esc(citationOf(p))}</div>
            <div class="flex gap-6" style="flex-wrap:wrap">
              <button type="button" class="btn btn-sm btn-secondary" data-act="citePaper" data-id="${p.id}">${IC.icon('quote')} 复制引用</button>
              <button type="button" class="btn btn-sm btn-ghost" data-act="downloadPaper" data-id="${p.id}">${IC.icon('download')} 下载</button>
              <button type="button" class="btn btn-sm btn-danger" data-act="deletePaper" data-id="${p.id}">${IC.icon('trash')} 删除</button>
            </div>
          </form>
        </div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">文件仅存于本地 · 笔记自动保存在条目中</span>
        <button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn btn-primary" data-act="savePaper" data-id="${p.id}">${IC.icon('save')} 保存条目</button>
      </div>
    </div>`;
  }

  function folderMgrHTML() {
    const list = folders();
    return `<div class="modal-card folder-mgr">
      <div class="modal-head">
        <div class="mh-main">
          <span class="eyebrow"><span class="dotline"></span>文件夹管理</span>
          <h2>管理文献分类文件夹</h2>
          <div class="sub">新建、重命名或删除文件夹。删除文件夹时，其中的文献会自动归入「待分类」。</div>
        </div>
        <button class="modal-close" data-act="closeModal">${IC.icon('x')}</button>
      </div>
      <div class="modal-body">
        <div class="folder-list">
          ${list.map((name) => `
            <div class="folder-row" data-old="${esc(name)}">
              <span class="folder-ico">${IC.icon('folder')}</span>
              <input class="input" data-folder-input value="${esc(name)}" aria-label="文件夹名">
              <button class="btn btn-sm btn-secondary" data-act="renameFolder" data-old="${esc(name)}" title="保存新名称">${IC.icon('check')}</button>
              <button class="btn btn-sm btn-danger" data-act="deleteFolder" data-name="${esc(name)}" title="删除该文件夹">${IC.icon('trash')}</button>
            </div>`).join('')}
          ${list.length === 0 ? '<div class="empty-tip">还没有文件夹，在下方新建一个。</div>' : ''}
        </div>
        <div class="folder-new">
          <input class="input" id="newFolderName" placeholder="输入新文件夹名称（例如：强化学习）" aria-label="新文件夹名称">
          <button class="btn btn-primary" data-act="createFolder">${IC.icon('plus')} 新建文件夹</button>
        </div>
      </div>
      <div class="modal-foot">
        <span class="foot-note">提示：文件夹会自动保存并用于文献分类与筛选。</span>
        <button class="btn btn-secondary" data-act="closeModal">完成</button>
      </div>
    </div>`;
  }

  WB.UI.papersHTML = papersHTML;
  WB.UI.paperPreviewHTML = paperPreviewHTML;
  WB.UI.citationOf = citationOf;
  WB.UI.paperFilters = filters;
  WB.UI.filteredPapers = filtered;
  WB.UI.folderMgrHTML = folderMgrHTML;
})();
