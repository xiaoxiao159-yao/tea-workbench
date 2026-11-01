/* 设置页 & 首次引导页 */
(function () {
  const U = WB.util;
  const IC = WBIcons;
  const esc = U.esc;
  const REPEAT_LABEL = { daily: '每天', workday: '工作日', weekly: '每周', custom: '自定义' };

  function repeatText(p) {
    if (!p.repeat || p.repeat === 'none') return '不重复';
    if (p.repeat === 'daily') return '每天';
    if (p.repeat === 'workday') return '工作日';
    if (p.repeat === 'weekly') return '每周';
    if (p.repeat === 'custom') {
      const names = ['日', '一', '二', '三', '四', '五', '六'];
      return '每周' + (p.days && p.days.length ? p.days.map((d) => names[d]).join('、') : '—');
    }
    return p.repeat;
  }

  function settingsHTML() {
    const s = WB.db.settings;
    const templates = WB.db.templates || [];
    const popups = WB.db.popups || [];
    const history = (WB.db.popupHistory || []).slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
    const tplById = (id) => templates.find((t) => t.id === id);

    return `<div class="page">
      <div class="page-head">
        <div class="ph-main">
          <span class="eyebrow"><span class="dotline"></span>SETTINGS · 设置</span>
          <h1 class="page-title">把工作台，调成你喜欢的样子。</h1>
          <p class="page-sub">主题、预算、定时弹窗模板与数据备份，都在这里。所有偏好保存在本地浏览器。</p>
        </div>
        <div class="page-actions"><button class="btn btn-secondary" data-act="shortcuts">${IC.icon('keyboard')} 全部快捷键</button></div>
      </div>

      <div class="settings-wrap">
        <!-- 主题 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('palette')}</span><div><h3>外观与主题</h3><p>奶茶色系的深浅两套配色，以及低饱和强调色微调。</p></div></div>
          <div class="set-body">
            <div class="theme-tiles">
              <button class="theme-tile ${s.theme === 'light' ? 'active' : ''}" data-act="setTheme" data-theme="light">
                <span class="theme-preview"><i class="tp-light"></i><i class="tp-light" style="filter:brightness(.96)"></i></span>
                <span><strong>浅色 · 奶盖</strong><span>温暖、柔和的白天</span></span>
              </button>
              <button class="theme-tile ${s.theme === 'dark' ? 'active' : ''}" data-act="setTheme" data-theme="dark">
                <span class="theme-preview"><i class="tp-dark"></i><i class="tp-dark" style="filter:brightness(1.08)"></i></span>
                <span><strong>深色 · 焙茶</strong><span>夜里也温柔的暗调</span></span>
              </button>
            </div>
            <div>
              <div class="mini-label" style="margin-bottom:7px">强调色</div>
              <div class="accent-row">
                ${Object.entries(WB.ACCENTS).map(([k, a]) => `<button class="accent-choice ${s.accent === k ? 'active' : ''}" data-act="setAccent" data-accent="${k}">
                  <i style="background:hsl(${a.h} ${a.s}% ${a.l}%)"></i>${a.name}</button>`).join('')}
              </div>
            </div>
            <div class="data-note">强调色会同步应用到按钮、图表、标签与高亮。深浅色切换在顶部栏也可以快速完成。</div>
          </div>
        </section>

        <!-- 偏好 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('timer')}</span><div><h3>专注与通知</h3><p>番茄节奏和系统通知的开关。</p></div></div>
          <div class="set-body">
            <form id="settingsPrefs" class="two-col">
              <div class="field"><label>默认专注时长（分钟）</label><input class="input" type="number" name="focusMin" min="1" max="180" value="${s.focusMin}"></div>
              <div class="field"><label>默认休息时长（分钟）</label><input class="input" type="number" name="breakMin" min="1" max="60" value="${s.breakMin}"></div>
            </form>
            <div class="set-row">
              <div class="sr-main"><strong>系统通知</strong><span>番茄钟结束、任务到期、定时弹窗触发时提醒我</span></div>
              <button class="toggle ${s.notifications ? 'on' : ''}" data-act="toggleNotifications" aria-label="系统通知开关"></button>
            </div>
            <div class="flex" style="justify-content:flex-end"><button class="btn btn-sm btn-soft" type="button" data-act="savePrefs">保存偏好</button></div>
          </div>
        </section>

        <!-- 预算 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('wallet')}</span><div><h3>预算设置</h3><p>给每天和每个月留一条柔软的边界。</p></div></div>
          <div class="set-body">
            <form id="budgetForm" class="two-col">
              <div class="field"><label>每日预算（元）</label><input class="input" type="number" min="0" step="1" name="dailyBudget" value="${s.dailyBudget}"></div>
              <div class="field"><label>每月预算（元）</label><input class="input" type="number" min="0" step="1" name="monthlyBudget" value="${s.monthlyBudget}"></div>
            </form>
            <div class="set-row">
              <div class="sr-main"><strong>超支提醒</strong><span>在支出页与首页卡片上显示预算进度和超支提示</span></div>
              <button class="toggle ${s.notifications ? 'on' : ''}" data-act="toggleNotifications" aria-label="提醒开关"></button>
            </div>
            <div class="flex" style="justify-content:space-between;gap:10px">
              <span class="mini-label">当前月预算 ¥${U.money(s.monthlyBudget)} · 日预算 ¥${U.money(s.dailyBudget)}</span>
              <button class="btn btn-sm btn-soft" type="button" data-act="saveBudget">保存预算</button>
            </div>
          </div>
        </section>

        <!-- 弹窗模板 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('note')}</span><div><h3>定时弹窗与模板</h3><p>到点弹出、必须填写才能关闭的复盘与计划模板。</p></div></div>
          <div class="set-body">
            <div class="flex" style="justify-content:space-between;gap:8px">
              <div class="mini-label">模板（${templates.length}）</div>
              <button class="btn btn-sm btn-secondary" data-act="newTemplate">${IC.icon('plus')} 新建模板</button>
            </div>
            <div class="tpl-list">
              ${templates.length ? templates.map((t) => `
                <div class="tpl-card">
                  <span class="tc-ico">${IC.icon(t.icon || 'note')}</span>
                  <div class="tc-main">
                    <strong>${esc(t.name)}</strong>
                    <p>${t.fields.length} 个字段 · 必填 ${t.fields.filter((f) => f.required).length} 项</p>
                    <div class="tpl-fields">${t.fields.slice(0, 4).map((f) => `<span class="tag-chip">${esc(f.label)}</span>`).join('')}${t.fields.length > 4 ? `<span class="tag-chip">+${t.fields.length - 4}</span>` : ''}</div>
                  </div>
                  <div class="tc-actions">
                    <button class="icon-btn" data-act="scheduleFromTemplate" data-id="${t.id}" title="用此模板新建定时弹窗">${IC.icon('calendar')}</button>
                    <button class="icon-btn" data-act="editTemplate" data-id="${t.id}" title="编辑">${IC.icon('edit')}</button>
                    <button class="icon-btn" data-act="deleteTemplate" data-id="${t.id}" title="删除">${IC.icon('trash')}</button>
                  </div>
                </div>`).join('') : `<div class="empty" style="padding:20px"><div class="empty-art">${IC.icon('note')}</div><p>还没有模板，新建一个「每日复盘」吧。</p></div>`}
            </div>

            <div class="list-divider" style="margin:6px 0"></div>
            <div class="flex" style="justify-content:space-between;gap:8px">
              <div class="mini-label">定时弹窗（${popups.length}）</div>
              <button class="btn btn-sm btn-secondary" data-act="newPopup">${IC.icon('plus')} 新建弹窗</button>
            </div>
            <div class="schedule-list">
              ${popups.length ? popups.slice().sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((p) => `
                <div class="schedule-row ${p.enabled ? '' : 'off'}">
                  <span class="schedule-time">${esc(p.time)}</span>
                  <div class="schedule-main">
                    <strong>${esc(p.title)}</strong>
                    <span>${IC.icon('repeat')} ${repeatText(p)} · ${esc((tplById(p.templateId) || {}).name || '无模板')}${p.lastRun ? ` · 上次 ${p.lastRun}` : ''}</span>
                  </div>
                  <div class="schedule-actions">
                    <button class="icon-btn" data-act="triggerPopup" data-id="${p.id}" title="立即触发测试">${IC.icon('play')}</button>
                    <button class="icon-btn" data-act="editPopup" data-id="${p.id}" title="编辑">${IC.icon('edit')}</button>
                    <button class="icon-btn" data-act="deletePopup" data-id="${p.id}" title="删除">${IC.icon('trash')}</button>
                    <button class="toggle ${p.enabled ? 'on' : ''}" data-act="togglePopup" data-id="${p.id}" aria-label="启用"></button>
                  </div>
                </div>`).join('') : `<div class="empty" style="padding:20px"><div class="empty-art">${IC.icon('clock')}</div><p>还没有定时弹窗。默认的每日复盘会在每晚固定时间提醒你。</p><button class="btn btn-sm btn-soft" data-act="newPopup">${IC.icon('plus')} 创建一个</button></div>`}
            </div>

            <div class="list-divider" style="margin:6px 0"></div>
            <div class="flex" style="justify-content:space-between;gap:8px">
              <div class="mini-label">填写历史（${(WB.db.popupHistory || []).length}）</div>
              <div class="flex gap-4">
                <button class="btn btn-sm btn-ghost" data-act="exportPopupHistory">${IC.icon('download')} 导出</button>
                <button class="btn btn-sm btn-ghost" data-act="clearPopupHistory">清空</button>
              </div>
            </div>
            ${history.length ? `<div class="popup-history">${history.map((h) => {
              const answers = Object.entries(h.answers || {});
              const summary = answers.length ? `${answers[0][0]}：${String(answers[0][1]).slice(0, 28)}` : '无填写内容';
              return `<div class="ph-row">
                <span class="ph-time">${U.fmtDateTime(h.ts)}</span>
                <span class="ph-title">${esc(h.title || '定时弹窗')}<small>${esc(summary)}</small></span>
                <button class="icon-btn" data-act="viewPopupHistory" data-id="${h.id}" title="查看">${IC.icon('bookOpen')}</button>
              </div>`;
            }).join('')}</div>` : `<div class="empty" style="padding:18px"><p style="font-size:10.5px">还没有填写记录。触发一次弹窗并完成后，记录会保存在这里。</p></div>`}
            <div class="data-note">弹窗触发时会发送系统通知；必须完成全部必填项后才能关闭，不能跳过。每晚 22:30 的「今日复盘」默认开启。</div>
          </div>
        </section>

        <!-- 数据 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('database')}</span><div><h3>数据与备份</h3><p>文献、任务、支出、专注记录全部保存在本地，可导出迁移。</p></div></div>
          <div class="set-body">
            <div class="backup-actions">
              <button class="btn btn-secondary btn-sm" data-act="exportJSON">${IC.icon('download')} 导出 JSON 备份</button>
              <button class="btn btn-secondary btn-sm" data-act="importJSON">${IC.icon('upload')} 导入 JSON</button>
              <button class="btn btn-secondary btn-sm" data-act="exportCSV" data-type="papers">文献 CSV</button>
              <button class="btn btn-secondary btn-sm" data-act="exportCSV" data-type="tasks">任务 CSV</button>
              <button class="btn btn-secondary btn-sm" data-act="exportCSV" data-type="expenses">支出 CSV</button>
              <button class="btn btn-secondary btn-sm" data-act="exportCSV" data-type="focus">专注 CSV</button>
              <button class="btn btn-danger btn-sm" data-act="clearData">${IC.icon('trash')} 清空全部数据</button>
            </div>
            <div class="data-note">JSON 备份包含全部数据与偏好；CSV 适合在 Excel 中查看。清空数据会删除本地记录与已上传文件（不可恢复）。刷新或关闭页面不会丢失现有数据。</div>
            <div class="flex" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
              <span class="mini-label">本地存储 · ${(JSON.stringify(WB.db).length / 1024).toFixed(1)} KB</span>
              <span class="mini-label">版本 v${WB.db.version || 1} · ${WB.db.papers.length} 文献 / ${WB.db.tasks.length} 任务 / ${WB.db.expenses.length} 支出</span>
            </div>
          </div>
        </section>

        <!-- 云同步 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('cloud')}</span><div><h3>云端同步</h3><p>把数据同步到 GitHub Gist，手机和其他设备打开同一个网址就能看到同样的内容。</p></div></div>
          <div class="set-body">
            <div class="two-col">
              <div class="field">
                <label>GitHub Personal Access Token</label>
                <input class="input" id="cloudToken" type="password" placeholder="ghp_xxxxxxxxxxxx" value="${esc(WB.cloud.getToken())}" autocomplete="off">
                <span class="mini-label" style="margin-top:4px">需要勾选 <code>gist</code> 和 <code>repo</code> 权限。Token 只存在你本地浏览器，不会上传到其他地方。</span>
              </div>
              <div class="field">
                <label>Gist ID（留空则自动创建）</label>
                <input class="input" id="cloudGistId" placeholder="首次上传后自动填写" value="${esc(WB.cloud.getGistId())}" autocomplete="off">
                <span class="mini-label" style="margin-top:4px">换设备时，把这里的 ID 填到新设备即可同步同一份数据。</span>
              </div>
            </div>
            <div class="set-row">
              <div class="sr-main"><strong>保存后自动同步</strong><span>每次修改数据后自动上传到云端（防抖 1.5 秒）</span></div>
              <button class="toggle ${s.cloudAutoSync ? 'on' : ''}" data-act="toggleCloudAuto" aria-label="自动同步开关"></button>
            </div>
            <div class="set-row">
              <div class="sr-main"><strong>文献与书籍文件也上云</strong><span>PDF / EPUB / 封面在导入后自动上传（单个文件上限 ${WB.cloud.fileStatus().maxMB}MB），换设备打开同一网址即可照着看</span></div>
            </div>
            <div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:4px">
              <button class="btn btn-secondary btn-sm" data-act="cloudPushFiles">${IC.icon('upload')} 上传全部文件</button>
              <button class="btn btn-secondary btn-sm" data-act="cloudPullFiles">${IC.icon('download')} 下载云端文件</button>
            </div>
            <div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:4px">
              <button class="btn btn-secondary btn-sm" data-act="cloudSaveConfig">${IC.icon('save')} 保存配置</button>
              <button class="btn btn-secondary btn-sm" data-act="cloudPush">${IC.icon('upload')} 上传到云端</button>
              <button class="btn btn-secondary btn-sm" data-act="cloudPull">${IC.icon('download')} 从云端拉取</button>
              <button class="btn btn-ghost btn-sm" data-act="cloudClear">${IC.icon('trash')} 清除配置</button>
            </div>
            <div class="flex" style="gap:8px;flex-wrap:wrap;margin-top:8px">
              <button class="btn btn-primary btn-sm" data-act="cloudDeploy">${IC.icon('rocket')} 一键部署到公网（手机可访问）</button>
              <span class="mini-label" style="align-self:center">把工作台发布到 GitHub Pages，生成手机随时可打开的网址</span>
            </div>
            <div class="cloud-status">
              <span class="mini-label">状态：${WB.cloud.isReady() ? '<b style="color:var(--good)">已连接</b>' : '<b style="color:var(--muted)">未连接</b>'}</span>
              <span class="mini-label">上次上传：${WB.cloud.fmtTime(WB.cloud.status().lastPush)}</span>
              <span class="mini-label">上次拉取：${WB.cloud.fmtTime(WB.cloud.status().lastPull)}</span>
              <span class="mini-label">文件上传：${WB.cloud.fmtTime(WB.cloud.fileStatus().lastPush)}</span>
              <span class="mini-label">文件下载：${WB.cloud.fmtTime(WB.cloud.fileStatus().lastPull)}</span>
            </div>
            <details class="cloud-help">
              <summary>如何获取 GitHub Token？（约 1 分钟）</summary>
              <ol>
                <li>打开 <a href="https://github.com/settings/tokens/new?scopes=gist,repo&description=Tea%20Workbench%20Sync" target="_blank" rel="noopener">github.com/settings/tokens/new</a></li>
                <li>勾选 <strong>gist</strong> 和 <strong>repo</strong> 权限，点击「Generate token」</li>
                <li>复制生成的 <code>ghp_...</code> 字符串，粘贴到上方输入框</li>
                <li>点「保存配置」，再点「上传到云端」即可同步数据</li>
                <li>点「一键部署到公网」可生成手机随时访问的网址</li>
              </ol>
            </details>
          </div>
        </section>

        <!-- 快捷键 -->
        <section class="card set-card">
          <div class="set-head"><span class="sh-ico">${IC.icon('keyboard')}</span><div><h3>快捷键</h3><p>手不离键盘，也能顺手完成日常操作。</p></div></div>
          <div class="set-body">
            <div class="shortcut-grid">
              ${[['新建任务', ['N']], ['开始 / 暂停番茄钟', ['P']], ['聚焦全局搜索', ['/']], ['关闭弹窗 / 收起面板', ['Esc']], ['切换深浅色', ['T']], ['打开今日复盘', ['R']]].map(([label, keys]) =>
                `<div class="sc-row"><span>${label}</span><span class="sc-keys">${keys.map((k) => `<kbd class="key">${k}</kbd>`).join('')}</span></div>`).join('')}
            </div>
          </div>
        </section>
      </div>
    </div>`;
  }

  /* ---------- 首次引导 ---------- */
  function onboardingHTML() {
    return `<div class="onboarding">
      <div class="ob-hero">
        <div class="ob-copy">
          <span class="eyebrow"><span class="dotline"></span>WELCOME · 新朋友</span>
          <h1>给忙碌的日子，<br>留一杯<em>茶的时间</em>。</h1>
          <p>把文献、专注、花销与睡前复盘，收进一张安静的工作台。没有账号，没有云端，数据只属于这台设备和你自己。</p>
          <div class="ob-actions">
            <button class="btn btn-primary" data-act="loadDemo">${IC.icon('sparkles')} 载入示例数据</button>
            <button class="btn btn-secondary" data-act="startBlank">${IC.icon('edit')} 从空白开始</button>
          </div>
          <p class="ob-hint">${IC.icon('lock')} 仅本地保存 · <button class="link-btn" data-act="importJSON">导入已有备份</button></p>
        </div>
        <div class="ob-art">
          <div class="ring-deco"></div>
          <div class="cup">
            <div class="cup-steam"><i></i><i></i><i></i></div>
            <div class="cup-straw"></div>
            <div class="cup-body">
              <div class="cup-tea"></div>
              <div class="cup-foam"></div>
              <div class="cup-pearls"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
            <div class="cup-handle"></div>
            <div class="cup-shadow"></div>
          </div>
          <div class="stamp"><b>Tea Time</b>慢慢来，也很好</div>
        </div>
      </div>
      <div class="ob-features">
        ${[
          ['book', '01', '文献存储', '上传、分类、标记阅读状态，记下创新点与批注。'],
          ['timer', '02', '番茄专注', '白噪音、打断记录与热力图，让专注有迹可循。'],
          ['wallet', '03', '每日支出', '分类预算、超支提醒，也能关联到具体任务。'],
          ['moon', '04', '睡前复盘', '到点必填的弹窗模板，把一天温柔地收尾。']
        ].map(([icon, num, title, desc]) => `<div class="ob-feature">
          <div class="of-ico">${IC.icon(icon)}</div>
          <strong>${title}</strong>
          <p>${desc}</p>
          <span class="of-num">${num}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }

  WB.UI.settingsHTML = settingsHTML;
  WB.UI.onboardingHTML = onboardingHTML;
  WB.UI.repeatText = repeatText;
})();
