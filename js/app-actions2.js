/* 动作层：支出 / 统计 / 设置 / 模板 / 定时弹窗 / 数据 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;
  const APP = WB.app;
  const ACT = WB.actions;
  const AU = WB.actionUtil;

  /* ---------- 支出 ---------- */
  ACT.expType = (el) => {
    const f = AU.syncExpForm();
    f.type = el.dataset.type === 'income' ? 'income' : 'expense';
    const cats = f.type === 'income' ? WB.INCOME_CATS : WB.EXPENSE_CATS;
    f.category = cats[0].name;
    AU.refresh();
  };
  ACT.expCat = (el) => {
    const f = AU.syncExpForm();
    f.category = el.dataset.cat || f.category;
    AU.refresh();
  };
  ACT.submitExpense = () => {
    const amountEl = document.getElementById('expAmount');
    const amount = Number(amountEl ? amountEl.value : 0);
    if (!amount || amount <= 0) {
      APP.toast('先输入一个大于 0 的金额', 'alert', 'warn');
      if (amountEl) amountEl.focus();
      return;
    }
    const f = AU.syncExpForm();
    const rec = {
      id: U.uid('e'), type: f.type, amount: Math.round(amount * 100) / 100,
      category: f.category, note: String(f.note || '').trim(),
      date: f.date || U.dateKey(), time: f.time || U.timeKey(),
      taskId: f.taskId || '', createdAt: new Date().toISOString()
    };
    WB.db.expenses.push(rec);
    WB.save();
    const today = U.dateKey();
    const budget = Number(WB.db.settings.dailyBudget) || 0;
    const spent = WB.UI.sumAmount(WB.db.expenses.filter((e) => e.date === today), 'expense');
    if (rec.type === 'expense' && budget && spent > budget) {
      APP.toast(`今日已花 ¥${U.money(spent)}，超出预算 ¥${U.money(budget)}`, 'alert', 'warn');
    }
    WB.state.expForm = Object.assign({}, f, { amount: '', note: '' });
    AU.refresh();
    APP.toast(`已记下${rec.type === 'income' ? '收入' : '支出'} ¥${U.money(rec.amount)}`, 'check');
  };
  ACT.delExpense = (el) => {
    const id = el.dataset.id;
    const rec = WB.db.expenses.find((e) => e.id === id);
    if (!rec) return;
    APP.askConfirm('删除这条记录？', `${rec.date} ${rec.time || ''} · ${rec.note || rec.category} ¥${U.money(rec.amount)}`, '删除', () => {
      WB.db.expenses = WB.db.expenses.filter((e) => e.id !== id);
      WB.save();
      AU.refresh();
      APP.toast('记录已删除', 'trash');
    });
  };
  ACT.openBudget = () => APP.openModal(WB.UI.budgetHTML());
  ACT.saveBudget = () => {
    const modalForm = document.getElementById('budgetModalForm');
    const form = modalForm || document.getElementById('budgetForm');
    if (!form) return;
    const fd = new FormData(form);
    WB.db.settings.dailyBudget = Math.max(0, Math.round(Number(fd.get('dailyBudget')) || 0));
    WB.db.settings.monthlyBudget = Math.max(0, Math.round(Number(fd.get('monthlyBudget')) || 0));
    WB.save();
    if (modalForm) APP.closeModal(true);
    AU.refresh();
    APP.toast(`预算已保存：每日 ¥${U.money(WB.db.settings.dailyBudget)} · 每月 ¥${U.money(WB.db.settings.monthlyBudget)}`, 'wallet');
  };
  ACT.importExpenses = () => {
    const input = document.getElementById('expenseImport');
    if (input) input.click();
  };

  /* ---------- 数据统计 ---------- */
  ACT.statsRange = (el) => {
    const r = Number(el.dataset.range) || 30;
    WB.state.statsRange = r;
    AU.refresh();
  };

  /* ---------- 设置 ---------- */
  ACT.savePrefs = () => {
    const form = document.getElementById('settingsPrefs');
    if (!form) return;
    const fd = new FormData(form);
    WB.db.settings.focusMin = Math.max(1, Math.min(180, Number(fd.get('focusMin')) || 25));
    WB.db.settings.breakMin = Math.max(1, Math.min(60, Number(fd.get('breakMin')) || 5));
    if (WB.state.pomo && !WB.state.pomo.running) WB.state.pomo = APP.makePomo(WB.state.pomo.mode);
    WB.save();
    AU.refresh();
    APP.toast('偏好已保存', 'save');
  };
  ACT.toggleNotifications = () => {
    const on = !WB.db.settings.notifications;
    WB.db.settings.notifications = on;
    WB.save();
    document.querySelectorAll('.toggle[data-act="toggleNotifications"]').forEach((b) => b.classList.toggle('on', on));
    if (on) APP.requestNotifyPermission();
    else APP.toast('系统通知已关闭', 'bell');
    AU.refresh();
  };

  /* ---------- 弹窗模板 ---------- */
  ACT.newTemplate = () => APP.openModal(WB.UI.templateEditorHTML(''));
  ACT.editTemplate = (el) => APP.openModal(WB.UI.templateEditorHTML(el.dataset.id));
  ACT.addFieldRow = () => {
    const box = document.getElementById('fieldEditor');
    if (!box) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = WB.UI.fieldRowHTML({ label: '', type: 'text', required: true });
    const row = wrap.firstElementChild;
    box.appendChild(row);
    WBIcons.hydrate(row);
    const input = row.querySelector('.field-label-input');
    if (input) input.focus();
  };
  ACT.removeFieldRow = (el) => {
    const row = el.closest('[data-field-row]');
    if (row) row.remove();
  };
  ACT.saveTemplate = (el) => {
    const form = document.getElementById('templateForm');
    if (!form) return;
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim();
    if (!name) { APP.toast('模板需要一个名字', 'alert', 'warn'); return; }
    const rows = [...document.querySelectorAll('#fieldEditor [data-field-row]')];
    const fields = rows.map((r) => ({
      label: String(r.querySelector('.field-label-input').value || '').trim(),
      type: r.querySelector('.field-type-select').value,
      required: r.querySelector('.req-box input[type="checkbox"]').checked
    })).filter((f) => f.label);
    if (!fields.length) { APP.toast('至少保留一个字段', 'alert', 'warn'); return; }
    const icon = String(fd.get('icon') || 'note');
    const id = el.dataset.id;
    if (id) {
      const t = (WB.db.templates || []).find((x) => x.id === id);
      if (t) Object.assign(t, { name, icon, fields });
    } else {
      WB.db.templates.push({ id: U.uid('tpl'), name, icon, fields });
    }
    WB.save();
    APP.closeModal(true);
    AU.refresh();
    APP.toast('模板已保存', 'save');
  };
  ACT.deleteTemplate = (el) => {
    const t = (WB.db.templates || []).find((x) => x.id === el.dataset.id);
    if (!t) return;
    APP.askConfirm('删除这个模板？', `「${t.name}」将不再出现在定时弹窗的模板列表中。`, '删除', () => {
      WB.db.templates = WB.db.templates.filter((x) => x.id !== t.id);
      WB.db.popups.forEach((p) => { if (p.templateId === t.id) p.templateId = ''; });
      WB.save();
      AU.refresh();
      APP.toast('模板已删除', 'trash');
    });
  };
  ACT.scheduleFromTemplate = (el) => {
    const id = el.dataset.id;
    APP.openModal(WB.UI.popupEditorHTML(''), {
      onOpen: () => {
        const sel = document.querySelector('#popupEditForm select[name="templateId"]');
        if (sel) sel.value = id;
      }
    });
  };

  /* ---------- 定时弹窗 ---------- */
  ACT.newPopup = () => APP.openModal(WB.UI.popupEditorHTML(''));
  ACT.editPopup = (el) => APP.openModal(WB.UI.popupEditorHTML(el.dataset.id));
  ACT.savePopupEdit = (el) => {
    const form = document.getElementById('popupEditForm');
    if (!form) return;
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const time = String(fd.get('time') || '').trim();
    if (!title || !time) { APP.toast('标题和触发时间都要填写', 'alert', 'warn'); return; }
    const repeat = String(fd.get('repeat') || 'daily');
    const days = [...form.querySelectorAll('input[name="days"]:checked')].map((i) => Number(i.value));
    if (repeat === 'custom' && !days.length) { APP.toast('自定义重复请至少选择一天', 'alert', 'warn'); return; }
    const payload = {
      title, time, repeat, days,
      templateId: String(fd.get('templateId') || ''),
      enabled: !!form.querySelector('input[name="enabled"]')?.checked
    };
    const id = el.dataset.id;
    if (id) {
      const p = (WB.db.popups || []).find((x) => x.id === id);
      if (p) Object.assign(p, payload);
    } else {
      WB.db.popups.push(Object.assign({ id: U.uid('pop'), lastRun: null, createdAt: new Date().toISOString() }, payload));
    }
    WB.save();
    APP.closeModal(true);
    AU.refresh();
    APP.toast('定时弹窗已保存', 'clock');
  };
  ACT.deletePopup = (el) => {
    const p = (WB.db.popups || []).find((x) => x.id === el.dataset.id);
    if (!p) return;
    APP.askConfirm('删除这个定时弹窗？', `「${p.title}」${p.time} 将不再自动弹出，历史填写记录会保留。`, '删除', () => {
      WB.db.popups = WB.db.popups.filter((x) => x.id !== p.id);
      WB.save();
      AU.refresh();
      APP.toast('定时弹窗已删除', 'trash');
    });
  };
  ACT.togglePopup = (el) => {
    const p = (WB.db.popups || []).find((x) => x.id === el.dataset.id);
    if (!p) return;
    p.enabled = !p.enabled;
    WB.save();
    AU.refresh();
    APP.toast(p.enabled ? '定时弹窗已启用' : '定时弹窗已停用', 'clock');
  };
  ACT.triggerPopup = (el) => APP.triggerPopup(el.dataset.id, true);
  ACT.viewPopupHistory = (el) => APP.openModal(WB.UI.historyHTML(el.dataset.id));
  ACT.exportPopupHistory = () => {
    const rows = [['时间', '弹窗', '字段', '内容']];
    (WB.db.popupHistory || []).forEach((h) => {
      Object.entries(h.answers || {}).forEach(([q, a]) => {
        rows.push([U.fmtDateTime(h.ts), h.title || '', q, typeof a === 'boolean' ? (a ? '已确认' : '未确认') : a]);
      });
    });
    if (rows.length === 1) { APP.toast('还没有填写历史', 'info', 'warn'); return; }
    U.download(`弹窗填写历史_${U.dateKey()}.csv`, U.toCSV(rows), 'text/csv;charset=utf-8');
    APP.toast('填写历史已导出', 'download');
  };
  ACT.clearPopupHistory = () => {
    APP.askConfirm('清空全部填写历史？', '所有定时弹窗的填写记录都会被删除，此操作不可恢复。', '清空', () => {
      WB.db.popupHistory = [];
      WB.save();
      AU.refresh();
      APP.toast('填写历史已清空', 'trash');
    });
  };
  ACT.submitPopup = () => {
    if (!WB.UI.validatePopup()) {
      APP.toast('还有必填项没有完成', 'lock', 'warn');
      return;
    }
    const form = document.getElementById('popupForm');
    if (!form) return;
    const answers = {};
    form.querySelectorAll('[data-popup-field]').forEach((el) => {
      let label = '';
      if (el.id) {
        const lab = form.querySelector(`label[for="${el.id}"]`);
        if (lab) label = lab.textContent.replace(/\*/g, '').trim();
      }
      if (!label) label = el.name;
      answers[label] = el.type === 'checkbox' ? el.checked : String(el.value || '').trim();
    });
    const popupId = form.dataset.popupId || WB.state.activePopup || '';
    const popup = (WB.db.popups || []).find((p) => p.id === popupId);
    WB.db.popupHistory.push({
      id: U.uid('ph'), popupId,
      title: popup ? popup.title : '定时弹窗',
      ts: new Date().toISOString(), answers
    });
    WB.save();
    APP.closeModal(true);
    AU.refresh();
    APP.toast('记录已保存，今天辛苦了', 'moon');
  };

  /* ---------- 数据备份 ---------- */
  ACT.exportJSON = () => { if (WB.dataIO) WB.dataIO.exportJSON(); };
  ACT.clearData = () => {
    APP.askConfirm('清空全部数据？', '文献、任务、支出、专注记录、弹窗历史与已上传文件都会被删除，且不可恢复。建议先导出 JSON 备份。', '清空全部', () => {
      WB.db.papers.forEach((p) => WB.idb.removeFile(p.id));
      WB.resetAll();
      WB.db.settings.onboarded = false;
      WB.save();
      WB.state.paperSelection.clear();
      WB.state.pomo = APP.makePomo('focus');
      WB.state.page = 'home';
      APP.applyTheme();
      WB.UI.renderAll();
      APP.toast('已回到初始状态', 'trash');
    });
  };

  /* ---------- 云同步 ---------- */
  ACT.cloudSaveConfig = () => {
    const tokenEl = document.getElementById('cloudToken');
    const gistEl = document.getElementById('cloudGistId');
    const token = (tokenEl ? tokenEl.value : '').trim();
    const gistId = (gistEl ? gistEl.value : '').trim();
    if (token) WB.cloud.setToken(token);
    if (gistId) WB.cloud.setGistId(gistId);
    WB.save();
    WB.UI.renderAll();
    APP.toast(WB.cloud.isReady() ? '配置已保存，已连接云端' : 'Token 已保存，还需要 Gist ID 才能同步', WB.cloud.isReady() ? 'cloud' : 'info');
  };

  ACT.cloudPush = async () => {
    if (!WB.cloud.getToken()) { APP.toast('请先填写 GitHub Token', 'alert', 'warn'); return; }
    APP.toast('正在上传到云端…', 'upload');
    try {
      const id = await WB.cloud.push();
      WB.save();
      WB.UI.renderAll();
      APP.toast(`已上传到云端${id ? '（Gist ID：' + id + '）' : ''}`, 'check');
    } catch (e) {
      APP.toast('上传失败：' + e.message, 'alert', 'error');
    }
  };

  ACT.cloudPull = async () => {
    if (!WB.cloud.getToken()) { APP.toast('请先填写 GitHub Token', 'alert', 'warn'); return; }
    if (!WB.cloud.getGistId()) { APP.toast('还没有 Gist ID，请先上传一次', 'alert', 'warn'); return; }
    APP.toast('正在从云端拉取…', 'download');
    try {
      const res = await WB.cloud.pull();
      WB.UI.renderAll();
      APP.toast(res.conflict ? '已拉取云端数据（本地有更新未上传，请注意）' : '已从云端拉取最新数据', 'check');
    } catch (e) {
      APP.toast('拉取失败：' + e.message, 'alert', 'error');
    }
  };

  ACT.toggleCloudAuto = () => {
    WB.db.settings.cloudAutoSync = !WB.db.settings.cloudAutoSync;
    WB.save();
    WB.UI.renderAll();
    APP.toast(WB.db.settings.cloudAutoSync ? '已开启自动同步' : '已关闭自动同步', WB.db.settings.cloudAutoSync ? 'cloud' : 'info');
  };

  ACT.cloudClear = () => {
    APP.askConfirm('清除云同步配置？', 'Token 和 Gist ID 会从本地移除，已上传到云端的数据不受影响。', '清除', () => {
      localStorage.removeItem(WB.cloud.TOKEN_KEY);
      localStorage.removeItem(WB.cloud.GIST_ID_KEY);
      localStorage.removeItem('tea_gist_last_push');
      localStorage.removeItem('tea_gist_last_pull');
      WB.cloud.setToken('');
      WB.cloud.setGistId('');
      WB.db.settings.cloudAutoSync = false;
      WB.save();
      WB.UI.renderAll();
      APP.toast('已清除云同步配置', 'trash');
    });
  };

  ACT.cloudDeploy = async () => {
    if (!WB.cloud.getToken()) { APP.toast('请先填写 GitHub Token', 'alert', 'warn'); return; }
    APP.toast('正在部署到 GitHub Pages…（约 10-30 秒）', 'rocket');
    try {
      const res = await WB.cloud.deployToPages();
      // 复制到剪贴板
      try { await navigator.clipboard.writeText(res.url); } catch (e) {}
      // 弹出可点击链接的成功弹窗
      APP.openModal(WB.UI.modalShell({
        eyebrow: '部署成功',
        title: '手机随时能看了',
        sub: `已上传 ${res.uploaded}/${res.total} 个文件`,
        body: `<div style="font-size:13px;line-height:1.8;color:var(--text-2)">
          <p>用手机浏览器打开下方网址即可访问工作台：</p>
          <p style="margin:12px 0"><a href="${res.url}" target="_blank" rel="noopener" style="color:var(--accent);word-break:break-all">${res.url}</a></p>
          <p style="font-size:12px;color:var(--muted)">网址已复制到剪贴板。建议在手机上把它添加到主屏幕，随时点开。</p>
        </div>`,
        foot: `<button class="btn btn-secondary" data-act="closeModal">好的</button>
          <a class="btn btn-primary" href="${res.url}" target="_blank" rel="noopener">在浏览器打开</a>`
      }));
    } catch (e) {
      APP.toast('部署失败：' + e.message, 'alert', 'error');
    }
  };
})();
