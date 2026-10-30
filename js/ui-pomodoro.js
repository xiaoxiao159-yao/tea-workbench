/* 番茄钟页 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const CH = WBCharts;
  const esc = U.esc;
  const RING_C = 628.32;

  function heatmapHTML() {
    const today = new Date();
    const start = U.addDays(today, -(11 * 7 + today.getDay()));
    const levels = (m) => m <= 0 ? '' : m < 30 ? 'l1' : m < 60 ? 'l2' : m < 90 ? 'l3' : 'l4';
    let cols = '';
    for (let w = 0; w < 12; w++) {
      let cells = '';
      for (let d = 0; d < 7; d++) {
        const date = U.addDays(start, w * 7 + d);
        const key = U.dateKey(date);
        const future = date > today;
        const m = WB.UI.focusOn(key);
        const isToday = key === U.dateKey();
        cells += `<span class="hm-cell ${future ? '' : levels(m)} ${isToday ? 'today' : ''}" title="${key} · ${m ? U.minsText(m) : '未专注'}" style="${future ? 'opacity:.25' : ''}"></span>`;
      }
      cols += `<div class="hm-week">${cells}</div>`;
    }
    return `<div class="heatmap-wrap">
      <div class="flex" style="align-items:flex-start;gap:4px">
        <div class="hm-labels"><span></span><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span></div>
        <div class="flex-1" style="flex:1"><div class="heatmap">${cols}</div></div>
      </div>
      <div class="hm-legend"><span>少</span><i style="background:color-mix(in srgb, var(--text) 4%, transparent)"></i>
        <i style="background:color-mix(in srgb, var(--accent) 22%, transparent)"></i>
        <i style="background:color-mix(in srgb, var(--accent) 42%, transparent)"></i>
        <i style="background:color-mix(in srgb, var(--accent) 66%, transparent)"></i>
        <i style="background:var(--accent)"></i><span>多</span>
        <span style="margin-left:auto">${WB.db.focus.length} 次专注记录</span>
      </div>
    </div>`;
  }

  function pomodoroHTML() {
    const db = WB.db;
    const st = WB.state.pomo;
    const today = U.dateKey();
    const todayRecs = db.focus.filter((f) => f.date === today);
    const tf = todayRecs.reduce((s, f) => s + f.minutes, 0);
    const interrupts = todayRecs.reduce((s, f) => s + (f.interruptions || 0), 0);
    const tasks = WB.UI.activeTasks();
    const linked = st.taskId ? WB.UI.taskById(st.taskId) : null;
    const modeName = st.mode === 'focus' ? '专注' : '休息';
    const week = [];
    for (let i = 6; i >= 0; i--) {
      const d = U.addDays(new Date(), -i);
      week.push({ label: U.weekdayCN(d).replace('期', ''), value: WB.UI.focusOn(U.dateKey(d)) });
    }
    const history = db.focus.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 8);

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>FOCUS · 番茄钟</span>
          <h1 class="page-title">给自己一段，不被打扰的时间。</h1>
          <p class="page-sub">专注结束会自动记录时长并关联到任务；也可以打开白噪音，把世界调成静音。</p>
        </div>
        <div class="page-actions">
          <span class="chip" data-tone="mint">${IC.icon('leaf')} 今天已专注 ${U.minsText(tf)}</span>
        </div>
      </div>

      <div class="pomo-layout">
        <div class="pomo-card">
          <div class="segmented pomo-mode">
            <button class="${st.mode === 'focus' ? 'active' : ''}" data-act="pomoMode" data-mode="focus">${IC.icon('flame')} 专注</button>
            <button class="${st.mode === 'break' ? 'active' : ''}" data-act="pomoMode" data-mode="break">${IC.icon('coffee')} 休息</button>
          </div>
          <div class="pomo-ring">
            <svg viewBox="0 0 220 220">
              <circle class="ring-bg" cx="110" cy="110" r="100"/>
              <circle class="ring-fg" id="pomoRing" cx="110" cy="110" r="100" stroke-dasharray="${RING_C}" stroke-dashoffset="0"/>
            </svg>
            <div class="ring-center">
              <span class="pomo-time" id="pomoTime">${U.pad(Math.floor(st.remaining / 60))}:${U.pad(st.remaining % 60)}</span>
              <span class="pomo-phase" id="pomoPhase">${st.running ? (st.mode === 'focus' ? '专注中' : '休息中') : '准备开始'}</span>
              <span class="pomo-task-label" id="pomoTaskLabel">${linked ? esc(linked.title) : '未关联任务'}</span>
              <span class="pomo-dots">${[0, 1, 2, 3].map((i) => `<i class="${i < Math.min(4, Math.floor(tf / (db.settings.focusMin || 25))) ? 'on' : ''}"></i>`).join('')}</span>
            </div>
          </div>
          <div class="pomo-controls">
            <button class="pomo-secondary" data-act="pomoReset" title="重置">${IC.icon('reset')}</button>
            <button class="pomo-play" id="pomoPlay" data-act="pomoToggle" aria-label="开始或暂停">
              <span id="pomoPlayIcon">${IC.icon(st.running ? 'pause' : 'play')}</span>
            </button>
            <button class="pomo-secondary" data-act="pomoInterrupt" title="记录一次打断">${IC.icon('alert')}</button>
            <button class="pomo-mini ${WB.state.noise ? 'on' : ''}" id="noiseBtn" data-act="toggleNoise">${IC.icon('volume')} 白噪音</button>
          </div>
          <div class="pomo-task-select">
            ${IC.icon('link')} <span>关联任务</span>
            <select class="select" id="pomoTaskSelect">
              <option value="">不关联任务</option>
              ${tasks.map((t) => `<option value="${t.id}" ${st.taskId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="pomo-side">
          <div class="card today-focus-card">
            <div class="card-title"><h3>今日专注</h3><span class="sub">${todayRecs.length} 个时段</span></div>
            <div class="tf-hero"><span class="num">${U.minsShort(tf)}</span><span>累计投入</span></div>
            <div class="tf-grid">
              <div class="tf-cell"><div class="v">${todayRecs.length}</div><div class="k">完成番茄</div></div>
              <div class="tf-cell"><div class="v">${interrupts}</div><div class="k">打断次数</div></div>
              <div class="tf-cell"><div class="v">${st.mode === 'focus' ? db.settings.focusMin : db.settings.breakMin}<span style="font-size:10px;color:var(--muted)"> min</span></div><div class="k">当前时长</div></div>
              <div class="tf-cell"><div class="v">${WB.UI.streakDays()}<span style="font-size:10px;color:var(--muted)"> 天</span></div><div class="k">连续专注</div></div>
            </div>
            <div class="tf-note">${IC.icon('info')} 专注结束后自动写入历史记录${linked ? `，并累计到「${esc(linked.title.slice(0, 12))}${linked.title.length > 12 ? '…' : ''}」` : ''}</div>
          </div>
          <form class="card pomo-settings-card" id="pomoSettingsForm">
            <div class="card-head"><div class="card-title"><h3>节奏设置</h3><span class="sub">按自己的呼吸来</span></div></div>
            <div class="setting-grid">
              <div class="field"><label>专注时长（分钟）</label><input class="input" type="number" min="1" max="180" name="focusMin" value="${db.settings.focusMin}"></div>
              <div class="field"><label>休息时长（分钟）</label><input class="input" type="number" min="1" max="60" name="breakMin" value="${db.settings.breakMin}"></div>
            </div>
            <div class="mt-10 flex" style="justify-content:space-between;gap:8px">
              <span class="pomo-note">修改后若当前未在计时，会立即更新。</span>
              <button class="btn btn-sm btn-soft" type="submit">保存</button>
            </div>
          </form>
        </div>
      </div>

      <div class="pomo-charts">
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>专注热力图</h3><span class="sub">过去 12 周</span></div><span class="drag-hint">颜色越深，投入越多</span></div>
          ${heatmapHTML()}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title"><h3>本周节奏</h3><span class="sub">分钟 / 天</span></div><span class="chip" data-tone="butter">${U.minsShort(WB.UI.weekFocus())} 累计</span></div>
          ${CH.barChart({ data: week, height: 186, showValues: true, yFmt: (v) => Math.round(v) + 'm', aria: '本周专注' })}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><h3>专注记录</h3><span class="sub">最近 8 条 · 可追溯每条投入</span></div>
          <button class="card-link" data-act="go" data-page="stats">统计详情 ${IC.icon('chevronRight')}</button>
        </div>
        ${history.length ? `<div class="pomo-history-list">${history.map((f) => {
          const task = f.taskId ? WB.UI.taskById(f.taskId) : null;
          return `<div class="history-row">
            <span class="hr-ico">${IC.icon('timer')}</span>
            <div class="hr-main">
              <div class="hr-title">${task ? esc(task.title) : '独立专注'}</div>
              <div class="hr-sub">${f.date} ${f.time || ''} · ${f.interruptions ? `打断 ${f.interruptions} 次` : '全程未打断'}</div>
            </div>
            <span class="hr-mins">${f.minutes}m</span>
          </div>`;
        }).join('')}</div>` : `<div class="empty" style="padding:24px">
          <div class="empty-art">${IC.icon('timer')}</div>
          <h4>还没有专注记录</h4><p>按下中间的播放键，开始第一个 25 分钟。</p>
        </div>`}
      </div>
    </div>`;
  }

  function updatePomoUI() {
    const st = WB.state.pomo;
    if (!st || !document.getElementById('pomoTime')) return;
    const remain = Math.max(0, st.remaining);
    const timeEl = document.getElementById('pomoTime');
    timeEl.textContent = `${U.pad(Math.floor(remain / 60))}:${U.pad(remain % 60)}`;
    const phase = document.getElementById('pomoPhase');
    if (phase) phase.textContent = st.running ? (st.mode === 'focus' ? '专注中' : '休息中') : (st.remaining === st.duration ? '准备开始' : '已暂停');
    const ring = document.getElementById('pomoRing');
    if (ring) {
      const pct = st.duration ? remain / st.duration : 0;
      ring.style.strokeDasharray = String(RING_C);
      ring.style.strokeDashoffset = String(RING_C * (1 - pct));
    }
    const playIcon = document.getElementById('pomoPlayIcon');
    if (playIcon) playIcon.innerHTML = IC.icon(st.running ? 'pause' : 'play');
    const label = document.getElementById('pomoTaskLabel');
    if (label) {
      const t = st.taskId ? WB.UI.taskById(st.taskId) : null;
      label.textContent = t ? t.title : '未关联任务';
    }
    const noise = document.getElementById('noiseBtn');
    if (noise) noise.classList.toggle('on', !!WB.state.noise);
    document.querySelectorAll('.pomo-mode button').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === st.mode);
    });
    if (WB.state.pomo.running && WB.state.page === 'pomodoro') {
      document.title = `${U.pad(Math.floor(remain / 60))}:${U.pad(remain % 60)} · ${st.mode === 'focus' ? '专注中' : '休息中'}`;
    } else if (WB.state.page === 'pomodoro') {
      document.title = '茶歇工作台 · Tea Time Studio';
    }
  }

  WB.UI.pomodoroHTML = pomodoroHTML;
  WB.UI.updatePomoUI = updatePomoUI;
  WB.UI.heatmapHTML = heatmapHTML;
})();
