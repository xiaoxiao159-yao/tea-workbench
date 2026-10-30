/* 云同步：通过 GitHub Gist 在多设备间同步数据 */
(function () {
  const U = WB.util;
  const APP = WB.app;
  const TOKEN_KEY = 'tea_gist_token';
  const GIST_ID_KEY = 'tea_gist_id';
  const GIST_FILE = 'tea_workbench_data.json';

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    gistId: localStorage.getItem(GIST_ID_KEY) || '',
    busy: false,
    lastPush: 0,
    lastPull: 0
  };

  function api(path, opts = {}) {
    return fetch('https://api.github.com' + path, Object.assign({
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'tea-workbench'
      }
    }, opts, {
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'tea-workbench',
        ...(state.token ? { Authorization: 'Bearer ' + state.token } : {})
      }, (opts.headers || {}))
    }));
  }

  function payload(data) {
    // data is WB.db object; wrap with timestamp for conflict detection
    return {
      description: 'Tea Workbench sync data (auto-generated, keep secret)',
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(data) } }
    };
  }

  async function createGist(data) {
    const res = await api('/gists', { method: 'POST', body: JSON.stringify(payload(data)) });
    if (!res.ok) throw new Error(`创建 Gist 失败：${res.status} ${await res.text().catch(() => '')}`);
    const j = await res.json();
    state.gistId = j.id;
    localStorage.setItem(GIST_ID_KEY, j.id);
    return j.id;
  }

  async function updateGist(data) {
    const res = await api('/gists/' + state.gistId, {
      method: 'PATCH',
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(data) } } })
    });
    if (!res.ok) throw new Error(`更新 Gist 失败：${res.status}`);
    return true;
  }

  async function fetchGist() {
    const res = await api('/gists/' + state.gistId);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`读取 Gist 失败：${res.status}`);
    const j = await res.json();
    const file = j.files && j.files[GIST_FILE];
    if (!file) return null;
    try {
      return JSON.parse(file.content);
    } catch (e) {
      return null;
    }
  }

  /* ---------- 对外接口 ---------- */

  function setToken(token) {
    state.token = token.trim();
    if (state.token) localStorage.setItem(TOKEN_KEY, state.token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function getToken() { return state.token; }
  function getGistId() { return state.gistId; }
  function setGistId(id) {
    state.gistId = id.trim();
    if (state.gistId) localStorage.setItem(GIST_ID_KEY, state.gistId);
    else localStorage.removeItem(GIST_ID_KEY);
  }
  function isReady() { return !!state.token && !!state.gistId; }

  async function push() {
    if (!state.token) throw new Error('请先在设置中填写 GitHub Token');
    if (state.busy) throw new Error('正在同步中，请稍候');
    state.busy = true;
    try {
      // 标记最后更新时间
      WB.db._lastCloudUpdate = Date.now();
      const data = JSON.parse(JSON.stringify(WB.db));
      if (state.gistId) {
        await updateGist(data);
      } else {
        await createGist(data);
      }
      state.lastPush = Date.now();
      localStorage.setItem('tea_gist_last_push', String(state.lastPush));
      return state.gistId;
    } finally {
      state.busy = false;
    }
  }

  async function pull() {
    if (!state.token) throw new Error('请先在设置中填写 GitHub Token');
    if (!state.gistId) throw new Error('还没有 Gist ID，先上传一次数据');
    if (state.busy) throw new Error('正在同步中，请稍候');
    state.busy = true;
    try {
      const data = await fetchGist();
      if (!data) throw new Error('云端没有数据');
      // 冲突检测：如果本地比云端新，提示用户
      const localTime = WB.db._lastCloudUpdate || 0;
      const cloudTime = data._lastCloudUpdate || 0;
      WB.db = WB.normalize(data);
      WB.save();
      state.lastPull = Date.now();
      localStorage.setItem('tea_gist_last_pull', String(state.lastPull));
      return { conflict: cloudTime < localTime, cloudTime, localTime };
    } finally {
      state.busy = false;
    }
  }

  function status() {
    return {
      ready: isReady(),
      token: !!state.token,
      gistId: state.gistId,
      busy: state.busy,
      lastPush: state.lastPush || Number(localStorage.getItem('tea_gist_last_push') || 0),
      lastPull: state.lastPull || Number(localStorage.getItem('tea_gist_last_pull') || 0)
    };
  }

  function fmtTime(ts) {
    if (!ts) return '从未';
    const d = new Date(ts);
    return `${U.pad(d.getMonth() + 1)}-${U.pad(d.getDate())} ${U.pad(d.getHours())}:${U.pad(d.getMinutes())}`;
  }

  /* ---------- 自动同步：包装 WB.save ---------- */
  let pushTimer = null;
  const _origSave = WB.save;
  WB.save = function () {
    const ok = _origSave.apply(WB, arguments);
    const auto = WB.db && WB.db.settings && WB.db.settings.cloudAutoSync;
    if (ok && auto && isReady() && !state.busy) {
      // 防抖：连续保存时只推送最后一次
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        push().catch((e) => console.warn('[cloud] auto push failed:', e));
      }, 1500);
    }
    return ok;
  };

  // 启动时如果开启了自动同步，尝试从云端拉取
  function autoPullOnBoot() {
    if (!WB.db.settings.cloudAutoSync || !isReady()) return;
    pull().then(() => {
      WB.UI.renderAll();
    }).catch((e) => {
      console.warn('[cloud] auto pull failed:', e);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoPullOnBoot);
  } else {
    setTimeout(autoPullOnBoot, 600);
  }

  /* ---------- 一键部署到 GitHub Pages ---------- */
  const DEPLOY_FILES = [
    'index.html', 'styles.css', 'pages.css', 'pages2.css', 'rail.css', 'responsive.css',
    'js/data.js', 'js/icons.js', 'js/charts.js', 'js/ui.js',
    'js/ui-papers.js', 'js/ui-pomodoro.js', 'js/ui-money.js',
    'js/ui-settings.js', 'js/ui-modals.js', 'js/ui-drinks.js',
    'js/cloud.js', 'js/app-core.js', 'js/app-actions.js',
    'js/app-actions2.js', 'js/app-boot.js'
  ];

  async function deployToPages() {
    if (!state.token) throw new Error('请先填写 GitHub Token');
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + state.token,
      'User-Agent': 'tea-workbench'
    };
    const gha = (method, path, body) => fetch('https://api.github.com' + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined
    }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => ({})) }));

    // 1. 用户名
    const u = await gha('GET', '/user');
    if (u.status !== 200) throw new Error('Token 无效：' + (u.data.message || u.status));
    const owner = u.data.login;
    const repo = 'tea-workbench';

    // 2. 创建仓库
    let r = await gha('GET', `/repos/${owner}/${repo}`);
    if (r.status === 404) {
      r = await gha('POST', '/user/repos', { name: repo, description: '茶歇工作台', auto_init: true });
      if (r.status > 201) throw new Error('创建仓库失败：' + (r.data.message || r.status));
    }

    // 3. 上传文件
    let ok = 0;
    for (const path of DEPLOY_FILES) {
      try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) continue;
        const text = await res.text();
        const b64 = btoa(unescape(encodeURIComponent(text)));
        const shaRes = await gha('GET', `/repos/${owner}/${repo}/contents/${path}`);
        const body = { message: 'deploy', content: b64 };
        if (shaRes.status === 200 && shaRes.data.sha) body.sha = shaRes.data.sha;
        const up = await gha('PUT', `/repos/${owner}/${repo}/contents/${path}`, body);
        if (up.status <= 201) ok++;
      } catch (e) { /* skip */ }
    }

    // 4. 启用 Pages
    await gha('POST', `/repos/${owner}/${repo}/pages`, { source: { branch: 'main', path: '/' } });
    const url = `https://${owner}.github.io/${repo}/`;
    return { url, uploaded: ok, total: DEPLOY_FILES.length };
  }

  WB.cloud = {
    setToken, getToken, setGistId, getGistId, isReady,
    push, pull, status, fmtTime, deployToPages, TOKEN_KEY, GIST_ID_KEY
  };
})();
