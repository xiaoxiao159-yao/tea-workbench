/* 弹窗内容：任务详情 / 新建任务 / 定时弹窗 / 模板 / 预算 / 快捷键 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;

  function modalShell(opts) {
    const close = opts.closeable === false ? '' :
      `<button class="modal-close" data-act="closeModal" aria-label="关闭">${IC.icon('x')}</button>`;
    return `<div class="modal-card ${opts.cls || ''}">
      ${opts.hero || ''}
      <div class="modal-head">
        <div class="mh-main">
          ${opts.eyebrow ? `<span class="eyebrow"><span class="dotline"></span>${opts.eyebrow}</span>` : ''}
          <h2>${opts.title || ''}</h2>
          ${opts.sub ? `<div class="sub">${opts.sub}</div>` : ''}
        </div>
        ${close}
      </div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.foot ? `<div class="modal-foot">${opts.foot}</div>` : ''}
    </div>`;
  }

  function focusTotal(t) {
    return Number(t.focusMinutes) || 0;
  }

  function taskDetailHTML(id) {
    const t = WB.UI.taskById(id);
    if (!t) return '';
    const p = WB.UI.progressOf(t);
    const pr = WB.PRIORITIES[t.priority] || WB.PRIORITIES.mid;
    return `<div class="modal-card task-detail" style="width:min(720px,96vw)">
      <div class="modal-head">
        <div class="mh-main">
          <span class="eyebrow"><span class="dotline"></span>任务详情</span>
          <h2>把一件事，拆成几小步。</h2>
          <div class="sub">累计专注 ${U.minsText(focusTotal(t))} · 创建于 ${new Date(t.createdAt).toLocaleDateString('zh-CN')}</div>
        </div>
        <button class="modal-close" data-act="closeModal">${IC.icon('x')}</button>
      </div>
      <div class="modal-body">
        <form id="taskEditForm" data-id="${t.id}" class="task-detail-body">
          <div class="task-detail-head">
            <button type="button" class="checkbox ${t.done ? 'done' : ''}" data-act="toggleTaskDetail" data-id="${t.id}" style="width:22px;height:22px;border-radius:7px;border:1.5px solid var(--line-strong);display:grid;place-items:center;background:${t.done ? 'var(--good)' : 'var(--card)'};color:${t.done ? '#fff' : 'transparent'};margin-top:2px">${IC.icon('check')}</button>
            <input class="task-detail-title" name="title" value="${esc(t.title)}" placeholder="任务名称">
          </div>
          <div class="td-grid">
            <div class="field"><label>优先级</label>
              <select class="select" name="priority">
                ${Object.entries(WB.PRIORITIES).map(([k, v]) => `<option value="${k}" ${t.priority === k ? 'selected' : ''}>${v.name}优先</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>截止日期</label><input class="input" type="date" name="due" value="${t.due || ''}"></div>
            <div class="field"><label>提醒时间</label><input class="input" type="time" name="reminder" value="${t.reminder || ''}"></div>
          </div>
          <div class="input-row">
            <div class="field"><label>重复规则</label>
              <select class="select" name="repeat">
                <option value="none" ${!t.repeat || t.repeat === 'none' ? 'selected' : ''}>不重复</option>
                <option value="daily" ${t.repeat === 'daily' ? 'selected' : ''}>每天</option>
                <option value="weekly" ${t.repeat === 'weekly' ? 'selected' : ''}>每周</option>
              </select>
            </div>
            <div class="field"><label>当前状态</label>
              <div class="flex gap-6" style="height:36px">
                <span class="pill" style="background:${pr.soft};color:${pr.color}">${pr.name}优先</span>
                <span class="pill ${t.done ? 'good' : 'neutral'}">${t.done ? '已完成' : t.archived ? '已归档' : '进行中'}</span>
              </div>
            </div>
          </div>

          <div class="td-progress-card">
            <div class="td-progress-top"><span>完成进度</span><b id="tdProgressNum">${p}%</b></div>
            <div class="td-progress-bar"><i id="tdProgressFill" style="width:${p}%"></i></div>
            <div class="td-mode">
              <label><input type="radio" name="progressMode" value="auto" ${t.progressMode !== 'manual' ? 'checked' : ''}> 按子任务自动计算</label>
              <label><input type="radio" name="progressMode" value="manual" ${t.progressMode === 'manual' ? 'checked' : ''}> 手动设定</label>
            </div>
            <div class="field" style="margin-top:4px">
              <input class="input" type="range" min="0" max="100" step="5" name="manualProgress" value="${Number(t.manualProgress) || 0}" style="padding:0;background:none;border:0;accent-color:var(--accent)">
            </div>
          </div>

          <div>
            <div class="subtask-head">
              <h4>子任务分解 · ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</h4>
              <span class="mini-label">勾选即更新进度</span>
            </div>
            <div class="subtask-list" id="subtaskList">
              ${t.subtasks.length ? t.subtasks.map((s) => `<div class="subtask ${s.done ? 'done' : ''}">
                <input class="file-check" type="checkbox" data-act="toggleSubtask" data-task="${t.id}" data-sub="${s.id}" ${s.done ? 'checked' : ''}>
                <span class="st-title">${esc(s.title)}</span>
                <button type="button" class="icon-btn sub-del" data-act="delSubtask" data-task="${t.id}" data-sub="${s.id}">${IC.icon('x')}</button>
              </div>`).join('') : `<div class="muted" style="font-size:10.5px;padding:6px 2px">还没有子任务。把大任务拆成可以立即开始的小步骤。</div>`}
            </div>
            <div class="subtask-add">
              <input class="input" id="newSubtaskInput" placeholder="添加一个子任务，回车确认">
              <button type="button" class="btn btn-sm btn-soft" data-act="addSubtask" data-task="${t.id}">${IC.icon('plus')} 添加</button>
            </div>
          </div>

          <div class="td-focus-meta">
            <span>累计投入 <b>${U.minsText(focusTotal(t))}</b> · ${t.subtasks.length ? `${t.subtasks.length} 个子任务` : '未拆分子任务'}</span>
            <button type="button" class="btn btn-sm btn-primary" data-act="startTaskPomodoro" data-id="${t.id}">${IC.icon('timer')} 开始番茄钟</button>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-sm btn-ghost" data-act="archiveTask" data-id="${t.id}">${IC.icon('archive')} ${t.archived ? '取消归档' : '归档'}</button>
        <button class="btn btn-sm btn-danger" data-act="deleteTask" data-id="${t.id}">${IC.icon('trash')} 删除</button>
        <span class="foot-note">已完成 ${t.done ? '· 任务已完成' : '· 保存后同步到任务栏'}</span>
        <button class="btn btn-secondary btn-sm" data-act="closeModal">取消</button>
        <button class="btn btn-primary btn-sm" data-act="saveTask" data-id="${t.id}">${IC.icon('save')} 保存</button>
      </div>
    </div>`;
  }

  function newTaskHTML(defaults) {
    const d = defaults || {};
    return modalShell({
      cls: 'new-task-modal', eyebrow: '新建任务', title: '现在，想完成哪件小事？',
      sub: '可以顺手拆解几个子任务，进度会自动计算。',
      body: `<form id="newTaskForm" class="set-body">
        <div class="field"><label>任务名称 <span class="req">*</span></label><input class="input" name="title" id="newTaskTitle" placeholder="例如：整理 Method 章节提纲" autocomplete="off"></div>
        <div class="td-grid">
          <div class="field"><label>优先级</label><select class="select" name="priority">
            <option value="high">高优先</option><option value="mid" selected>中优先</option><option value="low">低优先</option>
          </select></div>
          <div class="field"><label>截止日期</label><input class="input" type="date" name="due" value="${d.due || U.dateKey()}"></div>
          <div class="field"><label>提醒时间</label><input class="input" type="time" name="reminder"></div>
        </div>
        <div class="input-row">
          <div class="field"><label>重复规则</label><select class="select" name="repeat">
            <option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option>
          </select></div>
          <div class="field"><label>关联番茄钟任务</label><div class="input" style="display:flex;align-items:center;color:var(--muted);font-size:11px">保存后可在番茄钟中选择关联</div></div>
        </div>
        <div class="field"><label>子任务（每行一条，可选）</label><textarea class="textarea" name="subtasks" placeholder="列章节提纲&#10;补实验设置&#10;润色英文"></textarea></div>
      </form>`,
      foot: `<span class="foot-note">快捷键 N 可随时快速新建</span>
        <button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn btn-primary" data-act="createTask">${IC.icon('plus')} 创建任务</button>`
    });
  }

  function popupHTML(popupId) {
    const p = (WB.db.popups || []).find((x) => x.id === popupId) ||
      (WB.db.popups || [])[0] || null;
    const tpl = p ? (WB.db.templates || []).find((t) => t.id === p.templateId) : null;
    const fields = (tpl && tpl.fields.length) ? tpl.fields : [{ label: '今天想记下的一件事', type: 'textarea', required: true }];
    const title = p ? p.title : '今日复盘';
    const hero = `<div class="popup-hero">
      <span class="pu-badge">${IC.icon('bell')} ${p ? `定时弹窗 · ${esc(p.time)}` : '定时弹窗'}</span>
      <h2>${esc(title)}</h2>
      <p>${tpl ? esc(tpl.name) : '自由填写'} · 请完成所有必填项后再关闭</p>
    </div>`;
    const inputs = fields.map((f, i) => {
      const name = `pf_${i}`;
      const req = f.required ? '<span class="req">*</span>' : '';
      if (f.type === 'checkbox') {
        return `<div class="popup-field">
          <label for="${name}">${esc(f.label)} ${req}</label>
          <label class="popup-check" for="${name}">
            <input type="checkbox" id="${name}" name="${name}" data-popup-field data-required="${f.required ? '1' : '0'}">
            <span>${esc(f.hint || '确认')}</span>
          </label>
        </div>`;
      }
      if (f.type === 'textarea') {
        return `<div class="popup-field">
          <label for="${name}">${esc(f.label)} ${req}</label>
          <textarea class="textarea" id="${name}" name="${name}" data-popup-field data-required="${f.required ? '1' : '0'}" placeholder="写下你的回答…" style="min-height:78px"></textarea>
          ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}
        </div>`;
      }
      return `<div class="popup-field">
        <label for="${name}">${esc(f.label)} ${req}</label>
        <input class="input" type="${f.type === 'number' ? 'number' : 'text'}" id="${name}" name="${name}" data-popup-field data-required="${f.required ? '1' : '0'}" placeholder="${f.type === 'number' ? '输入数字' : '写下你的回答…'}">
        ${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}
      </div>`;
    }).join('');
    return `<div class="modal-card popup-modal">
      ${hero}
      <div class="modal-body">
        <form id="popupForm" data-popup-id="${p ? p.id : ''}" data-template-id="${tpl ? tpl.id : ''}" class="popup-fields">
          <div class="popup-lock-note">${IC.icon('lock')} 这是一次必须完成的记录，关闭按钮已锁定。填写完成后即可保存。</div>
          ${inputs}
          <div>
            <div class="flex" style="justify-content:space-between;font-size:10px;color:var(--muted)">
              <span>填写进度</span><span id="popupProgressText">0 / ${fields.filter((f) => f.required).length} 必填</span>
            </div>
            <div class="popup-progress"><i id="popupProgressFill" style="width:0%"></i></div>
          </div>
        </form>
      </div>
      <div class="modal-foot">
        <span class="foot-note" id="popupFootNote">请完成全部必填项，之后才能关闭弹窗</span>
        <button class="btn btn-primary" id="popupSubmit" data-act="submitPopup" data-id="${p ? p.id : ''}" disabled>${IC.icon('check')} 完成并关闭</button>
      </div>
    </div>`;
  }

  function validatePopup() {
    const form = document.getElementById('popupForm');
    if (!form) return false;
    const fields = [...form.querySelectorAll('[data-popup-field]')];
    const required = fields.filter((f) => f.dataset.required === '1');
    let done = 0;
    let ok = true;
    required.forEach((f) => {
      const good = f.type === 'checkbox' ? f.checked : String(f.value || '').trim().length > 0;
      if (good) done++;
      else ok = false;
    });
    const fill = document.getElementById('popupProgressFill');
    const txt = document.getElementById('popupProgressText');
    const btn = document.getElementById('popupSubmit');
    const note = document.getElementById('popupFootNote');
    if (fill) fill.style.width = `${required.length ? (done / required.length) * 100 : 100}%`;
    if (txt) txt.textContent = `${done} / ${required.length} 必填`;
    if (btn) btn.disabled = !ok;
    if (note) note.textContent = ok ? '已完成全部必填项，可以保存并关闭' : '请完成全部必填项，之后才能关闭弹窗';
    if (note) note.style.color = ok ? 'var(--good)' : '';
    return ok;
  }

  function templateEditorHTML(id) {
    const tpl = id ? (WB.db.templates || []).find((t) => t.id === id) : null;
    const fields = tpl ? tpl.fields : [
      { label: '今天完成了什么？', type: 'textarea', required: true },
      { label: '明天最重要的一件事', type: 'textarea', required: true }
    ];
    return modalShell({
      cls: 'template-modal', eyebrow: '弹窗模板', title: tpl ? '编辑模板' : '新建弹窗模板',
      sub: '模板决定弹窗里要填写哪些内容，可复用到多个定时弹窗。',
      body: `<form id="templateForm" data-id="${tpl ? tpl.id : ''}" class="set-body">
        <div class="input-row">
          <div class="field"><label>模板名称 <span class="req">*</span></label><input class="input" name="name" value="${esc(tpl ? tpl.name : '')}" placeholder="例如：每日复盘"></div>
          <div class="field"><label>图标</label><select class="select" name="icon">
            ${[['moon', '月亮 · 复盘'], ['calendar', '日历 · 计划'], ['wallet', '钱包 · 支出'], ['note', '笔记 · 记录'], ['leaf', '叶子 · 心情']].map(([v, l]) => `<option value="${v}" ${tpl && tpl.icon === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        </div>
        <div>
          <div class="flex" style="justify-content:space-between;margin-bottom:6px"><span class="field-label">字段列表</span><span class="mini-label">必填项不完成无法关闭弹窗</span></div>
          <div class="field-editor" id="fieldEditor">
            ${fields.map((f) => fieldRowHTML(f)).join('')}
          </div>
          <div class="field-editor-actions">
            <button type="button" class="btn btn-sm btn-secondary" data-act="addFieldRow">${IC.icon('plus')} 添加字段</button>
            <span class="mini-label">支持文本、长文本、数字、勾选确认</span>
          </div>
        </div>
        <div class="data-note">示例：每日复盘可以包含「今天完成了什么」「专注时长」「今日状态」「明日计划」四个字段。</div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn btn-primary" data-act="saveTemplate" data-id="${tpl ? tpl.id : ''}">${IC.icon('save')} 保存模板</button>`
    });
  }

  function fieldRowHTML(f) {
    const v = f || { label: '', type: 'text', required: true };
    return `<div class="field-row" data-field-row>
      <input class="input input-sm field-label-input" placeholder="字段名称" value="${esc(v.label)}">
      <select class="select input-sm field-type-select">
        ${[['text', '文本'], ['textarea', '长文本'], ['number', '数字'], ['checkbox', '勾选确认']].map(([k, l]) => `<option value="${k}" ${v.type === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <label class="req-box"><input type="checkbox" ${v.required ? 'checked' : ''}>必填</label>
      <button type="button" class="icon-btn" data-act="removeFieldRow">${IC.icon('x')}</button>
    </div>`;
  }

  function popupEditorHTML(id) {
    const p = id ? (WB.db.popups || []).find((x) => x.id === id) : null;
    const templates = WB.db.templates || [];
    const days = p && p.repeat === 'custom' ? (p.days || []) : [];
    return modalShell({
      cls: 'schedule-modal', eyebrow: '定时弹窗', title: p ? '编辑定时弹窗' : '新建定时弹窗',
      sub: '到点自动弹出并发送系统通知，必须完成才能关闭。',
      body: `<form id="popupEditForm" data-id="${p ? p.id : ''}" class="set-body">
        <div class="field"><label>弹窗标题 <span class="req">*</span></label><input class="input" name="title" value="${esc(p ? p.title : '今日复盘 · 睡前十分钟')}"></div>
        <div class="input-row">
          <div class="field"><label>触发时间 <span class="req">*</span></label><input class="input" type="time" name="time" value="${p ? p.time : '22:30'}"></div>
          <div class="field"><label>重复规则</label><select class="select" name="repeat" id="popupRepeat">
            <option value="daily" ${!p || p.repeat === 'daily' ? 'selected' : ''}>每天</option>
            <option value="workday" ${p && p.repeat === 'workday' ? 'selected' : ''}>工作日（周一至周五）</option>
            <option value="custom" ${p && p.repeat === 'custom' ? 'selected' : ''}>自定义星期</option>
          </select></div>
        </div>
        <div class="field" id="customDaysBox" style="${p && p.repeat === 'custom' ? '' : 'display:none'}">
          <label>选择星期</label>
          <div class="flex gap-6" style="flex-wrap:wrap">
            ${['日', '一', '二', '三', '四', '五', '六'].map((n, i) => `<label class="checkline" style="padding:4px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2)">
              <input type="checkbox" name="days" value="${i}" ${days.includes(i) ? 'checked' : ''}> 周${n}</label>`).join('')}
          </div>
        </div>
        <div class="field"><label>使用模板 <span class="req">*</span></label><select class="select" name="templateId">
          ${templates.map((t) => `<option value="${t.id}" ${p && p.templateId === t.id ? 'selected' : ''}>${esc(t.name)} · ${t.fields.length} 个字段</option>`).join('')}
          <option value="" ${!p || !p.templateId ? 'selected' : ''}>自由填写（仅一个文本字段）</option>
        </select></div>
        <label class="checkline"><input type="checkbox" name="enabled" ${!p || p.enabled ? 'checked' : ''}> 启用这个定时弹窗</label>
        <div class="data-note">弹窗会在触发时间自动出现，并发送系统通知。填写历史可在设置中查询与导出。日常复盘建议固定在睡前，例如 22:30。</div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn btn-primary" data-act="savePopupEdit" data-id="${p ? p.id : ''}">${IC.icon('save')} 保存弹窗</button>`
    });
  }

  function budgetHTML() {
    return modalShell({
      eyebrow: '预算设置', title: '给自己留一点余地',
      sub: '预算不是限制，而是提醒。随时可以调整。',
      body: `<form id="budgetModalForm" class="set-body">
        <div class="two-col">
          <div class="field"><label>每日预算（元）</label><input class="input" type="number" min="0" name="dailyBudget" value="${WB.db.settings.dailyBudget}"></div>
          <div class="field"><label>每月预算（元）</label><input class="input" type="number" min="0" name="monthlyBudget" value="${WB.db.settings.monthlyBudget}"></div>
        </div>
        <div class="data-note">达到每日预算的 100% 时，支出页会显示超支提醒，但不会阻止你继续记录。</div>
      </form>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">取消</button><button class="btn btn-primary" data-act="saveBudget">${IC.icon('save')} 保存预算</button>`
    });
  }

  function historyHTML(id) {
    const h = (WB.db.popupHistory || []).find((x) => x.id === id);
    if (!h) return '';
    const rows = Object.entries(h.answers || {}).map(([q, a]) => `<div class="field"><label>${esc(q)}</label>
      <div class="citation-box">${esc(typeof a === 'boolean' ? (a ? '已确认' : '未确认') : a)}</div></div>`).join('');
    return modalShell({
      eyebrow: '填写记录', title: esc(h.title || '定时弹窗'),
      sub: U.fmtDateTime(h.ts),
      body: `<div class="set-body">${rows || '<p class="muted">没有记录内容</p>'}</div>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">关闭</button>`
    });
  }

  function shortcutsHTML() {
    const rows = [
      ['新建任务', ['N']], ['开始 / 暂停番茄钟', ['P']], ['聚焦全局搜索', ['/']],
      ['关闭弹窗 / 收起面板', ['Esc']], ['切换深浅色', ['T']], ['触发今日复盘', ['R']],
      ['快速记一笔支出', ['E']], ['打开数据统计', ['S']]
    ];
    return modalShell({
      eyebrow: '键盘快捷键', title: '手不离键盘',
      sub: '在输入框中输入时，快捷键会自动让位。',
      body: `<div class="cheat-grid">${rows.map(([label, keys]) => `<div class="cheat-row"><span>${label}</span><span class="keys">${keys.map((k) => `<kbd class="key">${k}</kbd>`).join('')}</span></div>`).join('')}</div>
        <div class="data-note mt-14">搜索框支持按 Esc 关闭，回车打开第一条结果。定时弹窗为强制填写，Esc 不会关闭它。</div>`,
      foot: `<button class="btn btn-primary" data-act="closeModal">知道了</button>`
    });
  }

  function profileHTML() {
    const papers = WB.db.papers.length;
    const tasks = WB.db.tasks.filter((t) => !t.done && !t.archived).length;
    const focus = WB.UI.todayFocus();
    const days = WB.UI.streakDays();
    return modalShell({
      eyebrow: '个人工作台', title: '柚子的工作台',
      sub: '一杯茶，一张桌子，慢慢把事情做完。',
      body: `<div class="set-body">
        <div class="stats-metrics" style="margin:0;grid-template-columns:1fr 1fr">
          <div class="metric-card"><div class="mk-label">今天专注</div><div class="mk-value">${U.minsShort(focus)}</div><div class="mk-foot">连续 ${days} 天</div></div>
          <div class="metric-card"><div class="mk-label">进行中任务</div><div class="mk-value">${tasks}<small>项</small></div><div class="mk-foot">${papers} 篇文献收藏</div></div>
        </div>
        <div class="data-note">所有数据保存在当前浏览器。清理浏览器缓存前，记得在设置中导出 JSON 备份。</div>
      </div>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">关闭</button><button class="btn btn-primary" data-act="go" data-page="settings">${IC.icon('settings')} 去设置</button>`
    });
  }

  WB.UI.modalShell = modalShell;
  WB.UI.taskDetailHTML = taskDetailHTML;
  WB.UI.newTaskHTML = newTaskHTML;
  WB.UI.popupHTML = popupHTML;
  WB.UI.validatePopup = validatePopup;
  WB.UI.templateEditorHTML = templateEditorHTML;
  WB.UI.fieldRowHTML = fieldRowHTML;
  WB.UI.popupEditorHTML = popupEditorHTML;
  WB.UI.budgetHTML = budgetHTML;
  WB.UI.historyHTML = historyHTML;
  WB.UI.shortcutsHTML = shortcutsHTML;
  WB.UI.profileHTML = profileHTML;
})();
