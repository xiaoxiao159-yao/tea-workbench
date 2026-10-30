/* 线性图标集 */
(function () {
  const P = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICONS = {
    home: P('<path d="M4 10.5 12 4l8 6.5"/><path d="M5.8 9.6V20h12.4V9.6"/><path d="M10 20v-5h4v5"/>'),
    book: P('<path d="M4.5 5.6C7 4 9.4 4.4 12 6v13.4c-2.6-1.6-5-2-7.5-.5z"/><path d="M19.5 5.6C17 4 14.6 4.4 12 6v13.4c2.6-1.6 5-2 7.5-.5z"/>'),
    bookOpen: P('<path d="M4 5.5c2.2-1.2 4.5-.9 6.5.3v12.7c-2-1.2-4.3-1.5-6.5-.3z"/><path d="M20 5.5c-2.2-1.2-4.5-.9-6.5.3v12.7c2-1.2 4.3-1.5 6.5-.3z"/><path d="M12 6v13"/>'),
    timer: P('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5v3.5"/>'),
    wallet: P('<rect x="3" y="6.5" width="18" height="12.5" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1.2"/>'),
    chart: P('<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-6"/><path d="M21 20H3"/>'),
    settings: P('<path d="M4 6.5h16M4 12h16M4 17.5h7"/><circle cx="16.5" cy="12" r="2.2"/><circle cx="8.5" cy="6.5" r="2.2"/><circle cx="14" cy="17.5" r="2.2"/>'),
    search: P('<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>'),
    bell: P('<path d="M6.2 9.2a5.8 5.8 0 0 1 11.6 0c0 4.6 1.9 5.9 1.9 5.9H4.3s1.9-1.3 1.9-5.9"/><path d="M9.8 19a2.3 2.3 0 0 0 4.4 0"/>'),
    moon: P('<path d="M20.4 13.8A8.6 8.6 0 1 1 10.2 3.6a7 7 0 0 0 10.2 10.2z"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>'),
    palette: P('<path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.4 0 2.4-.9 2.4-2.1 0-1.2-.8-1.6-.8-2.5 0-1 .8-1.5 1.9-1.5H18a3.2 3.2 0 0 0 3.2-3.2C21.2 6.9 17.1 3.2 12 3.2z"/><circle cx="7.4" cy="10.3" r=".9" fill="currentColor"/><circle cx="10.6" cy="6.8" r=".9" fill="currentColor"/><circle cx="15.4" cy="7.2" r=".9" fill="currentColor"/>'),
    keyboard: P('<rect x="2.5" y="6" width="19" height="12" rx="2.8"/><circle cx="6" cy="10" r=".8" fill="currentColor"/><circle cx="9.2" cy="10" r=".8" fill="currentColor"/><circle cx="12.4" cy="10" r=".8" fill="currentColor"/><circle cx="15.6" cy="10" r=".8" fill="currentColor"/><circle cx="18.4" cy="10" r=".8" fill="currentColor"/><path d="M7 14h10"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    x: P('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    chevronDown: P('<path d="m6 9 6 6 6-6"/>'),
    chevronRight: P('<path d="m9 6 6 6-6 6"/>'),
    arrowRight: P('<path d="M4 12h15"/><path d="m14 6 6 6-6 6"/>'),
    arrowUpRight: P('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'),
    pin: P('<path d="M9.2 3.8h5.6l-.9 4.9 2.9 2.9v1.2H7.2v-1.2l2.9-2.9z"/><path d="M12 12.8V21"/>'),
    upload: P('<path d="M12 16.5V4"/><path d="m7.2 8.8 4.8-4.8 4.8 4.8"/><path d="M4.5 16v3.5h15V16"/>'),
    download: P('<path d="M12 4v12.5"/><path d="m7.2 11.7 4.8 4.8 4.8-4.8"/><path d="M4.5 16v3.5h15V16"/>'),
    trash: P('<path d="M4.5 7h15"/><path d="M6.5 7l.8 12.5h9.4L17.5 7"/><path d="M9 7V4.2h6V7"/><path d="M10 10.5v5.5M14 10.5v5.5"/>'),
    edit: P('<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/>'),
    play: P('<path d="M8 5.5 19 12 8 18.5z" fill="currentColor" stroke="none"/>'),
    pause: P('<path d="M9 6v12M15 6v12" stroke-width="2.4"/>'),
    reset: P('<path d="M4.5 11a8 8 0 1 1 2.2 5.3"/><path d="M4.2 5.5v5.8h5.8"/>'),
    coffee: P('<path d="M4 9h13v5.5a4.5 4.5 0 0 1-4.5 4.5H8.5A4.5 4.5 0 0 1 4 14.5z"/><path d="M17 10.2h1.8a2.8 2.8 0 0 1 0 5.6H17"/><path d="M8 3.5c-1 1.2 1 2 0 3.2M12 3.5c-1 1.2 1 2 0 3.2"/><path d="M4 21h14"/>'),
    flame: P('<path d="M12 3.2c3.2 4 5.2 5.6 5.2 8.6a5.2 5.2 0 0 1-10.4 0c0-1.9.8-3.1 2.1-4.4.2 2 1.1 2.8 2.1 2.8 1 0 1.9-1 1.1-2.9-.7-1.6-1-2.8-.1-4.1z"/>'),
    clock: P('<circle cx="12" cy="12" r="8.2"/><path d="M12 7.5V12l3 2.3"/>'),
    filter: P('<path d="M4 5.5h16l-6.1 7v6l-3.8 2v-8z"/>'),
    grid: P('<rect x="4" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4"/>'),
    list: P('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    folder: P('<path d="M3 7.2a2 2 0 0 1 2-2h4l2 2.8h8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    tag: P('<path d="m4 11.6 7.6-7.6H19v7.4l-7.6 7.6z"/><circle cx="16" cy="8" r="1.2"/>'),
    note: P('<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8 8h8M8 11.5h8M8 15h5"/>'),
    quote: P('<path d="M9 7.5H5.5v6h5V10"/><path d="M19 7.5h-3.5v6h5V10"/><path d="M9 13.5c-1.8 2-3.2 2.8-4.5 3M19 13.5c-1.8 2-3.2 2.8-4.5 3"/>'),
    volume: P('<path d="M4 10v4h3l4 3.5v-11L7 10z"/><path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.8 7a7 7 0 0 1 0 10"/>'),
    calendar: P('<rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4.5M16 3v4.5"/>'),
    flag: P('<path d="M6 21V4"/><path d="M6 4.2h11.5l-1.8 4.4 1.8 4.4H6"/>'),
    repeat: P('<path d="M4 9.5a5 5 0 0 1 5-5h10"/><path d="m16 1.8 2.7 2.7-2.7 2.7"/><path d="M20 14.5a5 5 0 0 1-5 5H5"/><path d="m8 22.2-2.7-2.7 2.7-2.7"/>'),
    link: P('<path d="M10 14a4.2 4.2 0 0 0 6 0l2.2-2.2a4.2 4.2 0 0 0-6-6l-1.4 1.4"/><path d="M14 10a4.2 4.2 0 0 0-6 0L5.8 12.2a4.2 4.2 0 0 0 6 6l1.3-1.3"/>'),
    archive: P('<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V20h14V8.5"/><path d="M9 12h6"/>'),
    file: P('<path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5v4h4"/>'),
    panel: P('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M14 4.5v15"/>'),
    menu: P('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    user: P('<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20c.7-3.4 3.4-5.2 7.2-5.2s6.5 1.8 7.2 5.2"/>'),
    lock: P('<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>'),
    sparkles: P('<path d="M12 3.5 13.6 8l4.4 1.6-4.4 1.6L12 15.6l-1.6-4.4L6 9.6l4.4-1.6z"/><path d="M18.5 15.5 19.3 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8z"/>'),
    alert: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/>'),
    info: P('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8h.01"/>'),
    target: P('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.4"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>'),
    inbox: P('<path d="M3.5 13.5h4l1.5 2.5h6l1.5-2.5h4"/><path d="M5.5 5.5h13l2 8v6h-17v-6z"/>'),
    external: P('<path d="M14 4h6v6"/><path d="m20 4-8 8"/><path d="M19 14v5.5H4.5V5H10"/>'),
    save: P('<path d="M5 3.5h11l3 3V20H5z"/><path d="M8 3.5v5h7V3.5"/><rect x="8" y="12.5" width="8" height="7.5"/>'),
    database: P('<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6"/>'),
    shield: P('<path d="M12 3.5 19 6v6c0 4.5-3 7.5-7 8.8-4-1.3-7-4.3-7-8.8V6z"/><path d="m9 12 2.2 2.2 3.8-4"/>'),
    bed: P('<path d="M3.5 18v-7.5h17V18"/><path d="M3.5 14.5h17M6 10.5V6h5.5v4.5M6 18v2M18 18v2"/>'),
    leaf: P('<path d="M5 19c0-7 5-13 14-14-1 9-5 13-11 13"/><path d="M5 19c1-2.5 3-4.5 6-5.5"/>'),
    more: P('<circle cx="6" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="18" cy="12" r="1.1" fill="currentColor"/>'),
    music: P('<path d="M9 17.5V6l9-2v11"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="15.5" cy="15" r="2.5"/>'),
    maximize: P('<path d="M9 4H4.5V8.5M15 4h4.5V8.5M20.5 15v4.5H16M4.5 15v4.5H9"/>'),
    minimize: P('<path d="M4.5 4.5 9.5 9.5M9.5 4.8v4.7H4.8M19.5 4.5 14.5 9.5M14.5 4.8v4.7h4.7M4.5 19.5 9.5 14.5M4.8 14.5h4.7v4.7M19.5 19.5 14.5 14.5M14.5 19.2v-4.7h4.7"/>'),
    undo: P('<path d="M4 7.5h9.5a6 6 0 0 1 0 12H8"/><path d="M7.5 4 4 7.5 7.5 11"/>'),
    gridList: P('<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/>'),
    star: P('<path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"/>'),
    cloud: P('<path d="M7.5 18.5h8.5a3.8 3.8 0 0 0 .2-7.6 5 5 0 0 0-9.6-1.3A3.5 3.5 0 0 0 7.5 18.5z"/>'),
    rocket: P('<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.7-.7.7-1.8 0-2.5s-1.8-.7-2.5 0z"/><path d="M12 15 9 12c2-6 6-8 11-9-1 5-3 9-9 11z"/><path d="M14 8a1.5 1.5 0 1 0 0-.1"/>')
  };
  function icon(name) {
    return ICONS[name] || ICONS.file;
  }
  function hydrate(root = document) {
    root.querySelectorAll('[data-icon]').forEach((el) => {
      if (el.querySelector('svg')) return;
      el.innerHTML = icon(el.dataset.icon);
    });
  }
  window.WBIcons = { icon, hydrate, map: ICONS };
})();
