/* 每日支出页 & 数据统计页 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const CH = WBCharts;
  const esc = U.esc;

  function catsOf(type) {
    return type === 'income' ? WB.INCOME_CATS : WB.EXPENSE_CATS;
  }
  function expForm() {
    if (!WB.state.expForm) {
      WB.state.expForm = {
        type: 'expense', category: '餐饮', amount: '', note: '',
        date: U.dateKey(), time: U.timeKey(), taskId: ''
      };
    }
    return WB.state.expForm;
  }
  function monthKey() {
    if (!WB.state.expMonth) {
      const d = new Date();
      WB.state.expMonth = `${d.getFullYear()}-${U.pad(d.getMonth() + 1)}`;
    }
    return WB.state.expMonth;
  }

  function expensesHTML() {
    const f = expForm();
    const today = U.dateKey();
    const list = WB.db.expenses.filter((e) => e.date === today);
    const spent = WB.UI.sumAmount(list, 'expense');
    const income = WB.UI.sumAmount(list, 'income');
    const budget = Number(WB.db.settings.dailyBudget) || 0;
    const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    const over = budget && spent > budget;
    const cats = catsOf(f.type);
    const catTotals = {};
    list.filter((e) => e.type === 'expense').forEach((e) => {
      catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
    });
    const catArr = Object.keys(catTotals).map((k) => ({ label: k, value: catTotals[k], color: U.catColor(k) })).sort((a, b) => b.value - a.value);
    const maxCat = catArr.length ? catArr[0].value : 1;
    const month = monthKey();
    const history = WB.db.expenses
      .filter((e) => (e.date || '').startsWith(month))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const tasks = WB.db.tasks.filter((t) => !t.archived);
    const todayTotal = spent;

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>LEDGER · 每日支出</span>
          <h1 class="page-title">每一笔，都心里有数。</h1>
          <p class="page-sub">记录日常开销、关联任务，也可以导入已有的 CSV。预算提醒会在超支时轻轻提示你。</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" data-act="importExpenses">${IC.icon('upload')} 导入 CSV</button>
          <button class="btn btn-secondary" data-act="exportExpenses">${IC.icon('download')} 导出</button>
        </div>
      </div>

      <div class="exp-layout">
        <div class="card exp-form-card">
          <div class="exp-type-toggle">
            <button class="${f.type === 'expense' ? 'active expense' : ''}" data-act="expType" data-type="expense">${IC.icon('wallet')} 支出</button>
            <button class="${f.type === 'income' ? 'active income' : ''}" data-act="expType" data-type="income">${IC.icon('arrowUpRight')} 收入</button>
          </div>
          <form id="expenseForm" style="display:grid;gap:13px">
            <div class="amount-field">
              <span class="currency">¥</span>
              <input id="expAmount" name="amount" inputmode="decimal" placeholder="0.00" value="${esc(f.amount)}" autocomplete="off">
            </div>
            <div class="field">
              <label>${f.type === 'expense' ? '类别' : '收入来源'}</label>
              <div class="cat-picker">
                ${cats.map((c) => `<button type="button" class="cat-pick ${f.category === c.name ? 'active' : ''}" data-act="expCat" data-cat="${c.name}">
                  <i class="dot" style="background:${c.color}"></i>${c.name}</button>`).join('')}
              </div>
            </div>
            <div class="field">
              <label>备注</label>
              <input class="input" id="expNote" name="note" placeholder="${f.type === 'expense' ? '例如：午餐 · 番茄牛腩饭' : '例如：周末助教收入'}" value="${esc(f.note)}">
            </div>
            <div class="input-row">
              <div class="field"><label>时间</label><input class="input" type="datetime-local" id="expTime" name="time" value="${f.date}T${f.time}"></div>
              <div class="field"><label>关联任务（可选）</label>
                <select class="select" id="expTask" name="taskId">
                  <option value="">不关联</option>
                  ${tasks.map((t) => `<option value="${t.id}" ${f.taskId === t.id ? 'selected' : ''}>${esc(t.title.slice(0, 22))}${t.title.length > 22 ? '…' : ''}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="flex" style="justify-content:space-between;gap:10px">
              <span class="mini-label">${IC.icon('lock')} 记录只保存在本地</span>
              <button class="btn btn-primary" type="submit">${IC.icon('plus')} 记一笔</button>
            </div>
          </form>
        </div>

        <div class="card exp-summary-card">
          <div class="card-head"><div class="card-title"><h3>今日汇总</h3><span class="sub">${list.length} 笔记录</span></div>
            <button class="icon-btn" data-act="openBudget" title="设置预算">${IC.icon('settings')}</button>
          </div>
          <div class="exp-total">
            <div><div class="et-label">今日支出</div><div class="et-value"><small>¥</small>${U.money(todayTotal)}</div></div>
            <span class="pill ${over ? 'bad' : 'good'}">${over ? '已超预算' : budget ? `预算内 ${pct}%` : '未设置预算'}</span>
          </div>
          <div class="exp-stats-row">
            <span>收入 <b>¥${U.money(income)}</b></span>
            <span>笔数 <b>${list.length}</b></span>
            <span>本月 <b>¥${U.money(WB.db.expenses.filter((e) => e.date.startsWith(month) && e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0))}</b></span>
          </div>
          ${budget ? `<div class="budget-block">
            <div class="budget-top"><span>每日预算</span><b>¥${U.money(spent)} / ¥${U.money(budget)}</b></div>
            <div class="budget-line"><i class="${over ? 'over' : ''}" style="width:${pct}%"></i></div>
            <div class="budget-note ${over ? 'alert' : ''}">${over ? `已超出今日预算 ¥${U.money(spent - budget)}，明天可以稍微收一收。` : `今天还可以花 ¥${U.money(budget - spent)}。`}</div>
          </div>` : `<div class="budget-block" style="cursor:pointer" data-act="openBudget">
            <div class="budget-top"><span>每日预算</span><b>去设置</b></div>
            <div class="budget-note">设定一个温柔的预算边界，超支时提醒自己。</div>
          </div>`}
          <div>
            <div class="mini-label" style="margin-bottom:6px">今日分类</div>
            ${catArr.length ? `<div class="cat-breakdown">${catArr.slice(0, 5).map((c) => `
              <div class="cat-break-row">
                <span class="cb-name"><i style="background:${c.color}"></i>${esc(c.label)}</span>
                <span class="cb-bar"><i style="background:${c.color};width:${Math.round((c.value / maxCat) * 100)}%"></i></span>
                <span class="cb-val">¥${U.money(c.value)}</span>
              </div>`).join('')}</div>` : `<div class="chart-empty" style="min-height:70px">${IC.icon('coffee')}今天还没有支出，先喝口水。</div>`}
          </div>
        </div>
      </div>

      <div class="exp-charts">
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>今日分类占比</h3><span class="sub">按金额</span></div></div>
          ${catArr.length ? `<div class="donut-wrap">
            <div style="width:50%;max-width:160px;flex:none">${CH.donutChart({ items: catArr, size: 160, thickness: 22, centerLabel: '今日支出', centerValue: '¥' + U.money(todayTotal) })}</div>
            <div class="chart-legend">${catArr.map((c) => `<span class="lg"><i style="background:${c.color}"></i>${esc(c.label)} <b>¥${U.money(c.value)}</b></span>`).join('')}</div>
          </div>` : `<div class="chart-empty">${IC.icon('wallet')}记一笔之后，这里会出现分类占比。</div>`}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>近 7 天支出</h3><span class="sub">元 / 天</span></div><span class="chip" data-tone="butter">日均 ¥${U.money(Math.round(WB.db.expenses.filter((e) => {
            const d = U.addDays(new Date(), -6);
            return e.date >= U.dateKey(d) && e.type === 'expense';
          }).reduce((s, e) => s + Number(e.amount), 0) / 7))}</span></div>
          ${CH.barChart({
            data: Array.from({ length: 7 }, (_, i) => {
              const d = U.addDays(new Date(), i - 6);
              const k = U.dateKey(d);
              return { label: U.weekdayCN(d).replace('期', ''), value: WB.UI.sumAmount(WB.db.expenses.filter((e) => e.date === k), 'expense') };
            }), height: 186, yFmt: (v) => '¥' + Math.round(v), aria: '近七天支出'
          })}
        </div>
      </div>

      <div class="card">
        <div class="exp-history-head">
          <div class="card-title"><h3>历史记录</h3><span class="sub">${history.length} 笔 · 可按月份筛选</span></div>
          <div class="flex gap-6">
            <input class="input input-sm" type="month" id="expMonth" value="${month}" style="width:130px">
            <button class="btn btn-sm btn-secondary" data-act="exportExpenses">${IC.icon('download')} CSV</button>
          </div>
        </div>
        ${history.length ? `<div class="exp-history">${history.map((e) => {
          const d = U.parseKey(e.date);
          const task = e.taskId ? WB.UI.taskById(e.taskId) : null;
          return `<div class="exp-row">
            <span class="er-date">${d.getMonth() + 1}/${d.getDate()}<br>${esc(e.time || '')}</span>
            <span class="er-note">${esc(e.note || e.category)}${task ? `<small>关联 · ${esc(task.title)}</small>` : ''}</span>
            <span class="er-cat"><span class="chip" data-tone="${U.toneFor(e.category)}"><i class="dot" style="background:${U.catColor(e.category)}"></i>${esc(e.category)}</span></span>
            <span class="er-amt ${e.type === 'income' ? 'income' : ''}">${e.type === 'income' ? '+' : '−'} ¥${U.money(e.amount)}</span>
            <button class="icon-btn er-del" data-act="delExpense" data-id="${e.id}" title="删除">${IC.icon('x')}</button>
          </div>`;
        }).join('')}</div>` : `<div class="exp-empty">这个月还没有记录。记下一笔，或导入 CSV。</div>`}
      </div>
    </div>`;
  }

  /* ---------- 数据统计 ---------- */
  function statsRange() {
    return WB.state.statsRange || 30;
  }

  function statsHTML() {
    const db = WB.db;
    const range = statsRange();
    const today = new Date();
    const days = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = U.addDays(today, -i);
      days.push({
        key: U.dateKey(d),
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        weekday: U.weekdayCN(d).replace('期', '')
      });
    }
    const focusSeries = days.map((d) => WB.UI.focusOn(d.key));
    const focusTotal = focusSeries.reduce((s, v) => s + v, 0);
    const expSeries = days.map((d) => WB.UI.sumAmount(db.expenses.filter((e) => e.date === d.key), 'expense'));
    const expTotal = expSeries.reduce((s, v) => s + v, 0);
    const tasks = db.tasks.filter((t) => !t.archived);
    const done = tasks.filter((t) => t.done).length;
    const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const overdue = tasks.filter((t) => !t.done && t.due && t.due < U.dateKey()).length;
    const papers = db.papers;
    const read = papers.filter((p) => p.status === 'read').length;
    const readPct = papers.length ? Math.round((read / papers.length) * 100) : 0;
    const paperItems = [
      { label: '已读', value: read, color: 'var(--good)' },
      { label: '在读', value: papers.filter((p) => p.status === 'reading').length, color: 'var(--accent)' },
      { label: '未读', value: papers.filter((p) => p.status === 'unread').length, color: 'color-mix(in srgb, var(--muted) 40%, transparent)' }
    ];
    const cats = {};
    db.expenses.filter((e) => e.type === 'expense' && days.some((d) => d.key === e.date)).forEach((e) => {
      cats[e.category] = (cats[e.category] || 0) + Number(e.amount || 0);
    });
    const catItems = Object.keys(cats).map((k) => ({ label: k, value: cats[k], color: U.catColor(k) })).sort((a, b) => b.value - a.value);
    const priorityCounts = ['high', 'mid', 'low'].map((k) => ({
      key: k, name: WB.PRIORITIES[k].name, color: WB.PRIORITIES[k].color,
      count: tasks.filter((t) => t.priority === k && !t.done).length
    }));
    const maxPri = Math.max(...priorityCounts.map((p) => p.count), 1);
    const completionItems = [
      { label: '已完成', value: done, color: 'var(--good)' },
      { label: '进行中', value: tasks.length - done, color: 'var(--accent)' }
    ];

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>INSIGHTS · 数据统计</span>
          <h1 class="page-title">看见时间都去了哪里。</h1>
          <p class="page-sub">专注、开销、任务与文献的全景视图。数据来自本地记录，范围切换即时生效。</p>
        </div>
        <div class="page-actions">
          <div class="segmented stats-range">
            ${[[7, '近 7 天'], [30, '近 30 天'], [90, '近 90 天']].map(([v, l]) =>
              `<button class="${range === v ? 'active' : ''}" data-act="statsRange" data-range="${v}">${l}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="stats-metrics">
        <div class="metric-card">
          <div class="mk-label">${IC.icon('timer')} 专注总时长</div>
          <div class="mk-value">${U.minsShort(focusTotal)}</div>
          <div class="mk-foot">日均 ${Math.round(focusTotal / range)} 分钟 · ${range} 天</div>
          ${CH.sparkline(focusSeries)}
        </div>
        <div class="metric-card">
          <div class="mk-label">${IC.icon('wallet')} 支出总额</div>
          <div class="mk-value">¥${U.money(expTotal)}</div>
          <div class="mk-foot">日均 ¥${U.money(Math.round(expTotal / range))}</div>
          ${CH.sparkline(expSeries, 'var(--warn)')}
        </div>
        <div class="metric-card">
          <div class="mk-label">${IC.icon('check')} 任务完成率</div>
          <div class="mk-value">${completion}<small>%</small></div>
          <div class="mk-foot">${done} / ${tasks.length} 项完成 · 逾期 ${overdue} 项</div>
          ${CH.sparkline([completion, 100], 'var(--good)')}
        </div>
        <div class="metric-card">
          <div class="mk-label">${IC.icon('book')} 文献阅读率</div>
          <div class="mk-value">${readPct}<small>%</small></div>
          <div class="mk-foot">${read} / ${papers.length} 篇已读 · 在读 ${papers.filter((p) => p.status === 'reading').length} 篇</div>
          ${CH.sparkline([readPct, 100], 'var(--info)')}
        </div>
      </div>

      <div class="stats-grid">
        <div class="card stats-chart-card span-2">
          <div class="card-head"><div class="card-title"><h3>专注时长趋势</h3><span class="sub">分钟 / 天 · 近 ${range} 天</span></div><span class="chip" data-tone="mint">共 ${U.minsText(focusTotal)}</span></div>
          <div class="chart-body">${CH.lineChart({
            labels: days.map((d) => d.label), values: focusSeries, height: 190,
            labelEvery: range > 30 ? 10 : range > 7 ? 5 : 1, aria: '专注趋势', fmt: (v) => Math.round(v) + ' 分钟'
          })}</div>
        </div>

        <div class="card stats-chart-card">
          <div class="card-head"><div class="card-title"><h3>支出趋势</h3><span class="sub">元 / 天</span></div><span class="chip" data-tone="butter">共 ¥${U.money(expTotal)}</span></div>
          <div class="chart-body">${CH.barChart({
            data: days.map((d, i) => ({ label: d.label, value: expSeries[i] })), height: 190,
            labelEvery: range > 30 ? 15 : range > 7 ? 5 : 1, yFmt: (v) => Math.round(v), aria: '支出趋势'
          })}</div>
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><h3>任务完成率</h3><span class="sub">全部未归档任务</span></div><span class="chip" data-tone="mint">${completion}%</span></div>
          <div class="completion-wrap">
            ${CH.donutChart({ items: completionItems, size: 150, thickness: 20, centerLabel: '完成率', centerValue: completion + '%' })}
            <div class="completion-info">
              <div class="completion-line"><span>已完成</span><b>${done} 项</b></div>
              <div class="completion-line"><span>进行中</span><b>${tasks.length - done} 项</b></div>
              <div class="completion-line"><span>已逾期</span><b style="color:${overdue ? 'var(--bad)' : 'var(--good)'}">${overdue} 项</b></div>
              <div class="completion-line"><span>高优先级待办</span><b>${tasks.filter((t) => t.priority === 'high' && !t.done).length} 项</b></div>
            </div>
          </div>
          <div class="priority-bars mt-14">
            ${priorityCounts.map((p) => `<div class="pbar-row"><span>${p.name}优先</span><span class="pb-track"><i style="width:${Math.round((p.count / maxPri) * 100)}%;background:${p.color}"></i></span><span class="pb-num">${p.count}</span></div>`).join('')}
          </div>
        </div>

        <div class="card stats-chart-card span-2">
          <div class="card-head"><div class="card-title"><h3>专注热力图</h3><span class="sub">过去 12 周 · 每天的颜色是投入</span></div><span class="chip" data-tone="cocoa">${WB.UI.streakDays()} 天连续</span></div>
          ${WB.UI.heatmapHTML()}
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><h3>支出类别构成</h3><span class="sub">近 ${range} 天</span></div></div>
          ${catItems.length ? `<div class="donut-wrap">
            <div style="width:50%;max-width:150px;flex:none">${CH.donutChart({ items: catItems, size: 150, thickness: 20, centerLabel: '总支出', centerValue: '¥' + U.money(expTotal) })}</div>
            <div class="chart-legend">${catItems.slice(0, 5).map((c) => `<span class="lg"><i style="background:${c.color}"></i>${esc(c.label)} <b>${Math.round((c.value / (expTotal || 1)) * 100)}%</b></span>`).join('')}</div>
          </div>` : `<div class="chart-empty">${IC.icon('wallet')}还没有支出数据</div>`}
        </div>

        <div class="card">
          <div class="card-head"><div class="card-title"><h3>文献阅读进度</h3><span class="sub">按状态</span></div></div>
          ${papers.length ? `<div class="donut-wrap">
            ${CH.donutChart({ items: paperItems, size: 150, thickness: 20, centerLabel: '阅读率', centerValue: readPct + '%' })}
            <div class="chart-legend">
              <span class="lg"><i style="background:var(--good)"></i>已读 <b>${read}</b></span>
              <span class="lg"><i style="background:var(--accent)"></i>在读 <b>${paperItems[1].value}</b></span>
              <span class="lg"><i style="background:color-mix(in srgb, var(--muted) 40%, transparent)"></i>未读 <b>${paperItems[2].value}</b></span>
              <div class="list-divider"></div>
              <span class="lg">共 ${papers.length} 篇 · 待读 ${paperItems[1].value + paperItems[2].value} 篇</span>
            </div>
          </div>` : `<div class="chart-empty">${IC.icon('book')}书架还是空的，去添加第一篇文献</div>`}
        </div>
      </div>
    </div>`;
  }

  WB.UI.expensesHTML = expensesHTML;
  WB.UI.statsHTML = statsHTML;
  WB.UI.expForm = expForm;
  WB.UI.expMonth = monthKey;
})();
