/* Словарик — офлайн-словарь русско-китайских фраз.
 * Без фреймворков: состояние в localStorage, рендер шаблонами.
 */
(function () {
  'use strict';

  const STORE_KEY = 'slovar.v1';
  const APP_VERSION = '2.5.1';
  const PUBLIC_APP_URL = 'https://slovar-app.github.io/slovar/';

  /* ───────────────────────── Утилиты ───────────────────────── */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b >= 2 && b <= 4) return few;
    return many;
  }

  function stripTones(s) {
    return String(s == null ? '' : s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ü/g, 'v');
  }

  function normalizeQuery(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function hue(tag) {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % 360;
    return h;
  }

  // Пиньинь с тонами. Китайскую пунктуацию из пиньиня убираем.
  function makePinyin(zh) {
    const src = String(zh || '').trim();
    if (!src) return '';
    if (!window.pinyinPro) return '';
    try {
      const arr = window.pinyinPro.pinyin(src, {
        toneType: 'symbol',
        type: 'array',
        nonZh: 'consecutive'
      });
      return arr
        .join(' ')
        .replace(/[，。！？、；：""''（）《》【】…—～]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (err) {
      return '';
    }
  }

  const ICONS = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="6.4"/><path d="M16 16l4.6 4.6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.1"/><path d="M19.2 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.6L12 18V6L7.6 9.5H4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6"/><path d="M18.7 6.4a8 8 0 0 1 0 11.2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>',
    pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18.5h3"/><path d="M12 7v5m0 0l-2-2m2 2l2-2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6z"/><path d="M12 15v5"/></svg>',
    merge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h9a3 3 0 0 1 3 3v5"/><path d="M13 5l3 3-3 3"/><path d="M20 16h-6"/><path d="M17 13l3 3-3 3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.4l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 16.92l-5.3 2.79 1.01-5.9L3.42 9.63l5.93-.86L12 3.4z"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4.5" width="12" height="16" rx="2.5"/><path d="M9.5 4.5V3.2A1.2 1.2 0 0 1 10.7 2h2.6a1.2 1.2 0 0 1 1.2 1.2v1.3"/><path d="M9.5 10h5M9.5 13.5h5M9.5 17h3"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.4 10.8l7.2-4.2M8.4 13.2l7.2 4.2"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h2.5M20.5 14v2.5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7"/><path d="M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12"/><path d="M10.5 11v5.5M13.5 11v5.5"/></svg>'
  };

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    clearTimeout(toast._tm);
    t.classList.remove('is-action');
    t.textContent = msg;
    t.classList.add('is-show');
    toast._tm = setTimeout(() => t.classList.remove('is-show'), 2400);
  }

  function showUndoToast(msg, snapshot) {
    const t = $('#toast');
    if (!t || !snapshot) return;
    clearTimeout(toast._tm);
    t.innerHTML = '<span>' + esc(msg) + '</span>' +
      '<button type="button" class="toast-action">Отменить</button>';
    t.classList.add('is-show', 'is-action');
    t.querySelector('.toast-action').addEventListener('click', function () {
      if (undoDelete(snapshot)) {
        if (!sheetOpen) render();
        toast('Восстановлено');
      } else {
        t.classList.remove('is-show', 'is-action');
        t.innerHTML = '';
      }
    });
    toast._tm = setTimeout(function () {
      t.classList.remove('is-show', 'is-action');
      t.innerHTML = '';
    }, 6000);
  }

  function formatDateTime(ts) {
    const d = new Date(ts);
    if (!ts || isNaN(d.getTime())) return '';
    const p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function todayISO() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /* ───────────────────────── Данные ───────────────────────── */

  function defaultSettings() {
    return { rate: 0.9, voice: '', theme: 'system', sort: 'new', cloudAuto: true, cloudLast: 0, cloudFile: '', cloudError: '' };
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.entries)) return null;
      data.settings = Object.assign(defaultSettings(), data.settings || {});
      data.removed = Array.isArray(data.removed) ? data.removed : [];
      data.history = Array.isArray(data.history) ? data.history : [];
      data.backups = Array.isArray(data.backups) ? data.backups : [];
      data.forceNewVersion = !!data.forceNewVersion;
      data.seedCleared = !!data.seedCleared;
      data.lastCleanup = data.lastCleanup || 0;
      data.pinnedTags = Array.isArray(data.pinnedTags) ? data.pinnedTags : [];
      data.topics = Array.isArray(data.topics) ? data.topics : [];
      data.demoSeeded = data.demoSeeded !== undefined
        ? !!data.demoSeeded
        : (data.entries.length > 0 || data.topics.length > 0);
      return data;
    } catch (err) {
      return null;
    }
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function recordAdditions(entries) {
    const list = (entries || []).filter(Boolean);
    if (!list.length) return;

    db.history = Array.isArray(db.history) ? db.history : [];
    const now = Date.now();
    const HOUR = 60 * 60 * 1000;
    let version = db.forceNewVersion ? null : db.history[0];
    if (db.forceNewVersion) db.forceNewVersion = false;

    if (version && now - version.start < HOUR) {
      const known = new Set(version.entries.map(function (e) { return e.id; }));
      list.forEach(function (e) {
        if (known.has(e.id)) return;
        version.entries.push(cloneData(e));
        known.add(e.id);
      });
      version.updated = now;
    } else {
      db.history.unshift({
        id: uid(),
        start: now,
        updated: now,
        entries: list.map(cloneData)
      });
    }

    if (db.history.length > 100) db.history.length = 100;
    saveDB();
  }

  function createBackup(note, silent) {
    if (!db.entries.length && !(db.topics || []).length) {
      if (!silent) toast('Словарь пуст — копировать нечего');
      return null;
    }
    db.backups = Array.isArray(db.backups) ? db.backups : [];
    const backup = {
      id: uid(),
      ts: Date.now(),
      note: note || 'Копия',
      entries: cloneData(db.entries),
      topics: cloneData(db.topics || [])
    };
    db.backups.unshift(backup);
    if (db.backups.length > 12) db.backups.length = 12;
    saveDB();
    if (!silent) {
      render();
      toast('Копия создана');
    }
    if (CLOUD_ENABLED && db.settings.cloudAuto !== false && getYandexToken() && !cloudUploading) {
      uploadToYandex(backup.entries, false);
    }
    return backup;
  }

  function cleanupOldData() {
    const DAY = 24 * 60 * 60 * 1000;
    if (db.lastCleanup && Date.now() - db.lastCleanup < DAY) return 0;

    const MONTH = 30 * DAY;
    const cutoff = Date.now() - MONTH;
    const beforeHistory = (db.history || []).length;
    const beforeBackups = (db.backups || []).length;

    db.history = (db.history || []).filter(function (v) {
      return (v.updated || v.start || 0) >= cutoff;
    });

    const allBackups = (db.backups || []).slice().sort(function (a, b) { return b.ts - a.ts; });
    let backups = allBackups.filter(function (b) { return b.ts >= cutoff; });
    if (!backups.length && allBackups.length) backups = [allBackups[0]];
    db.backups = backups;

    db.lastCleanup = Date.now();
    const removed = (beforeHistory - db.history.length) + (beforeBackups - db.backups.length);
    saveDB();
    return removed;
  }

  function maybeWeeklyBackup() {
    if (!db.entries.length && !(db.topics || []).length) return;
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const last = (db.backups || [])[0];
    if (last && Date.now() - last.ts < WEEK) return;
    const first = !last;
    const created = createBackup('Недельная копия', true);
    if (created && !sheetOpen && (state.view === 'settings' || state.view === 'history')) render();
    if (created && !first) toast('Создана недельная копия словаря');
  }

  function timeHM(ts) {
    const d = new Date(ts);
    const p = function (n) { return String(n).padStart(2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function historyRange(v) {
    const start = formatDateTime(v.start);
    if (v.updated - v.start < 60 * 1000) return start;
    const sameDay = new Date(v.start).toDateString() === new Date(v.updated).toDateString();
    return start + (sameDay ? '–' + timeHM(v.updated) : ' – ' + formatDateTime(v.updated));
  }

  function saveDB() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    } catch (err) {
      // при переполнении сокращаем историю и копии, затем пробуем снова
      try {
        if (db.backups && db.backups.length > 2) {
          db.backups.length = 2;
          localStorage.setItem(STORE_KEY, JSON.stringify(db));
          toast('Память заполнена: оставлены 2 последние копии');
          return;
        }
        if (db.history && db.history.length > 20) {
          db.history.length = 20;
          localStorage.setItem(STORE_KEY, JSON.stringify(db));
          toast('Память заполнена: история версий сокращена');
          return;
        }
      } catch (e2) { /* ignore */ }
      toast('Не удалось сохранить: память переполнена');
    }
  }

  let dupHintTimer = null;

  function scheduleDupHint() {
    clearTimeout(dupHintTimer);
    dupHintTimer = setTimeout(updateDupHint, 180);
  }

  function updateDupHint() {
    const box = $('#dup-hint');
    if (!box) return;
    const zh = $('#in-zh') ? $('#in-zh').value : '';
    const ru = $('#in-ru') ? $('#in-ru').value : '';
    const exact = findExactDup(zh, ru, sheetEntryId);
    const similar = findSimilar(zh, ru, sheetEntryId)
      .filter(function (e) { return !exact || e.id !== exact.id; })
      .slice(0, 3);

    if (!exact && !similar.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }

    const items = (exact ? [exact] : []).concat(similar);
    box.hidden = false;
    box.innerHTML = '<div class="dup-hint-title">' + (exact ? 'Такая фраза уже есть' : 'Похожие фразы') + '</div>' +
      items.map(function (e) {
        const sub = [e.py, e.zh && e.ru ? e.ru : '', e.tags.join(', ')].filter(Boolean).join(' · ');
        return '<button type="button" class="dup-item" data-act="open-existing" data-id="' + esc(e.id) + '">' +
          '<span class="dup-item-zh">' + esc(e.zh || e.ru) + '</span>' +
          '<span class="dup-item-ru">' + esc(sub) + '</span>' +
        '</button>';
      }).join('');
  }

  // Облако временно скрыто: код оставлен на будущее, но раздел и загрузки отключены.
  const CLOUD_ENABLED = false;
  const YANDEX_TOKEN_KEY = 'slovar.yandex.token';

  function getYandexToken() {
    try { return localStorage.getItem(YANDEX_TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function setYandexToken(token) {
    try { localStorage.setItem(YANDEX_TOKEN_KEY, token); } catch (e) { /* ignore */ }
  }
  function clearYandexToken() {
    try { localStorage.removeItem(YANDEX_TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  let cloudUploading = false;

  let db = loadDB();
  if (!db) db = {
    entries: [], settings: defaultSettings(),
    removed: [], history: [], backups: [], forceNewVersion: false,
    seedCleared: true, demoSeeded: false, lastCleanup: 0, pinnedTags: [], topics: [], v: 1
  };

  function makeEntry(raw) {
    const zh = String(raw.zh || '').trim();
    const ru = String(raw.ru || '').trim();
    let tags = Array.isArray(raw.tags)
      ? raw.tags.map(t => String(t).trim()).filter(Boolean)
      : [];
    if (!tags.length) tags = ['Без тега'];
    return {
      id: raw.id || uid(),
      zh: zh,
      py: String(raw.py || '').trim() || makePinyin(zh),
      ru: ru,
      tags: tags,
      note: String(raw.note || '').trim(),
      fav: !!raw.fav,
      ts: raw.ts || Date.now()
    };
  }

  // FNV-1a по UTF-16; должен совпадать с генератором в seed.js.
  function fnvHash(str) {
    const s = String(str).toLowerCase();
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }

  // Одноразово убирает стартовые фразы (и тестовые) у тех, кто уже пользовался приложением.
  function cleanupLegacySeed() {
    if (db.seedCleared) return 0;

    const hashes = new Set(window.SEED_CLEANUP || []);
    const doomed = db.entries.filter(function (e) {
      return hashes.has(fnvHash((e.zh || '') + '|' + (e.ru || '')));
    });

    if (doomed.length) {
      createBackup('Перед удалением стартовых фраз', true);
      const ids = new Set(doomed.map(function (e) { return e.id; }));
      db.entries = db.entries.filter(function (e) { return !ids.has(e.id); });
      db.history = (db.history || []).map(function (v) {
        v.entries = v.entries.filter(function (x) { return !ids.has(x.id); });
        return v;
      }).filter(function (v) { return v.entries.length; });
    }

    db.seedCleared = true;
    try { localStorage.removeItem('slovar.pass.v1'); } catch (e) { /* ignore */ }
    saveDB();
    return doomed.length;
  }

  function makePinyinText(text) {
    return String(text || '')
      .split('\n')
      .map(function (line) { return makePinyin(line); })
      .join('\n');
  }

  function makeTopic(raw) {
    const zh = String(raw.zh || '').trim();
    const ru = String(raw.ru || '').trim();
    return {
      id: raw.id || uid(),
      title: String(raw.title || '').trim(),
      zh: zh,
      ru: ru,
      py: String(raw.py || '').trim() || makePinyinText(zh),
      ts: raw.ts || Date.now(),
      updated: raw.updated || raw.ts || Date.now()
    };
  }

  function seedDemoData() {
    if (db.demoSeeded) return 0;
    const demo = window.DEMO_DATA;
    if (!demo) return 0;

    const known = new Set(db.entries.map(function (e) {
      return (e.zh + '|' + e.ru).toLowerCase();
    }));
    const added = [];
    (demo.entries || []).forEach(function (raw) {
      const entry = makeEntry(raw);
      const key = (entry.zh + '|' + entry.ru).toLowerCase();
      if (known.has(key)) return;
      db.entries.push(entry);
      known.add(key);
      added.push(entry);
    });

    let addedTopic = false;
    if (demo.topic && (demo.topic.zh || demo.topic.ru)) {
      db.topics = db.topics || [];
      const topicKey = (String(demo.topic.zh || '') + '|' + String(demo.topic.ru || '')).toLowerCase();
      const exists = db.topics.some(function (t) {
        return (String(t.zh || '') + '|' + String(t.ru || '')).toLowerCase() === topicKey;
      });
      if (!exists) {
        db.topics.unshift(makeTopic(demo.topic));
        addedTopic = true;
      }
    }

    db.demoSeeded = true;
    if (added.length) {
      db.forceNewVersion = true;
      recordAdditions(added);
    }
    saveDB();
    return added.length + (addedTopic ? 1 : 0);
  }

  function topicById(id) {
    return (db.topics || []).find(function (t) { return t.id === id; }) || null;
  }

  function topicTitle(t) {
    const title = String(t.title || '').trim();
    const src = title || (t.zh || t.ru || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean)[0] || 'Без названия';
    return src.length > 42 ? src.slice(0, 42) + '…' : src;
  }

  function topicPreview(t) {
    const src = String(t.ru || t.zh || '').replace(/\n+/g, ' ').trim();
    return src.length > 96 ? src.slice(0, 96) + '…' : src;
  }

  function entryById(id) {
    return db.entries.find(e => e.id === id) || null;
  }

  function tagStats() {
    const map = new Map();
    db.entries.forEach(e => {
      e.tags.forEach(t => map.set(t, (map.get(t) || 0) + 1));
    });
    const pinned = new Set(db.pinnedTags || []);
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const pa = pinned.has(a.name) ? 0 : 1;
        const pb = pinned.has(b.name) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return b.count - a.count || a.name.localeCompare(b.name, 'ru');
      });
  }

  function allTags() {
    return tagStats().map(t => t.name);
  }

  function pinyinInitials(py) {
    return stripTones(py)
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(s => s.charAt(0))
      .join('');
  }

  const RU_ENDINGS = [
    'иями', 'ями', 'ами', 'иях', 'ях', 'ах', 'иям', 'ям', 'ам',
    'ием', 'ем', 'ом', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими',
    'ой', 'ей', 'ый', 'ий', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие',
    'ов', 'ев', 'ия', 'ию', 'ии', 'ье', 'ью', 'ться', 'тся', 'ть',
    'ет', 'ют', 'ит', 'ат', 'ят', 'ла', 'ло', 'ли', 'ся', 'сь',
    'и', 'ы', 'а', 'я', 'о', 'е', 'у', 'ю', 'ь'
  ];

  function stemRu(word) {
    let w = String(word || '').toLowerCase();
    for (let i = 0; i < RU_ENDINGS.length; i++) {
      const end = RU_ENDINGS[i];
      if (w.length - end.length >= 4 && w.slice(-end.length) === end) {
        w = w.slice(0, -end.length);
        break;
      }
    }
    return w;
  }

  function wordTokens(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  // расстояние 1: замена, вставка, удаление или перестановка соседних букв
  function withinOneEdit(a, b) {
    if (a === b) return true;
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > 1) return false;

    if (la === lb) {
      const diff = [];
      for (let i = 0; i < la; i++) if (a[i] !== b[i]) diff.push(i);
      if (diff.length === 1) return true;
      if (diff.length === 2 && diff[1] === diff[0] + 1 &&
          a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
      return false;
    }

    const longer = la > lb ? a : b;
    const shorter = la > lb ? b : a;
    let i = 0;
    let j = 0;
    let skipped = false;
    while (i < longer.length && j < shorter.length) {
      if (longer[i] === shorter[j]) { i++; j++; continue; }
      if (skipped) return false;
      skipped = true;
      i++;
    }
    return true;
  }

  function fuzzyWord(cand, token) {
    if (cand.length < 4 || token.length < 4) return false;
    const min = Math.max(4, token.length - 1);
    const max = Math.min(cand.length, token.length + 1);
    for (let len = min; len <= max; len++) {
      if (withinOneEdit(cand.slice(0, len), token)) return true;
    }
    return false;
  }

  // 2 — точное вхождение, 1 — основа/окончание, 0.5 — опечатка
  function tokenScore(token, text, tokens) {
    if (text.indexOf(token) !== -1) return 2;
    if (token.length < 4) return 0;

    const stem = stemRu(token);
    if (stem.length >= 4 && text.indexOf(stem) !== -1) return 1;

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      if (w.length < 4) continue;
      if (w.indexOf(stem) === 0 || stem.indexOf(w) === 0) return 1;

      const ws = stemRu(w);
      if (ws.length >= 4 && (ws.indexOf(stem) === 0 || stem.indexOf(ws) === 0)) return 1;

      if (fuzzyWord(w, token)) return 0.5;
      if (fuzzyWord(ws, stem)) return 0.5;
    }
    return 0;
  }

  function matchScore(entry, query) {
    const q = normalizeQuery(query);
    if (!q) return 2;
    const qLoose = stripTones(q).replace(/\s+/g, '');
    const fields = [entry.zh, entry.ru, entry.note, entry.py].concat(entry.tags);
    const hit = fields.some(f => {
      const value = normalizeQuery(f);
      if (!value) return false;
      if (value.indexOf(q) !== -1) return true;
      return stripTones(value).replace(/\s+/g, '').indexOf(qLoose) !== -1;
    });
    if (hit) return 2;

    // Поиск по инициалам пиньиня: nh -> 你好, zg -> 这个
    if (/^[a-z]+$/.test(qLoose) && qLoose.length >= 2) {
      const initials = pinyinInitials(entry.py || makePinyin(entry.zh));
      if (initials.indexOf(qLoose) === 0) return 2;
    }

    // Русские слова: без окончаний и с опечатками
    const qTokens = wordTokens(q).filter(function (t) { return /[а-я]/.test(t); });
    if (qTokens.length) {
      const ruText = [entry.ru, entry.note, entry.tags.join(' ')].join(' ');
      const ruTokens = wordTokens(ruText);
      let score = 2;
      for (let i = 0; i < qTokens.length; i++) {
        const t = qTokens[i];
        if (t.length <= 2) continue;
        const s = tokenScore(t, normalizeQuery(ruText), ruTokens);
        if (!s) { score = 0; break; }
        if (s < score) score = s;
      }
      if (score) return score;
    }

    return 0;
  }

  function matches(entry, query) {
    return matchScore(entry, query) > 0;
  }

  function fieldScore(field, q) {
    const v = normalizeQuery(field);
    if (!v) return 0;
    if (v === q) return 100;
    const tokens = wordTokens(v);
    if (tokens.indexOf(q) !== -1) return 95;
    if (tokens.some(function (w) { return w.indexOf(q) === 0; })) return 90;
    if (v.indexOf(q) === 0) return 88;
    if (v.indexOf(q) !== -1) return 80;
    return 0;
  }

  function tokenScorePct(token, text, tokens) {
    if (text.indexOf(token) !== -1) return 95;
    if (token.length < 4) return 0;

    const stem = stemRu(token);
    if (stem.length >= 4 && text.indexOf(stem) !== -1) return 65;

    for (let i = 0; i < tokens.length; i++) {
      const w = tokens[i];
      if (w.length < 4) continue;
      if (w.indexOf(stem) === 0 || stem.indexOf(w) === 0) return 65;

      const ws = stemRu(w);
      if (ws.length >= 4 && (ws.indexOf(stem) === 0 || stem.indexOf(ws) === 0)) return 65;

      if (fuzzyWord(w, token)) return 45;
      if (fuzzyWord(ws, stem)) return 45;
    }
    return 0;
  }

  function entryRelevance(entry, q) {
    let best = 0;
    [entry.zh, entry.ru, entry.note, entry.py].forEach(function (f) {
      const s = fieldScore(f, q);
      if (s > best) best = s;
    });

    const qLoose = stripTones(q).replace(/\s+/g, '');
    const pyLoose = stripTones(entry.py || '').replace(/\s+/g, '');
    if (pyLoose && qLoose) {
      if (pyLoose === qLoose) best = Math.max(best, 100);
      else if (pyLoose.indexOf(qLoose) === 0) best = Math.max(best, 90);
      else if (pyLoose.indexOf(qLoose) !== -1) best = Math.max(best, 80);
    }

    if (/^[a-z]+$/.test(qLoose) && qLoose.length >= 2) {
      const initials = pinyinInitials(entry.py || makePinyin(entry.zh));
      if (initials.indexOf(qLoose) === 0) best = Math.max(best, 75);
    }

    const qTokens = wordTokens(q).filter(function (t) { return /[а-я]/.test(t); });
    if (qTokens.length) {
      const ruText = [entry.ru, entry.note].join(' ');
      const ruTokens = wordTokens(ruText);
      let min = 100;
      let matched = true;
      for (let i = 0; i < qTokens.length; i++) {
        const t = qTokens[i];
        if (t.length <= 2) continue;
        const s = tokenScorePct(t, normalizeQuery(ruText), ruTokens);
        if (!s) { matched = false; break; }
        if (s < min) min = s;
      }
      if (matched) best = Math.max(best, min);
    }

    return best;
  }

  function tagRelevance(tag, q) {
    const v = normalizeQuery(tag);
    if (!v) return 0;
    if (v === q) return 100;
    if (v.indexOf(q) === 0) return 90;
    if (v.indexOf(q) !== -1) return 80;

    const qTokens = wordTokens(q).filter(function (t) { return /[а-я]/.test(t); });
    if (qTokens.length) {
      const tokens = wordTokens(v);
      let min = 100;
      let matched = true;
      for (let i = 0; i < qTokens.length; i++) {
        const t = qTokens[i];
        if (t.length <= 2) continue;
        const s = tokenScorePct(t, normalizeQuery(v), tokens);
        if (!s) { matched = false; break; }
        if (s < min) min = s;
      }
      if (matched) return Math.min(90, min);
    }
    return 0;
  }

  function searchPhraseResults(query, includeAll) {
    const q = normalizeQuery(query);
    if (!q) return [];

    const scored = [];
    db.entries.forEach(function (e) {
      const score = entryRelevance(e, q);
      if (score > 0) scored.push({ entry: e, score: score });
    });
    scored.sort(function (a, b) {
      return b.score - a.score || b.entry.ts - a.entry.ts;
    });

    if (!includeAll && scored.length) {
      const best = scored[0].score;
      const threshold = best >= 60 ? 60 : 0;
      return scored.filter(function (x) { return x.score >= threshold; });
    }
    return scored;
  }

  function searchTagResults(query, includeAll) {
    const q = normalizeQuery(query);
    if (!q) return [];
    const list = [];
    tagStats().forEach(function (t) {
      const score = tagRelevance(t.name, q);
      if (score > 0) list.push({ name: t.name, count: t.count, score: score });
    });
    list.sort(function (a, b) {
      return b.score - a.score || b.count - a.count || a.name.localeCompare(b.name, 'ru');
    });
    if (!includeAll && list.length) {
      const best = list[0].score;
      return list.filter(function (x) { return best >= 60 ? x.score >= 60 : true; });
    }
    return list;
  }

  function searchEntries(query) {
    return searchPhraseResults(query, false).map(function (x) { return x.entry; });
  }

  // Нормализация для сравнения: без регистра, пробелов, знаков и ё/е.
  function normKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function findExactDup(zh, ru, excludeId) {
    const z = normKey(zh);
    const r = normKey(ru);
    if (!z && !r) return null;
    return db.entries.find(function (e) {
      return e.id !== excludeId && normKey(e.zh) === z && normKey(e.ru) === r;
    }) || null;
  }

  function findSimilar(zh, ru, excludeId) {
    const z = normKey(zh);
    const r = normKey(ru);
    if (!z && !r) return [];
    return db.entries.filter(function (e) {
      if (e.id === excludeId) return false;
      return (!!z && normKey(e.zh) === z) || (!!r && normKey(e.ru) === r);
    });
  }

  function buildDuplicateGroups() {
    const exactMap = new Map();
    const zhMap = new Map();
    const ruMap = new Map();

    db.entries.forEach(function (e) {
      const z = normKey(e.zh);
      const r = normKey(e.ru);
      if (z || r) {
        const key = z + '|' + r;
        if (!exactMap.has(key)) exactMap.set(key, []);
        exactMap.get(key).push(e);
      }
      if (z) {
        if (!zhMap.has(z)) zhMap.set(z, []);
        zhMap.get(z).push(e);
      }
      if (r) {
        if (!ruMap.has(r)) ruMap.set(r, []);
        ruMap.get(r).push(e);
      }
    });

    const exact = Array.from(exactMap.entries()).filter(function (g) { return g[1].length > 1; });
    exact.sort(function (a, b) { return b[1].length - a[1].length || b[0].length - a[0].length; });

    const similar = [];
    const seen = new Set();

    function addSimilar(kind, list) {
      if (list.length < 2) return;
      const zs = new Set(list.map(function (e) { return normKey(e.zh); }));
      const rs = new Set(list.map(function (e) { return normKey(e.ru); }));
      if (zs.size === 1 && rs.size === 1) return; // это точный дубликат
      const sig = list.map(function (e) { return e.id; }).sort().join(',');
      if (seen.has(sig)) return;
      seen.add(sig);
      similar.push({ kind: kind, list: list });
    }

    zhMap.forEach(function (list) { addSimilar('zh', list); });
    ruMap.forEach(function (list) { addSimilar('ru', list); });
    similar.sort(function (a, b) { return b.list.length - a.list.length; });

    return { exact: exact, similar: similar };
  }

  /* ───────────────────────── Тема ───────────────────────── */

  function resolvedTheme() {
    const s = db.settings.theme || 'system';
    if (s === 'light' || s === 'dark') return s;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const theme = resolvedTheme();
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0d1115' : '#fbfaf7');
  }

  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', () => { if ((db.settings.theme || 'system') === 'system') applyTheme(); });
  }

  /* ───────────────────────── Озвучка ───────────────────────── */

  let voicesCache = [];

  function refreshVoices() {
    if (!('speechSynthesis' in window)) return;
    voicesCache = window.speechSynthesis.getVoices() || [];
  }

  function zhVoices() {
    if (!voicesCache.length) refreshVoices();
    return voicesCache.filter(v => /^zh/i.test(v.lang));
  }

  function speak(text, btn) {
    if (!text) return;
    if (!('speechSynthesis' in window)) {
      toast('Озвучка не поддерживается браузером');
      return;
    }
    const synth = window.speechSynthesis;
    synth.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = Number(db.settings.rate) || 0.9;

    const list = zhVoices();
    let voice = null;
    if (db.settings.voice) voice = list.find(v => v.voiceURI === db.settings.voice);
    if (!voice) voice = list.find(v => /zh[-_]CN/i.test(v.lang)) || list[0] || null;
    if (voice) u.voice = voice;

    if (btn) btn.classList.add('is-speaking');
    const done = () => { if (btn) btn.classList.remove('is-speaking'); };
    u.onend = done;
    u.onerror = done;

    if (!list.length) {
      toast('Нет китайского голоса. Установите его в настройках Android: Язык и ввод → Синтез речи');
    }
    synth.speak(u);
  }

  /* ───────────────────────── Диктовка ───────────────────────── */

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let activeRec = null;

  function dictate(lang, input, btn) {
    if (!SpeechRec) {
      toast('Диктовка не поддерживается — нужен Chrome');
      return;
    }
    if (activeRec) {
      try { activeRec.abort(); } catch (e) { /* ignore */ }
      activeRec = null;
    }
    const rec = new SpeechRec();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    activeRec = rec;
    if (btn) btn.classList.add('is-live');

    rec.onresult = function (ev) {
      const text = (ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript || '').trim();
      if (!text) return;
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = function (ev) {
      const map = {
        'not-allowed': 'Разрешите доступ к микрофону',
        'service-not-allowed': 'Разрешите доступ к микрофону',
        'no-speech': 'Ничего не расслышал',
        'network': 'Диктовка работает только с интернетом',
        'audio-capture': 'Микрофон недоступен'
      };
      toast(map[ev.error] || 'Не удалось распознать речь');
    };
    rec.onend = function () {
      if (btn) btn.classList.remove('is-live');
      if (activeRec === rec) activeRec = null;
    };
    try {
      rec.start();
    } catch (err) {
      toast('Не удалось запустить диктовку');
      if (btn) btn.classList.remove('is-live');
    }
  }

  /* ───────────────────────── Состояние и роутер ───────────────────────── */

  const state = {
    view: 'tags',
    tag: null,
    query: '',
    onlyFav: false,
    onlyNotes: false,
    searchAll: false,
    topicId: null
  };

  let selectionMode = false;
  let selectedIds = new Set();
  let sheetOpen = false;
  let closingByUI = false;
  let deferredPrompt = null;

  function go(view, opts, push) {
    opts = opts || {};
    const hadSheet = sheetOpen;
    if (selectionMode) { selectionMode = false; selectedIds.clear(); }
    state.onlyFav = false;
    state.onlyNotes = false;
    state.view = view;
    if ('tag' in opts) state.tag = opts.tag;
    if ('query' in opts) state.query = opts.query;
    if ('topicId' in opts) state.topicId = opts.topicId;
    if (view === 'search') state.searchAll = false;
    if (hadSheet) closeSheet(false);
    if (push !== false) {
      const next = { view: state.view, tag: state.tag, query: state.query, topicId: state.topicId };
      if (hadSheet) history.replaceState(next, '');
      else history.pushState(next, '');
    }
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  window.addEventListener('popstate', function (ev) {
    if (closingByUI) { closingByUI = false; return; }
    if (sheetOpen) {
      closeSheet(false);
      history.pushState({ view: state.view, tag: state.tag, query: state.query }, '');
      return;
    }
    const s = ev.state || { view: 'tags', tag: null, query: '' };
    if (selectionMode) { selectionMode = false; selectedIds.clear(); }
    state.onlyFav = false;
    state.onlyNotes = false;
    state.view = s.view || 'tags';
    state.tag = s.tag || null;
    state.query = s.query || '';
    state.topicId = s.topicId || null;
    render();
  });

  /* ───────────────────────── Рендер: каркас ───────────────────────── */

  const app = $('#app');
  const topbar = $('#topbar');
  const sheetRoot = $('#sheet-root');

  function render() {
    document.body.classList.toggle('selecting', selectionMode && (state.view === 'tag' || state.view === 'favorites'));
    renderTopbar();
    renderTabs();
    if (state.view === 'tags') {
      app.innerHTML = pageTags();
    } else if (state.view === 'tag') {
      app.innerHTML = pageTag();
    } else if (state.view === 'favorites') {
      app.innerHTML = pageFavorites();
    } else if (state.view === 'topics') {
      app.innerHTML = pageTopics();
    } else if (state.view === 'topic') {
      app.innerHTML = pageTopic();
    } else if (state.view === 'topics') {
      const count = (db.topics || []).length;
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="topbar-title">Топики</div>' +
            '<div class="topbar-sub">' + count + ' ' + plural(count, 'текст', 'текста', 'текстов') + '</div>' +
          '</div>' +
          '<button class="icon-btn" data-act="new-topic" aria-label="Добавить топик">' + ICONS.plus + '</button>' +
        '</div>';
    } else if (state.view === 'topic') {
      const t = topicById(state.topicId);
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">' + esc(t ? topicTitle(t) : 'Топик') + '</div>' +
        '</div>';
    } else if (state.view === 'search') {
      app.innerHTML = pageSearch();
      bindSearch();
    } else if (state.view === 'settings') {
      app.innerHTML = pageSettings();
      bindSettings();
    } else if (state.view === 'history') {
      app.innerHTML = pageHistory();
    } else if (state.view === 'duplicates') {
      app.innerHTML = pageDuplicates();
    } else if (state.view === 'tagmanager') {
      app.innerHTML = pageTagManager();
    }
    renderSelectionBar();
  }

  function currentSelectionList() {
    if (state.view === 'tag' && state.tag) return tagList(state.tag);
    if (state.view === 'favorites') return favoritesList();
    return [];
  }

  function renderSelectionBar() {
    const bar = $('#selection-bar');
    if (!bar) return;
    const active = selectionMode && (state.view === 'tag' || state.view === 'favorites');
    bar.hidden = !active;
    if (!active) return;

    const list = currentSelectionList();
    const allSelected = list.length > 0 && selectedIds.size === list.length;

    const all = $('[data-act="select-all"]', bar);
    if (all) all.textContent = allSelected ? 'Снять все' : 'Выбрать все';

    const del = $('[data-act="delete-selected"]', bar);
    if (del) {
      del.textContent = selectedIds.size ? 'Удалить (' + selectedIds.size + ')' : 'Удалить';
      del.disabled = selectedIds.size === 0;
    }
  }

  function renderTopbar() {
    if (state.view === 'tags') {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<div class="brand">' +
            '<div class="brand-title">Словарик</div>' +
            '<div class="brand-sub">RU ↔ 中文 · офлайн</div>' +
          '</div>' +
          '<button class="icon-btn" data-act="settings" aria-label="Настройки">' + ICONS.gear + '</button>' +
        '</div>' +
        '<button class="search-pill" data-act="search">' +
          '<span class="ico">' + ICONS.search + '</span><span>Найти слово, фразу или тег…</span>' +
        '</button>';
    } else if (state.view === 'tag') {
      const total = db.entries.filter(e => e.tags.indexOf(state.tag) !== -1).length;
      const list = tagList(state.tag);
      const subText = ((state.onlyFav || state.onlyNotes) && list.length !== total)
        ? list.length + ' из ' + total
        : list.length + ' ' + plural(list.length, 'фраза', 'фразы', 'фраз');

      if (selectionMode) {
        topbar.innerHTML =
          '<div class="topbar-row">' +
            '<button class="icon-btn" data-act="exit-selection" aria-label="Выйти из выбора">✕</button>' +
            '<div style="min-width:0;flex:1">' +
              '<div class="topbar-title">Выбрано: ' + selectedIds.size + '</div>' +
              '<div class="topbar-sub">' + esc(state.tag || '') + '</div>' +
            '</div>' +
            '<button class="text-btn" data-act="exit-selection">Готово</button>' +
          '</div>';
      } else {
        topbar.innerHTML =
          '<div class="topbar-row">' +
            '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
            '<div style="min-width:0;flex:1">' +
              '<div class="topbar-title">' + esc(state.tag || '') + '</div>' +
              '<div class="topbar-sub">' + subText + '</div>' +
            '</div>' +
            '<button class="text-btn" data-act="select-mode">Выбрать</button>' +
            '<button class="icon-btn" data-act="settings" aria-label="Настройки">' + ICONS.gear + '</button>' +
          '</div>';
      }
    } else if (state.view === 'favorites') {
      const list = favoritesList();
      const favSub = list.length + ' ' + plural(list.length, 'фраза', 'фразы', 'фраз');

      if (selectionMode) {
        topbar.innerHTML =
          '<div class="topbar-row">' +
            '<button class="icon-btn" data-act="exit-selection" aria-label="Выйти из выбора">✕</button>' +
            '<div style="min-width:0;flex:1">' +
              '<div class="topbar-title">Выбрано: ' + selectedIds.size + '</div>' +
              '<div class="topbar-sub">Избранное</div>' +
            '</div>' +
            '<button class="text-btn" data-act="exit-selection">Готово</button>' +
          '</div>';
      } else {
        topbar.innerHTML =
          '<div class="topbar-row">' +
            '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
            '<div style="min-width:0;flex:1">' +
              '<div class="topbar-title">Избранное</div>' +
              '<div class="topbar-sub">' + favSub + '</div>' +
            '</div>' +
            '<button class="text-btn" data-act="select-mode">Выбрать</button>' +
            '<button class="icon-btn" data-act="settings" aria-label="Настройки">' + ICONS.gear + '</button>' +
          '</div>';
      }
    } else if (state.view === 'topics') {
      const count = (db.topics || []).length;
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="topbar-title">Топики</div>' +
            '<div class="topbar-sub">' + count + ' ' + plural(count, 'текст', 'текста', 'текстов') + '</div>' +
          '</div>' +
          '<button class="icon-btn" data-act="new-topic" aria-label="Добавить топик">' + ICONS.plus + '</button>' +
        '</div>';
    } else if (state.view === 'topic') {
      const t = topicById(state.topicId);
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">' + esc(t ? topicTitle(t) : 'Топик') + '</div>' +
        '</div>';
    } else if (state.view === 'search') {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">Поиск</div>' +
          '<button class="icon-btn" data-act="settings" aria-label="Настройки">' + ICONS.gear + '</button>' +
        '</div>';
    } else if (state.view === 'history') {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">История</div>' +
        '</div>';
    } else if (state.view === 'duplicates') {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">Дубликаты</div>' +
        '</div>';
    } else if (state.view === 'tagmanager') {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">Теги</div>' +
        '</div>';
    } else {
      topbar.innerHTML =
        '<div class="topbar-row">' +
          '<button class="icon-btn" data-act="back" aria-label="Назад">' + ICONS.back + '</button>' +
          '<div class="topbar-title">Ещё</div>' +
        '</div>';
    }
  }

  function renderTabs() {
    const active = state.view === 'tags' || state.view === 'tag' || state.view === 'favorites' ? 'tags'
      : state.view === 'topics' || state.view === 'topic' ? 'topics'
      : state.view === 'search' ? 'search'
      : 'settings';
    $$('#tabbar .tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === active);
    });
  }

  /* ───────────────────────── Рендер: страницы ───────────────────────── */

  function pageTags() {
    const tags = tagStats();
    const installCard = !isStandalone()
      ? '<button class="install-card" data-act="install-or-help">' +
          '<span class="install-card-ico">' + ICONS.install + '</span>' +
          '<span class="fav-card-main">' +
            '<span class="fav-card-title">Открыть без адресной строки</span>' +
            '<span class="fav-card-sub">Установите приложение — полный экран и иконка</span>' +
          '</span>' +
          '<span class="fav-card-chev">›</span>' +
        '</button>'
      : '';

    if (!tags.length) {
      return installCard + emptyState('词', 'Словарь пуст', 'Нажмите «+», чтобы добавить первую фразу. Тег можно создать прямо в форме.');
    }

    const favCount = db.entries.filter(e => e.fav).length;
    return installCard +
      '<button class="fav-card" data-act="open-favorites">' +
        '<span class="fav-card-ico">' + ICONS.star + '</span>' +
        '<span class="fav-card-main">' +
          '<span class="fav-card-title">Избранное</span>' +
          '<span class="fav-card-sub">' + (favCount ? favCount + ' ' + plural(favCount, 'фраза', 'фразы', 'фраз') : 'Отмечайте ★ на фразах') + '</span>' +
        '</span>' +
        '<span class="fav-card-chev">›</span>' +
      '</button>' +
      '<div class="section-head"><h2>Ситуации</h2>' +
        '<span class="count">' + tags.length + ' · ' + db.entries.length + ' ' + plural(db.entries.length, 'фраза', 'фразы', 'фраз') + '</span>' +
      '</div>' +
      '<div class="tag-grid">' + tags.map(tagCard).join('') + '</div>';
  }

  function tagCard(t) {
    const pinned = (db.pinnedTags || []).indexOf(t.name) !== -1;
    return '<button class="tag-card' + (pinned ? ' is-pinned' : '') + '" data-act="open-tag" data-tag="' + esc(t.name) + '">' +
      (pinned ? '<span class="tag-pin" aria-hidden="true">' + ICONS.pin + '</span>' : '') +
      '<span class="tag-dot" style="--h:' + hue(t.name) + '"></span>' +
      '<span class="tag-name">' + esc(t.name) + '</span>' +
      '<span class="tag-count">' + t.count + ' ' + plural(t.count, 'фраза', 'фразы', 'фраз') + '</span>' +
    '</button>';
  }

  function sortedEntries(list) {
    const sort = db.settings.sort || 'new';
    const arr = list.slice();
    if (sort === 'old') {
      arr.sort(function (a, b) { return a.ts - b.ts; });
    } else if (sort === 'ru') {
      arr.sort(function (a, b) { return (a.ru || '').localeCompare(b.ru || '', 'ru'); });
    } else if (sort === 'zh') {
      arr.sort(function (a, b) {
        return stripTones(a.py || '').localeCompare(stripTones(b.py || ''));
      });
    } else {
      arr.sort(function (a, b) { return b.ts - a.ts; });
    }
    return arr;
  }

  function tagList(tag) {
    let list = db.entries.filter(function (e) { return e.tags.indexOf(tag) !== -1; });
    if (state.onlyFav) list = list.filter(function (e) { return e.fav; });
    if (state.onlyNotes) list = list.filter(function (e) { return !!e.note; });
    return sortedEntries(list);
  }

  function favoritesList() {
    return sortedEntries(db.entries.filter(function (e) { return e.fav; }));
  }

  function sortSelect() {
    const sort = db.settings.sort || 'new';
    const opts = [
      ['new', 'Сначала новые'],
      ['old', 'Сначала старые'],
      ['ru', 'По-русски (А–Я)'],
      ['zh', 'По пиньиню (A–Z)']
    ];
    return '<select class="sort-select" data-act="sort" aria-label="Сортировка">' +
      opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>';
  }

  function listToolbar(showFavFilter) {
    return '<div class="list-toolbar">' +
      sortSelect() +
      (showFavFilter
        ? '<button class="filter-chip' + (state.onlyFav ? ' is-on' : '') + '" type="button" data-act="toggle-only-fav">★ Избранные</button>' +
          '<button class="filter-chip' + (state.onlyNotes ? ' is-on' : '') + '" type="button" data-act="toggle-only-notes">✎ Заметки</button>'
        : '') +
    '</div>';
  }

  function pageFavorites() {
    const list = favoritesList();
    if (!list.length) {
      return emptyState('★', 'В избранном пусто', 'Нажмите звёздочку на фразе — она появится здесь.');
    }
    return listToolbar(false) +
      '<div class="phrase-list">' + list.map(e => entryCard(e, null, '', selectionMode)).join('') + '</div>';
  }

  function pageTopics() {
    const list = (db.topics || []).slice().sort(function (a, b) { return b.updated - a.updated; });
    if (!list.length) {
      return emptyState('📄', 'Пока нет топиков',
        'Добавьте диалог или текст: китайский и перевод. Пиньинь появится автоматически.',
        '<button class="btn btn-primary" data-act="new-topic" style="margin-top:16px">Добавить топик</button>');
    }

    return '<div class="topic-list">' + list.map(function (t) {
      const lines = (t.zh || '').split('\n').filter(function (l) { return l.trim(); }).length;
      return '<button class="card topic-card" data-act="open-topic" data-id="' + esc(t.id) + '">' +
        '<div class="topic-card-main">' +
          '<div class="topic-title">' + esc(topicTitle(t)) + '</div>' +
          '<div class="topic-preview">' + esc(topicPreview(t)) + '</div>' +
          '<div class="topic-meta">' + formatDateTime(t.updated) + ' · ' + lines + ' ' + plural(lines, 'строка', 'строки', 'строк') + '</div>' +
        '</div>' +
        '<span class="row-chev">›</span>' +
      '</button>';
    }).join('') + '</div>';
  }

  function pageTopic() {
    const t = topicById(state.topicId);
    if (!t) {
      return emptyState('📄', 'Топик не найден', 'Вернитесь к списку топиков.',
        '<button class="btn btn-ghost" data-act="back" style="margin-top:16px">К списку</button>');
    }

    const py = t.py || makePinyinText(t.zh);
    return '<div class="topic-detail">' +
      '<div class="topic-actions">' +
        (t.zh ? '<button class="btn btn-primary" data-act="speak-topic" data-id="' + esc(t.id) + '">' + ICONS.speaker + ' Слушать</button>' : '') +
        '<button class="btn btn-ghost" data-act="edit-topic" data-id="' + esc(t.id) + '">Изменить</button>' +
      '</div>' +
      (t.zh ? '<div class="topic-block"><div class="topic-label">中文</div><div class="topic-zh">' + esc(t.zh) + '</div></div>' : '') +
      (py ? '<div class="topic-block"><div class="topic-label">Пиньинь</div><div class="topic-py">' + esc(py) + '</div></div>' : '') +
      (t.ru ? '<div class="topic-block"><div class="topic-label">Перевод</div><div class="topic-ru">' + esc(t.ru) + '</div></div>' : '') +
      '<button class="btn btn-danger" data-act="delete-topic" data-id="' + esc(t.id) + '">Удалить топик</button>' +
    '</div>';
  }

  let editingTopicId = null;

  function openTopicSheet(topicId) {
    const t = topicId ? topicById(topicId) : null;
    editingTopicId = t ? t.id : null;

    openSheet(
      '<div class="sheet-head"><div class="sheet-title">' + (t ? 'Топик' : 'Новый топик') + '</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<div class="field">' +
          '<label for="topic-title">Название</label>' +
          '<input class="input" id="topic-title" placeholder="Например: В кафе" autocomplete="off" value="' + esc(t ? t.title || '' : '') + '">' +
        '</div>' +
        '<div class="field">' +
          '<label for="topic-zh">Китайский текст или диалог</label>' +
          '<textarea class="textarea input-zh" id="topic-zh" rows="7" style="min-height:150px" placeholder="你好！&#10;你好吗？">' + esc(t ? t.zh : '') + '</textarea>' +
        '</div>' +
        '<div class="field">' +
          '<label for="topic-ru">Русский перевод</label>' +
          '<textarea class="textarea" id="topic-ru" rows="6" style="min-height:110px" placeholder="Привет!">' + esc(t ? t.ru : '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
        (t
          ? '<button class="btn btn-danger" data-act="delete-topic" data-id="' + esc(t.id) + '">Удалить</button>'
          : '<button class="btn btn-ghost" data-act="close-sheet">Отмена</button>') +
        '<button class="btn btn-primary" data-act="save-topic">Сохранить</button>' +
      '</div>'
    );

    const zh = $('#topic-zh');

    if (zh) {
      setTimeout(function () {
        const el = t ? zh : $('#topic-title');
        if (el) el.focus();
      }, 200);
    }
  }

  function saveTopicFromSheet() {
    const title = $('#topic-title') ? $('#topic-title').value.trim() : '';
    const zh = $('#topic-zh') ? $('#topic-zh').value.trim() : '';
    const ru = $('#topic-ru') ? $('#topic-ru').value.trim() : '';
    if (!zh && !ru) { toast('Добавьте текст или перевод'); return; }

    const py = makePinyinText(zh);
    const wasEdit = !!editingTopicId;

    if (wasEdit) {
      const t = topicById(editingTopicId);
      if (t) {
        t.title = title;
        t.zh = zh;
        t.ru = ru;
        t.py = py;
        t.updated = Date.now();
      }
    } else {
      db.topics = db.topics || [];
      db.topics.unshift(makeTopic({ title: title, zh: zh, ru: ru, py: py }));
    }

    editingTopicId = null;
    saveDB();
    closeSheet(true);
    render();
    toast(wasEdit ? 'Сохранено' : 'Топик добавлен');
  }

  function deleteTopic(id) {
    const t = topicById(id);
    if (!t) return;
    if (!confirm('Удалить топик «' + topicTitle(t) + '»?')) return;

    db.topics = (db.topics || []).filter(function (x) { return x.id !== id; });
    saveDB();
    if (state.view === 'topic' && state.topicId === id) {
      state.view = 'topics';
      state.topicId = null;
    }
    closeSheet(true);
    render();
    toast('Топик удалён');
  }

  function pageTag() {
    const tag = state.tag;
    const all = db.entries.filter(e => e.tags.indexOf(tag) !== -1);
    if (!all.length) {
      return emptyState('🗂', 'В этом теге пусто', 'Добавьте фразу — она сразу появится здесь.');
    }

    const list = tagList(tag);
    if (!list.length) {
      return listToolbar(true) + emptyState('★', 'Ничего не найдено',
        'В этом теге нет фраз по выбранным фильтрам.',
        '<button class="btn btn-ghost" data-act="reset-filters" style="margin-top:16px">Сбросить фильтры</button>');
    }

    return listToolbar(true) +
      '<div class="phrase-list">' + list.map(e => entryCard(e, tag, '', selectionMode)).join('') + '</div>';
  }

  function entryCard(entry, activeTag, query, selectable, score) {
    const visibleTags = activeTag ? entry.tags.filter(t => t !== activeTag) : entry.tags;
    const tags = visibleTags.slice(0, 4).map(t =>
      '<span class="tag-mini' + (t === activeTag ? ' is-accent' : '') + '">' + esc(t) + '</span>'
    ).join('');
    const py = entry.py || makePinyin(entry.zh);
    const selected = !!selectable && selectedIds.has(entry.id);
    return '<article class="phrase' + (selected ? ' is-selected' : '') + '"' +
      (selectable ? ' data-act="toggle-select" data-id="' + esc(entry.id) + '"' : '') + '>' +
      (selectable ? '<span class="pick' + (selected ? ' is-on' : '') + '" aria-hidden="true"></span>' : '') +
      '<div class="phrase-main"' + (selectable ? '' : ' data-act="edit" data-id="' + esc(entry.id) + '"') + '>' +
        '<div class="phrase-zh">' + highlight(entry.zh, query) +
          (score ? ' <span class="match-badge">' + Math.round(score) + '%</span>' : '') +
        '</div>' +
        (py ? '<div class="phrase-py">' + highlight(py, query) + '</div>' : '') +
        (entry.ru ? '<div class="phrase-ru">' + highlight(entry.ru, query) + '</div>' : '') +
        (entry.note ? '<div class="phrase-note">' + esc(entry.note) + '</div>' : '') +
        (tags ? '<div class="phrase-tags">' + tags + '</div>' : '') +
      '</div>' +
      (!selectable ? '<div class="phrase-actions">' +
        '<button class="star-btn' + (entry.fav ? ' is-on' : '') + '" data-act="toggle-fav" data-id="' + esc(entry.id) + '" aria-label="' + (entry.fav ? 'Убрать из избранного' : 'В избранное') + '">' + ICONS.star + '</button>' +
        (entry.zh ? '<button class="speak" data-act="speak" data-id="' + esc(entry.id) + '" aria-label="Озвучить по-китайски">' + ICONS.speaker + '</button>' : '') +
      '</div>' : '') +
    '</article>';
  }

  function highlight(text, query) {
    const safe = esc(text);
    const q = String(query || '').trim();
    if (!q) return safe;
    const pattern = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return safe.replace(new RegExp('(' + pattern + ')', 'ig'), '<mark>$1</mark>');
    } catch (err) {
      return safe;
    }
  }

  function pageSearch() {
    return '' +
      '<div class="search-box">' +
        '<input class="search-input" id="search-input" type="search" inputmode="search" enterkeyhint="search" ' +
          'placeholder="Слово, фраза, пиньинь или тег" autocomplete="off" value="' + esc(state.query) + '">' +
        '<button class="search-clear' + (state.query ? '' : ' hidden') + '" data-act="clear-search" aria-label="Очистить">✕</button>' +
      '</div>' +
      '<p class="search-hint">Сначала точные совпадения, потом похожие. Русский — с опечатками и без окончаний; также по-китайски, пиньинем и тегом.</p>' +
      '<div id="search-results"></div>';
  }

  function tagChip(t, score) {
    return '<button class="tag-chip-btn" data-act="open-tag" data-tag="' + esc(t.name) + '">' +
      esc(t.name) +
      ' <span class="tag-chip-count">' + t.count + '</span>' +
      (score ? ' <span class="match-badge">' + Math.round(score) + '%</span>' : '') +
    '</button>';
  }

  function phraseResultsHtml(list, q) {
    return '<div class="phrase-list">' +
      list.map(function (x) { return entryCard(x.entry, null, q, false, x.score); }).join('') +
    '</div>';
  }

  function renderSearchResults() {
    const box = $('#search-results');
    if (!box) return;
    const q = state.query.trim();

    if (!q) {
      const tags = tagStats();
      box.innerHTML =
        '<div class="section-head"><h2>Теги</h2><span class="count">' + tags.length + '</span></div>' +
        '<div class="tag-suggest">' + tags.map(function (t) { return tagChip(t, 0); }).join('') + '</div>';
      return;
    }

    const phraseAll = searchPhraseResults(q, true);
    const tagAll = searchTagResults(q, true);
    const total = phraseAll.length + tagAll.length;

    if (!total) {
      box.innerHTML = emptyState('🔍', 'Ничего не найдено',
        'Проверьте написание или добавьте новую фразу — она сохранится в словаре.',
        '<button class="btn btn-primary" data-act="add-from-query" style="margin-top:18px;padding-left:24px;padding-right:24px">Добавить «' + esc(q) + '»</button>');
      return;
    }

    let html = '';

    if (state.searchAll) {
      html += '<div class="search-view-head">' +
        '<button class="link-btn" data-act="search-quick">‹ Быстрые группы</button>' +
        '<span class="search-count">Все совпадения: ' + total + '</span>' +
      '</div>';

      if (phraseAll.length) {
        html += '<div class="section-head"><h2>Слова</h2><span class="count">' + phraseAll.length + '</span></div>' +
          phraseResultsHtml(phraseAll, q);
      }
      if (tagAll.length) {
        html += '<div class="section-head"><h2>Теги</h2><span class="count">' + tagAll.length + '</span></div>' +
          '<div class="tag-suggest">' + tagAll.map(function (t) { return tagChip(t, t.score); }).join('') + '</div>';
      }
    } else {
      const phrases = searchPhraseResults(q, false).slice(0, 3);
      const tags = searchTagResults(q, false).slice(0, 3);

      if (phrases.length) {
        html += '<div class="section-head"><h2>Слова</h2><span class="count">' + phraseAll.length + '</span></div>' +
          phraseResultsHtml(phrases, q);
      }
      if (tags.length) {
        html += '<div class="section-head"><h2>Теги</h2><span class="count">' + tagAll.length + '</span></div>' +
          '<div class="tag-suggest">' + tags.map(function (t) { return tagChip(t, t.score); }).join('') + '</div>';
      }

      if (total > 0) {
        html += '<button class="btn btn-ghost search-all-btn" data-act="search-all">' +
          'Глобальный поиск: все совпадения (' + total + ')</button>';
      }
    }

    box.innerHTML = html;
  }

  function bindSearch() {
    const input = $('#search-input');
    if (!input) return;
    let searchTimer = null;
    input.addEventListener('input', function () {
      state.query = input.value;
      state.searchAll = false;
      const clear = $('.search-clear');
      if (clear) clear.classList.toggle('hidden', !input.value);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderSearchResults, 120);
    });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
    });
    renderSearchResults();
    if (state.view === 'search' && !state.query) {
      // не открываем клавиатуру автоматически — только при переходе с главной
    }
  }

  /* ───────────────────────── Яндекс Диск ───────────────────────── */

  function cloudStamp() {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      '_' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function cloudPayload(entries) {
    return JSON.stringify({
      app: 'slovar',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: entries || db.entries,
      settings: db.settings,
      removed: db.removed,
      pinnedTags: db.pinnedTags,
      topics: db.topics
    }, null, 2);
  }

  async function uploadToYandex(entries, manual) {
    if (!CLOUD_ENABLED) return false;
    if (cloudUploading) return false;
    const token = getYandexToken();
    if (!token) {
      if (manual) openCloudSheet();
      return false;
    }
    if (!(entries || db.entries).length && !(db.topics || []).length) {
      if (manual) toast('Словарь пуст — отправлять нечего');
      return false;
    }

    cloudUploading = true;
    const path = 'app:/slovar-backup-' + cloudStamp() + '.json';
    const body = cloudPayload(entries);

    try {
      const res = await fetch(
        'https://cloud-api.yandex.net/v1/disk/resources/upload?path=' + encodeURIComponent(path) + '&overwrite=true',
        { headers: { Authorization: 'OAuth ' + token, Accept: 'application/json' } }
      );
      if (!res.ok) {
        throw new Error(res.status === 401 ? 'Токен не подходит' : 'Яндекс Диск: ошибка ' + res.status);
      }
      const info = await res.json();
      if (!info || !info.href) throw new Error('Яндекс Диск не выдал ссылку на загрузку');

      const put = await fetch(info.href, { method: 'PUT', body: body });
      if (!put.ok) throw new Error('Загрузка: ошибка ' + put.status);

      db.settings.cloudLast = Date.now();
      db.settings.cloudFile = path;
      db.settings.cloudError = '';
      saveDB();
      if (!sheetOpen && state.view === 'settings') render();
      if (manual) toast('Копия отправлена в Яндекс Диск');
      return true;
    } catch (err) {
      db.settings.cloudError = String(err && err.message ? err.message : err);
      saveDB();
      if (!sheetOpen && state.view === 'settings') render();
      if (manual) toast('Не удалось отправить в облако');
      return false;
    } finally {
      cloudUploading = false;
    }
  }

  function maybeCloudBackup() {
    if (!CLOUD_ENABLED) return;
    if (db.settings.cloudAuto === false) return;
    if (!getYandexToken() || (!db.entries.length && !(db.topics || []).length) || cloudUploading) return;
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    if (db.settings.cloudLast && Date.now() - db.settings.cloudLast < WEEK) return;
    uploadToYandex(db.entries, false);
  }

  function openCloudSheet() {
    if (!CLOUD_ENABLED) return;
    const token = getYandexToken();
    if (!token) {
      openSheet(
        '<div class="sheet-head"><div class="sheet-title">Яндекс Диск</div>' +
          '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
        '<div class="sheet-body">' +
          '<p style="margin:0 0 12px;line-height:1.5">Копии словаря будут уходить в папку приложения на Яндекс Диске. Можно не подключать — тогда всё остаётся только на телефоне.</p>' +
          '<p style="margin:0 0 12px;line-height:1.5">Для подключения нужен OAuth-токен.</p>' +
          '<input class="input" type="password" id="cloud-token" placeholder="OAuth-токен" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<div class="search-hint" id="cloud-error" style="color:var(--danger);margin-top:10px"></div>' +
          '<button class="btn btn-ghost" data-act="cloud-help" style="width:100%;margin-top:12px">Как получить токен</button>' +
        '</div>' +
        '<div class="sheet-foot">' +
          '<button class="btn btn-ghost" data-act="close-sheet">Отмена</button>' +
          '<button class="btn btn-primary" data-act="cloud-connect">Подключить</button>' +
        '</div>'
      );
      setTimeout(function () { const i = $('#cloud-token'); if (i) i.focus(); }, 250);
      return;
    }

    const last = db.settings.cloudLast ? formatDateTime(db.settings.cloudLast) : 'ещё не отправлялась';
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Яндекс Диск</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<p style="margin:0 0 14px;line-height:1.5">Подключено. Последняя копия: <b>' + esc(last) + '</b>.</p>' +
        '<button class="btn btn-primary" data-act="cloud-upload" style="width:100%;margin-bottom:12px">Сохранить копию сейчас</button>' +
        '<label class="check-row"><input type="checkbox" data-act="cloud-auto"' + (db.settings.cloudAuto !== false ? ' checked' : '') + '> Автозагрузка раз в неделю</label>' +
        '<p class="search-hint" style="margin-top:8px">Копия уходит при открытии приложения, если прошла неделя.</p>' +
        (db.settings.cloudError ? '<p class="search-hint" style="color:var(--danger);margin-top:8px">' + esc(db.settings.cloudError) + '</p>' : '') +
        '<button class="btn btn-ghost" data-act="cloud-help" style="width:100%;margin-top:12px">Как это работает</button>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-danger" data-act="cloud-disconnect">Отключить</button>' +
        '<button class="btn btn-primary" data-act="close-sheet">Готово</button>' +
      '</div>'
    );
  }

  function openCloudHelp() {
    if (!CLOUD_ENABLED) return;
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Токен Яндекс Диска</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body" style="line-height:1.55">' +
        '<p style="margin:0 0 10px">1. Откройте <a href="https://oauth.yandex.com/client/new/" target="_blank" rel="noopener">oauth.yandex.com/client/new</a> и создайте приложение.</p>' +
        '<p style="margin:0 0 10px">2. Платформа — <b>Веб-сервисы</b>. Redirect URI: <code>https://oauth.yandex.ru/verification_code</code>.</p>' +
        '<p style="margin:0 0 10px">3. В доступах отметьте <b>«Доступ к папке приложения на Яндекс.Диске»</b> (<code>cloud_api:disk.app_folder</code>).</p>' +
        '<p style="margin:0 0 10px">4. Скопируйте <b>ClientID</b> и вставьте сюда:</p>' +
        '<input class="input" id="cloud-client" placeholder="ClientID" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button class="btn btn-ghost" data-act="cloud-open-auth" style="width:100%;margin-top:10px">Открыть страницу токена</button>' +
        '<p style="margin:14px 0 6px">5. Вставьте токен и подключите:</p>' +
        '<input class="input" type="password" id="cloud-token-help" placeholder="OAuth-токен" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<div class="search-hint" id="cloud-error-help" style="color:var(--danger);margin-top:8px"></div>' +
        '<p style="margin:12px 0 0;color:var(--muted);font-size:13.5px">После входа Яндекс покажет токен. Скопируйте его сюда. Токен хранится только на телефоне; отозвать его можно в Яндекс ID.</p>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-ghost" data-act="close-sheet">Понятно</button>' +
        '<button class="btn btn-primary" data-act="cloud-connect">Подключить</button>' +
      '</div>'
    );
  }

  async function connectYandex() {
    const input = $('#cloud-token') || $('#cloud-token-help');
    const error = $('#cloud-error') || $('#cloud-error-help');
    const btn = $('[data-act="cloud-connect"]');
    if (!input || !error) return;

    const token = input.value.trim();
    if (!token) { error.textContent = 'Вставьте токен'; return; }
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(
        'https://cloud-api.yandex.net/v1/disk/resources/upload?path=' +
          encodeURIComponent('app:/slovar-check.json') + '&overwrite=true',
        { headers: { Authorization: 'OAuth ' + token, Accept: 'application/json' } }
      );
      if (!res.ok) {
        if (res.status === 401) throw new Error('Токен не подошёл');
        if (res.status === 403) throw new Error('Нет доступа к папке приложения. Проверьте права токена.');
        throw new Error('Яндекс Диск: ошибка ' + res.status);
      }
    } catch (err) {
      error.textContent = String(err && err.message ? err.message : err);
      if (btn) btn.disabled = false;
      return;
    }

    setYandexToken(token);
    db.settings.cloudAuto = true;
    db.settings.cloudError = '';
    saveDB();
    closeSheet(true);
    render();
    toast('Яндекс Диск подключён');
    uploadToYandex(db.entries, true);
  }

  function pageSettings() {
    const total = db.entries.length;
    const tags = tagStats().length;
    const theme = db.settings.theme || 'system';
    const rate = Math.round((Number(db.settings.rate) || 0.9) * 100);
    const voices = zhVoices();
    const historyCount = (db.history || []).length;
    const backupCount = (db.backups || []).length;
    const dups = buildDuplicateGroups();
    const dupExtra = dups.exact.reduce(function (n, g) { return n + g[1].length - 1; }, 0);
    const dupSummary = (dupExtra || dups.similar.length)
      ? (dupExtra ? 'Лишних точных: ' + dupExtra : 'Точных нет') + (dups.similar.length ? ' · похожих групп: ' + dups.similar.length : '')
      : 'Не найдены';
    return '' +
      '<div class="stat-grid">' +
        '<div class="stat"><b>' + total + '</b><span>' + plural(total, 'фраза', 'фразы', 'фраз') + '</span></div>' +
        '<div class="stat"><b>' + tags + '</b><span>' + plural(tags, 'тег', 'тега', 'тегов') + '</span></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head">Резервная копия</div>' +
        '<button class="row" data-act="export"><div class="row-main">' +
          '<div class="row-title">Экспорт в файл</div>' +
          '<div class="row-sub">JSON-файл со всеми фразами и настройками</div>' +
        '</div><span class="row-chev">↧</span></button>' +
        '<button class="row" data-act="import"><div class="row-main">' +
          '<div class="row-title">Импорт из файла</div>' +
          '<div class="row-sub">Восстановление или объединение</div>' +
        '</div><span class="row-chev">↥</span></button>' +
        '<button class="row" data-act="copy"><div class="row-main">' +
          '<div class="row-title">Скопировать JSON</div>' +
          '<div class="row-sub">Быстро переслать себе в мессенджер</div>' +
        '</div><span class="row-chev">⧉</span></button>' +
      '</div>' +

      '<p class="search-hint" style="margin:-2px 4px 14px">Совет: раз в месяц делайте экспорт — это защитит словарь при смене телефона или очистке браузера.</p>' +

      '<div class="card">' +
        '<div class="card-head">Озвучка и диктовка</div>' +
        '<div class="row"><div class="row-main">' +
          '<div class="row-title">Скорость речи</div>' +
          '<div class="row-sub">Скорость: ' + rate + '%' + (voices.length ? ' · голосов zh: ' + voices.length : ' · китайский голос не найден') + '</div>' +
          '<input class="slider" data-act="rate" type="range" min="0.5" max="1.3" step="0.05" value="' + (Number(db.settings.rate) || 0.9) + '" style="margin-top:10px">' +
        '</div></div>' +
        '<div class="row"><div class="row-main">' +
          '<div class="row-title">Голос</div>' +
          '<div class="row-sub">' + (voices.length ? 'Выберите голос для озвучки' : 'Установите китайский голос в Android') + '</div>' +
          '<select class="select" data-act="voice" style="margin-top:8px">' +
            '<option value="">Авто (китайский)</option>' +
            voices.map(v => '<option value="' + esc(v.voiceURI) + '"' + (db.settings.voice === v.voiceURI ? ' selected' : '') + '>' +
              esc(v.name) + (v.localService ? ' · офлайн' : ' · онлайн') + '</option>').join('') +
          '</select>' +
        '</div></div>' +
        '<button class="row" data-act="test-voice"><div class="row-main">' +
          '<div class="row-title">Проверить голос</div>' +
          '<div class="row-sub">Произнести «你好»</div>' +
        '</div><span class="row-chev">' + ICONS.speaker + '</span></button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head">Словарь</div>' +
        '<button class="row" data-act="batch-add"><div class="row-main">' +
          '<div class="row-title">Добавить списком</div>' +
          '<div class="row-sub">Вставить сразу несколько фраз из заметок или Excel</div>' +
        '</div><span class="row-chev">＋</span></button>' +
        '<button class="row" data-act="duplicates"><div class="row-main">' +
          '<div class="row-title">Дубликаты</div>' +
          '<div class="row-sub">' + esc(dupSummary) + '</div>' +
        '</div><span class="row-chev">›</span></button>' +
        '<button class="row" data-act="history"><div class="row-main">' +
          '<div class="row-title">История и версии</div>' +
          '<div class="row-sub">' + historyCount + ' ' + plural(historyCount, 'версия', 'версии', 'версий') + ' · копий: ' + backupCount + '</div>' +
        '</div><span class="row-chev">›</span></button>' +
        '<button class="row" data-act="manage-tags"><div class="row-main">' +
          '<div class="row-title">Управление тегами</div>' +
          '<div class="row-sub">Переименовать или удалить тег</div>' +
        '</div><span class="row-chev">›</span></button>' +
        '<div class="row"><div class="row-main">' +
          '<div class="row-title">Тема</div>' +
        '</div>' +
          '<select class="select" data-act="theme" style="width:auto">' +
            '<option value="system"' + (theme === 'system' ? ' selected' : '') + '>Как в системе</option>' +
            '<option value="light"' + (theme === 'light' ? ' selected' : '') + '>Светлая</option>' +
            '<option value="dark"' + (theme === 'dark' ? ' selected' : '') + '>Тёмная</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      (!isStandalone() ? '<div class="card"><button class="row" data-act="install-or-help"><div class="row-main">' +
        '<div class="row-title">Установить приложение</div>' +
        '<div class="row-sub">Убрать адресную строку и навигацию браузера</div>' +
      '</div><span class="row-chev">↧</span></button></div>' : '') +

      '<div class="card">' +
        '<div class="card-head">Приложение</div>' +
        '<button class="row" data-act="share-app"><div class="row-main">' +
          '<div class="row-title">Поделиться приложением</div>' +
          '<div class="row-sub">Ссылка и QR-код для установки</div>' +
        '</div><span class="row-chev">' + ICONS.share + '</span></button>' +
        '<button class="row" data-act="check-update"><div class="row-main">' +
          '<div class="row-title">Проверить обновления</div>' +
          '<div class="row-sub">Версия ' + APP_VERSION + '</div>' +
        '</div><span class="row-chev">↻</span></button>' +
        '<button class="row" data-act="install-help"><div class="row-main">' +
          '<div class="row-title">Как установить на телефон</div>' +
          '<div class="row-sub">Chrome → меню → «Установить приложение»</div>' +
        '</div><span class="row-chev">›</span></button>' +
        '<button class="row" data-act="clear-all" style="color:var(--danger)"><div class="row-main">' +
          '<div class="row-title">Удалить все данные</div>' +
          '<div class="row-sub">Фразы, теги и настройки на этом телефоне</div>' +
        '</div></button>' +
      '</div>' +

      '<p class="version">Словарик · офлайн · данные хранятся только на этом устройстве</p>' +
      '<input type="file" id="import-file" accept="application/json,.json" class="hidden">';
  }

  function dupRow(e) {
    const sub = [e.py, e.zh && e.ru ? e.ru : '', e.tags.join(', ') || 'Без тега', formatDateTime(e.ts)]
      .filter(Boolean).join(' · ');
    return '<div class="dup-row">' +
      '<div class="row-main">' +
        '<div class="row-title" style="font-size:15px">' + esc(e.zh || e.ru) + '</div>' +
        '<div class="row-sub">' + esc(sub) + '</div>' +
      '</div>' +
      '<button class="icon-btn" data-act="dup-delete" data-id="' + esc(e.id) + '" aria-label="Удалить">' + ICONS.trash + '</button>' +
    '</div>';
  }

  function exactGroupCard(key, list) {
    const first = list[0];
    const sub = [first.py, first.zh && first.ru ? first.ru : '',
      list.length + ' ' + plural(list.length, 'запись', 'записи', 'записей')].filter(Boolean).join(' · ');
    return '<div class="card dup-group">' +
      '<div class="dup-head">' +
        '<div class="row-main">' +
          '<div class="dup-key">' + esc(first.zh || first.ru) + '</div>' +
          '<div class="dup-sub">' + esc(sub) + '</div>' +
        '</div>' +
        '<button class="btn btn-ghost" data-act="dup-keep" data-key="' + esc(key) + '" style="padding:8px 12px;font-size:13px">Оставить одну</button>' +
      '</div>' +
      list.map(dupRow).join('') +
    '</div>';
  }

  function similarGroupCard(group) {
    const first = group.list[0];
    const head = group.kind === 'zh' ? first.zh : first.ru;
    const label = group.kind === 'zh' ? 'одинаковый китайский' : 'одинаковый перевод';
    return '<div class="card dup-group">' +
      '<div class="dup-head"><div class="row-main">' +
        '<div class="dup-key">' + esc(head) + '</div>' +
        '<div class="dup-sub">' + label + ' · ' + group.list.length + ' ' + plural(group.list.length, 'запись', 'записи', 'записей') + '</div>' +
      '</div></div>' +
      group.list.map(dupRow).join('') +
    '</div>';
  }

  function versionCard(v) {
    const sample = v.entries.slice(0, 3).map(function (e) { return e.zh || e.ru; }).filter(Boolean).join(', ') +
      (v.entries.length > 3 ? '…' : '');
    return '<button class="card history-card" data-act="open-version" data-id="' + esc(v.id) + '">' +
      '<div class="history-main">' +
        '<div class="history-title">' + esc(historyRange(v)) + ' · ' + v.entries.length + ' ' + plural(v.entries.length, 'фраза', 'фразы', 'фраз') + '</div>' +
        '<div class="history-sub">' + esc(sample || '—') + '</div>' +
      '</div>' +
      '<span class="row-chev">›</span>' +
    '</button>';
  }

  function backupCard(b) {
    return '<div class="card"><div class="row">' +
      '<div class="row-main">' +
        '<div class="row-title">' + formatDateTime(b.ts) + ' · ' + b.entries.length + ' ' + plural(b.entries.length, 'фраза', 'фразы', 'фраз') +
          (b.topics && b.topics.length ? ' · ' + b.topics.length + ' ' + plural(b.topics.length, 'топик', 'топика', 'топиков') : '') + '</div>' +
        '<div class="row-sub">' + esc(b.note || 'Копия') + '</div>' +
      '</div>' +
      '<button class="btn btn-ghost" data-act="restore-backup" data-id="' + esc(b.id) + '" style="padding:9px 12px;font-size:13px">Восстановить</button>' +
    '</div></div>';
  }

  function pageHistory() {
    const versions = db.history || [];
    const backups = db.backups || [];

    let html = '<p class="search-hint" style="margin:0 0 14px">Добавления в течение часа после первого попадают в одну версию. Из версии можно удалить отдельные фразы или откатить всё.</p>';

    html += '<div class="section-head"><h2>Версии</h2><span class="count">' + versions.length + '</span></div>';
    if (versions.length) {
      html += versions.map(versionCard).join('');
    } else {
      html += '<div class="card"><div class="row"><div class="row-main">' +
        '<div class="row-title">Пока нет версий</div>' +
        '<div class="row-sub">Добавьте фразы — появится первая версия.</div>' +
      '</div></div></div>';
    }

    html += '<div class="section-head"><h2>Резервные копии</h2><span class="count">' + backups.length + '</span></div>';
    html += '<div class="card">' +
      '<button class="row" data-act="backup-now"><div class="row-main">' +
        '<div class="row-title">Создать копию сейчас</div>' +
        '<div class="row-sub">Полный снимок словаря</div>' +
      '</div><span class="row-chev">＋</span></button>' +
      '<button class="row" data-act="export"><div class="row-main">' +
        '<div class="row-title">Скачать файл копии</div>' +
        '<div class="row-sub">JSON — на случай потери телефона</div>' +
      '</div><span class="row-chev">↧</span></button>' +
    '</div>';

    if (backups.length) {
      html += backups.map(backupCard).join('');
    } else {
      html += '<div class="card"><div class="row"><div class="row-main">' +
        '<div class="row-title">Копий пока нет</div>' +
        '<div class="row-sub">Первая создастся автоматически.</div>' +
      '</div></div></div>';
    }

    html += '<p class="search-hint" style="margin-top:16px">Недельная копия создаётся автоматически при открытии приложения, если прошло больше 7 дней. Версии и копии старше 30 дней удаляются автоматически; последняя копия сохраняется всегда.</p>';
    return html;
  }

  function versionEntryRow(e, versionId) {
    const present = db.entries.some(function (x) { return x.id === e.id; });
    const sub = [e.py, e.zh && e.ru ? e.ru : '', e.tags.join(', ')].filter(Boolean).join(' · ');
    return '<div class="version-row">' +
      '<div class="row-main">' +
        '<div class="row-title" style="font-size:16px">' + esc(e.zh || e.ru) + '</div>' +
        '<div class="row-sub">' + esc(sub) + (present ? '' : ' · удалена') + '</div>' +
      '</div>' +
      (present
        ? '<button class="icon-btn" data-act="version-remove" data-version="' + esc(versionId) + '" data-id="' + esc(e.id) + '" aria-label="Удалить фразу">' + ICONS.trash + '</button>'
        : '<button class="text-btn" data-act="version-restore" data-version="' + esc(versionId) + '" data-id="' + esc(e.id) + '">Вернуть</button>') +
    '</div>';
  }

  function openVersionSheet(versionId, replace) {
    const v = (db.history || []).find(function (x) { return x.id === versionId; });
    if (!v) {
      closeSheet(false);
      render();
      return;
    }

    const rows = v.entries.slice().reverse().map(function (e) { return versionEntryRow(e, v.id); }).join('');
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Версия</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<p class="search-hint" style="margin:0 0 10px">' + esc(historyRange(v)) + ' · ' + v.entries.length + ' ' + plural(v.entries.length, 'фраза', 'фразы', 'фраз') + '</p>' +
        '<div class="card" style="margin-bottom:0">' + (rows || '<div class="row"><div class="row-main"><div class="row-sub">В версии не осталось фраз.</div></div></div>') + '</div>' +
        '<p class="search-hint" style="margin:14px 0 0">Удаляйте отдельные фразы или откатите всю версию. Перед откатом текущее состояние сохранится в резервной копии.</p>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-danger" data-act="rollback-version" data-id="' + esc(v.id) + '">Откатить версию</button>' +
      '</div>',
      null,
      replace
    );
  }

  function pageDuplicates() {
    const groups = buildDuplicateGroups();
    if (!groups.exact.length && !groups.similar.length) {
      return emptyState('✓', 'Дубликатов нет', 'Все фразы в словаре уникальны.');
    }

    let html = '';
    if (groups.exact.length) {
      html += '<div class="section-head"><h2>Точные дубликаты</h2><span class="count">' + groups.exact.length + '</span></div>';
      html += groups.exact.map(function (g) { return exactGroupCard(g[0], g[1]); }).join('');
    }
    if (groups.similar.length) {
      html += '<div class="section-head"><h2>Похожие фразы</h2><span class="count">' + groups.similar.length + '</span></div>';
      html += groups.similar.map(similarGroupCard).join('');
    }
    html += '<p class="search-hint" style="margin-top:16px">«Оставить одну» объединяет теги и заметки, лишние записи удаляет.</p>';
    return html;
  }

  function forEachEntryCopy(fn) {
    db.entries.forEach(fn);
    (db.history || []).forEach(function (v) { (v.entries || []).forEach(fn); });
    (db.backups || []).forEach(function (b) { (b.entries || []).forEach(fn); });
  }

  function replaceTag(oldTag, newTag) {
    if (!oldTag || !newTag || oldTag === newTag) return;
    forEachEntryCopy(function (e) {
      if (!Array.isArray(e.tags) || e.tags.indexOf(oldTag) === -1) return;
      e.tags = e.tags.map(function (t) { return t === oldTag ? newTag : t; });
      e.tags = Array.from(new Set(e.tags));
    });
    db.pinnedTags = Array.from(new Set((db.pinnedTags || []).map(function (t) {
      return t === oldTag ? newTag : t;
    })));
    saveDB();
  }

  function removeTag(tag) {
    forEachEntryCopy(function (e) {
      if (!Array.isArray(e.tags)) return;
      e.tags = e.tags.filter(function (t) { return t !== tag; });
      if (!e.tags.length) e.tags = ['Без тега'];
    });
    db.pinnedTags = (db.pinnedTags || []).filter(function (t) { return t !== tag; });
    saveDB();
  }

  function togglePinnedTag(tag) {
    db.pinnedTags = db.pinnedTags || [];
    const idx = db.pinnedTags.indexOf(tag);
    if (idx === -1) db.pinnedTags.push(tag);
    else db.pinnedTags.splice(idx, 1);
    saveDB();
  }

  function openMergeTagSheet(source) {
    const targets = tagStats().filter(function (t) { return t.name !== source; });
    if (!targets.length) {
      openSheet(
        '<div class="sheet-head"><div class="sheet-title">Объединить тег</div>' +
          '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
        '<div class="sheet-body"><p style="margin:0">Других тегов пока нет — объединять не с чем.</p></div>' +
        '<div class="sheet-foot"><button class="btn btn-primary" data-act="close-sheet">Понятно</button></div>'
      );
      return;
    }

    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Объединить тег</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<p style="margin:0 0 12px;line-height:1.5">Фразы из «' + esc(source) + '» получат выбранный тег. Тег «' + esc(source) + '» исчезнет, сами фразы останутся.</p>' +
        '<div class="card">' + targets.map(function (t) {
          return '<button class="row" data-act="merge-into" data-source="' + esc(source) + '" data-target="' + esc(t.name) + '">' +
            '<span class="tag-dot" style="--h:' + hue(t.name) + '"></span>' +
            '<div class="row-main">' +
              '<div class="row-title">' + esc(t.name) + '</div>' +
              '<div class="row-sub">' + t.count + ' ' + plural(t.count, 'фраза', 'фразы', 'фраз') + '</div>' +
            '</div>' +
            '<span class="row-chev">›</span>' +
          '</button>';
        }).join('') + '</div>' +
      '</div>' +
      '<div class="sheet-foot"><button class="btn btn-ghost" data-act="close-sheet">Отмена</button></div>'
    );
  }

  function pageTagManager() {
    const tags = tagStats();
    if (!tags.length) return emptyState('🏷', 'Тегов пока нет', 'Создайте тег при добавлении фразы.');
    const pinned = new Set(db.pinnedTags || []);
    return '<p class="search-hint" style="margin:0 0 12px">Закреплённые теги показываются первыми. Объединение сохраняет все фразы.</p>' +
      '<div class="card">' + tags.map(t =>
      '<div class="row">' +
        '<span class="tag-dot" style="--h:' + hue(t.name) + '"></span>' +
        '<div class="row-main">' +
          '<div class="row-title">' + esc(t.name) + '</div>' +
          '<div class="row-sub">' + t.count + ' ' + plural(t.count, 'фраза', 'фразы', 'фраз') + '</div>' +
        '</div>' +
        '<button class="icon-btn pin' + (pinned.has(t.name) ? ' is-on' : '') + '" data-act="pin-tag" data-tag="' + esc(t.name) + '" aria-label="Закрепить">' + ICONS.pin + '</button>' +
        '<button class="icon-btn" data-act="merge-tag" data-tag="' + esc(t.name) + '" aria-label="Объединить">' + ICONS.merge + '</button>' +
        '<button class="icon-btn" data-act="rename-tag" data-tag="' + esc(t.name) + '" aria-label="Переименовать">' + ICONS.pencil + '</button>' +
        '<button class="icon-btn" data-act="delete-tag" data-tag="' + esc(t.name) + '" aria-label="Удалить">' + ICONS.trash + '</button>' +
      '</div>'
    ).join('') + '</div>';
  }

  function emptyState(icon, title, text, extra) {
    return '<div class="empty">' +
      '<div class="big">' + icon + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + esc(text) + '</p>' +
      (extra || '') +
    '</div>';
  }

  /* ───────────────────────── Настройки: обработчики ───────────────────────── */

  function bindSettings() {
    const file = $('#import-file');
    if (file) {
      file.addEventListener('change', function () {
        const f = file.files && file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function () {
          try {
            const data = JSON.parse(String(reader.result));
            askImportMode(data);
          } catch (err) {
            toast('Не удалось прочитать файл');
          }
        };
        reader.readAsText(f);
        file.value = '';
      });
    }
  }

  function exportData() {
    const payload = {
      app: 'slovar',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: db.entries,
      settings: db.settings,
      removed: db.removed,
      history: db.history,
      backups: db.backups,
      pinnedTags: db.pinnedTags,
      topics: db.topics
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'slovar-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Файл сохранён');
  }

  function askImportMode(data) {
    const arr = Array.isArray(data) ? data : data && data.entries;
    if (!Array.isArray(arr)) { toast('Это не похоже на резервную копию'); return; }
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Импорт</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<p style="margin:0 0 6px">В файле ' + arr.length + ' ' + plural(arr.length, 'фраза', 'фразы', 'фраз') + '.</p>' +
        '<p style="color:var(--muted);font-size:14px">«Добавить» сохранит текущие фразы и добавит новые. «Заменить» удалит текущие.</p>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-ghost" data-act="import-add">Добавить</button>' +
        '<button class="btn btn-primary" data-act="import-replace">Заменить</button>' +
      '</div>',
      { importData: data }
    );
  }

  function applyImport(data, mode) {
    const arr = Array.isArray(data) ? data : data.entries;
    const incoming = (arr || []).map(makeEntry);

    if (mode === 'replace') {
      db.entries = incoming;
      if (data.settings) db.settings = Object.assign(defaultSettings(), data.settings);
      if (Array.isArray(data.history)) db.history = data.history;
      if (Array.isArray(data.backups)) db.backups = data.backups;
      if (Array.isArray(data.removed)) db.removed = data.removed;
      if (Array.isArray(data.pinnedTags)) db.pinnedTags = data.pinnedTags;
      if (Array.isArray(data.topics)) db.topics = data.topics.map(function (t) { return makeTopic(t); });
      db.forceNewVersion = true;
    } else {
      const key = e => (e.zh + '|' + e.ru).toLowerCase();
      const known = new Set(db.entries.map(key));
      const addedEntries = [];
      incoming.forEach(e => {
        if (!known.has(key(e))) {
          db.entries.push(e);
          known.add(key(e));
          addedEntries.push(e);
        }
      });
      recordAdditions(addedEntries);
      if (Array.isArray(data.pinnedTags)) {
        db.pinnedTags = Array.from(new Set((db.pinnedTags || []).concat(data.pinnedTags)));
      }
      if (Array.isArray(data.topics)) {
        db.topics = db.topics || [];
        const known = new Set(db.topics.map(function (t) { return (t.zh + '|' + t.ru).toLowerCase(); }));
        data.topics.forEach(function (raw) {
          const t = makeTopic(raw);
          const key = (t.zh + '|' + t.ru).toLowerCase();
          if (!known.has(key)) { db.topics.push(t); known.add(key); }
        });
      }
    }

    db.demoSeeded = true;
    saveDB();
    applyTheme();
    closeSheet(true);
    render();
    toast(mode === 'replace' ? 'Данные заменены' : 'Фразы добавлены');
  }

  /* ───────────────────────── Модальное окно фразы ───────────────────────── */

  function openInstallHelp() {
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Установка на телефон</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body" style="line-height:1.5">' +
        '<p style="margin:0 0 12px">Адресная строка и кнопки браузера видны только в обычной вкладке Chrome. В установленном приложении их нет.</p>' +
        '<ol style="padding-left:20px;margin:0 0 12px;display:flex;flex-direction:column;gap:8px">' +
          '<li>Откройте сайт в Chrome на телефоне.</li>' +
          '<li>Нажмите ⋮ и выберите <b>«Установить приложение»</b>.</li>' +
          '<li>Подтвердите установку.</li>' +
          '<li>Запускайте «Словарик» с иконки на рабочем столе, а не по ссылке.</li>' +
        '</ol>' +
        '<p style="margin:0 0 12px;color:var(--muted);font-size:13.5px">Если вы уже добавляли ярлык через «Добавить на главный экран», он может открываться в браузере с адресной строкой. Удалите такой ярлык и установите заново через «Установить приложение».</p>' +
        '<p style="margin:0;color:var(--muted);font-size:13.5px">Ссылка из чата или QR-кода открывает обычную вкладку — адресную строку в ней скрыть нельзя.</p>' +
      '</div>' +
      '<div class="sheet-foot"><button class="btn btn-primary" data-act="close-sheet">Понятно</button></div>'
    );
  }

  function openShareSheet() {
    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Поделиться приложением</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="sheet-body">' +
        '<p class="share-lead">Ссылка на «Словарик» — без имени и аккаунта. Каждый устанавливает приложение себе, данные остаются на его телефоне.</p>' +
        '<div class="share-link" id="share-app-url">' + esc(PUBLIC_APP_URL) + '</div>' +
        '<div class="share-actions">' +
          '<button class="btn btn-primary" data-act="share-link">Поделиться ссылкой</button>' +
          '<button class="btn btn-ghost" data-act="copy-app-link">Скопировать</button>' +
        '</div>' +
        '<div class="share-qr"><img src="slovar-qr.png" alt="QR-код для установки «Словарика»"></div>' +
        '<p class="search-hint" style="text-align:center;margin:8px 0 0">Наведите камеру телефона на QR-код или откройте ссылку в Chrome и выберите «Установить приложение».</p>' +
      '</div>' +
      '<div class="sheet-foot"><button class="btn btn-ghost" data-act="close-sheet">Закрыть</button></div>'
    );
  }

  function copyAppLink() {
    const fallback = function () {
      window.prompt('Скопируйте ссылку:', PUBLIC_APP_URL);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(PUBLIC_APP_URL).then(function () {
        toast('Ссылка скопирована');
      }, fallback);
    } else {
      fallback();
    }
  }

  function shareApp() {
    if (navigator.share) {
      navigator.share({
        title: 'Словарик — RU ↔ 中文',
        text: 'Офлайн-словарик русско-китайских фраз',
        url: PUBLIC_APP_URL
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        copyAppLink();
      });
      return;
    }
    copyAppLink();
  }

  function openSheet(html, data, replace) {
    const alreadyOpen = sheetOpen;
    sheetRoot.innerHTML = '<div class="sheet-overlay" id="sheet-overlay">' +
      '<div class="sheet-panel" role="dialog" aria-modal="true">' + html + '</div></div>';
    sheetOpen = true;
    sheetRoot._data = data || {};
    document.body.style.overflow = 'hidden';
    if (!(replace && alreadyOpen)) history.pushState({ sheet: 1 }, '');

    const overlay = $('#sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (ev) {
        if (ev.target === overlay) closeSheet(true);
      });
    }
    document.removeEventListener('keydown', onSheetKey);
    document.addEventListener('keydown', onSheetKey);
  }

  function onSheetKey(ev) {
    if (!sheetOpen) return;
    if (ev.key === 'Escape') { ev.preventDefault(); closeSheet(true); }
  }

  function closeSheet(goBack) {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheetRoot.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onSheetKey);
    if (goBack) {
      closingByUI = true;
      history.back();
      setTimeout(() => { closingByUI = false; }, 150);
    }
  }

  let sheetTags = [];
  let sheetEntryId = null;
  let sheetFav = false;
  let sheetPyState = { touched: false };

  function openEntry(entryId, presetTag, prefill, replace) {
    const entry = entryId ? entryById(entryId) : null;
    sheetEntryId = entry ? entry.id : null;
    sheetFav = !!(entry && entry.fav);
    sheetTags = entry ? entry.tags.slice() : (presetTag ? [presetTag] : []);
    const pre = String(prefill || '').trim();
    const preIsZh = /[\u3400-\u9fff]/.test(pre);
    const preZh = preIsZh ? pre : '';
    const preRu = pre && !preIsZh ? pre : '';

    const html =
      '<div class="sheet-head">' +
        '<div class="sheet-title">' + (entry ? 'Фраза' : 'Новая фраза') + '</div>' +
        '<button class="icon-btn star' + (sheetFav ? ' is-on' : '') + '" data-act="toggle-sheet-fav" aria-label="' + (sheetFav ? 'Убрать из избранного' : 'В избранное') + '">' + ICONS.star + '</button>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button>' +
      '</div>' +
      (entry ? '' : '<div class="seg">' +
        '<button class="seg-btn is-active" type="button">Одна фраза</button>' +
        '<button class="seg-btn" type="button" data-act="open-batch">Списком</button>' +
      '</div>') +
      '<div class="sheet-body">' +
        '<div class="field">' +
          '<div class="field-head">' +
            '<label for="in-zh">Китайский</label>' +
            '<button class="link-btn" type="button" data-act="paste-form">Вставить из буфера</button>' +
          '</div>' +
          '<div class="input-wrap">' +
            '<input class="input input-zh" id="in-zh" placeholder="你好" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(entry ? entry.zh : preZh) + '">' +
            '<button class="mic" type="button" data-mic="zh" aria-label="Надиктовать по-китайски">' + ICONS.mic + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="in-py">Пиньинь</label>' +
          '<input class="input input-py" id="in-py" placeholder="nǐ hǎo" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(entry ? entry.py : '') + '">' +
        '</div>' +
        '<div class="field">' +
          '<label for="in-ru">Перевод</label>' +
          '<div class="input-wrap">' +
            '<input class="input input-ru" id="in-ru" placeholder="Привет" autocomplete="off" value="' + esc(entry ? entry.ru : preRu) + '">' +
            '<button class="mic" type="button" data-mic="ru" aria-label="Надиктовать по-русски">' + ICONS.mic + '</button>' +
          '</div>' +
        '</div>' +
        '<div id="dup-hint" class="dup-hint" hidden></div>' +
        '<div class="field">' +
          '<label for="tag-input">Теги</label>' +
          '<div class="chips" id="tags-editor"><input id="tag-input" placeholder="Добавить тег…" autocomplete="off"></div>' +
          '<div class="tag-suggestions" id="tag-sug"></div>' +
        '</div>' +
        '<div class="field">' +
          '<label for="in-note">Заметка</label>' +
          '<textarea class="textarea" id="in-note" rows="2" placeholder="Что важно запомнить…">' + esc(entry ? entry.note : '') + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
        (entry
          ? '<button class="btn btn-danger" data-act="delete-entry">Удалить</button>'
          : '<button class="btn btn-ghost" data-act="close-sheet">Отмена</button>' +
            '<button class="btn btn-ghost" data-act="save-entry-more" aria-label="Сохранить и добавить ещё" title="Сохранить и добавить ещё">Ещё</button>') +
        '<button class="btn btn-primary" data-act="save-entry">Сохранить</button>' +
      '</div>';

    openSheet(html, null, replace);

    const zhInput = $('#in-zh');
    const pyInput = $('#in-py');
    const ruInput = $('#in-ru');
    const tagInput = $('#tag-input');
    // если пиньинь был сгенерирован автоматически — продолжаем обновлять его при правке иероглифов
    sheetPyState.touched = !!entry && entry.py !== makePinyin(entry.zh);

    renderSheetTags();
    renderTagSuggestions('');

    zhInput.addEventListener('input', function () {
      if (!sheetPyState.touched) pyInput.value = makePinyin(zhInput.value);
    });
    pyInput.addEventListener('input', function () { sheetPyState.touched = true; });
    zhInput.addEventListener('input', scheduleDupHint);
    ruInput.addEventListener('input', scheduleDupHint);

    tagInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ',' || ev.key === '，') {
        ev.preventDefault();
        addSheetTag(tagInput.value);
      } else if (ev.key === 'Backspace' && !tagInput.value && sheetTags.length) {
        sheetTags.pop();
        renderSheetTags();
        renderTagSuggestions('');
      }
    });
    tagInput.addEventListener('input', function () {
      renderTagSuggestions(tagInput.value);
    });

    $$('[data-mic]', sheetRoot).forEach(btn => {
      btn.addEventListener('click', function () {
        const isZh = btn.dataset.mic === 'zh';
        dictate(isZh ? 'zh-CN' : 'ru-RU', isZh ? zhInput : ruInput, btn);
      });
    });

    setTimeout(() => {
      if (!entry) zhInput.focus();
    }, 250);
  }

  function addSheetTag(raw) {
    const name = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (sheetTags.some(t => t.toLowerCase() === name.toLowerCase())) return;
    sheetTags.push(name);
    renderSheetTags();
    const input = $('#tag-input');
    if (input) { input.value = ''; input.focus(); }
    renderTagSuggestions('');
  }

  function renderSheetTags() {
    const box = $('#tags-editor');
    if (!box) return;
    const input = $('#tag-input');
    const value = input ? input.value : '';
    box.innerHTML = sheetTags.map((t, i) =>
      '<span class="chip">' + esc(t) +
        '<button type="button" data-remove-tag="' + i + '" aria-label="Убрать тег">✕</button></span>'
    ).join('') + '<input id="tag-input" placeholder="Добавить тег…" autocomplete="off" value="' + esc(value) + '">';

    const fresh = $('#tag-input');
    fresh.addEventListener('input', function () { renderTagSuggestions(fresh.value); });
    fresh.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ',' || ev.key === '，') {
        ev.preventDefault();
        addSheetTag(fresh.value);
      } else if (ev.key === 'Backspace' && !fresh.value && sheetTags.length) {
        sheetTags.pop();
        renderSheetTags();
        renderTagSuggestions('');
      }
    });
    $$('[data-remove-tag]', box).forEach(btn => {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        sheetTags.splice(Number(btn.dataset.removeTag), 1);
        renderSheetTags();
        renderTagSuggestions($('#tag-input') ? $('#tag-input').value : '');
      });
    });
  }

  function renderTagSuggestions(query) {
    const box = $('#tag-sug');
    if (!box) return;
    const q = normalizeQuery(query);
    const list = tagStats()
      .map(t => t.name)
      .filter(t => !sheetTags.some(x => x.toLowerCase() === t.toLowerCase()))
      .filter(t => !q || normalizeQuery(t).indexOf(q) !== -1)
      .slice(0, 8);
    box.innerHTML = list.length
      ? list.map(t => '<button class="sug" type="button" data-sug="' + esc(t) + '">' + esc(t) + '</button>').join('')
      : '<span style="font-size:12px;color:var(--muted)">Новый тег создастся при сохранении</span>';
    $$('[data-sug]', box).forEach(btn => {
      btn.addEventListener('click', function () {
        addSheetTag(btn.dataset.sug);
        const input = $('#tag-input');
        if (input) { input.value = ''; input.focus(); }
        renderTagSuggestions('');
      });
    });
  }

  function saveEntryFromSheet(andMore) {
    const zh = $('#in-zh').value.trim();
    const ru = $('#in-ru').value.trim();
    const py = $('#in-py').value.trim();
    const note = $('#in-note').value.trim();
    const pendingTag = $('#tag-input') ? $('#tag-input').value.trim() : '';
    if (pendingTag) addSheetTag(pendingTag);

    if (!zh && !ru) {
      toast('Добавьте китайский текст или перевод');
      return;
    }

    const exact = findExactDup(zh, ru, sheetEntryId);
    if (exact) {
      const label = (exact.zh || exact.ru) + (exact.zh && exact.ru ? ' — ' + exact.ru : '');
      if (confirm('Такая фраза уже есть:\n' + label + '\n\nОткрыть её?')) {
        openEntry(exact.id, null, '', true);
      }
      return;
    }

    if (!sheetTags.length) {
      toast('Добавьте хотя бы один тег');
      if ($('#tag-input')) $('#tag-input').focus();
      return;
    }

    if (sheetEntryId) {
      const e = entryById(sheetEntryId);
      if (e) {
        e.zh = zh;
        e.ru = ru;
        e.py = py || makePinyin(zh);
        e.note = note;
        e.tags = sheetTags.slice();
        e.fav = sheetFav;
        e.ts = Date.now();
      }
      saveDB();
      sheetEntryId = null;
      closeSheet(true);
      render();
      toast('Сохранено');
      return;
    }

    const newEntry = makeEntry({ zh, ru, py, note, tags: sheetTags, fav: sheetFav });
    db.entries.unshift(newEntry);
    recordAdditions([newEntry]);
    saveDB();

    if (andMore) {
      $('#in-zh').value = '';
      $('#in-py').value = '';
      $('#in-ru').value = '';
      $('#in-note').value = '';
      sheetFav = false;
      const starBtn = $('[data-act="toggle-sheet-fav"]');
      if (starBtn) starBtn.classList.remove('is-on');
      sheetPyState.touched = false;
      $('#in-zh').focus();
      toast('Добавлено — можно следующую');
      return;
    }

    closeSheet(true);
    render();
    toast('Фраза добавлена');
  }

  function markRemoved(e) {
    const key = ((e.zh || '') + '|' + (e.ru || '')).toLowerCase();
    if (!key.replace('|', '').trim()) return;
    db.removed = Array.isArray(db.removed) ? db.removed : [];
    if (db.removed.indexOf(key) === -1) db.removed.push(key);
    if (db.removed.length > 2000) db.removed = db.removed.slice(-2000);
  }

  function removeEntry(e) {
    return removeEntries(e ? [e] : []);
  }

  // Удаляет записи и возвращает снимок для отмены.
  function removeEntries(entries) {
    const list = (entries || []).filter(Boolean);
    if (!list.length) return null;

    const snapshot = {
      removed: Array.isArray(db.removed) ? db.removed.slice() : [],
      items: list.map(function (e) {
        return { entry: JSON.parse(JSON.stringify(e)), index: db.entries.indexOf(e) };
      })
    };

    const ids = new Set(list.map(function (e) { return e.id; }));
    list.forEach(markRemoved);
    db.entries = db.entries.filter(function (e) { return !ids.has(e.id); });
    saveDB();
    return snapshot;
  }

  function undoDelete(snapshot) {
    if (!snapshot) return false;
    snapshot.items
      .slice()
      .sort(function (a, b) { return a.index - b.index; })
      .forEach(function (item) {
        const idx = Math.max(0, Math.min(item.index, db.entries.length));
        db.entries.splice(idx, 0, item.entry);
      });
    db.removed = snapshot.removed.slice();
    saveDB();
    return true;
  }

  function deleteEntry(id) {
    const e = entryById(id);
    if (!e) return;
    if (!confirm('Удалить фразу «' + (e.zh || e.ru) + '»?')) return;
    const snapshot = removeEntry(e);
    closeSheet(true);
    render();
    showUndoToast('Фраза удалена', snapshot);
  }

  /* ───────────────────────── Ввод пачкой ───────────────────────── */

  function splitBatchLine(line) {
    const raw = String(line || '').replace(/\r/g, '').trim();
    if (!raw || raw.charAt(0) === '#') return null;

    let parts;
    if (raw.indexOf('\t') !== -1) parts = raw.split('\t');
    else if (raw.indexOf(';') !== -1) parts = raw.split(';');
    else if (raw.indexOf('|') !== -1) parts = raw.split('|');
    else if (raw.indexOf('｜') !== -1) parts = raw.split('｜');
    else parts = [raw];
    parts = parts.map(function (p) { return p.trim(); });

    // заголовок таблицы
    if (parts[0] && /^(китай|中文|chinese|zh|слово)/i.test(parts[0]) &&
        parts[1] && /(перевод|рус|meaning|ru|значение)/i.test(parts[1])) {
      return null;
    }

    let zh = parts[0] || '';
    let ru = parts[1] || '';
    let tags = (parts[2] || '').split(/[,，、]/).map(function (t) { return t.trim(); }).filter(Boolean);

    if (parts.length === 1) {
      if (/[\u3400-\u9fff]/.test(zh)) ru = '';
      else { ru = zh; zh = ''; }
    }

    // если колонки перепутаны — меняем местами
    if (zh && !/[\u3400-\u9fff]/.test(zh) && /[\u3400-\u9fff]/.test(ru)) {
      const tmp = zh; zh = ru; ru = tmp;
    }

    if (!zh && !ru) return null;
    return { zh: zh, ru: ru, tags: tags };
  }

  function parseBatch(text) {
    const rows = [];
    String(text || '').split('\n').forEach(function (line) {
      const row = splitBatchLine(line);
      if (row) rows.push(row);
    });
    return rows;
  }

  function batchPlan() {
    const rows = parseBatch($('#batch-text') ? $('#batch-text').value : '');
    const existing = new Set(db.entries.map(function (e) { return (e.zh + '|' + e.ru).toLowerCase(); }));
    const seen = new Set();
    let fresh = 0;
    let dup = 0;
    rows.forEach(function (r) {
      const key = (r.zh + '|' + r.ru).toLowerCase();
      if (existing.has(key) || seen.has(key)) { dup++; return; }
      seen.add(key);
      fresh++;
    });
    return { rows: rows, fresh: fresh, dup: dup };
  }

  function updateBatchPreview() {
    const plan = batchPlan();
    const btn = $('#batch-import-btn');
    if (btn) {
      btn.disabled = plan.fresh === 0;
      btn.textContent = plan.fresh ? 'Добавить ' + plan.fresh : 'Добавить';
    }
    const info = $('#batch-preview');
    if (info) {
      if (!plan.rows.length) {
        info.textContent = 'Вставьте строки — покажу, сколько получится.';
      } else {
        info.textContent = 'Строк: ' + plan.rows.length +
          ' · новых: ' + plan.fresh +
          (plan.dup ? ' · уже есть: ' + plan.dup : '');
      }
    }
  }

  function openBatchSheet(replace, initialText) {
    const preset = String(initialText || '');
    const datalist = allTags().map(function (t) {
      return '<option value="' + esc(t) + '"></option>';
    }).join('');

    openSheet(
      '<div class="sheet-head"><div class="sheet-title">Добавить списком</div>' +
        '<button class="icon-btn" data-act="close-sheet" aria-label="Закрыть">✕</button></div>' +
      '<div class="seg">' +
        '<button class="seg-btn" type="button" data-act="open-single">Одна фраза</button>' +
        '<button class="seg-btn is-active" type="button">Списком</button>' +
      '</div>' +
      '<div class="sheet-body">' +
        '<p class="search-hint" style="margin:0 0 10px">Одна строка — одна фраза. Разделитель — <b>;</b> или табуляция. Третий столбец — теги через запятую.</p>' +
        '<textarea class="textarea" id="batch-text" rows="8" style="min-height:190px;font-size:15px" ' +
          'placeholder="你好; Привет; Приветствие&#10;谢谢; Спасибо; Вежливость&#10;多少钱？; Сколько стоит?; Деньги и торг, Магазин">' + esc(preset) + '</textarea>' +
        '<div class="field" style="margin-top:14px">' +
          '<label for="batch-tag">Тег по умолчанию</label>' +
          '<input class="input" id="batch-tag" list="batch-tags" placeholder="Например: Мои фразы" autocomplete="off">' +
          '<datalist id="batch-tags">' + datalist + '</datalist>' +
        '</div>' +
        '<div class="search-hint" id="batch-preview" style="margin-top:4px">Вставьте строки — покажу, сколько получится.</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-ghost" data-act="batch-paste">Из буфера</button>' +
        '<button class="btn btn-primary" id="batch-import-btn" data-act="batch-import" disabled>Добавить</button>' +
      '</div>',
      null,
      replace
    );

    const area = $('#batch-text');
    if (area) {
      area.addEventListener('input', updateBatchPreview);
      setTimeout(function () { area.focus(); }, 220);
    }
    const tagInput = $('#batch-tag');
    if (tagInput) tagInput.addEventListener('input', updateBatchPreview);
    updateBatchPreview();
  }

  function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast('Вставьте текст вручную');
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      if (!text || !text.trim()) { toast('Буфер обмена пуст'); return; }
      const area = $('#batch-text');
      if (!area) return;
      area.value = (area.value ? area.value.replace(/\s+$/, '') + '\n' : '') + text.trim();
      updateBatchPreview();
      toast('Вставлено из буфера');
    }).catch(function () {
      toast('Нет доступа к буферу — вставьте вручную');
    });
  }

  function applyBatchImport() {
    const plan = batchPlan();
    if (!plan.fresh) { toast('Нет новых строк для добавления'); return; }

    const defaultTag = $('#batch-tag') ? $('#batch-tag').value.trim() : '';
    const existing = new Set(db.entries.map(function (e) { return (e.zh + '|' + e.ru).toLowerCase(); }));
    const addedEntries = [];

    plan.rows.forEach(function (r) {
      const key = (r.zh + '|' + r.ru).toLowerCase();
      if (existing.has(key)) return;
      const tags = r.tags.length ? r.tags : (defaultTag ? [defaultTag] : []);
      const entry = makeEntry({ zh: r.zh, ru: r.ru, tags: tags });
      db.entries.unshift(entry);
      addedEntries.push(entry);
      existing.add(key);
    });

    recordAdditions(addedEntries);
    saveDB();
    closeSheet(true);
    render();
    toast('Добавлено: ' + addedEntries.length + (plan.dup ? ' · пропущено дублей: ' + plan.dup : ''));
  }

  /* ───────────────────────── «Поделиться» и ярлык ---------- */

  function parseSharedLine(line) {
    const row = splitBatchLine(line);
    if (!row) return { zh: '', ru: '', tags: [] };

    // «你好 — Привет» / «你好 - Привет»: разносим по полям
    if (!row.ru && row.zh) {
      const m = String(line).match(/^(.+?)\s*[—–-]\s*(.+)$/);
      if (m) {
        const a = m[1].trim();
        const b = m[2].trim();
        const aZh = /[\u3400-\u9fff]/.test(a);
        const bZh = /[\u3400-\u9fff]/.test(b);
        if (aZh && !bZh) return { zh: a, ru: b, tags: row.tags };
        if (bZh && !aZh) return { zh: b, ru: a, tags: row.tags };
      }
    }
    return row;
  }

  function handleEntryParams() {
    const params = new URLSearchParams(location.search);
    const add = params.get('add');
    let text = (params.get('text') || '').trim();
    const title = (params.get('title') || '').trim();

    if (!text && title) text = title;
    if (/^https?:\/\//i.test(text) && !/\s/.test(text)) text = title;

    if (!text && add !== '1') return;

    history.replaceState({ view: 'tags', tag: null, query: '' }, '', location.pathname);

    if (!text) {
      openEntry(null, null);
      return;
    }

    const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length > 1) {
      openBatchSheet(false, text);
      toast('Фразы из «Поделиться»');
      return;
    }

    const row = parseSharedLine(lines[0]);
    openEntry(null, null, row.zh || row.ru);
    const zi = $('#in-zh');
    const ri = $('#in-ru');
    if (row.zh && zi) {
      zi.value = row.zh;
      zi.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (row.ru && ri) ri.value = row.ru;
    if (row.tags && row.tags.length) row.tags.forEach(addSheetTag);
    toast('Вставлено из «Поделиться»');
  }

  function pasteToForm() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      toast('Вставьте вручную');
      return;
    }
    navigator.clipboard.readText().then(function (text) {
      const lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { toast('Буфер обмена пуст'); return; }
      const row = splitBatchLine(lines[0]);
      if (!row) { toast('Не удалось разобрать текст'); return; }
      if (row.zh) {
        const zi = $('#in-zh');
        if (zi) { zi.value = row.zh; zi.dispatchEvent(new Event('input', { bubbles: true })); }
      }
      if (row.ru) {
        const ri = $('#in-ru');
        if (ri) ri.value = row.ru;
      }
      if (row.tags && row.tags.length) row.tags.forEach(addSheetTag);
      toast('Вставлено из буфера');
    }).catch(function () {
      toast('Нет доступа к буферу — вставьте вручную');
    });
  }

  /* ───────────────────────── Глобальные действия ───────────────────────── */

  document.addEventListener('click', function (ev) {
    const mic = ev.target.closest('[data-mic]');
    if (mic) return; // обрабатывается локально

    const actionEl = ev.target.closest('[data-act]');
    if (!actionEl) return;
    const act = actionEl.dataset.act;

    if (act === 'open-tag') {
      closeSheet(false);
      go('tag', { tag: actionEl.dataset.tag });
      return;
    }
    if (act === 'edit') {
      openEntry(actionEl.dataset.id);
      return;
    }
    if (act === 'speak') {
      ev.stopPropagation();
      const e = entryById(actionEl.dataset.id);
      if (e) speak(e.zh, actionEl);
      return;
    }
    if (act === 'settings') { go('settings'); return; }
    if (act === 'search') { go('search', { query: '' }); setTimeout(focusSearch, 60); return; }
    if (act === 'back') { history.back(); return; }
    if (act === 'search-all') { state.searchAll = true; renderSearchResults(); return; }
    if (act === 'search-quick') { state.searchAll = false; renderSearchResults(); return; }
    if (act === 'clear-search') {
      state.query = '';
      state.searchAll = false;
      const input = $('#search-input');
      if (input) { input.value = ''; input.focus(); }
      const clear = $('.search-clear');
      if (clear) clear.classList.add('hidden');
      renderSearchResults();
      return;
    }
    if (act === 'close-sheet') { closeSheet(true); return; }
    if (act === 'save-entry') { saveEntryFromSheet(false); return; }
    if (act === 'save-entry-more') { saveEntryFromSheet(true); return; }
    if (act === 'batch-add') { openBatchSheet(false); return; }
    if (act === 'open-batch') { openBatchSheet(true); return; }
    if (act === 'open-single') { openEntry(null, state.view === 'tag' ? state.tag : null, '', true); return; }
    if (act === 'paste-form') { pasteToForm(); return; }
    if (act === 'open-favorites') { go('favorites'); return; }
    if (act === 'new-topic') { openTopicSheet(null); return; }
    if (act === 'open-topic') { go('topic', { topicId: actionEl.dataset.id }); return; }
    if (act === 'edit-topic') { openTopicSheet(actionEl.dataset.id); return; }
    if (act === 'save-topic') { saveTopicFromSheet(); return; }
    if (act === 'delete-topic') { deleteTopic(actionEl.dataset.id); return; }
    if (act === 'speak-topic') {
      const t = topicById(actionEl.dataset.id);
      if (t && t.zh) speak(t.zh, actionEl);
      return;
    }
    if (act === 'toggle-only-fav') { state.onlyFav = !state.onlyFav; render(); return; }
    if (act === 'toggle-only-notes') { state.onlyNotes = !state.onlyNotes; render(); return; }
    if (act === 'reset-filters') { state.onlyFav = false; state.onlyNotes = false; render(); return; }
    if (act === 'toggle-fav') {
      ev.stopPropagation();
      const e = entryById(actionEl.dataset.id);
      if (!e) return;
      e.fav = !e.fav;
      saveDB();
      if (!e.fav && (state.view === 'favorites' || (state.view === 'tag' && state.onlyFav))) { render(); return; }
      actionEl.classList.toggle('is-on', e.fav);
      actionEl.setAttribute('aria-label', e.fav ? 'Убрать из избранного' : 'В избранное');
      return;
    }
    if (act === 'toggle-sheet-fav') {
      sheetFav = !sheetFav;
      actionEl.classList.toggle('is-on', sheetFav);
      actionEl.setAttribute('aria-label', sheetFav ? 'Убрать из избранного' : 'В избранное');
      return;
    }
    if (act === 'select-mode') { selectionMode = true; selectedIds.clear(); render(); return; }
    if (act === 'exit-selection') { selectionMode = false; selectedIds.clear(); render(); return; }
    if (act === 'toggle-select') {
      const id = actionEl.dataset.id;
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      render();
      return;
    }
    if (act === 'select-all') {
      const list = currentSelectionList();
      if (!list.length) return;
      if (selectedIds.size === list.length) selectedIds.clear();
      else list.forEach(function (e) { selectedIds.add(e.id); });
      render();
      return;
    }
    if (act === 'delete-selected') {
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      if (!confirm('Удалить ' + ids.length + ' ' + plural(ids.length, 'фразу', 'фразы', 'фраз') + '?')) return;
      const entries = ids.map(entryById).filter(Boolean);
      const snapshot = removeEntries(entries);
      selectionMode = false;
      selectedIds.clear();
      render();
      showUndoToast('Удалено: ' + entries.length, snapshot);
      return;
    }
    if (act === 'open-existing') { openEntry(actionEl.dataset.id, null, '', true); return; }
    if (act === 'duplicates') { go('duplicates'); return; }
    if (act === 'history') { go('history'); return; }
    if (act === 'cloud') { openCloudSheet(); return; }
    if (act === 'cloud-help') { openCloudHelp(); return; }
    if (act === 'cloud-connect') { connectYandex(); return; }
    if (act === 'cloud-upload') {
      uploadToYandex(db.entries, true).then(function () {
        if (sheetOpen) { closeSheet(true); render(); }
      });
      return;
    }
    if (act === 'cloud-disconnect') {
      if (!confirm('Отключить Яндекс Диск? Токен удалится с телефона, копии в облаке останутся.')) return;
      clearYandexToken();
      db.settings.cloudAuto = false;
      db.settings.cloudLast = 0;
      db.settings.cloudFile = '';
      db.settings.cloudError = '';
      saveDB();
      closeSheet(true);
      render();
      toast('Яндекс Диск отключён');
      return;
    }
    if (act === 'cloud-open-auth') {
      const idEl = $('#cloud-client');
      const clientId = idEl ? idEl.value.trim() : '';
      if (!clientId) { toast('Вставьте ClientID'); return; }
      window.open('https://oauth.yandex.ru/authorize?response_type=token&client_id=' + encodeURIComponent(clientId), '_blank', 'noopener');
      return;
    }
    if (act === 'open-version') { openVersionSheet(actionEl.dataset.id, false); return; }

    if (act === 'version-remove') {
      const versionId = actionEl.dataset.version;
      const entryId = actionEl.dataset.id;
      const entry = entryById(entryId);
      if (entry && !confirm('Удалить фразу «' + (entry.zh || entry.ru) + '» из словаря и из версии?')) return;
      if (entry) removeEntry(entry);
      db.history.forEach(function (v) { v.entries = v.entries.filter(function (x) { return x.id !== entryId; }); });
      db.history = db.history.filter(function (v) { return v.entries.length; });
      saveDB();
      render();
      if (db.history.some(function (v) { return v.id === versionId; })) openVersionSheet(versionId, true);
      else closeSheet(true);
      toast(entry ? 'Фраза удалена' : 'Убрана из истории');
      return;
    }

    if (act === 'version-restore') {
      const versionId = actionEl.dataset.version;
      const entryId = actionEl.dataset.id;
      const v = (db.history || []).find(function (x) { return x.id === versionId; });
      const copy = v && v.entries.find(function (x) { return x.id === entryId; });
      if (copy && !db.entries.some(function (x) { return x.id === copy.id; })) {
        const key = ((copy.zh || '') + '|' + (copy.ru || '')).toLowerCase();
        const already = db.entries.some(function (x) {
          return ((x.zh || '') + '|' + (x.ru || '')).toLowerCase() === key;
        });
        if (already) {
          toast('Такая фраза уже есть в словаре');
          return;
        }
        const restored = makeEntry(copy);
        db.entries.unshift(restored);
        db.removed = (db.removed || []).filter(function (k) { return k !== key; });
        saveDB();
        render();
      }
      openVersionSheet(versionId, true);
      toast('Фраза возвращена');
      return;
    }

    if (act === 'rollback-version') {
      const versionId = actionEl.dataset.id;
      const idx = (db.history || []).findIndex(function (v) { return v.id === versionId; });
      if (idx === -1) return;

      const affected = db.history.slice(0, idx + 1);
      const ids = new Set();
      affected.forEach(function (v) { v.entries.forEach(function (e) { ids.add(e.id); }); });
      const existing = db.entries.filter(function (e) { return ids.has(e.id); });

      if (!confirm('Удалить фразы, добавленные в этой и следующих версиях (' + existing.length + ')? Текущее состояние сохранится в резервной копии.')) return;

      createBackup('Перед откатом', true);
      existing.forEach(markRemoved);
      db.entries = db.entries.filter(function (e) { return !ids.has(e.id); });
      db.history = db.history.slice(idx + 1);
      db.forceNewVersion = true;
      saveDB();
      closeSheet(true);
      render();
      toast('Откат выполнен: удалено ' + existing.length);
      return;
    }

    if (act === 'backup-now') {
      createBackup('Ручная копия', false);
      return;
    }

    if (act === 'restore-backup') {
      const b = (db.backups || []).find(function (x) { return x.id === actionEl.dataset.id; });
      if (!b) return;
      if (!confirm('Восстановить копию от ' + formatDateTime(b.ts) + '? Текущий словарь заменится. Перед этим создастся ещё одна копия.')) return;
      createBackup('Перед восстановлением', true);
      db.entries = b.entries.map(function (e) { return makeEntry(e); });
      if (Array.isArray(b.topics)) db.topics = b.topics.map(function (t) { return makeTopic(t); });
      db.forceNewVersion = true;
      saveDB();
      render();
      toast('Копия восстановлена');
      return;
    }

    if (act === 'dup-delete') {
      const e = entryById(actionEl.dataset.id);
      if (!e) return;
      if (!confirm('Удалить фразу «' + (e.zh || e.ru) + '»?')) return;
      const snapshot = removeEntry(e);
      render();
      showUndoToast('Фраза удалена', snapshot);
      return;
    }

    if (act === 'dup-keep') {
      const key = actionEl.dataset.key;
      const found = buildDuplicateGroups().exact.filter(function (g) { return g[0] === key; })[0];
      if (!found) return;
      const list = found[1];
      if (!confirm('Оставить одну фразу из ' + list.length + '? Теги и заметки объединятся, лишние записи удалятся.')) return;

      const keeper = list.slice().sort(function (a, b) {
        return (b.note ? 1 : 0) - (a.note ? 1 : 0) ||
          b.tags.length - a.tags.length ||
          a.ts - b.ts;
      })[0];

      list.forEach(function (e) {
        if (e.id === keeper.id) return;
        keeper.tags = keeper.tags.concat(e.tags);
        if (!keeper.note && e.note) keeper.note = e.note;
        if (e.fav) keeper.fav = true;
        markRemoved(e);
      });
      keeper.tags = Array.from(new Set(keeper.tags));

      const ids = new Set(list.map(function (e) { return e.id; }));
      db.entries = db.entries.filter(function (e) { return !ids.has(e.id) || e.id === keeper.id; });
      saveDB();
      render();
      toast('Оставлена одна фраза, теги объединены');
      return;
    }
    if (act === 'batch-paste') { pasteFromClipboard(); return; }
    if (act === 'batch-import') { applyBatchImport(); return; }
    if (act === 'delete-entry') { if (sheetEntryId) deleteEntry(sheetEntryId); return; }
    if (act === 'add') { openEntry(null, state.view === 'tag' ? state.tag : null); return; }
    if (act === 'add-from-query') { openEntry(null, null, state.query.trim()); return; }

    if (act === 'export') { exportData(); return; }
    if (act === 'import') { const f = $('#import-file'); if (f) f.click(); return; }
    if (act === 'copy') {
      const payload = JSON.stringify({
        app: 'slovar', version: 1,
        entries: db.entries, settings: db.settings,
        removed: db.removed, history: db.history, backups: db.backups,
        pinnedTags: db.pinnedTags, topics: db.topics
      }, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(() => toast('JSON скопирован'), () => toast('Не удалось скопировать'));
      } else {
        toast('Копирование не поддерживается');
      }
      return;
    }
    if (act === 'import-add' || act === 'import-replace') {
      const data = (sheetRoot._data && sheetRoot._data.importData) || { entries: [] };
      applyImport(data, act === 'import-add' ? 'add' : 'replace');
      return;
    }
    if (act === 'manage-tags') { go('tagmanager'); return; }
    if (act === 'pin-tag') {
      const tag = actionEl.dataset.tag;
      const was = (db.pinnedTags || []).indexOf(tag) !== -1;
      togglePinnedTag(tag);
      render();
      toast(was ? 'Тег откреплён' : 'Тег закреплён');
      return;
    }
    if (act === 'merge-tag') {
      openMergeTagSheet(actionEl.dataset.tag);
      return;
    }
    if (act === 'merge-into') {
      const source = actionEl.dataset.source;
      const target = actionEl.dataset.target;
      if (!confirm('Объединить «' + source + '» в «' + target + '»? Все фразы сохранятся.')) return;
      replaceTag(source, target);
      closeSheet(true);
      render();
      toast('Теги объединены');
      return;
    }
    if (act === 'rename-tag') {
      const old = actionEl.dataset.tag;
      const next = prompt('Новое название тега', old);
      if (next == null) return;
      const clean = next.trim().replace(/\s+/g, ' ');
      if (!clean || clean === old) return;
      const existed = tagStats().some(function (t) { return t.name === clean; });
      replaceTag(old, clean);
      render();
      toast(existed ? 'Теги объединены' : 'Тег переименован');
      return;
    }
    if (act === 'delete-tag') {
      const tag = actionEl.dataset.tag;
      if (tag === 'Без тега') { toast('Тег «Без тега» удалить нельзя'); return; }
      const count = db.entries.filter(e => e.tags.indexOf(tag) !== -1).length;
      if (!confirm('Удалить тег «' + tag + '»? Он исчезнет у ' + count + ' ' + plural(count, 'фразы', 'фраз', 'фраз') + ', сами фразы останутся.')) return;
      removeTag(tag);
      render();
      toast('Тег удалён');
      return;
    }
    if (act === 'clear-all') {
      if (!confirm('Удалить все фразы, теги и настройки? Это необратимо.')) return;
      if (!confirm('Точно удалить? Рекомендуем сначала сделать экспорт.')) return;
      const theme = db.settings.theme;
      clearYandexToken();
      try { localStorage.removeItem('slovar.pass.v1'); } catch (e) { /* ignore */ }
      db = {
        entries: [], settings: Object.assign(defaultSettings(), { theme }),
        removed: [], history: [], backups: [], forceNewVersion: false,
        seedCleared: true, demoSeeded: true, lastCleanup: 0, pinnedTags: [], topics: [], v: 1
      };
      saveDB();
      render();
      toast('Все данные удалены');
      return;
    }
    if (act === 'share-app') { openShareSheet(); return; }
    if (act === 'share-link') { shareApp(); return; }
    if (act === 'copy-app-link') { copyAppLink(); return; }
    if (act === 'check-update') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg) reg.update().then(() => toast('Проверяем обновления…')).catch(() => toast('Не удалось проверить'));
        }).catch(() => toast('Не удалось проверить'));
      }
      setTimeout(() => location.reload(), 900);
      return;
    }
    if (act === 'install' || act === 'install-or-help') {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
        render();
      } else {
        openInstallHelp();
      }
      return;
    }
    if (act === 'test-voice') { speak('你好', null); return; }
    if (act === 'install-help') {
      openInstallHelp();
      return;
    }
  });

  document.addEventListener('change', function (ev) {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'theme') {
      db.settings.theme = el.value;
      saveDB();
      applyTheme();
      render();
    } else if (el.dataset.act === 'voice') {
      db.settings.voice = el.value;
      saveDB();
    } else if (el.dataset.act === 'sort') {
      db.settings.sort = el.value;
      saveDB();
      render();
    } else if (el.dataset.act === 'cloud-auto') {
      db.settings.cloudAuto = el.checked;
      saveDB();
      if (el.checked) maybeCloudBackup();
    }
  });

  document.addEventListener('input', function (ev) {
    const el = ev.target.closest('[data-act="rate"]');
    if (!el) return;
    db.settings.rate = Number(el.value);
    saveDB();
    const sub = el.closest('.row-main') && el.closest('.row-main').querySelector('.row-sub');
    if (sub) sub.textContent = Math.round(Number(el.value) * 100) + '% · скорость речи';
  });

  function focusSearch() {
    const input = $('#search-input');
    if (input) {
      input.focus();
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) { /* ignore */ }
    }
  }

  /* ───────────────────────── Табы, FAB, скролл ───────────────────────── */

  document.addEventListener('click', function (ev) {
    const tab = ev.target.closest('.tab');
    if (!tab) return;
    if (tab.dataset.tab === 'tags') go('tags');
    else if (tab.dataset.tab === 'topics') go('topics');
    else if (tab.dataset.tab === 'search') { go('search', { query: '' }); setTimeout(focusSearch, 60); }
    else if (tab.dataset.tab === 'add') {
      if (state.view === 'topics' || state.view === 'topic') openTopicSheet(null);
      else openEntry(null, state.view === 'tag' ? state.tag : null);
    }
    else go('settings');
  });

  window.addEventListener('scroll', function () {
    const bar = $('#topbar');
    if (bar) bar.classList.toggle('is-scrolled', window.scrollY > 4);
  }, { passive: true });

  /* ───────────────────────── PWA ───────────────────────── */

  function showUpdateBanner() {
    const banner = $('#update-banner');
    if (!banner) return;
    banner.hidden = false;
    document.body.classList.add('has-update');
    const btn = $('#update-btn');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => location.reload(), 250);
      });
    });
  }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.addEventListener('updatefound', function () {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', function () {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });
      }).catch(function () { /* офлайн-режим недоступен, приложение всё равно работает */ });
    });
  }

  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    deferredPrompt = ev;
    if (state.view === 'settings' || state.view === 'tags') render();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    render();
    toast('Приложение установлено');
  });

  if (window.matchMedia) {
    const standaloneMedia = window.matchMedia('(display-mode: standalone)');
    if (standaloneMedia.addEventListener) {
      standaloneMedia.addEventListener('change', function () { render(); });
    }
  }

  /* ───────────────────────── Старт ───────────────────────── */

  function initVoices() {
    if (!('speechSynthesis' in window)) return;
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
    // Safari/Chrome иногда отдают голоса с задержкой
    setTimeout(refreshVoices, 700);
    setTimeout(refreshVoices, 2000);
  }

  applyTheme();
  initVoices();

  // Компьютерная синхронизация убрана — старый пароль больше не нужен.
  try { localStorage.removeItem('slovar.pass.v1'); } catch (e) { /* ignore */ }
  if (!CLOUD_ENABLED) clearYandexToken();

  const removedSeed = cleanupLegacySeed();
  const removedOld = cleanupOldData();
  const demoAdded = seedDemoData();

  history.replaceState({ view: 'tags', tag: null, query: '', topicId: null }, '');
  render();
  handleEntryParams();

  if (demoAdded) {
    setTimeout(function () {
      toast('Добавлены примеры: теги и диалог «Знакомство»');
    }, 1800);
  }
  if (removedSeed) {
    setTimeout(function () {
      toast('Удалено стартовых фраз: ' + removedSeed + ' · копия сохранена');
    }, 900);
  }
  if (removedOld) {
    setTimeout(function () {
      toast('Удалены старые версии и копии: ' + removedOld);
    }, 1500);
  }

  setTimeout(maybeWeeklyBackup, 4000);
  setTimeout(maybeCloudBackup, 5500);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      cleanupOldData();
      maybeWeeklyBackup();
      maybeCloudBackup();
    }
  });

  if (navigator.storage && navigator.storage.persist) {
    try { navigator.storage.persist().catch(function () {}); } catch (e) { /* ignore */ }
  }

  // Отладочный доступ (не мешает работе)
  window.__slovar = { db, render, go, applyTheme, saveDB };
})();
