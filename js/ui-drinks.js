/* 饮品记录页 & 相关弹窗 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const CH = WBCharts;
  const APP = WB.app;
  const ACT = WB.actions;
  const esc = U.esc;

  const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

  function drinksOf(date) { return WB.db.drinks.filter((d) => d.date === date); }
  function catInfo(name) {
    return WB.DRINK_CATS.find((c) => c.name === name) || WB.DRINK_CATS[WB.DRINK_CATS.length - 1];
  }
  function monthKey() {
    if (!WB.state.drinkMonth) {
      const n = new Date();
      WB.state.drinkMonth = `${n.getFullYear()}-${U.pad(n.getMonth() + 1)}`;
    }
    return WB.state.drinkMonth;
  }
  function monthDrinks(mk) {
    return WB.db.drinks.filter((d) => (d.date || '').startsWith(mk));
  }
  function streak() {
    const has = (k) => WB.db.drinks.some((d) => d.date === k);
    let n = 0;
    let fromYest = false;
    if (!has(U.dateKey())) fromYest = true;
    for (let i = fromYest ? 1 : 0; i < 400; i++) {
      const k = U.dateKey(U.addDays(new Date(), -i));
      if (has(k)) n++;
      else break;
    }
    return { n, fromYest };
  }
  function refresh() {
    const y = window.scrollY;
    WB.UI.renderAll();
    window.scrollTo(0, y);
  }

  /* ---------- 页面 ---------- */
  function drinksHTML() {
    const mk = monthKey();
    const [y, m] = mk.split('-').map(Number);
    const list = monthDrinks(mk);
    const cups = list.length;
    const spend = list.reduce((s, d) => s + (Number(d.price) || 0), 0);
    const days = new Date(y, m, 0).getDate();
    const counts = WB.DRINK_CATS.map((c) => ({
      label: c.name, value: list.filter((d) => d.category === c.name).length, color: c.color
    }));
    const st = streak();
    const today = U.dateKey();
    const first = new Date(y, m - 1, 1);
    const offset = (first.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('<div class="dr-cell dr-cell-empty"></div>');
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${U.pad(m)}-${U.pad(d)}`;
      const items = drinksOf(key);
      const top = items.length ? catInfo(items[0].category) : null;
      const pills = items.slice(0, 2).map((e) => {
        const c = catInfo(e.category);
        return `<span class="dr-pill" style="--pc:${c.color}">${esc(e.name)}</span>`;
      }).join('');
      const more = items.length > 2 ? `<span class="dr-more">+${items.length - 2}</span>` : '';
      const cls = `dr-cell${items.length ? ' has' : ''}${key === today ? ' today' : ''}`;
      const style = top ? ` style="--soft:${top.soft};--pc:${top.color}"` : '';
      cells.push(`<div class="${cls}"${style} data-act="drinkDay" data-date="${key}" role="button" tabindex="0" title="查看 ${m} 月 ${d} 日">
        <span class="dr-date">${d}</span>
        <div class="dr-pills">${pills}${more}</div>
        ${items.length ? `<span class="dr-count">${items.length} 杯 · ¥${U.money(items.reduce((s, e) => s + (Number(e.price) || 0), 0))}</span>` : ''}
      </div>`);
    }
    while (cells.length % 7) cells.push('<div class="dr-cell dr-cell-empty"></div>');

    const legend = WB.DRINK_CATS.map((c) => {
      const n = counts.find((x) => x.label === c.name).value;
      return `<span class="lg"><i style="background:${c.color}"></i>${c.name} <b>${n}</b></span>`;
    }).join('');

    const perDay = list.reduce((o, d) => { o[d.date] = (o[d.date] || 0) + 1; return o; }, {});
    const maxPerDay = cups ? Math.max.apply(null, Object.keys(perDay).map((k) => perDay[k])) : 0;

    const detail = list.slice().sort((a, b) => String(b.date + (b.time || '')).localeCompare(String(a.date + (a.time || ''))));
    const detailRows = detail.map((e) => {
      const d = U.parseKey(e.date);
      const c = catInfo(e.category);
      const meta = (WB.db.drinkFields || [])
        .map((f) => (e.meta && e.meta[f.id] ? `<span>${esc(f.label)}·${esc(e.meta[f.id])}</span>` : '')).join('');
      return `<div class="dr-row">
        <span class="drr-date">${d.getMonth() + 1}/${d.getDate()}<small>${esc(e.time || '')}</small></span>
        <span class="drr-name">${esc(e.name)}<span class="chip" data-tone="${U.toneFor(e.category)}"><i class="dot" style="background:${c.color}"></i>${esc(e.category)}</span>${meta ? `<span class="drr-meta">${meta}</span>` : ''}</span>
        <span class="drr-price">¥${U.money(e.price)}</span>
        <button class="icon-btn" data-act="editDrink" data-id="${e.id}" title="修改">${IC.icon('edit')}</button>
        <button class="icon-btn drr-del" data-act="deleteDrink" data-id="${e.id}" title="删除">${IC.icon('trash')}</button>
      </div>`;
    }).join('');

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>DRINK LOG · 饮品记录</span>
          <h1 class="page-title">今天也要好好喝一杯。</h1>
          <p class="page-sub">记下每一杯奶茶、咖啡与果茶，按月份看自己的饮用节奏。数据只留在本地，也可以导出成表格。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-act="openDrinkFields">${IC.icon('settings')} 自定义字段</button>
          <button class="btn btn-secondary" data-act="exportDrinks">${IC.icon('download')} 导出</button>
          <button class="btn btn-primary" data-act="addDrink">${IC.icon('plus')} 添加饮品</button>
        </div>
      </div>

      <div class="drink-stats">
        <div class="metric-card">
          <div class="mk-label">${IC.icon('coffee')} ${m} 月杯数</div>
          <div class="mk-value">${cups}<small>杯</small></div>
          <div class="mk-foot">日均 ${(cups / days).toFixed(1)} 杯 · ${cups ? `最多一天 ${maxPerDay} 杯` : '还没有记录'}</div>
        </div>
        <div class="metric-card">
          <div class="mk-label">${IC.icon('wallet')} ${m} 月花费</div>
          <div class="mk-value"><small>¥</small>${U.money(spend)}</div>
          <div class="mk-foot">${cups ? `平均每杯 ¥${U.money(spend / cups)}` : '记录后自动统计'}</div>
        </div>
        <div class="metric-card">
          <div class="mk-label">${IC.icon('flame')} 连续饮用</div>
          <div class="mk-value">${st.n}<small>天</small></div>
          <div class="mk-foot">${st.n ? (st.fromYest ? '截至昨天，今天还没记' : '今天已续上') : '从今天开始记录吧'}</div>
        </div>
        <div class="card drink-donut-card">
          <div class="card-head"><div class="card-title"><h3>品类占比</h3><span class="sub">按杯数 · 本月</span></div></div>
          ${cups ? `<div class="drink-donut-wrap">
            ${CH.donutChart({ items: counts, size: 132, thickness: 17, centerValue: `${cups} 杯`, centerLabel: '本月' })}
            <div class="drink-legend">${counts.filter((c) => c.value).map((c) => `<span class="lg"><i style="background:${c.color}"></i>${c.label}<b>${Math.round((c.value / cups) * 100)}%</b></span>`).join('')}</div>
          </div>` : `<div class="chart-empty" style="min-height:84px">${IC.icon('coffee')}本月还没有饮品记录。</div>`}
        </div>
      </div>

      <div class="card drink-cal-card">
        <div class="drink-cal-head">
          <div class="card-title"><h3>月视图表格</h3><span class="sub">${y} 年 ${m} 月 · 点击任意日期查看或编辑</span></div>
          <div class="drink-month-nav">
            <button class="icon-btn dr-chev-prev" data-act="drinkMonth" data-dir="-1" title="上个月">${IC.icon('chevronDown')}</button>
            <b>${y} 年 ${m} 月</b>
            <button class="icon-btn dr-chev-next" data-act="drinkMonth" data-dir="1" title="下个月">${IC.icon('chevronDown')}</button>
            <button class="btn btn-sm btn-secondary" data-act="drinkMonth" data-dir="0">回到本月</button>
          </div>
        </div>
        <div class="dr-legend">${legend}</div>
        <div class="dc-week">${WEEK_HEADS.map((h) => `<span>周${h}</span>`).join('')}</div>
        <div class="dc-grid">${cells.join('')}</div>
      </div>

      <div class="card drink-detail-card">
        <div class="card-head">
          <div class="card-title"><h3>${m} 月明细</h3><span class="sub">${cups} 杯 · 共 ¥${U.money(spend)}</span></div>
        </div>
        ${detailRows ? `<div class="dr-rows">${detailRows}</div>` : `<div class="dr-empty">这个月还没有记录。点右上角「添加饮品」记下第一杯。</div>`}
      </div>
    </div>`;
  }

  /* ---------- 当日记录弹窗 ---------- */
  function drinkDayHTML(date) {
    const list = drinksOf(date).slice().sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    const spend = list.reduce((s, d) => s + (Number(d.price) || 0), 0);
    const d = U.parseKey(date);
    const rows = list.map((e) => {
      const c = catInfo(e.category);
      const meta = (WB.db.drinkFields || [])
        .map((f) => (e.meta && e.meta[f.id] ? `<span class="dd-chip">${esc(f.label)}·${esc(e.meta[f.id])}</span>` : '')).join('');
      return `<div class="dd-row">
        <span class="dd-time">${esc(e.time || '—')}</span>
        <span class="dd-main">
          <strong>${esc(e.name)}<span class="dd-cat" style="--pc:${c.color}">${esc(e.category)}</span></strong>
          ${meta ? `<span class="dd-meta">${meta}</span>` : ''}
        </span>
        <span class="dd-price">¥${U.money(e.price)}</span>
        <button class="icon-btn" data-act="editDrink" data-id="${e.id}" title="修改">${IC.icon('edit')}</button>
        <button class="icon-btn dd-del" data-act="deleteDrink" data-id="${e.id}" data-date="${date}" title="删除">${IC.icon('trash')}</button>
      </div>`;
    }).join('');

    return WB.UI.modalShell({
      eyebrow: 'DRINK LOG · 当日记录',
      title: `${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${U.weekdayCN(d)}`,
      sub: list.length ? `共 ${list.length} 杯，花费 ¥${U.money(spend)}` : '轻轻记下一杯，也算照顾自己。',
      cls: 'drink-day-modal',
      body: `${list.length ? `<div class="dd-sum"><span>当日合计 · ${list.length} 杯</span><b>¥${U.money(spend)}</b></div>` : ''}
        ${rows ? `<div class="dd-list">${rows}</div>` : `<div class="dd-empty">${IC.icon('coffee')}<span>这一天还没有饮品记录。</span></div>`}`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">关闭</button>
        <button class="btn btn-primary" data-act="addDrink" data-date="${date}">${IC.icon('plus')} 添加饮品</button>`
    });
  }

  /* ---------- 条目编辑弹窗 ---------- */
  function drinkEntryHTML() {
    const s = WB.state.drinkEdit || { date: U.dateKey(), time: U.timeKey(), name: '', category: '奶茶', price: '', meta: {} };
    const fields = WB.db.drinkFields || [];
    const catBtns = WB.DRINK_CATS.map((c) => `<button type="button" class="cat-pick ${s.category === c.name ? 'active' : ''}" data-act="drinkCatPick" data-cat="${c.name}"><i class="dot" style="background:${c.color}"></i>${c.name}</button>`).join('');
    const fieldHTML = fields.map((f) => `<div class="field"><label>${esc(f.label)}</label><select class="select" data-drink-field="${f.id}">
        <option value="">不选</option>
        ${(f.options || []).map((o) => `<option value="${esc(o)}" ${s.meta && s.meta[f.id] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select></div>`).join('');

    return WB.UI.modalShell({
      eyebrow: s.id ? 'EDIT · 修改记录' : 'NEW · 添加饮品',
      title: s.id ? '修改这一杯' : '记录一杯饮品',
      sub: '名称与类别为必填，杯型、甜度等字段可在「自定义字段」里增删。',
      cls: 'drink-entry-modal',
      body: `<form id="drinkForm" style="display:grid;gap:12px">
        <div class="input-row">
          <div class="field"><label>日期</label><input class="input" type="date" id="drinkDate" value="${esc(s.date || U.dateKey())}"></div>
          <div class="field"><label>时间</label><input class="input" type="time" id="drinkTime" value="${esc(s.time || '')}"></div>
        </div>
        <div class="field"><label>饮品名称 <span class="req">*</span></label><input class="input" id="drinkName" placeholder="例如：桂花乌龙奶茶" value="${esc(s.name || '')}" autocomplete="off"></div>
        <div class="field"><label>类别</label><div class="cat-picker">${catBtns}</div></div>
        <div class="amount-field">
          <span class="currency">¥</span>
          <input id="drinkPrice" inputmode="decimal" placeholder="0.00" value="${s.price === '' || s.price == null ? '' : esc(String(s.price))}" autocomplete="off">
        </div>
        ${fieldHTML ? `<div class="input-row drink-custom-fields">${fieldHTML}</div>` : `<p class="df-tip">还没有自定义字段。可在页面的「自定义字段」中添加杯型、甜度、冰度等。</p>`}
      </form>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">取消</button>
        <button class="btn btn-primary" type="submit" form="drinkForm">${IC.icon('save')} 保存</button>`
    });
  }

  /* ---------- 字段管理弹窗 ---------- */
  function drinkFieldsHTML() {
    const fields = WB.db.drinkFields || [];
    const rows = fields.map((f) => `<div class="df-row">
        <div class="field"><label>字段名</label><input class="input" data-f-label value="${esc(f.label)}"></div>
        <div class="field"><label>选项（逗号分隔）</label><input class="input" data-f-opts value="${esc((f.options || []).join('，'))}"></div>
        <div class="df-acts">
          <button class="icon-btn" data-act="saveDrinkField" data-id="${f.id}" title="保存修改">${IC.icon('check')}</button>
          <button class="icon-btn df-del" data-act="delDrinkField" data-id="${f.id}" title="删除字段">${IC.icon('trash')}</button>
        </div>
      </div>`).join('');

    return WB.UI.modalShell({
      eyebrow: 'FIELDS · 自定义字段',
      title: '管理饮品字段',
      sub: '杯型、甜度、冰度……按自己的习惯来。修改后点 ✓ 保存。',
      cls: 'drink-fields-modal',
      body: `${rows ? `<div class="df-list">${rows}</div>` : `<div class="dd-empty">${IC.icon('tag')}<span>还没有自定义字段，先在下面添加一个。</span></div>`}
        <form id="drinkFieldForm" class="df-new">
          <div class="field"><label>新字段名</label><input class="input" id="dfNewLabel" placeholder="例如：温度、加料" autocomplete="off"></div>
          <div class="field"><label>选项（逗号分隔）</label><input class="input" id="dfNewOpts" placeholder="例如：热、常温、冰" autocomplete="off"></div>
          <button class="btn btn-primary" type="submit">${IC.icon('plus')} 添加字段</button>
        </form>`,
      foot: `<button class="btn btn-secondary" data-act="closeModal">完成</button>`
    });
  }

  /* ---------- 动作 ---------- */
  ACT.drinkMonth = (el) => {
    const dir = Number(el.dataset.dir) || 0;
    if (dir === 0) {
      const n = new Date();
      WB.state.drinkMonth = `${n.getFullYear()}-${U.pad(n.getMonth() + 1)}`;
    } else {
      const [y, m] = monthKey().split('-').map(Number);
      const d = new Date(y, m - 1 + dir, 1);
      WB.state.drinkMonth = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
    }
    refresh();
  };

  ACT.drinkDay = (el) => {
    const date = el.dataset.date;
    if (!date) return;
    WB.state.drinkDay = date;
    APP.openModal(WB.UI.drinkDayHTML(date));
  };

  ACT.addDrink = (el) => {
    const date = (el && el.dataset && el.dataset.date) || U.dateKey();
    WB.state.drinkEdit = { id: '', date, time: U.timeKey(), name: '', category: '奶茶', price: '', meta: {} };
    APP.openModal(WB.UI.drinkEntryHTML());
  };

  ACT.editDrink = (el) => {
    const d = WB.db.drinks.find((x) => x.id === el.dataset.id);
    if (!d) return;
    WB.state.drinkEdit = {
      id: d.id, date: d.date, time: d.time || '', name: d.name,
      category: d.category, price: d.price, meta: Object.assign({}, d.meta || {})
    };
    APP.openModal(WB.UI.drinkEntryHTML());
  };

  ACT.drinkCatPick = (el) => {
    const s = WB.state.drinkEdit;
    if (!s) return;
    s.category = el.dataset.cat || s.category;
    const form = document.getElementById('drinkForm');
    if (form) {
      form.querySelectorAll('.cat-pick').forEach((b) => b.classList.toggle('active', b.dataset.cat === s.category));
    }
  };

  ACT.saveDrink = () => {
    const s = WB.state.drinkEdit || {};
    const nameEl = document.getElementById('drinkName');
    const dateEl = document.getElementById('drinkDate');
    const timeEl = document.getElementById('drinkTime');
    const priceEl = document.getElementById('drinkPrice');
    const name = (nameEl ? nameEl.value : '').trim();
    if (!name) {
      APP.toast('给这杯饮品起个名字吧', 'alert', 'warn');
      if (nameEl) nameEl.focus();
      return;
    }
    const date = (dateEl && dateEl.value) || s.date || U.dateKey();
    const time = (timeEl && timeEl.value) || '';
    const price = Math.max(0, Number(priceEl ? priceEl.value : 0) || 0);
    const meta = {};
    (WB.db.drinkFields || []).forEach((f) => {
      const sel = document.querySelector(`[data-drink-field="${f.id}"]`);
      if (sel && sel.value) meta[f.id] = sel.value;
    });
    if (s.id) {
      const d = WB.db.drinks.find((x) => x.id === s.id);
      if (d) Object.assign(d, { name, date, time, price, meta, category: s.category || '其他' });
      APP.toast('已更新这杯饮品', 'coffee');
    } else {
      WB.db.drinks.push({
        id: U.uid('dr'), name, date, time, price,
        category: s.category || '其他', meta, createdAt: new Date().toISOString()
      });
      APP.toast('已记录一杯', 'coffee');
    }
    WB.state.drinkDay = date;
    WB.state.drinkEdit = null;
    WB.save();
    refresh();
    APP.openModal(WB.UI.drinkDayHTML(date));
  };

  ACT.deleteDrink = (el) => {
    const id = el.dataset.id;
    const d = WB.db.drinks.find((x) => x.id === id);
    if (!d) return;
    const day = el.dataset.date || '';
    APP.askConfirm('删除这杯饮品？', `「${esc(d.name)}」的记录会被移除，无法恢复。`, '删除', () => {
      WB.db.drinks = WB.db.drinks.filter((x) => x.id !== id);
      WB.save();
      refresh();
      APP.toast('已删除', 'trash');
      if (day) APP.openModal(WB.UI.drinkDayHTML(day));
    }, true);
  };

  ACT.openDrinkFields = () => APP.openModal(WB.UI.drinkFieldsHTML());

  function splitOpts(v) {
    return String(v || '').split(/[,，、]/).map((x) => x.trim()).filter(Boolean);
  }

  ACT.addDrinkField = () => {
    const labelEl = document.getElementById('dfNewLabel');
    const optsEl = document.getElementById('dfNewOpts');
    const label = (labelEl ? labelEl.value : '').trim();
    if (!label) {
      APP.toast('先填写字段名', 'alert', 'warn');
      if (labelEl) labelEl.focus();
      return;
    }
    if ((WB.db.drinkFields || []).some((f) => f.label === label)) {
      APP.toast('已存在同名字段', 'alert', 'warn');
      return;
    }
    WB.db.drinkFields.push({ id: U.uid('df'), label, options: splitOpts(optsEl ? optsEl.value : '') });
    WB.save();
    APP.toast('字段已添加', 'tag');
    APP.openModal(WB.UI.drinkFieldsHTML());
  };

  ACT.saveDrinkField = (el) => {
    const row = el.closest('.df-row');
    const f = (WB.db.drinkFields || []).find((x) => x.id === el.dataset.id);
    if (!row || !f) return;
    const labelEl = row.querySelector('[data-f-label]');
    const optsEl = row.querySelector('[data-f-opts]');
    const label = (labelEl ? labelEl.value : '').trim();
    if (!label) {
      APP.toast('字段名不能为空', 'alert', 'warn');
      return;
    }
    const opts = splitOpts(optsEl ? optsEl.value : '');
    f.label = label;
    if (opts.length) f.options = opts;
    WB.save();
    APP.toast('字段已保存', 'save');
    APP.openModal(WB.UI.drinkFieldsHTML());
  };

  ACT.delDrinkField = (el) => {
    const id = el.dataset.id;
    const f = (WB.db.drinkFields || []).find((x) => x.id === id);
    if (!f) return;
    APP.askConfirm('删除这个字段？', `「${esc(f.label)}」不再出现在饮品记录里，已有的值会保留但不显示。`, '删除', () => {
      WB.db.drinkFields = WB.db.drinkFields.filter((x) => x.id !== id);
      WB.save();
      refresh();
      APP.toast('字段已删除', 'trash');
      APP.openModal(WB.UI.drinkFieldsHTML());
    }, true);
  };

  ACT.exportDrinks = () => {
    const mk = monthKey();
    const list = monthDrinks(mk).slice().sort((a, b) => String(a.date + (a.time || '')).localeCompare(String(b.date + (b.time || ''))));
    if (!list.length) {
      APP.toast('这个月还没有饮品记录', 'info', 'warn');
      return;
    }
    const fields = WB.db.drinkFields || [];
    const rows = [['日期', '时间', '饮品名称', '类别', '价格(元)', ...fields.map((f) => f.label)]];
    list.forEach((d) => rows.push([
      d.date, d.time || '', d.name, d.category, Number(d.price) || 0,
      ...fields.map((f) => (d.meta && d.meta[f.id]) || '')
    ]));
    U.download(`饮品记录_${mk}.csv`, '\ufeff' + U.toCSV(rows), 'text/csv;charset=utf-8');
    APP.toast(`已导出 ${mk.replace('-', ' 年 ')} 月饮品记录`, 'download');
  };

  WB.UI.drinksHTML = drinksHTML;
  WB.UI.drinkDayHTML = drinkDayHTML;
  WB.UI.drinkEntryHTML = drinkEntryHTML;
  WB.UI.drinkFieldsHTML = drinkFieldsHTML;
})();
