/* 轻量 SVG 图表：柱状 / 折线 / 环形 / 迷你走势 */
(function () {
  let seq = 0;
  const nextId = () => `cg_${++seq}`;
  const FONT = 'font-size="9" fill="var(--muted)" font-family="inherit"';

  function niceMax(v) {
    if (v <= 0) return 10;
    const exp = Math.floor(Math.log10(v));
    const base = Math.pow(10, exp);
    const n = v / base;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * base * (n <= step ? 1 : 1);
  }

  function barChart(opts) {
    const data = opts.data || [];
    const H = opts.height || 168;
    const W = 360;
    const padL = 30, padR = 8, padT = 16, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const values = data.map((d) => Math.max(0, Number(d.value) || 0));
    const max = niceMax(Math.max(...values, 1) * 1.08);
    const color = opts.color || 'var(--accent)';
    const gid = nextId();
    const n = data.length;
    const slot = plotW / Math.max(1, n);
    const bw = Math.min(26, Math.max(4, slot * 0.58));
    const every = opts.labelEvery || (n > 14 ? Math.ceil(n / 7) : n > 8 ? 2 : 1);
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const y = padT + plotH - (plotH * i) / 3;
      const val = (max * i) / 3;
      grid += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="var(--line-soft)" stroke-width="1"/>`;
      grid += `<text x="${padL - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end" ${FONT}>${opts.yFmt ? opts.yFmt(val) : Math.round(val)}</text>`;
    }
    let bars = '';
    data.forEach((d, i) => {
      const v = values[i];
      const h = v <= 0 ? 0.7 : Math.max(2, (v / max) * plotH);
      const x = padL + slot * i + (slot - bw) / 2;
      const y = padT + plotH - h;
      const rx = Math.min(4, bw / 2);
      const op = v <= 0 ? 0.18 : 1;
      bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${color}" opacity="${op}"/>`;
      if (opts.showValues && n <= 12 && v > 0) {
        bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="var(--muted)">${opts.fmt ? opts.fmt(v) : Math.round(v)}</text>`;
      }
      if (i % every === 0 || i === n - 1) {
        bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${opts.xFmt ? opts.xFmt(d.label, i) : d.label}</text>`;
      }
    });
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.aria || '柱状图'}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.55"/>
      </linearGradient></defs>
      ${grid}${bars}</svg>`;
  }

  function lineChart(opts) {
    const values = opts.values || [];
    const labels = opts.labels || [];
    const H = opts.height || 180;
    const W = 360;
    const padL = 32, padR = 10, padT = 18, padB = 24;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const max = niceMax(Math.max(...values, 1) * 1.1);
    const n = values.length;
    const color = opts.color || 'var(--accent)';
    const gid = nextId();
    const xOf = (i) => padL + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
    const yOf = (v) => padT + plotH - (Math.max(0, v) / max) * plotH;
    let grid = '';
    for (let i = 0; i <= 3; i++) {
      const y = padT + plotH - (plotH * i) / 3;
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--line-soft)"/>`;
      grid += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" ${FONT}>${Math.round((max * i) / 3)}</text>`;
    }
    const pts = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`);
    const line = pts.join(' ');
    const area = `M${padL},${padT + plotH} L${pts.join(' L')} L${xOf(n - 1) || padL},${padT + plotH} Z`;
    let dots = '';
    values.forEach((v, i) => {
      if (n <= 14 || i === n - 1) {
        dots += `<circle cx="${xOf(i)}" cy="${yOf(v)}" r="${i === n - 1 ? 3 : 2.2}" fill="${color}" opacity="${i === n - 1 ? 1 : .55}"/>`;
      }
    });
    let xlabels = '';
    const every = opts.labelEvery || Math.max(1, Math.ceil(n / 7));
    labels.forEach((l, i) => {
      if (i % every === 0 || i === n - 1) {
        xlabels += `<text x="${xOf(i)}" y="${H - 7}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${l}</text>`;
      }
    });
    const lastVal = values[n - 1] || 0;
    const lastLabel = opts.fmt ? opts.fmt(lastVal) : lastVal;
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.aria || '趋势图'}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient></defs>
      ${grid}
      ${n > 1 ? `<path d="${area}" fill="url(#${gid})"/>` : ''}
      ${n > 1 ? `<polyline points="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${dots}${xlabels}
      ${n ? `<text x="${W - padR}" y="${padT - 4}" text-anchor="end" font-size="9" fill="${color}">${lastLabel}</text>` : ''}
    </svg>`;
  }

  function polar(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }
  function arc(cx, cy, r, start, end) {
    const s = polar(cx, cy, r, end);
    const e = polar(cx, cy, r, start);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  }
  function donutChart(opts) {
    const items = (opts.items || []).filter((d) => Number(d.value) > 0);
    const size = opts.size || 168;
    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 10;
    const thick = opts.thickness || 20;
    const total = items.reduce((s, d) => s + (Number(d.value) || 0), 0);
    let paths = '';
    if (!total) {
      paths = `<circle cx="${cx}" cy="${cy}" r="${r - thick / 2}" fill="none" stroke="var(--line-soft)" stroke-width="${thick}"/>`;
    } else {
      let angle = 0;
      items.forEach((d, i) => {
        const sweep = (Number(d.value) / total) * 360;
        const gap = items.length > 1 ? 1.6 : 0;
        const start = angle + gap / 2;
        const end = angle + sweep - gap / 2;
        if (end > start) {
          paths += `<path d="${arc(cx, cy, r - thick / 2, start, end)}" fill="none" stroke="${d.color || 'var(--accent)'}" stroke-width="${thick}" stroke-linecap="butt" opacity="${d.opacity || 1}"/>`;
        }
        angle += sweep;
      });
    }
    const centerLabel = opts.centerLabel || '';
    const centerValue = opts.centerValue != null ? opts.centerValue : '';
    return `<svg class="chart-svg donut-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="${opts.aria || '环形图'}">
      ${paths}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="${opts.big ? 22 : 17}" font-family="Georgia, serif" fill="var(--text)">${centerValue}</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="8.5" fill="var(--muted)">${centerLabel}</text>
    </svg>`;
  }

  function sparkline(values, color = 'var(--accent)') {
    const vs = values && values.length ? values : [0, 0];
    const w = 58, h = 26, pad = 2;
    const max = Math.max(...vs, 1);
    const min = Math.min(...vs, 0);
    const pts = vs.map((v, i) => {
      const x = pad + ((w - pad * 2) * i) / Math.max(1, vs.length - 1);
      const y = pad + (h - pad * 2) * (1 - (v - min) / (max - min || 1));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" class="mk-spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  window.WBCharts = { barChart, lineChart, donutChart, sparkline };
})();
