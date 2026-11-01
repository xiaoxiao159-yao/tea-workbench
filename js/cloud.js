/* 云同步：通过 GitHub Gist 在多设备间同步数据 */
(function () {
  const U = WB.util;
  const APP = WB.app;
  const TOKEN_KEY = 'tea_gist_token';
  const GIST_ID_KEY = 'tea_gist_id';
  const GIST_FILE = 'tea_workbench_data.json';
  const FILE_PREFIX = 'blob_';
  const MAX_SYNC_BYTES = 5 * 1024 * 1024; // 单文件上限 5MB（base64 后仍小于 Gist 单文件限制）
  const FILE_PUSH_KEY = 'tea_gist_last_file_push';
  const FILE_PULL_KEY = 'tea_gist_last_file_pull';

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || '',
    gistId: localStorage.getItem(GIST_ID_KEY) || '',
    busy: false,
    pulling: false,
    lastPush: 0,
    lastPull: 0,
    lastFilePush: Number(localStorage.getItem(FILE_PUSH_KEY) || 0),
    lastFilePull: Number(localStorage.getItem(FILE_PULL_KEY) || 0)
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

  /* ============================================================
     文件云同步：PDF / EPUB / 封面等二进制随 Gist 一起走
     每个文件存为独立 gist 文件 blob_<id>.json，内容为 base64（可 gzip）
     ============================================================ */
  function fileGistName(id) { return `${FILE_PREFIX}${id}.json`; }

  function abToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }
  function b64ToAb(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  async function gzipBuf(buf) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      const stream = new Blob([buf]).stream().pipeThrough(new CompressionStream('gzip'));
      return await new Response(stream).arrayBuffer();
    } catch (e) { return null; }
  }
  async function gunzipBuf(buf) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).arrayBuffer();
  }

  async function encodeFile(file, id) {
    const buf = await file.arrayBuffer();
    const gz = await gzipBuf(buf);
    const useGzip = !!gz && gz.byteLength < buf.byteLength * 0.92;
    return {
      v: 1,
      id,
      name: file.name || '',
      type: file.type || 'application/octet-stream',
      size: file.size || buf.byteLength,
      enc: useGzip ? 'gzip' : 'raw',
      data: abToB64(useGzip ? gz : buf),
      ts: Date.now()
    };
  }

  async function decodeFile(rec) {
    let buf = b64ToAb(rec.data);
    if (rec.enc === 'gzip') buf = await gunzipBuf(buf);
    const type = rec.type || 'application/octet-stream';
    const blob = new Blob([buf], { type });
    if (rec.name && typeof File !== 'undefined') {
      try { return new File([blob], rec.name, { type, lastModified: rec.ts || Date.now() }); } catch (e) { /* ignore */ }
    }
    return blob;
  }

  async function patchFiles(files) {
    if (!state.gistId) throw new Error('还没有 Gist ID，先上传一次数据');
    const res = await api('/gists/' + state.gistId, {
      method: 'PATCH',
      body: JSON.stringify({ files })
    });
    if (!res.ok) throw new Error(`同步文件失败：${res.status}`);
    return true;
  }

  async function listLocalFiles() {
    const db = await WB.idb.openFiles();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function pushFile(id) {
    if (!state.token) throw new Error('请先填写 GitHub Token');
    const file = await WB.idb.getFile(id);
    if (!file) throw new Error('本地没有这个文件');
    const size = file.size || 0;
    if (size > MAX_SYNC_BYTES) throw new Error(`文件超过 ${Math.round(MAX_SYNC_BYTES / 1048576)}MB，暂不支持云同步`);
    if (!state.gistId) await push();
    const rec = await encodeFile(file, id);
    await patchFiles({ [fileGistName(id)]: { content: JSON.stringify(rec) } });
    state.lastFilePush = Date.now();
    localStorage.setItem(FILE_PUSH_KEY, String(state.lastFilePush));
    return { id, size, enc: rec.enc };
  }

  async function deleteFile(id) {
    if (!state.token || !state.gistId) return false;
    try {
      const res = await api('/gists/' + state.gistId);
      if (!res.ok) return false;
      const j = await res.json();
      if (!j.files || !j.files[fileGistName(id)]) return false;
    } catch (e) {
      return false;
    }
    await patchFiles({ [fileGistName(id)]: null });
    return true;
  }

  async function fetchGistJson(rawUrl) {
    let res = await fetch(rawUrl, {
      cache: 'no-store',
      headers: state.token ? { Authorization: 'Bearer ' + state.token } : {}
    });
    if (!res.ok) {
      res = await fetch(rawUrl, { cache: 'no-store' });
    }
    if (!res.ok) throw new Error('下载文件失败：' + res.status);
    return await res.json();
  }

  async function pullFiles() {
    if (!state.token) throw new Error('请先填写 GitHub Token');
    if (!state.gistId) throw new Error('还没有 Gist ID，先上传一次数据');
    const res = await api('/gists/' + state.gistId);
    if (!res.ok) throw new Error('读取 Gist 失败：' + res.status);
    const j = await res.json();
    const names = Object.keys(j.files || {}).filter((k) => k.indexOf(FILE_PREFIX) === 0);
    let added = 0, skipped = 0, failed = 0;
    state.pulling = true;
    try {
      for (const name of names) {
        const f = j.files[name];
        try {
          const rec = f.truncated ? await fetchGistJson(f.raw_url) : JSON.parse(f.content);
          if (!rec || !rec.id) { failed++; continue; }
          const local = await WB.idb.getFile(rec.id);
          if (local) { skipped++; continue; }
          const blob = await decodeFile(rec);
          const ok = await _origPutFile(rec.id, blob);
          if (ok) added++; else failed++;
        } catch (e) {
          console.warn('[cloud] 文件拉取失败', name, e);
          failed++;
        }
      }
    } finally {
      state.pulling = false;
    }
    state.lastFilePull = Date.now();
    localStorage.setItem(FILE_PULL_KEY, String(state.lastFilePull));
    return { total: names.length, added, skipped, failed };
  }

  async function pushAllFiles() {
    if (!state.token) throw new Error('请先填写 GitHub Token');
    const keys = await listLocalFiles();
    const out = { total: keys.length, uploaded: 0, skipped: 0, failed: 0 };
    for (const id of keys) {
      try {
        const file = await WB.idb.getFile(id);
        if (!file || (file.size || 0) > MAX_SYNC_BYTES) { out.skipped++; continue; }
        await pushFile(id);
        out.uploaded++;
      } catch (e) {
        console.warn('[cloud] 文件上传失败', id, e);
        out.failed++;
      }
    }
    return out;
  }

  function fileStatus() {
    return {
      maxMB: Math.round(MAX_SYNC_BYTES / 1048576),
      lastPush: state.lastFilePush,
      lastPull: state.lastFilePull
    };
  }

  /* ---------- 自动排队：文件写入/删除后自动上云 ---------- */
  const pendingPut = new Set();
  const pendingDel = new Set();
  let fileTimer = null;

  function autoFileSyncOn() {
    return !!(state.token && WB.db && WB.db.settings && WB.db.settings.cloudAutoSync);
  }
  function scheduleFilePush(id) {
    if (state.pulling || !autoFileSyncOn()) return;
    pendingDel.delete(id);
    pendingPut.add(id);
    clearTimeout(fileTimer);
    fileTimer = setTimeout(flushFiles, 2500);
  }
  function scheduleFileDelete(id) {
    if (state.pulling || !autoFileSyncOn() || !state.gistId) return;
    pendingPut.delete(id);
    pendingDel.add(id);
    clearTimeout(fileTimer);
    fileTimer = setTimeout(flushFiles, 2500);
  }
  async function flushFiles() {
    if (state.busy) { clearTimeout(fileTimer); fileTimer = setTimeout(flushFiles, 1200); return; }
    const ups = Array.from(pendingPut); pendingPut.clear();
    const dels = Array.from(pendingDel); pendingDel.clear();
    try {
      if (dels.length) for (const id of dels) await deleteFile(id);
      if (ups.length) for (const id of ups) await pushFile(id);
    } catch (e) {
      console.warn('[cloud] 自动同步文件失败:', e);
    }
  }

  const _origPutFile = WB.idb.putFile;
  const _origRemoveFile = WB.idb.removeFile;
  WB.idb.putFile = function (id, file) {
    const p = _origPutFile.apply(WB.idb, arguments);
    p.then((ok) => { if (ok) scheduleFilePush(id); }).catch(() => {});
    return p;
  };
  WB.idb.removeFile = function (id) {
    const p = _origRemoveFile.apply(WB.idb, arguments);
    p.then((ok) => { if (ok) scheduleFileDelete(id); }).catch(() => {});
    return p;
  };

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

  // 启动时如果开启了自动同步，尝试从云端拉取（元数据 + 文献/书籍文件）
  function autoPullOnBoot() {
    if (!WB.db.settings.cloudAutoSync || !isReady()) return;
    pull().then(async () => {
      try { await pullFiles(); } catch (e) { console.warn('[cloud] auto pull files failed:', e); }
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
    'index.html', 'styles.css', 'pages.css', 'pages2.css', 'rail.css', 'responsive.css', 'reading.css',
    'js/data.js', 'js/icons.js', 'js/charts.js', 'js/ui.js',
    'js/ui-papers.js', 'js/ui-pomodoro.js', 'js/ui-money.js',
    'js/ui-settings.js', 'js/ui-modals.js', 'js/ui-drinks.js', 'js/ui-reading.js',
    'js/cloud.js', 'js/app-core.js', 'js/app-actions.js',
    'js/app-actions2.js', 'js/reader.js', 'js/reading-actions.js', 'js/app-boot.js'
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
    push, pull, status, fmtTime, deployToPages,
    pushFile, pullFiles, pushAllFiles, deleteFile, fileStatus, listLocalFiles,
    TOKEN_KEY, GIST_ID_KEY
  };
})();
