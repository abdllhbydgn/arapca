/* Arapça Öğren — Mısır Lehçesi Portalı
   Tek sayfalık uygulama: hash yönlendirme, yerel Mısır lehçesi çeviri motoru, sözlük, kelime kartları (Leitner),
   alfabe, konuşma rehberi, gramer & fiiller, çalışma defteri ve testler. Veriler data/*.js içinde gömülüdür. */
(function () {
  'use strict';
  const D = window.MASRI_DICT || { entries: [], cats: [] };
  const C = window.MASRI || {};
  const E = D.entries;
  const VB = window.MASRI_VERBS || { verbs: [], nouns: [] };
  const OR = window.MASRI_ORTAK || { sections: [], words: [], examples: [], rules: { franco: [], shift: [] }, tags: {} };
  const byId = new Map(E.map(e => [e.id, e]));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const view = $('#view');

  // ── Depolama / Storage ──
  const store = {
    get(k, d) { try { const v = localStorage.getItem('masri.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('masri.' + k, JSON.stringify(v)); } catch (e) {} try { if (window.MASRI_ONSET) window.MASRI_ONSET(k, v); } catch (e) {} }
  };
  let favs = new Set(store.get('favs', []));
  let cards = store.get('cards', {});
  const saveFavs = () => store.set('favs', Array.from(favs));
  const saveCards = () => store.set('cards', cards);
  (function streak() {
    const s = store.get('streak', { last: '', n: 0 });
    const today = new Date().toISOString().slice(0, 10);
    if (s.last !== today) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      s.n = s.last === y ? s.n + 1 : 1;
      s.last = today;
      store.set('streak', s);
    }
  })();

  // ── Puan (XP), seviye, günlük hedef ve konfeti / XP, level, daily goal and confetti ──
  const today = () => new Date().toISOString().slice(0, 10);
  const DAILY_GOAL = 50;
  const lvlOf = xp => Math.floor(Math.sqrt(xp / 40)) + 1;
  const lvlXP = l => 40 * (l - 1) * (l - 1);
  const LVL_NAMES = ['Çırak', 'Kalfa', 'Usta', 'Baş Usta', 'Ustabaşı', 'Ustaların Ustası', 'Masri Ustası', 'Kahire Efsanesi'];
  const lvlName = l => LVL_NAMES[Math.min(LVL_NAMES.length - 1, l - 1)];
  function xpState() { const x = store.get('xp', { total: 0, day: today(), n: 0 }); if (x.day !== today()) { x.day = today(); x.n = 0; } return x; }
  function addXP(n) {
    const x = xpState(), before = lvlOf(x.total), goalBefore = x.n >= DAILY_GOAL;
    x.total += n; x.n += n;
    store.set('xp', x);
    const after = lvlOf(x.total);
    if (after > before) { confetti(); toast('🎉 Seviye atladın! Seviye ' + after + ' · ' + lvlName(after)); }
    else if (!goalBefore && x.n >= DAILY_GOAL) { confetti(); toast('🏆 Günlük hedef tamam! +' + DAILY_GOAL + ' XP'); }
    else xpPop('+' + n + ' XP');
    try { buildSideCard(); } catch (e) {}
  }
  function xpPop(t) {
    const el = document.createElement('div');
    el.className = 'xp-pop';
    el.textContent = t;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
  function confetti() {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.className = 'confetti';
    c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const COLS = ['#FF5D73', '#FFB020', '#22C55E', '#2EC4F1', '#7C5CFF', '#FF5DA2', '#E9C46A'];
    const P = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: COLS[Math.floor(Math.random() * COLS.length)] }));
    const t0 = performance.now();
    const step = now => {
      const t = now - t0;
      g.clearRect(0, 0, c.width, c.height);
      P.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - t / 2200); g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); g.restore(); });
      if (t < 2200) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }
  const ringSvg = (pct, size, col) => { const r = size / 2 - 5, L = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct)); return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="7"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - v)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`; };

  // ── İkonlar / Icons ──
  const IC = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    tr: '<path d="M4 5h7M9 3v2c0 4.4-2.7 8-6 8"/><path d="M5 9c0 2.5 2.7 4.6 6 5"/><path d="m12 20 4-9 4 9M13.5 17h5"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
    cards: '<rect x="3" y="6" width="14" height="15" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
    abc: '<path d="M4 19 8 5l4 14M5.5 14h5"/><path d="M15 5h3a2.5 2.5 0 0 1 0 5h-3zM15 10h3.5a2.5 2.5 0 0 1 0 5H15z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/>',
    gram: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    pen: '<path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    vol: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
    swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    fire: '<path d="M12 22c4 0 7-2.7 7-7 0-5-5-7-4-12-3 1-7 5-7 9-1-1-2-2-2-4-2 2-3 4-3 7 0 4.3 4 7 9 7z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
    mega: '<path d="M3 10v4h4l6 4V6L7 10z"/><path d="M17 8a5 5 0 0 1 0 8M20 5a9 9 0 0 1 0 14"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    out: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
    verb: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    build: '<path d="M4 6h16M4 12h10M4 18h13"/><path d="m17 10 3 2-3 2"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    fab: '<path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/><path d="M7 17h2M12 17h2M17 17h2"/>'
  };
  const ic = (n, cls) => `<svg class="i${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

  // ── Metin normalleştirme / Normalisation ──
  const normAr = s => String(s || '').replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^ء-ي0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const fold = s => s.replace(/[çÇ]/g, 'c').replace(/[ğĞ]/g, 'g').replace(/[ıIİ]/g, 'i').replace(/[öÖ]/g, 'o').replace(/[şŞ]/g, 's').replace(/[üÜ]/g, 'u').replace(/[âÂ]/g, 'a').replace(/[îÎ]/g, 'i').replace(/[ûÛ]/g, 'u');
  const normTr = s => fold(String(s || '').toLocaleLowerCase('tr')).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const normFr = s => String(s || '').toLowerCase().replace(/[’'`´]/g, '2').replace(/[^a-z0-9\s]/g, ' ').replace(/(.)\1+/g, '$1').replace(/\s+/g, ' ').trim();
  const isAr = s => /[؀-ۿ]/.test(s);
  // Cümlelerde (k='p') virgül iki ayrı cümleyi ayırır, eş anlamlı değildir: parça eşleşmesi yanlış çeviri verir /
  // In sentences a comma separates clauses, not synonyms: partial matches would give wrong translations
  const trVariants = (t, phrase) => String(t || '').split(phrase ? /\s*[\/;|]\s*|\s+veya\s+/ : /\s*[\/;,|]\s*|\s+veya\s+/).map(normTr).filter(Boolean);

  // ── Dizinler / Indexes ──
  const IX = { tr: new Map(), ar: new Map(), fr: new Map(), trTok: new Map() };
  const add = (m, k, e) => { if (!k) return; let a = m.get(k); if (!a) m.set(k, a = []); if (!a.includes(e)) a.push(e); };
  E.forEach(e => {
    e._ar = normAr(e.ar); e._fr = normFr(e.fr); e._tr = normTr(e.tr); e._ok = normTr(e.ok);
    trVariants(e.tr, e.k === 'p').forEach(v => {
      add(IX.tr, v, e);
      // "gitmek" → "git" kökü / verb stem
      if (/(mek|mak)$/.test(v) && v.indexOf(' ') < 0) add(IX.tr, v.slice(0, -3), e);
      v.split(' ').forEach(w => w.length > 1 && add(IX.trTok, w, e));
    });
    add(IX.ar, e._ar, e);
    e._ar.split(' ').length === 1 && add(IX.ar, e._ar.replace(/^ال/, ''), e);
    add(IX.fr, e._fr, e);
    add(IX.fr, e._ok, e);
  });
  // Tek kelimeler önce, sonra kısa ifadeler / Single words first, then short phrases
  // Kadına özel söyleyişler ve uzun açıklamalar geriye / Feminine-only forms and long glosses go last
  const SRC_RANK = { ext: 0, fab: 0, a1: 0, conv: 1, core: 2, phr: 3, alf: 4 };
  const rank = e => (e.k === 'w' ? 0 : 1) * 1000 + (/\((k|kadın|kadına|dişil)/i.test(e.tr) ? 300 : 0) + (SRC_RANK[e.src] || 0) * 20 + Math.min(19, (e.tr || '').length / 3);
  // Aranan anlam kaydın birincil (ilk) anlamıysa öne alınır / Entries whose first meaning is the key come first
  IX.tr.forEach((a, k) => a.sort((x, y) => {
    const px = trVariants(x.tr, x.k === 'p').indexOf(k), py = trVariants(y.tr, y.k === 'p').indexOf(k);
    return (px < 0 ? 0 : Math.min(px, 2)) - (py < 0 ? 0 : Math.min(py, 2)) || rank(x) - rank(y);
  }));
  IX.ar.forEach(a => a.sort((x, y) => rank(x) - rank(y)));

  // ── Arama / Search ──
  function search(q, limit) {
    q = String(q || '').trim();
    if (!q) return [];
    const out = new Map();
    const push = (e, s) => { const o = out.get(e); if (o === undefined || s > o) out.set(e, s); };
    if (isAr(q)) {
      const n = normAr(q);
      E.forEach(e => {
        if (e._ar === n) push(e, 100);
        else if (e._ar.startsWith(n)) push(e, 70);
        else if (e._ar.includes(n)) push(e, 40);
      });
    } else {
      const t = normTr(q), f = normFr(q);
      E.forEach(e => {
        let s = 0;
        if (trVariants(e.tr, e.k === 'p').includes(t)) s = 100;
        else if (e._tr.startsWith(t)) s = 75;
        else if ((' ' + e._tr).includes(' ' + t)) s = 60;
        else if (e._tr.includes(t)) s = 35;
        if (f.length > 1) {
          if (e._fr === f || e._ok === t) s = Math.max(s, 95);
          else if (e._fr.startsWith(f) || e._ok.startsWith(t)) s = Math.max(s, 55);
          else if (f.length > 3 && (e._fr.includes(f) || e._ok.includes(t))) s = Math.max(s, 30);
        }
        if (s) push(e, s - (e.k === 'w' ? 0 : 3) - Math.min(10, e._tr.length / 12));
      });
    }
    return Array.from(out.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit || 60).map(x => x[0]);
  }

  // ── Sesli okuma / Text-to-speech ──
  let voices = [];
  const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch (e) {} };
  if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  // Kayıtlı Mısır lehçesi sesleri (audio/, ar-EG Shakir erkek sesi) önce; yoksa cihazın ar-EG sesi, o da yoksa herhangi bir Arapça ses /
  // Recorded Egyptian audio first; otherwise the device's ar-EG voice, then any Arabic voice
  const audioKey = t => {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    let h = 0x811C9DC5;
    for (const b of new TextEncoder().encode(t)) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + '-' + t.length;
  };
  let audioIdx = null, audioLoad = null, curAudio = null;
  let slow = !!store.get('slow', false);
  const newAudio = k => { const a = new Audio('audio/' + k + '.mp3'); a.playbackRate = slow ? .75 : 1; a.preservesPitch = true; return a; };
  const loadAudioIdx = () => audioLoad || (audioLoad = fetch('audio/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : { keys: [] }).then(j => { audioIdx = new Set(j.keys || []); }).catch(() => { audioIdx = new Set(); }));
  loadAudioIdx();
  // Yalnız Mısır Arapçası (ar-EG) cihaz sesi kullanılır; standart Arapça (Fusha) sese asla düşülmez /
  // Only an Egyptian (ar-EG) device voice is used; never a standard Arabic (Fusha) voice
  function deviceSpeak(text, btn) {
    const eg = 'speechSynthesis' in window ? voices.find(v => /ar[-_]EG/i.test(v.lang)) : null;
    if (!eg) { if (btn) btn.classList.remove('playing'); toast('Bu metnin Mısır lehçesi ses kaydı yok'); return; }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = eg; u.lang = eg.lang; u.rate = slow ? .65 : .85;
      if (btn) u.onend = u.onerror = () => btn.classList.remove('playing');
      speechSynthesis.speak(u);
    } catch (e) { if (btn) btn.classList.remove('playing'); }
  }
  // Kaydı olmayan cümle: kelimelerin kayıtlı Mısır sesleri sırayla çalınır / Unrecorded sentence: recorded word clips in sequence
  function playSequence(keys, btn, onFail) {
    let i = 0;
    const next = () => {
      if (i >= keys.length) { if (btn) btn.classList.remove('playing'); return; }
      const a = curAudio = newAudio(keys[i++]);
      a.onended = next;
      a.onerror = next;
      a.play().catch(() => { if (i === 1 && onFail) onFail(); else next(); });
    };
    try { if (curAudio) curAudio.pause(); } catch (e) {}
    next();
  }
  function speak(text, btn) {
    text = String(text || '').trim();
    if (!text) return;
    if (btn) btn.classList.add('playing');
    const done = () => { if (btn) btn.classList.remove('playing'); };
    const go = () => {
      const k = audioKey(text);
      if (audioIdx && audioIdx.has(k)) {
        try { if (curAudio) curAudio.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {}
        const a = curAudio = newAudio(k);
        let fell = false;
        const fallback = () => { if (fell) return; fell = true; deviceSpeak(text, btn); };
        a.onended = done;
        a.onerror = fallback;
        a.play().catch(fallback);
      } else {
        const parts = text.replace(/[؟?!.,،:؛]/g, ' ').split(/\s+/).filter(Boolean).map(audioKey).filter(k2 => audioIdx && audioIdx.has(k2));
        if (parts.length && parts.length >= text.split(/\s+/).filter(Boolean).length * .6) playSequence(parts, btn, () => deviceSpeak(text, btn));
        else deviceSpeak(text, btn);
      }
    };
    audioIdx ? go() : loadAudioIdx().then(go);
  }
  const playBtn = (ar, extra) => `<button class="icon-btn play${extra ? ' ' + extra : ''}" data-say="${esc(ar)}" title="Dinle" aria-label="Dinle">${ic('vol')}</button>`;
  const favBtn = e => `<button class="icon-btn${favs.has(e.id) ? ' on' : ''}" data-fav="${e.id}" title="Favorilere ekle" aria-label="Favori">${ic('star')}</button>`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ── Kart görünümü / Entry card ──
  const catEmoji = name => (D.cats.find(c => c.name === name) || {}).emoji || '•';
  function entryHtml(e, opt) {
    opt = opt || {};
    const ex = e.ex && e.ex.ar ? `<div class="ex"><div class="ar">${esc(e.ex.ar)}</div><div><b>${esc(e.ex.ok || e.ex.fr || '')}</b> — ${esc(e.ex.tr || '')}</div></div>` : '';
    const extra = [e.pl ? 'Çoğul: <span class="ar">' + esc(e.pl) + '</span>' : '', e.fem ? 'Dişil: <span class="ar">' + esc(e.fem) + '</span>' : '', e.note ? esc(e.note) : ''].filter(Boolean).join(' · ');
    return `<article class="card entry fade">
      <div class="top-row"><span class="tag">${e.em ? esc(e.em) : catEmoji(e.cat)} ${esc(e.cat)}</span>${e.lv ? `<span class="lv">${esc(e.lv)}</span>` : ''}${favBtn(e)}${playBtn(e.ar)}</div>
      <div class="ar">${esc(e.ar)}</div>
      <div class="read-row"><span><small>Okunuş</small> <span class="ok">${esc(e.ok)}</span></span><span><small>Franko</small> <span class="fr">${esc(e.fr)}</span></span></div>
      <div class="tr">${esc(e.tr)}</div>
      ${extra ? `<div class="meta">${extra}</div>` : ''}${ex}
    </article>`;
  }

  // ── Yönlendirme / Routing ──
  const NAV = [
    ['', 'home', 'Ana Sayfa'], ['fabrika', 'fab', 'Fabrika Dili', () => E.filter(e => e.src === 'fab').length || ''], ['cumlekur', 'build', 'Cümle Kur'], ['ortak', 'link', 'Ortak Kelimeler', () => OR.words.length || ''], ['ceviri', 'tr', 'Çeviri'], ['sozluk', 'book', 'Sözlük', () => E.length],
    ['h', 'Öğren'], ['kartlar', 'cards', 'Kelime Kartları'], ['alfabe', 'abc', 'Alfabe', () => ((C.alphabet || {}).letters || []).length],
    ['konusma', 'chat', 'Konuşma Rehberi', () => ((C.conv || {}).topics || []).length], ['gramer', 'gram', 'Gramer'], ['fiiller', 'verb', 'Fiiller', () => ((C.grammar || {}).verbs || []).length],
    ['h', 'Pratik'], ['alistirma', 'pen', 'Çalışma Defteri'], ['test', 'quiz', 'Test Çöz'], ['favoriler', 'star', 'Favorilerim', () => favs.size]
  ];
  const NAV_COL = { '': '#FFB020', fabrika: '#FF7A45', ceviri: '#2EC4F1', sozluk: '#E9C46A', kartlar: '#7C5CFF', alfabe: '#FF5D73', konusma: '#22C55E', gramer: '#C084FC', fiiller: '#FACC15', alistirma: '#38BDF8', test: '#FF5DA2', favoriler: '#FBBF24' };
  function buildSideCard() {
    const s = store.get('streak', { n: 1 }), x = xpState(), l = lvlOf(x.total), a = lvlXP(l), b = lvlXP(l + 1);
    $('#sideCard').innerHTML = `<div class="lvl"><span class="lvl-b">Sv. ${l}</span><div><b>${esc(lvlName(l))}</b><small>${x.total} XP · sonraki seviyeye ${b - x.total} XP</small></div></div>
      <div class="xpbar"><i style="width:${((x.total - a) / (b - a) * 100).toFixed(1)}%"></i></div>
      <div class="side-mini"><span>🔥 ${s.n} gün seri</span><span>🎯 Bugün ${Math.min(x.n, DAILY_GOAL)}/${DAILY_GOAL}</span></div>`;
  }
  function buildNav() {
    // Üyelik modülü menüyü süzebilir (kilit, yönetim bölümü) / The membership module may filter the menu (locks, admin section)
    const items = window.MASRI_NAV_FILTER ? window.MASRI_NAV_FILTER(NAV.slice()) : NAV;
    $('#nav').innerHTML = items.map(n => n[0] === 'h' ? `<div class="nav-h">${n[1]}</div>` : `<a href="#/${n[0]}" data-r="${n[0]}" style="--nc:${NAV_COL[n[0]] || n[5] || '#E9C46A'}"><span class="ni">${ic(n[1])}</span><span>${n[2]}</span>${n[4] === 'lock' ? '<span class="lockb" title="Üyelere özel">🔒</span>' : n[3] ? `<span class="cnt">${n[3]()}</span>` : ''}</a>`).join('');
    $('#bnav').innerHTML = [['', 'home', 'Ana'], ['ceviri', 'tr', 'Çeviri'], ['sozluk', 'book', 'Sözlük'], ['kartlar', 'cards', 'Kartlar']].map(n => `<a href="#/${n[0]}" data-r="${n[0]}">${ic(n[1])}<span>${n[2]}</span></a>`).join('') + `<button id="bMore">${ic('more')}<span>Daha</span></button>`;
    buildSideCard();
  }
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const q = {};
    (qs || '').split('&').forEach(p => { if (!p) return; const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); });
    return { r: parts[0] || '', a: parts.slice(1), q: q };
  }
  const ROUTES = {};
  // Site içi gezinme geçmişi: Geri/İleri yalnız site içinde çalışır / In-site history: Back/Forward stay inside the site
  const NAVH = { stack: [location.hash || '#/'], pos: 0 };
  window.addEventListener('hashchange', () => {
    const h = location.hash || '#/';
    if (NAVH.stack[NAVH.pos] === h) return;
    if (NAVH.stack[NAVH.pos - 1] === h) NAVH.pos--;
    else if (NAVH.stack[NAVH.pos + 1] === h) NAVH.pos++;
    else { NAVH.stack = NAVH.stack.slice(0, NAVH.pos + 1).concat(h); NAVH.pos++; }
  });
  const PAGE_NAMES = { '': 'Ana Sayfa', fabrika: 'Fabrika Dili', cumlekur: 'Cümle Kur', ortak: 'Ortak Kelimeler', ceviri: 'Çeviri', sozluk: 'Sözlük', kartlar: 'Kelime Kartları', alfabe: 'Alfabe', konusma: 'Konuşma Rehberi', gramer: 'Gramer', fiiller: 'Fiiller', alistirma: 'Çalışma Defteri', test: 'Test Çöz', favoriler: 'Favorilerim', giris: 'Giriş', hesabim: 'Hesabım', admin: 'Yönetim' };
  function drawPnav(r) {
    const el = $('#pnav');
    if (!el) return;
    const t = (($('.ph h1', view) || {}).textContent || PAGE_NAMES[r] || '').trim();
    el.innerHTML = `<button class="pn-b" id="pnBack" ${NAVH.pos > 0 ? '' : 'disabled'} aria-label="Geri">${ic('back')}<span>Geri</span></button>
      <button class="pn-b" id="pnFwd" ${NAVH.pos < NAVH.stack.length - 1 ? '' : 'disabled'} aria-label="İleri"><span>İleri</span>${ic('arrow')}</button>
      <a class="pn-b home${r === '' ? ' on' : ''}" href="#/" aria-label="Ana sayfa">${ic('home')}<span>Ana Sayfa</span></a>
      <span class="pn-t">${esc(t)}</span>`;
    $('#pnBack').onclick = () => { if (NAVH.pos > 0) history.back(); };
    $('#pnFwd').onclick = () => { if (NAVH.pos < NAVH.stack.length - 1) history.forward(); };
  }
  function render() {
    const { r, a, q } = parseHash();
    $$('#nav a, #bnav a').forEach(x => x.classList.toggle('on', x.dataset.r === r || (x.dataset.r && x.dataset.r.indexOf('/') > 0 && location.hash.indexOf('#/' + x.dataset.r) === 0)));
    closeSide();
    if (window.MASRI_GATE && !window.MASRI_GATE(r) && ROUTES.__locked) ROUTES.__locked(r, a, q);
    else (ROUTES[r] || ROUTES[''])(a, q);
    try { if (window.MASRI_AFTER_RENDER) window.MASRI_AFTER_RENDER(r, a, q); } catch (e) {}
    drawPnav(r);
    if (!render._first) window.scrollTo(0, 0);
    render._first = false;
    { const h1 = ($('.ph h1', view) || {}).textContent; const pg = h1 ? h1.replace(/^[^A-Za-z0-9\u00C0-\u024F\u0600-\u06FF]+/, '').trim() : ''; document.title = pg ? 'Arapça Öğren | ' + pg : 'Arapça Öğren | Mısır Lehçesi Portalı'; }
  }
  render._first = true;
  const go = h => { location.hash = h; };
  const pageHead = (title, sub, right, crumb) => `<div class="ph">${crumb ? '' : ''}<div>${crumb ? `<div class="crumb">${crumb}</div>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right || ''}</div>`;

  // ── Ana sayfa / Home ──
  const dayIdx = n => { const d = new Date(); return (d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate()) % n; };
  ROUTES[''] = function () {
    const words = E.filter(e => e.k === 'w' && e.ex && e.ex.ar);
    const wd = words.length ? words[dayIdx(words.length)] : E[dayIdx(E.length)];
    const phr = E.filter(e => e.k === 'p' && e.src === 'conv');
    const pd = phr.length ? phr[(dayIdx(phr.length) * 7) % phr.length] : null;
    const s = store.get('streak', { n: 1 });
    const learned = Object.values(cards).filter(c => c.box >= 2).length;
    const due = dueCount();
    const mods = [
      ['fabrika', '🧵', '#FBF1DA', 'Fabrika Dili', 'Konfeksiyon atölyesinin halk dili: makine, hat, kalite, vardiya'],
      ['cumlekur', '🧩', '#FFF1E6', 'Cümle Kur', 'Kim, ne zaman, hangi fiil: kendi cümleni kur, doğru çekimle dinle'],
      ['ortak', '🔗', '#E4EDF9', 'Ortak Kelimeler', 'Türkçeyle benzer ' + OR.words.length + ' kelime: ortak, Osmanlı, Batı, dikkat'],
      ['ceviri', '🔁', '#DDF4F1', 'Çeviri', 'Türkçe ⇄ Mısır lehçesi, kelime kelime açıklamalı'],
      ['sozluk', '📖', '#FBF1DA', 'Sözlük', E.length.toLocaleString('tr-TR') + ' kelime ve ifade'],
      ['kartlar', '🃏', '#E8EEFB', 'Kelime Kartları', due ? due + ' kart tekrar bekliyor' : '3 kutu yöntemiyle ezberle'],
      ['alfabe', '🔤', '#FDE7E7', 'Alfabe', '28 harf, Mısır telaffuzu ve örnek kelimeler'],
      ['konusma', '💬', '#E3F6EA', 'Konuşma Rehberi', 'Günlük durumlar, diyaloglar ve kalıplar'],
      ['gramer', '✍️', '#F1E8FB', 'Gramer', 'Zamirler, zamanlar, olumsuzluk ve daha fazlası'],
      ['fiiller', '⚡', '#FFF3D6', 'Fiiller', 'Çekim tabloları ve örnekler'],
      ['alistirma', '📝', '#E0F2FE', 'Çalışma Defteri', 'Etkileşimli alıştırmalar, anında kontrol'],
      ['test', '🎯', '#FCE7F3', 'Test Çöz', 'Kendini dene: çoktan seçmeli ve dinleme']
    ];
    const x = xpState(), lv = lvlOf(x.total);
    const Q = C.quotes || [];
    view.innerHTML = `<section class="gt-home fade"><div class="gt-title"><h2>Çeviri</h2><a class="btn sm ghost" href="#/cumlekur">🧩 Cümle Kur</a></div>${trBoxHtml()}<div class="hero-hints gt-hints">${['Nasılsın?', 'Ne kadar?', 'Anlamadım', 'Su istiyorum', 'Makine bozuldu', 'معلش'].map(x => `<button type="button" data-hint="${esc(x)}">${esc(x)}</button>`).join('')}</div></section>` + `<section class="hero fade">
        <div class="hero-float" aria-hidden="true"><span>ع</span><span>ب</span><span>م</span><span>ص</span><span>ر</span><span>ك</span></div>
        <h1>Ahlan wa sahlan! 👋</h1>
        <p>Mısır lehçesini (Masri) Türkçe açıklamalarla öğren: çeviri, sözlük, kartlar, konuşma ve gramer bir arada.</p>
      </section>
      <div class="stats">
        <div class="stat vivid" style="--g1:#7C5CFF;--g2:#C084FC"><div class="ringbox">${ringSvg(x.n / DAILY_GOAL, 58, '#fff')}<span>${Math.min(100, Math.round(x.n / DAILY_GOAL * 100))}%</span></div><div><b>${Math.min(x.n, DAILY_GOAL)}/${DAILY_GOAL} XP</b><small>Günlük hedef</small></div></div>
        <div class="stat vivid" style="--g1:#FFB020;--g2:#FF7A45"><div class="ic">🏅</div><div><b>Seviye ${lv}</b><small>${esc(lvlName(lv))} · ${x.total} XP</small></div></div>
        <div class="stat vivid" style="--g1:#FF5D73;--g2:#FF5DA2"><div class="ic flame">🔥</div><div><b>${s.n} gün</b><small>çalışma serisi</small></div></div>
        <a class="stat vivid" href="#/kartlar${due ? '/tekrar' : ''}" style="--g1:#22C55E;--g2:#2EC4F1;text-decoration:none"><div class="ic">🃏</div><div><b>${due} kart</b><small>${due ? 'tekrar bekliyor →' : learned + ' kart öğrenildi'}</small></div></a>
      </div>
      <div class="grid g2">
        ${wd ? `<div class="card day"><span class="tag">⭐ Günün kelimesi · ${esc(wd.cat)}</span><div class="ar">${esc(wd.ar)}</div><div class="read-row"><span class="ok" style="font-weight:800;font-size:18px;">${esc(wd.ok)}</span><span class="fr" style="font-family:monospace;color:var(--teal)">${esc(wd.fr)}</span></div><div style="font-size:17px;font-weight:700;">${esc(wd.tr)}</div>${wd.ex ? `<div class="meta" style="color:var(--muted)"><span class="ar" style="font-size:18px">${esc(wd.ex.ar)}</span> — ${esc(wd.ex.tr)}</div>` : ''}<div style="display:flex;gap:8px;margin-top:6px;">${playBtn(wd.ar)}${favBtn(wd)}<button class="btn sm ghost" id="luckyBtn" style="margin-left:auto">🎲 Şans kelimesi</button></div></div>` : ''}
        ${pd ? `<div class="card day"><span class="tag">💬 Günün ifadesi · ${esc(pd.cat)}</span><div class="ar" style="font-size:30px">${esc(pd.ar)}</div><div class="read-row"><span class="ok" style="font-weight:800;font-size:17px;">${esc(pd.ok)}</span></div><div style="font-size:16px;font-weight:700;">${esc(pd.tr)}</div><div style="display:flex;gap:8px;margin-top:6px;">${playBtn(pd.ar)}${favBtn(pd)}</div></div>` : ''}
      </div>
      <div class="sec-h"><h2>Modüller</h2></div>
      <div class="grid g3">${mods.map((m, i) => `<a class="card mod vivid-mod" href="#/${m[0]}" style="--mc:${NAV_COL[m[0]] || '#E9C46A'};animation-delay:${i * 40}ms"><div class="ic">${m[1]}</div><div><b>${m[3]}</b><small>${m[4]}</small></div><span class="go">${ic('arrow')}</span></a>`).join('')}</div>
      <div class="sec-h"><h2>Mısır lehçesi ipuçları</h2></div>
      <div class="grid g3">
        <div class="card pad"><b>ج = G</b><p style="margin:6px 0 0;color:var(--muted)">Mısır'da ج sert "g" okunur: <span class="ar">جميل</span> → gamiil (güzel).</p></div>
        <div class="card pad"><b>ق = hemze</b><p style="margin:6px 0 0;color:var(--muted)">Kahire'de ق çoğunlukla yutulur: <span class="ar">قلب</span> → 'alb (kalp).</p></div>
        <div class="card pad"><b>ب- = şimdiki zaman</b><p style="margin:6px 0 0;color:var(--muted)">Fiilin başına b- gelir: <span class="ar">باكل</span> → bākol (yiyorum).</p></div>
      </div>` + (Q.length ? `<section class="quote q-small fade" id="quote"></section>` : '');
    // Günün sözü: her gün değişir, oklarla önceki/sonraki günlere bakılır / Saying of the day, browsable
    let qOff = 0;
    const drawQuote = () => {
      const box = $('#quote');
      if (!box || !Q.length) return;
      const i = ((dayIdx(Q.length) + qOff) % Q.length + Q.length) % Q.length, q = Q[i];
      const d = new Date(Date.now() + qOff * 864e5).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
      box.innerHTML = `<div class="q-head"><span class="q-badge">🌟 Günün Sözü</span><span class="q-date">${qOff ? esc(d) : 'Bugün · ' + esc(d)}</span><span class="q-nav"><button class="icon-btn" id="qPrev" title="Önceki gün" aria-label="Önceki gün">‹</button><button class="icon-btn" id="qNext" title="Sonraki gün" aria-label="Sonraki gün">›</button></span></div>
        <div class="q-body"><div class="q-ar ar">${esc(q.ar)}</div><div class="q-side">${playBtn(q.ar, 'q-play')}</div></div>
        <div class="q-ok">${esc(q.ok)}</div><div class="q-tr">“${esc(q.tr)}”</div><div class="q-mean">💡 ${esc(q.mean || '')}</div>`;
      $('#qPrev').onclick = () => { qOff--; drawQuote(); };
      $('#qNext').onclick = () => { qOff++; drawQuote(); };
    };
    drawQuote();
    const lucky = $('#luckyBtn');
    if (lucky) lucky.onclick = () => {
      const pool = E.filter(e => e.k === 'w' && e.src !== 'alf');
      const e = pool[Math.floor(Math.random() * pool.length)];
      const card = lucky.closest('.day');
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      card.innerHTML = `<span class="tag">🎲 Şans kelimesi · ${esc(e.cat)}</span><div class="ar">${esc(e.ar)}</div><div class="read-row"><span class="ok" style="font-weight:800;font-size:18px;">${esc(e.ok)}</span><span class="fr" style="font-family:monospace;color:var(--teal)">${esc(e.fr)}</span></div><div style="font-size:17px;font-weight:700;">${esc(e.tr)}</div><div style="display:flex;gap:8px;margin-top:6px;">${playBtn(e.ar)}${favBtn(e)}<button class="btn sm ghost" id="luckyBtn" style="margin-left:auto">🎲 Bir tane daha</button></div>`;
      $('#luckyBtn').onclick = lucky.onclick;
      speak(e.ar);
    };
    // Ana sayfa çeviri kutusu: Çeviri sayfasıyla aynı motor ve tasarım / Home translator: same engine and design as the Translate page
    mountTranslator('', { hash: false, focus: false, more: false });
    $$('[data-hint]').forEach(b => b.onclick = () => { const i = $('#trIn'); i.value = b.dataset.hint; i.dispatchEvent(new Event('input')); });
  };

  // ── Çeviri motoru / Translation engine ──
  // 1) Tam ifade eşleşmesi  2) Benzer ifadeler  3) Kelime kelime çözümleme (ek ayıklama)  4) İsteğe bağlı makine çevirisi
  const TR_SUFFIX = ['lerimizden', 'larımızdan', 'lerinden', 'larından', 'lerimiz', 'larımız', 'leri', 'ları', 'ler', 'lar', 'imiz', 'ımız', 'umuz', 'ümüz', 'iniz', 'ınız', 'den', 'dan', 'ten', 'tan', 'de', 'da', 'te', 'ta', 'yi', 'yı', 'yu', 'yü', 'ye', 'ya', 'nin', 'nın', 'nun', 'nün', 'in', 'ın', 'un', 'ün', 'im', 'ım', 'um', 'üm', 'i', 'ı', 'u', 'ü', 'e', 'a', 'm', 'n', 'yor', 'iyor', 'ıyor', 'uyor', 'üyor', 'yorum', 'iyorum', 'ıyorum', 'uyorum', 'üyorum', 'dim', 'dım', 'dum', 'düm', 'tim', 'tım', 'di', 'dı', 'du', 'dü', 'ti', 'tı', 'mak', 'mek', 'sun', 'sün', 'sin', 'sın', 'ım', 'yım', 'yim', 'mı', 'mi', 'mu', 'mü'].map(fold).sort((a, b) => b.length - a.length);
  function lookupTrToken(tok) {
    if (IX.tr.has(tok)) return IX.tr.get(tok);
    // Olumsuz fiil (anla-ma-dım): olumlu fiil verilmez; hazır kalıp yoksa "مش" ile tahmini olumsuz /
    // Negative verb: never return the positive verb; without a ready phrase, an approximate "مش" negative
    const neg = /^(.{2,}?)(ma|me)(di|dim|din|dik|diniz|diler|dilar|yor|yorum|yorsun|yoruz|z|m|n|sin|sun|yacak|yecek|yacagim|yecegim|mis|misim)$/.exec(tok);
    if (neg) {
      const st = neg[1], st2 = st.replace(/d$/, 't').replace(/g$/, 'k');
      for (const k of [st + 'mek', st + 'mak', st2 + 'mek', st2 + 'mak']) if (IX.tr.has(k)) {
        const e = pickForm(IX.tr.get(k)[0], 'yor');
        return [Object.assign({}, e, { ar: 'مش ' + e.ar, ok: 'miş ' + e.ok, fr: 'mesh ' + e.fr, tr: 'olumsuz: ' + e.tr, _neg: true })];
      }
    }
    for (let cut = 0; cut < 3; cut++) {
      let w = tok;
      for (let n = 0; n <= cut; n++) { const s = TR_SUFFIX.find(x => w.length - x.length >= 2 && w.endsWith(x)); if (!s) break; w = w.slice(0, -s.length); }
      if (w !== tok) {
        // Çekimli kelimede önce mastar aranır (gidiyorum → gitmek) / For inflected words the infinitive is tried first
        const ws = w.replace(/d$/, 't').replace(/ğ$/, 'k').replace(/g$/, 'k');
        for (const k of [w + 'mek', w + 'mak', ws + 'mek', ws + 'mak', w, ws]) if (IX.tr.has(k)) return IX.tr.get(k);
      }
    }
    // Ünsüz yumuşaması: kitabı → kitap / Consonant softening
    const soft = tok.replace(/b$/, 'p').replace(/c$/, 'ç').replace(/d$/, 't').replace(/g$/, 'k');
    if (soft !== tok && IX.tr.has(soft)) return IX.tr.get(soft);
    return null;
  }
  const AR_PRE = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ه', 'ح', 'م'];
  const AR_SUF = ['كوا', 'وها', 'هم', 'كم', 'نا', 'ها', 'ك', 'ه', 'ي', 'ش', 'وا', 'ت'];
  function lookupArToken(tok) {
    if (IX.ar.has(tok)) return IX.ar.get(tok);
    for (const p of [''].concat(AR_PRE)) {
      if (p && !tok.startsWith(p)) continue;
      const w = tok.slice(p.length);
      if (w.length < 2) continue;
      if (IX.ar.has(w)) return IX.ar.get(w);
      for (const s of AR_SUF) if (w.endsWith(s) && w.length - s.length >= 2 && IX.ar.has(w.slice(0, -s.length))) return IX.ar.get(w.slice(0, -s.length));
    }
    return null;
  }
  // "مشي / بمشي" gibi geçmiş / şimdiki çiftlerinden cümleye uygun olanı seçer / Picks past or present from "past / present" pairs
  function pickForm(e, src) {
    const A = String(e.ar).split(/\s*\/\s*/), O = String(e.ok || '').split(/\s*\/\s*/), F = String(e.fr || '').split(/\s*\/\s*/);
    if (A.length !== 2) {
      // Sözlük notundaki "geniş zaman: بروح (barûh)" biçimi / Present form from the note
      const m = /geniş zaman:\s*([\u0600-\u06FF]+)\s*\(([^)]+)\)/.exec(e.note || '');
      return m && /(yor|yorum|yorsun|yoruz|r|rim|rum|riz)$/.test(String(src || '').split(' ').pop()) ? Object.assign({}, e, { ar: m[1], ok: m[2], fr: m[2] }) : e;
    }
    const j = /(yor|yorum|yorsun|yoruz|r|rim|rum|riz|ir|ar)$/.test(String(src || '').split(' ').pop()) ? 1 : 0;
    return Object.assign({}, e, { ar: A[j], ok: O[j] || O[0], fr: F[j] || F[0] });
  }
  function translate(text, dir) {
    const res = { exact: [], similar: [], gloss: [] };
    if (!text.trim()) return res;
    if (dir === 'ar') {
      const n = normAr(text);
      res.exact = (IX.ar.get(n) || []).slice(0, 6);
      const toks = n.split(' ');
      let i = 0;
      while (i < toks.length) {
        let hit = null, len = 0;
        for (let L = Math.min(4, toks.length - i); L >= 1; L--) { const k = toks.slice(i, i + L).join(' '); const h = L > 1 ? IX.ar.get(k) : lookupArToken(k); if (h) { hit = h; len = L; break; } }
        res.gloss.push(hit ? { src: toks.slice(i, i + len).join(' '), e: hit[0] } : { src: toks[i], e: null });
        i += len || 1;
      }
      if (!res.exact.length) res.similar = search(text, 8);
    } else {
      const t = normTr(text), f = normFr(text);
      res.exact = (IX.tr.get(t) || []).slice(0, 6);
      if (!res.exact.length && f) res.exact = (IX.fr.get(f) || []).slice(0, 6);
      const toks = t.split(' ');
      let i = 0;
      while (i < toks.length) {
        let hit = null, len = 0;
        for (let L = Math.min(4, toks.length - i); L >= 1; L--) { const k = toks.slice(i, i + L).join(' '); const h = L > 1 ? IX.tr.get(k) : lookupTrToken(k); if (h) { hit = h; len = L; break; } }
        res.gloss.push(hit ? { src: toks.slice(i, i + len).join(' '), e: pickForm(hit[0], toks.slice(i, i + len).join(' ')) } : { src: toks[i], e: null });
        i += len || 1;
      }
      // Türkçe fiil sonda, Mısır Arapçasında başta (özneden sonra) gelir / Turkish verb-final → Egyptian SVO
      const isVerb = g => g.e && (g.e.cat === 'Fiiller' || /(yor|yorum|yorsun|yoruz|iyor|dim|dum|dım|düm|tim|tum|di|dı|du|dü|cak|cek|cagim|cegim|mek|mak|abilir|ebilir|malı|meli|istiyorum|istiyor)$/.test(g.src.split(' ').pop()));
      const tail = new Set(['lutfen', 'mi', 'mu', 'misin', 'musun', 'de', 'da', 'artik', 'simdi', 'hemen']);
      let end = res.gloss.length;
      while (end > 0 && tail.has(res.gloss[end - 1].src)) end--;
      const vi = end - 1;
      if (vi > 0 && isVerb(res.gloss[vi]) && !isVerb(res.gloss[0])) {
        const v = res.gloss.splice(vi, 1)[0];
        const subj = res.gloss[0].e && /Zamir/.test(res.gloss[0].e.cat) ? 1 : 0;
        res.gloss.splice(subj, 0, v);
      }
      if (!res.exact.length) {
        // Ortak kelime sayısına göre benzer ifadeler / Similar phrases by shared tokens
        const set = new Set(toks.filter(w => w.length > 1));
        const score = new Map();
        set.forEach(w => (IX.trTok.get(w) || []).forEach(e => score.set(e, (score.get(e) || 0) + 1)));
        res.similar = Array.from(score.entries()).filter(x => x[1] >= Math.max(1, Math.ceil(set.size / 2))).sort((a, b) => b[1] - a[1] || (set.size > 1 ? (a[0].k === 'p' ? 0 : 1) - (b[0].k === 'p' ? 0 : 1) : 0) || a[0]._tr.length - b[0]._tr.length).slice(0, 8).map(x => x[0]);
        if (!res.similar.length) res.similar = search(text, 8);
      }
    }
    return res;
  }
  const trBoxHtml = () => `<div class="card tr-box gt">
      <div class="gt-bar"><span class="lang gt-l" id="lIn"></span><button id="trSwap" class="gt-swap" aria-label="Yön değiştir" title="Yön değiştir">${ic('swap')}</button><span class="lang gt-l gt-r" id="lOut"></span></div>
      <div class="gt-panes">
        <div class="tr-pane gt-in"><textarea class="tr-in" id="trIn" rows="3" placeholder="Metni yazın…" aria-label="Çevrilecek metin"></textarea>
          <div class="gt-foot"><button class="icon-btn" id="trClear" title="Temizle" aria-label="Temizle">${ic('x')}</button><span id="trCount"></span></div></div>
        <div class="tr-pane gt-out"><div id="trOut" class="tr-out-main"></div></div>
      </div></div>`;
  function mountTranslator(init, o) {
    o = o || {};
    let dir = o.dir === 'ar' ? 'ar' : 'tr';
    if (init && isAr(init)) dir = 'ar';
    const inp = $('#trIn');
    inp.value = init;
    const setDir = () => {
      $('#lIn').textContent = dir === 'tr' ? 'Türkçe' : 'Mısır Arapçası';
      $('#lOut').textContent = dir === 'tr' ? 'Mısır Arapçası' : 'Türkçe';
      inp.classList.toggle('ar', dir === 'ar');
      inp.dir = dir === 'ar' ? 'rtl' : 'ltr';
    };
    setDir();
    const run = () => {
      const text = inp.value;
      $('#trCount').textContent = text.length ? text.length + ' karakter' : '';
      if (text.trim() && isAr(text) && dir === 'tr') { dir = 'ar'; setDir(); }
      if (o.hash) history.replaceState(null, '', '#/ceviri?q=' + encodeURIComponent(text) + (dir === 'ar' ? '&dir=ar' : ''));
      const r = translate(text, dir);
      const out = $('#trOut'), more = o.more ? $('#trMore') : { innerHTML: '' };
      if (!text.trim()) { out.innerHTML = `<div style="color:var(--muted)">Çeviri</div>`; more.innerHTML = ''; return; }
      let main = r.exact[0], approx = false;
      if (!main && r.similar.length && !r.gloss.every(g => g.e)) {
        // En yakın ifade, sözlükte bulunan asıl kelimeleri de içermeli (ör. "avans") / The closest phrase must contain the known content words
        const need = r.gloss.filter(g => g.e).map(g => g.src.split(' ')).flat().filter(w => w.length > 2);
        const has = (e, w) => e._tr.split(' ').some(t => t.startsWith(w.slice(0, Math.max(3, w.length - 2))));
        let cand = r.similar.find(e => need.every(w => has(e, w)));
        // Örnek cümleler de aranır / Example sentences are searched too
        if (!cand && dir === 'tr') {
          const qt = normTr(text).split(' ').filter(w => w.length > 1);
          let best = null, bs = 0;
          E.forEach(e => {
            if (!e.ex || !e.ex.tr) return;
            const x = { _tr: normTr(e.ex.tr) };
            if (!need.every(w => has(x, w))) return;
            const sc = qt.filter(w => has(x, w)).length / Math.max(qt.length, x._tr.split(' ').length);
            if (sc > bs) { bs = sc; best = e; }
          });
          if (best && bs >= .5) cand = { id: best.id, ar: best.ex.ar, ok: best.ex.ok, fr: best.ex.fr, tr: best.ex.tr, cat: best.cat, _tr: normTr(best.ex.tr) };
        }
        // En yakın ifade çeviri olarak gösterilmez (yanlış çeviri riski); yalnız “Benzer ifadeler” listesinde kalır /
        // The closest phrase is no longer shown as the translation (wrong-translation risk); it stays in the “similar phrases” list only
      }
      if (main) {
        out.innerHTML = dir === 'tr'
          ? `<div class="ar">${esc(main.ar)}</div><div class="ok">${esc(main.ok)}</div><div class="fr">${esc(main.fr)}</div><div style="display:flex;gap:8px;margin-top:6px">${playBtn(main.ar)}${favBtn(main)}<button class="icon-btn" data-copy="${esc(main.ar)}" title="Kopyala">${ic('copy')}</button></div><span class="tr-src${approx ? ' mt' : ''}"><span class="dot"></span>${approx ? 'En yakın ifade: “' + esc(main.tr) + '”' : 'Portal sözlüğü'} · ${esc(main.cat)}</span>`
          : `<div style="font-size:24px;font-weight:800">${esc(main.tr)}</div><div class="ok">${esc(main.ok)}</div><div style="display:flex;gap:8px;margin-top:6px">${playBtn(main.ar)}${favBtn(main)}</div><span class="tr-src${approx ? ' mt' : ''}"><span class="dot"></span>${approx ? 'En yakın ifade' : 'Portal sözlüğü'} · ${esc(main.cat)}</span>`;
      } else {
        const known = r.gloss.filter(g => g.e);
        // Dürüst davranış: birebir karşılık yoksa kelime dizisini çeviri gibi göstermeyiz /
        // No exact match: we do not present a word list as a translation
        out.innerHTML = `<div class="tr-none"><b>Bu cümlenin hazır karşılığı yok.</b><p>Yanlış çeviri göstermemek için kelimeleri art arda dizmiyorum. Aşağıda kelimelerin tek tek anlamları ve en yakın hazır cümleler var.</p><a class="btn gold" href="#/cumlekur">🧩 Cümle Kur ile kendin kur</a></div>`;
      }
      const gl = r.gloss.length > 1 || (!main && r.gloss.length) ? `<div class="sec-h"><h2>Kelime kelime</h2></div><div class="card pad"><div class="gloss">${r.gloss.map(g => g.e ? `<div class="gl" data-say="${esc(g.e.ar)}" style="cursor:pointer" title="Dinle"><small>${esc(g.src)}</small><span class="ar">${esc(g.e.ar)}</span><small><b>${esc(g.e.ok)}</b></small><small>${esc(g.e.tr)}</small></div>` : `<div class="gl miss"><small>${esc(g.src)}</small><span>?</span></div>`).join('')}</div></div>` : '';
      const alts = (main && !approx ? r.exact.slice(1) : r.similar);
      const al = alts.length ? `<div class="sec-h"><h2>${main && !approx ? 'Diğer karşılıklar' : 'Benzer ifadeler'}</h2></div><div class="alt-list">${alts.map(e => `<div class="card alt"><div><div style="font-weight:700">${esc(e.tr)}</div><div style="font-size:13px;color:var(--muted)">${esc(e.ok)} · <span style="font-family:monospace;color:var(--teal)">${esc(e.fr)}</span></div></div><div class="ar">${esc(e.ar)}</div>${playBtn(e.ar)}</div>`).join('')}</div>` : '';
      more.innerHTML = gl + al;
    };
    let tm;
    inp.oninput = () => { clearTimeout(tm); tm = setTimeout(run, 160); };
    $('#trSwap').onclick = () => {
      const r = translate(inp.value, dir);
      const m = r.exact[0];
      dir = dir === 'tr' ? 'ar' : 'tr';
      if (m) inp.value = dir === 'ar' ? m.ar : m.tr.split(/\s*\/\s*/)[0];
      setDir();
      run();
    };
    $('#trClear').onclick = () => { inp.value = ''; run(); inp.focus(); };
    run();
    if (o.focus) inp.focus();
  }
  ROUTES.ceviri = function (a, q) {
    view.innerHTML = pageHead('Çeviri', 'Türkçe ⇄ Mısır lehçesi. Yalnızca portalın Mısır lehçesi sözlüğünü kullanır (standart Arapça/Fusha yok); birebir karşılık yoksa kelime kelime çözümler ve en yakın ifadeyi gösterir. Franko (ör. <b>ezzayak</b>) da yazabilirsiniz.') + trBoxHtml() + '<div id="trMore"></div>';
    mountTranslator(q.q || '', { dir: q.dir, hash: true, focus: true, more: true });
  };

  // ── Fabrika dili / Garment-factory shop-floor language ──
  ROUTES.fabrika = function () {
    const F = E.filter(e => e.src === 'fab');
    const subs = new Map();
    F.forEach(e => { const k = e.sub || 'Genel'; if (!subs.has(k)) subs.set(k, []); subs.get(k).push(e); });
    const EM = { 'Makineler & Ekipman': '🪡', 'Kumaş & Malzeme': '🧶', 'Kesim': '✂️', 'Dikim Hattı': '🧵', 'Ütü & Paketleme': '📦', 'Kalite Kontrol': '🔍', 'Üretim & Hedef': '🎯', 'Vardiya & Devam': '⏰', 'Maaş & Prim': '💵', 'İş Güvenliği': '🦺', 'Usta–İşçi Konuşmaları': '🗣️', 'Halk Deyimleri': '🇪🇬' };
    const quick = F.filter(e => e.k === 'p').slice(0, 12);
    view.innerHTML = pageHead('🧵 Fabrika Dili', 'Konfeksiyon atölyesinde ustaların ve işçilerin gerçekten konuştuğu Mısır halk dili: makineler, dikim hattı, kalite, hedef, vardiya, maaş ve günlük atölye konuşmaları.', `<a class="btn gold" href="#/kartlar/${encodeURIComponent('Konfeksiyon Fabrikası')}" id="fabCards">${ic('cards')} Kartlarla çalış</a>`) +
      (F.length ? `<div class="grid g3">${Array.from(subs.entries()).map(([k, list]) => `<a class="card mod" href="#/sozluk?cat=${encodeURIComponent('Konfeksiyon Fabrikası')}&sub=${encodeURIComponent(k)}"><div class="ic" style="background:var(--gold-soft)">${EM[k] || '🧵'}</div><div><b>${esc(k)}</b><small>${list.length} kelime ve ifade</small><small class="ar" style="font-size:16px;margin-top:4px;text-align:left">${esc(list.slice(0, 3).map(e => e.ar).join(' · '))}</small></div></a>`).join('')}</div>
      ${quick.length ? `<div class="sec-h"><h2>🗣️ Atölyede en çok duyacağın cümleler</h2></div><div class="grid gauto">${quick.map(e => entryHtml(e)).join('')}</div>` : ''}` : `<div class="card empty"><b>🧵</b>Fabrika dili içeriği hazırlanıyor.</div>`);
    const fc = $('#fabCards');
    if (fc) fc.onclick = ev => { ev.preventDefault(); const ids = F.map(e => e.id); flashSession({ key: 'fabrika', cat: 'Konfeksiyon Fabrikası', em: '🧵', ids: ids }); };
  };

  // ── Ortak Kelimeler / Türkçe ile Mısır Arapçasında ortak ve benzer kelimeler ──
  const ORT_TAG = { 'Ortak': '#1B3F7A', 'Osmanlı': '#EA580C', 'Batı': '#0E9384', 'Dikkat': '#E11D48' };
  const ORT_SHORT = { 1: 'Selamlaşma', 2: 'Din ve kültür', 3: 'İnsanlar ve meslekler', 4: 'Duygular ve soyut', 5: 'Zaman ve takvim', 6: 'Doğa ve yer', 7: 'Ev ve mutfak', 8: 'Yiyecek ve içecek', 9: 'Alışveriş ve iş', 10: 'Devlet ve ordu', 11: 'Osmanlı hitapları', 12: 'Batı kökenliler', 13: 'Dikkat: farklı anlam', 14: 'Örnek cümleler', 15: 'Ek kelimeler' };
  const nA = s => String(s || '').replace(/[ً-ْٰـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  const nT = s => String(s || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase().replace(/[çğıöşüâîû]/g, c => ({ 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' }[c]));
  ROUTES.ortak = function (a, q) {
    const W = OR.words, tag = q.tag || '', sec = q.sec ? +q.sec : 0, qs = q.q || '';
    const secName = n => (OR.sections.find(s => s.n === n) || {}).name || '';
    const href = o => '#/ortak' + (() => { const p = Object.assign({ tag: tag, sec: sec || '', q: qs }, o), s = Object.keys(p).filter(k => p[k]).map(k => k + '=' + encodeURIComponent(p[k])).join('&'); return s ? '?' + s : ''; })();
    const tc = {}, sc = {};
    W.forEach(w => { tc[w.tag] = (tc[w.tag] || 0) + 1; });
    W.filter(w => !tag || w.tag === tag).forEach(w => { sc[w.sec] = (sc[w.sec] || 0) + 1; });
    const rules = `<details class="card pad ort-rules"><summary><b>📘 Okuma anahtarı ve ses kaymaları</b><small>Franko harfleri ve Türkçe ↔ Mısır Arapçası düzenli farkları</small></summary>
      <h3>Franko (Latin harfli Arapça) okuma anahtarı</h3>
      <div class="ort-tbl"><div class="ort-th"><span>Franko</span><span>Arap harfi</span><span>Ses</span><span>Örnek</span></div>${OR.rules.franco.map(r => `<div><b>${esc(r[0])}</b><span class="ar">${esc(r[1])}</span><span>${esc(r[2])}</span><span>${esc(r[3])}</span></div>`).join('')}</div>
      <p class="ort-n">Türkçe okunuş sütununda: ʿ = ayın sesi, ' = hemze (kısa duraklama), kh = hırıltılı h, ğ = gırtlaktan g/ğ, â î û = uzun ünlüler.</p>
      <h3>Ses kaymaları: Türkçe ile Mısır Arapçası arasındaki düzenli farklar</h3>
      <p class="ort-n">Bu kuralları bilirsen yeni bir Arapça kelimeyi duyunca Türkçe karşılığını tahmin edebilirsin.</p>
      <div class="ort-tbl ort-sh">${OR.rules.shift.map(r => `<div><b class="ar">${esc(r[0])}</b><span>${esc(r[1])}</span><span>${esc(r[2])}</span></div>`).join('')}</div></details>`;
    view.innerHTML = pageHead('🔗 Ortak Kelimeler', 'Türkçede de Mısır Arapçasında da tanıdık gelen kelimeler: iki dilde ortak olanlar, Osmanlı’dan kalanlar, Batı kökenliler ve anlamı farklı olan tuzak kelimeler.') +
      `<div class="ort-legend">${Object.keys(ORT_TAG).map(k => `<span><i style="background:${ORT_TAG[k]}"></i><b>${k}</b> ${esc(OR.tags[k] || '')}</span>`).join('')}</div>` + rules +
      `<div class="gsearch" style="max-width:none;margin:14px 0"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="oIn" type="search" placeholder="Türkçe, Arapça veya Franko ara…" value="${esc(qs)}"></div>
      <div class="chips" style="margin-bottom:10px"><a class="chip${!tag ? ' on' : ''}" href="${href({ tag: '', sec: '' })}">Tümü <span class="n">${W.length}</span></a>${Object.keys(ORT_TAG).map(k => `<a class="chip${tag === k ? ' on' : ''}" href="${href({ tag: k, sec: '' })}"><i class="ort-dot" style="background:${ORT_TAG[k]}"></i>${k} <span class="n">${tc[k] || 0}</span></a>`).join('')}</div>
      <div class="chips" style="margin-bottom:18px"><a class="chip${!sec ? ' on' : ''}" href="${href({ sec: '' })}">Tüm bölümler</a>${OR.sections.filter(s => s.n <= 13 || s.n === 15).map(s => sc[s.n] ? `<a class="chip${sec === s.n ? ' on' : ''}" href="${href({ sec: s.n })}">${esc(ORT_SHORT[s.n] || s.name)} <span class="n">${sc[s.n]}</span></a>` : '').join('')}<a class="chip${sec === 14 ? ' on' : ''}" href="${href({ sec: 14, tag: '' })}">Örnek cümleler <span class="n">${OR.examples.length}</span></a></div>
      <div id="oRes" class="grid gauto"></div><div class="more-wrap"><button class="btn ghost" id="oMore" hidden>Daha fazla göster</button></div>`;
    const card = w => `<article class="card entry fade ort-c" style="--tc:${ORT_TAG[w.tag]}"><div class="top-row"><span class="tag ort-tg"><i class="ort-dot" style="background:${ORT_TAG[w.tag]}"></i>${esc(w.tag)}</span><span class="lv">${esc(ORT_SHORT[w.sec] || '')}</span>${playBtn(w.ar)}</div>
      <div class="ar">${esc(w.ar)}</div><div class="read-row"><span><small>Okunuş</small> <span class="ok">${esc(w.ok)}</span></span><span><small>Franko</small> <span class="fr">${esc(w.fr)}</span></span></div>
      <div class="tr">${esc(w.tr)}</div>${w.note ? `<div class="meta">${esc(w.note)}</div>` : ''}</article>`;
    const exCard = w => `<article class="card entry fade ort-c" style="--tc:#1B3F7A"><div class="top-row"><span class="tag ort-tg"><i class="ort-dot" style="background:#1B3F7A"></i>Örnek cümle</span>${playBtn(w.ar)}</div>
      <div class="ar">${esc(w.ar)}</div><div class="read-row"><span><small>Okunuş</small> <span class="ok">${esc(w.ok)}</span></span><span><small>Franko</small> <span class="fr">${esc(w.fr)}</span></span></div><div class="tr">${esc(w.tr)}</div></article>`;
    let list = [], shown = 0;
    const draw = reset => {
      if (reset) { $('#oRes').innerHTML = ''; shown = 0; }
      const part = list.slice(shown, shown + 48);
      $('#oRes').insertAdjacentHTML('beforeend', part.map(sec === 14 ? exCard : card).join(''));
      shown += part.length; $('#oMore').hidden = shown >= list.length;
      if (!list.length) $('#oRes').innerHTML = '<div class="empty" style="grid-column:1/-1"><b>🔎</b>Sonuç bulunamadı.</div>';
    };
    const filter = () => {
      const s = $('#oIn').value.trim(), sa = nA(s), st = nT(s);
      const src = sec === 14 ? OR.examples : W.filter(w => (!tag || w.tag === tag) && (!sec || w.sec === sec));
      list = !s ? src : src.filter(w => nT(w.tr).indexOf(st) >= 0 || nA(w.ar).indexOf(sa) >= 0 || nT(w.fr).indexOf(st) >= 0 || nT(w.ok).indexOf(st) >= 0 || nT(w.note || '').indexOf(st) >= 0);
      draw(true);
    };
    let tm; $('#oIn').oninput = () => { clearTimeout(tm); tm = setTimeout(filter, 150); };
    $('#oMore').onclick = () => draw(false);
    filter();
  };

  // ── Cümle Kur / Kurallı cümle kurucu (fiil çekimi + sözcükler) ──
  const FR_OK = fr => String(fr || '').replace(/\bel-/g, 'il-').replace(/sh/g, 'ş').replace(/gh/g, 'ğ').replace(/ch/g, 'ç').replace(/kh/g, 'x').replace(/5/g, 'x').replace(/7/g, 'h').replace(/[23]/g, "'").replace(/aa/g, 'â').replace(/ee/g, 'î').replace(/oo/g, 'û').replace(/x/g, 'kh').replace(/[STDZ]/g, c => c.toLowerCase());
  const CK_PERS = [
    { k: 'b1', l: 'Ben (erkek)', i: 0, g: 'm', ar: 'أنا', fr: 'ana' }, { k: 'b2', l: 'Ben (kadın)', i: 0, g: 'f', ar: 'أنا', fr: 'ana' },
    { k: 's1', l: 'Sen (erkek)', i: 1, g: 'm', ar: 'إنت', fr: 'enta' }, { k: 's2', l: 'Sen (kadın)', i: 2, g: 'f', ar: 'إنتي', fr: 'enti' },
    { k: 'o1', l: 'O (erkek)', i: 3, g: 'm', ar: 'هو', fr: 'howwa' }, { k: 'o2', l: 'O (kadın)', i: 4, g: 'f', ar: 'هي', fr: 'heyya' },
    { k: 'bz', l: 'Biz', i: 5, g: 'p', ar: 'إحنا', fr: 'e7na' }, { k: 'sz', l: 'Siz', i: 6, g: 'p', ar: 'إنتو', fr: 'entoo' }, { k: 'on', l: 'Onlar', i: 7, g: 'p', ar: 'هما', fr: 'homma' }
  ];
  const CK_TENSE = [
    ['now', 'Şu an (yapıyorum)'], ['habit', 'Genelde (yaparım)'], ['past', 'Geçmiş (yaptım)'], ['fut', 'Gelecek (yapacağım)'], ['imp', 'Emir (yap!)'],
    ['want', 'İstek (yapmak istiyorum)'], ['must', 'Gerek (yapmalıyım)'], ['can', 'Yapabilir (yapabilirim)']
  ];
  const CK_QW = [['', '—'], ['فين', 'nerede? / nereye?'], ['إمتى', 'ne zaman?'], ['ليه', 'neden?'], ['إزاي', 'nasıl?'], ['إيه', 'ne?'], ['كام', 'kaç?'], ['مين', 'kim?']];
  const CK_QWFR = { 'فين': 'feen', 'إمتى': 'emta', 'ليه': 'leh', 'إزاي': 'ezzay', 'إيه': 'eh', 'كام': 'kaam', 'مين': 'meen' };
  const CK_PREP = [['', 'edatsız (gitmek, gelmek)'], ['في', 'içinde / -de'], ['من', '-den'], ['مع', 'ile (birlikte)'], ['على', 'üstünde / -e'], ['جنب', 'yanında'], ['قدام', 'önünde'], ['تحت', 'altında'], ['فوق', 'üstünde']];
  const CK_PREPFR = { 'في': 'fee', 'من': 'min', 'مع': 'ma3a', 'على': '3ala', 'جنب': 'ganb', 'قدام': '2oddaam', 'تحت': 'ta7t', 'فوق': 'foo2' };
  ROUTES.cumlekur = function (a, q) {
    const V = VB.verbs, N = VB.nouns;
    const st = { p: q.p || 's1', t: q.t || 'fut', v: q.v || (V.find(v => /^gitmek/.test(v.tr)) || V[0] || {}).id, neg: q.neg === '1', qs: q.qs === '1', qw: q.qw || '', o: q.o || '', od: q.od !== '0', pl: q.pl || '', pp: q.pp || '', pd: q.pd !== '0', ad: q.ad || '', tm: q.tm || '' };
    const opt = (list, cur, any) => (any ? `<option value="">${any}</option>` : '') + list.map(x => `<option value="${esc(x[0])}"${x[0] === cur ? ' selected' : ''}>${esc(x[1])}</option>`).join('');
    const nl = k => N.map((n, i) => [i, n]).filter(x => x[1].k === k).map(x => [String(x[0]), x[1].tr]);
    view.innerHTML = pageHead('🧩 Cümle Kur', 'Kim, ne zaman, hangi fiil, nesne ve yer: seç, site doğru çekimleyip günlük Mısır lehçesinde cümleyi kursun ve seslendirsin.') +
      `<div class="card pad ck-card">
        <div class="ck-sec"><b>1. Kim?</b><div class="chips" id="ckP">${CK_PERS.map(x => `<button class="chip" data-p="${x.k}">${x.l}</button>`).join('')}</div></div>
        <div class="ck-sec"><b>2. Ne zaman / nasıl?</b><div class="chips" id="ckT">${CK_TENSE.map(x => `<button class="chip" data-t="${x[0]}">${x[1]}</button>`).join('')}</div></div>
        <div class="ck-sec"><b>3. Ne yapıyor?</b><input id="ckV" list="ckVL" class="ck-in" placeholder="Fiil yaz veya seç (gitmek, yazmak, beklemek…)" autocomplete="off"><datalist id="ckVL">${V.map(v => `<option value="${esc(v.tr)}">`).join('')}</datalist>
          <div class="chips ck-mini"><button class="chip" id="ckNeg">Olumsuz (yapmıyorum)</button><button class="chip" id="ckQs">Soru (yapıyor musun?)</button></div></div>
        <div class="ck-sec"><b>4. Eklemek istersen</b><div class="ck-grid">
          <label>Nesne<select id="ckO"><option value="">—</option>${nl('n').map(x => `<option value="${x[0]}"${x[0] === st.o ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
          <label>Yer<select id="ckPl"><option value="">—</option>${nl('p').map(x => `<option value="${x[0]}"${x[0] === st.pl ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
          <label>Yer edatı<select id="ckPP">${opt(CK_PREP, st.pp)}</select></label>
          <label>Ne zaman<select id="ckTm"><option value="">—</option>${nl('t').map(x => `<option value="${x[0]}"${x[0] === st.tm ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
          <label>Nasıl / ne kadar<select id="ckAd"><option value="">—</option>${nl('a').map(x => `<option value="${x[0]}"${x[0] === st.ad ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>
          <label>Soru sözcüğü<select id="ckQW">${opt(CK_QW, st.qw)}</select></label></div>
          <div class="chips ck-mini"><button class="chip" id="ckOd">Nesne belirli (el-)</button><button class="chip" id="ckPd">Yer belirli (el-)</button></div></div>
      </div>
      <div class="card pad ck-out" id="ckOut"></div><p class="ck-note">Cümleler kurallara göre kurulur ve fiil çekimleri tablolardan gelir; seslendirme parça parça kayıtlı erkek sesle yapılır. Mısır günlük dilinde bazı cümleler farklı söylenebilir.</p>`;
    const person = () => CK_PERS.find(x => x.k === st.p) || CK_PERS[2];
    const verb = () => V.find(v => v.id === st.v) || V[0];
    const piece = (ar, fr) => ({ ar: ar, fr: fr });
    const defn = n => ({ ar: /^ال/.test(n.ar) ? n.ar : 'ال' + n.ar, fr: 'el-' + n.fr });
    const build = () => {
      const P = person(), v = verb(), pcs = [];
      if (!v) return { pcs: [] };
      const form = (arr, i) => arr[i] || arr[0];
      const pr = piece(P.ar, P.fr);
      const NEG = piece('مش', 'mesh');
      let main = [], showPron = true, neg = st.neg;
      const t = st.t;
      if (t === 'imp') {
        if (![1, 2, 6].includes(P.i)) { return { err: 'Emir kipi yalnız “sen” ve “siz” için kullanılır.' }; }
        const k = P.i === 1 ? 0 : P.i === 2 ? 1 : 2;
        main = [neg ? form(v.impneg, k) : form(v.imp, k)]; showPron = false; neg = false;
        if (!main[0]) return { err: 'Bu fiilin emir biçimi tabloda yok.' };
      } else if (t === 'past') { main = [neg ? form(v.pastneg, P.i) : form(v.past, P.i)]; neg = false; }
      else if (t === 'fut') main = [form(v.fut, P.i)];
      else if (t === 'habit') main = [form(v.pres, P.i)];
      else if (t === 'now') { if (v.part) { const gi = P.g === 'm' ? 0 : P.g === 'f' ? 1 : 2; main = [v.part[gi]]; } else main = [form(v.pres, P.i)]; }
      else if (t === 'want') { main = [piece(P.g === 'f' ? 'عايزة' : P.g === 'p' ? 'عايزين' : 'عايز', P.g === 'f' ? '3ayza' : P.g === 'p' ? '3ayzeen' : '3aayez'), form(v.subj, P.i)]; }
      else if (t === 'must') { main = [piece('لازم', 'laazem'), form(v.subj, P.i)]; showPron = false; }
      else if (t === 'can') { const cv = V.find(x => /^gücü yetmek/.test(x.tr)); main = [cv ? form(cv.pres, P.i) : piece('بقدر', 'ba2dar'), form(v.subj, P.i)]; }
      if (st.qw === 'ليه') pcs.push(piece('ليه', 'leh'));
      if (showPron) pcs.push(pr);
      if (neg) pcs.push(NEG);
      main.forEach(x => pcs.push(piece(x[0] || x.ar, x[1] || x.fr)));
      const no = st.o !== '' ? N[+st.o] : null, np = st.pl !== '' ? N[+st.pl] : null, nad = st.ad !== '' ? N[+st.ad] : null, nt = st.tm !== '' ? N[+st.tm] : null;
      if (no) pcs.push(st.od ? defn(no) : piece(no.ar, no.fr));
      if (np) { if (st.pp) pcs.push(piece(st.pp, CK_PREPFR[st.pp])); pcs.push(st.pd ? defn(np) : piece(np.ar, np.fr)); }
      if (nad) pcs.push(piece(nad.ar, nad.fr));
      if (nt) pcs.push(piece(nt.ar, nt.fr));
      if (st.qw && st.qw !== 'ليه') pcs.push(piece(st.qw, CK_QWFR[st.qw]));
      return { pcs: pcs };
    };
    const speakPieces = (pcs, btn) => {
      const keys = pcs.map(x => audioKey(x.ar));
      const go = () => {
        if (keys.every(k => audioIdx && audioIdx.has(k))) { if (btn) btn.classList.add('playing'); playSequence(keys, btn, () => deviceSpeak(pcs.map(x => x.ar).join(' '), btn)); }
        else deviceSpeak(pcs.map(x => x.ar).join(' '), btn);
      };
      audioIdx ? go() : loadAudioIdx().then(go);
    };
    let cur = [];
    const draw = () => {
      $$('#ckP .chip').forEach(b => b.classList.toggle('on', b.dataset.p === st.p));
      $$('#ckT .chip').forEach(b => b.classList.toggle('on', b.dataset.t === st.t));
      $('#ckNeg').classList.toggle('on', st.neg); $('#ckQs').classList.toggle('on', st.qs);
      $('#ckOd').classList.toggle('on', st.od); $('#ckPd').classList.toggle('on', st.pd);
      const vv = verb(); if (vv && document.activeElement !== $('#ckV')) $('#ckV').value = vv.tr;
      history.replaceState(null, '', '#/cumlekur?' + new URLSearchParams({ p: st.p, t: st.t, v: st.v, neg: st.neg ? 1 : 0, qs: st.qs ? 1 : 0, qw: st.qw, o: st.o, od: st.od ? 1 : 0, pl: st.pl, pp: st.pp, pd: st.pd ? 1 : 0, ad: st.ad, tm: st.tm }).toString());
      const r = build(), out = $('#ckOut');
      if (r.err) { out.innerHTML = `<div class="ck-err">${esc(r.err)}</div>`; cur = []; return; }
      cur = r.pcs;
      const qm = (st.qs || st.qw) ? '؟' : '';
      const ar = cur.map(x => x.ar).join(' ') + qm, fr = cur.map(x => x.fr).join(' ') + (qm ? '?' : ''), ok = FR_OK(cur.map(x => x.fr).join(' ')) + (qm ? '?' : '');
      out.innerHTML = `<div class="ar ck-ar">${esc(ar)}</div><div class="ok">${esc(ok)}</div><div class="fr">${esc(fr)}</div>
        <div class="ck-tr">${esc(person().l)} · ${esc(vv ? vv.tr : '')} · ${esc((CK_TENSE.find(x => x[0] === st.t) || [])[1] || '')}${st.neg ? ' · olumsuz' : ''}${st.qs ? ' · soru' : ''}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn gold" id="ckPlay">${ic('vol')} Dinle</button><button class="btn ghost" id="ckCopy">${ic('copy')} Kopyala</button></div>
        <div class="ck-pcs">${cur.map(x => `<button class="chip ck-pc" data-say="${esc(x.ar)}"><span class="ar">${esc(x.ar)}</span><small>${esc(FR_OK(x.fr))}</small></button>`).join('')}</div>`;
      $('#ckPlay').onclick = ev => speakPieces(cur, ev.currentTarget);
      $('#ckCopy').onclick = () => { try { navigator.clipboard.writeText(ar); toast('Kopyalandı'); } catch (e) {} };
    };
    $('#ckP').onclick = ev => { const b = ev.target.closest('[data-p]'); if (b) { st.p = b.dataset.p; draw(); } };
    $('#ckT').onclick = ev => { const b = ev.target.closest('[data-t]'); if (b) { st.t = b.dataset.t; draw(); } };
    $('#ckNeg').onclick = () => { st.neg = !st.neg; draw(); };
    $('#ckQs').onclick = () => { st.qs = !st.qs; draw(); };
    $('#ckOd').onclick = () => { st.od = !st.od; draw(); };
    $('#ckPd').onclick = () => { st.pd = !st.pd; draw(); };
    $('#ckV').oninput = ev => { const x = V.find(v => v.tr === ev.target.value.trim()) || V.find(v => v.tr.split(/[\s\/]+/)[0] === ev.target.value.trim()); if (x) { st.v = x.id; draw(); } };
    $('#ckV').onchange = () => draw();
    [['ckO', 'o'], ['ckPl', 'pl'], ['ckPP', 'pp'], ['ckTm', 'tm'], ['ckAd', 'ad'], ['ckQW', 'qw']].forEach(x => { $('#' + x[0]).onchange = ev => { st[x[1]] = ev.target.value; draw(); }; });
    draw();
  };

  // ── Sözlük / Dictionary ──
  ROUTES.sozluk = function (a, q) {
    const cat = q.cat || '', lv = q.lv || '', kind = q.k || '', sub = q.sub || '';
    const counts = {};
    E.forEach(e => counts[e.cat] = (counts[e.cat] || 0) + 1);
    view.innerHTML = pageHead('Sözlük', 'Mısır lehçesi kelime ve ifadeler. Türkçe, Arapça ya da Franko yazarak arayın.',
      `<div class="chips"><a class="chip${!kind ? ' on' : ''}" href="#/sozluk?cat=${encodeURIComponent(cat)}">Tümü</a><a class="chip${kind === 'w' ? ' on' : ''}" href="#/sozluk?k=w&cat=${encodeURIComponent(cat)}">Kelimeler</a><a class="chip${kind === 'p' ? ' on' : ''}" href="#/sozluk?k=p&cat=${encodeURIComponent(cat)}">İfadeler</a></div>`) +
      `<div class="gsearch" style="max-width:none;margin-bottom:14px"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="dIn" type="search" placeholder="Ara…" value="${esc(q.q || '')}" aria-label="Sözlükte ara"></div>
      <div class="chips" style="margin-bottom:18px"><a class="chip${!cat ? ' on' : ''}" href="#/sozluk?k=${kind}">Tüm kategoriler</a>${D.cats.filter(c => counts[c.name]).map(c => `<a class="chip${cat === c.name ? ' on' : ''}" href="#/sozluk?k=${kind}&cat=${encodeURIComponent(c.name)}">${esc(c.emoji || '')} ${esc(c.name)} <span class="n">${counts[c.name]}</span></a>`).join('')}</div>
      <div id="dRes" class="grid gauto"></div><div class="more-wrap"><button class="btn ghost" id="dMore" hidden>Daha fazla göster</button></div>`;
    let list = [], shown = 0;
    const draw = reset => {
      if (reset) { $('#dRes').innerHTML = ''; shown = 0; }
      const part = list.slice(shown, shown + 48);
      $('#dRes').insertAdjacentHTML('beforeend', part.map(e => entryHtml(e)).join(''));
      shown += part.length;
      $('#dMore').hidden = shown >= list.length;
      if (!list.length) $('#dRes').innerHTML = `<div class="empty" style="grid-column:1/-1"><b>🔎</b>Sonuç bulunamadı. <a href="#/ceviri?q=${encodeURIComponent($('#dIn').value)}">Çeviriyi deneyin</a></div>`;
    };
    const filter = () => {
      const s = $('#dIn').value.trim();
      let base = s ? search(s, 400) : E;
      list = base.filter(e => (!cat || e.cat === cat) && (!sub || e.sub === sub) && (!lv || e.lv === lv) && (!kind || e.k === kind));
      draw(true);
    };
    let tm;
    $('#dIn').oninput = () => { clearTimeout(tm); tm = setTimeout(filter, 150); };
    $('#dMore').onclick = () => draw(false);
    filter();
  };

  // ── Kelime kartları (3 kutu) / Flashcards (Leitner) ──
  const DAY = 864e5, INTERVAL = { 1: 0, 2: 2 * DAY, 3: 7 * DAY };
  const deckList = () => {
    const m = new Map();
    E.forEach(e => { if (e.k !== 'w' && e.src !== 'fab') return; const key = (e.src === 'a1' ? 'A1 · ' : '') + e.cat + (e.sub ? ' · ' + e.sub : ''); if (!m.has(key)) m.set(key, { key: key, cat: e.sub ? e.cat + ' · ' + e.sub : e.cat, a1: e.src === 'a1', em: e.em && e.src === 'a1' ? e.em : catEmoji(e.cat), ids: [] }); m.get(key).ids.push(e.id); });
    const fabFirst = d => /^Konfeksiyon/.test(d.cat) ? 0 : 1;
    return Array.from(m.values()).sort((x, y) => fabFirst(x) - fabFirst(y) || (y.a1 - x.a1) || x.cat.localeCompare(y.cat, 'tr'));
  };
  const isDue = id => { const c = cards[id]; return !!c && Date.now() >= (c.t || 0) + INTERVAL[c.box || 1]; };
  const dueCount = () => Object.keys(cards).filter(id => byId.has(id) && isDue(id)).length;
  ROUTES.kartlar = function (a) {
    const decks = deckList();
    if (a[0]) return flashSession(decks.find(d => d.key === a[0]) || (a[0] === 'tekrar' ? { key: 'tekrar', cat: 'Tekrar zamanı gelenler', em: '🔁', ids: Object.keys(cards).filter(id => byId.has(id) && isDue(id)) } : null));
    const intro = (C.a1 || {}).intro || {};
    const due = dueCount();
    view.innerHTML = pageHead('Kelime Kartları', 'Kartın önyüzünde Türkçe, arkasında Mısır Arapçası var. Bildiğin kart bir üst kutuya geçer, bilemediğin 1. kutuya döner.', due ? `<a class="btn gold" href="#/kartlar/tekrar">${ic('cards')} ${due} kartı tekrar et</a>` : '') +
      `<div class="note" style="margin-bottom:18px"><b>🧠 3 kutu yöntemi:</b> Kutu 1 her gün, Kutu 2 iki günde bir, Kutu 3 haftada bir tekrar edilir. Günde 10 yeni kartla bir ayda tüm A1 listesini bitirirsin.${intro.franko ? `<div style="margin-top:6px;font-size:13px;color:var(--muted)">${esc(intro.franko)}</div>` : ''}</div>
      <div class="grid gauto">${decks.map(d => {
        const st = [0, 0, 0, 0];
        d.ids.forEach(id => st[(cards[id] || {}).box || 0]++);
        const pc = n => (n / d.ids.length * 100).toFixed(1) + '%';
        return `<a class="card deck" href="#/kartlar/${encodeURIComponent(d.key)}"><div style="display:flex;align-items:center;gap:10px"><span class="em">${esc(d.em)}</span><div><b>${esc(d.cat)}</b><div style="font-size:12.5px;color:var(--muted)">${d.ids.length} kart${d.a1 ? ' · A1 kart seti' : ''}</div></div></div>
          <div class="bar"><i style="width:${pc(st[3])};background:var(--green)"></i><i style="width:${pc(st[2])};background:var(--gold)"></i><i style="width:${pc(st[1])};background:var(--red)"></i></div>
          <div class="legend"><span><i style="background:var(--green)"></i>${st[3]} iyi</span><span><i style="background:var(--gold)"></i>${st[2]} biliyor</span><span><i style="background:var(--red)"></i>${st[1]} yeni</span><span>${st[0]} başlanmadı</span></div></a>`;
      }).join('')}</div>`;
  };
  function flashSession(deck) {
    if (!deck || !deck.ids.length) { view.innerHTML = `<div class="empty"><b>🃏</b>Bu destede kart yok. <a href="#/kartlar">Destelere dön</a></div>`; return; }
    const due = deck.ids.filter(isDue), fresh = deck.ids.filter(id => !cards[id]).slice(0, 10);
    let queue = due.concat(fresh);
    if (!queue.length) queue = deck.ids.slice().sort(() => Math.random() - .5).slice(0, 15);
    queue = queue.sort(() => Math.random() - .5);
    let i = 0, right = 0, mode = store.get('fcMode', 'tr');
    const draw = () => {
      if (i >= queue.length) {
        if (right >= queue.length * .8) confetti();
        view.innerHTML = `<div class="fc-wrap"><div class="card score fade"><div style="font-size:48px">🎉</div><b>${right}/${queue.length}</b><p>Oturum tamamlandı. Kartların kutuları güncellendi.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn pri" href="#/kartlar/${encodeURIComponent(deck.key)}" id="again">Devam et</a><a class="btn ghost" href="#/kartlar">Destelere dön</a></div></div></div>`;
        $('#again').onclick = ev => { ev.preventDefault(); flashSession(deck); };
        buildNav();
        return;
      }
      const e = byId.get(queue[i]);
      const c = cards[e.id] || {};
      const front = mode === 'tr' ? `<span class="em">${esc(e.em || catEmoji(e.cat))}</span><div class="w">${esc(e.tr)}</div><div class="fc-hint">Arapçasını söyle, sonra kartı çevir</div>` : `<div class="ar" style="font-size:52px">${esc(e.ar)}</div><div class="fc-hint">Anlamını söyle, sonra kartı çevir</div>`;
      view.innerHTML = `<div class="fc-wrap fade"><div class="crumb"><a href="#/kartlar">Kelime Kartları</a> › ${esc(deck.cat)}</div>
        <div class="fc-top"><div class="boxes"><span>Kart ${i + 1}/${queue.length}</span><span>Kutu ${c.box || 1}</span></div><div class="chips"><button class="chip${mode === 'tr' ? ' on' : ''}" data-mode="tr">TR → AR</button><button class="chip${mode === 'ar' ? ' on' : ''}" data-mode="ar">AR → TR</button></div></div>
        <div class="prog"><i style="width:${i / queue.length * 100}%"></i></div>
        <div class="fc" id="fc" tabindex="0" role="button" aria-label="Kartı çevir"><div class="fc-in">
          <div class="fc-f">${front}</div>
          <div class="fc-b"><div class="ar">${esc(e.ar)}</div><div class="ok">${esc(e.ok)}</div><div class="fr">${esc(e.fr)}</div><div class="tr">${esc(e.tr)}${e.note ? ' · ' + esc(e.note) : ''}</div>${playBtn(e.ar)}</div>
        </div></div>
        <div class="fc-act"><button class="btn no" id="no">${ic('x')} Bilemedim</button><button class="btn ok" id="yes">${ic('check')} Bildim</button></div>
        <p class="fc-hint" style="text-align:center;margin-top:12px">Kısayollar: Boşluk = çevir · ← bilemedim · → bildim</p></div>`;
      const fc = $('#fc');
      fc.onclick = ev => { if (ev.target.closest('[data-say]')) return; fc.classList.toggle('flip'); if (fc.classList.contains('flip')) speak(e.ar); };
      const ans = ok => {
        const cur = cards[e.id] || { box: 0 };
        cards[e.id] = { box: ok ? Math.min(3, (cur.box || 0) + 1) : 1, t: Date.now() };
        if (ok) right++;
        addXP(ok ? 5 : 1);
        saveCards();
        i++;
        draw();
      };
      $('#yes').onclick = () => ans(true);
      $('#no').onclick = () => ans(false);
      $$('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; store.set('fcMode', mode); draw(); });
      document.onkeydown = ev => {
        if (!$('#fc')) { document.onkeydown = null; return; }
        if (ev.target.matches('input,textarea')) return;
        if (ev.key === ' ') { ev.preventDefault(); fc.click(); } else if (ev.key === 'ArrowRight') ans(true); else if (ev.key === 'ArrowLeft') ans(false);
      };
    };
    draw();
  }

  // ── Alfabe / Alphabet ──
  ROUTES.alfabe = function (a) {
    const A = C.alphabet || { letters: [] };
    if (a[0] !== undefined && A.letters[+a[0]]) {
      const i = +a[0], L = A.letters[i], f = L.forms || {};
      view.innerHTML = `<div class="crumb"><a href="#/alfabe">Alfabe</a> › ${esc(L.name)}</div>
        <div class="grid g2" style="align-items:start">
          <div class="card pad fade"><div class="ar big-letter">${esc(L.letter)}</div><h1 style="text-align:center;margin:0">${esc(L.name)} <span style="color:var(--muted);font-weight:600">· ${esc(L.fr || '')}</span></h1><p style="text-align:center;color:var(--ink2)">${esc(L.sound || '')}</p>
            <div style="text-align:center;margin-bottom:14px">${playBtn(L.letter)}</div>
            <div class="forms"><div><span class="ar">${esc(f.iso || '')}</span><small>Tek başına</small></div><div><span class="ar">${esc(f.ini || '')}</span><small>Başta</small></div><div><span class="ar">${esc(f.med || '')}</span><small>Ortada</small></div><div><span class="ar">${esc(f.fin || '')}</span><small>Sonda</small></div></div>
            <div style="display:flex;justify-content:space-between;margin-top:16px">${i > 0 ? `<a class="btn ghost sm" href="#/alfabe/${i - 1}">← ${esc(A.letters[i - 1].name)}</a>` : '<span></span>'}${i < A.letters.length - 1 ? `<a class="btn ghost sm" href="#/alfabe/${i + 1}">${esc(A.letters[i + 1].name)} →</a>` : ''}</div></div>
          <div><div class="sec-h" style="margin-top:0"><h2>Bu harfle başlayan kelimeler</h2></div><div class="grid">${(L.words || []).map(w => entryHtml(Object.assign({ id: 'alf' + i + w.ar, cat: L.name }, w))).join('')}</div></div>
        </div>`;
      return;
    }
    view.innerHTML = pageHead('Arap Alfabesi', esc(A.intro || '28 harf, Mısır lehçesindeki okunuşları ve her harf için örnek kelimeler. Arapça sağdan sola yazılır.')) +
      `<div class="letters">${A.letters.map((L, i) => `<a class="card letter" href="#/alfabe/${i}"><span class="ar">${esc(L.letter)}</span><b>${esc(L.name)}</b><small>${esc(L.fr || '')}</small></a>`).join('')}</div>`;
  };

  // ── Konuşma rehberi / Conversation ──
  ROUTES.konusma = function (a) {
    const T = (C.conv || {}).topics || [];
    const t = a[0] && T.find(x => x.id === a[0]);
    if (t) {
      view.innerHTML = pageHead(esc((t.emoji || '') + ' ' + t.title), esc(t.summary || ''), '', '<a href="#/konusma">Konuşma Rehberi</a>') +
        ((t.dialogs || []).map((d, di) => `<div class="sec-h"><h2>🎭 ${esc(d.title || 'Diyalog')}</h2><button class="btn ghost sm" data-dialog="${di}">${ic('vol')} Baştan sona dinle</button></div><div class="card chat" id="dlg-${di}">${(d.lines || []).map((l, k) => {
          const side = (d._sides = d._sides || {}), w = l.who || (k % 2 ? 'B' : 'A');
          if (!side[w]) side[w] = Object.keys(side).length % 2 ? 'b' : 'a';
          return `<div class="bub ${side[w]}"><span class="who">${esc(w)}</span><span class="ar">${esc(l.ar)}</span><span class="ok">${esc(l.ok || l.fr || '')}</span><span class="tr">${esc(l.tr)}</span>${playBtn(l.ar)}</div>`;
        }).join('')}</div>`).join('')) +
        ((t.phrases || []).length ? `<div class="sec-h"><h2>🗣️ Kalıplar ve ifadeler</h2></div><div class="grid gauto">${t.phrases.map((p, k) => entryHtml(Object.assign({ id: 'cv-' + t.id + '-' + k, cat: t.title }, p, byArTr(p)))).join('')}</div>` : '') +
        ((t.tips || []).length ? `<div class="sec-h"><h2>💡 İpuçları</h2></div><div class="card pad"><ul class="tips">${t.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
      $$('[data-dialog]').forEach(b => b.onclick = () => playDialog(t.dialogs[+b.dataset.dialog], $('#dlg-' + b.dataset.dialog), b));
      return;
    }
    view.innerHTML = pageHead('Konuşma Rehberi', esc((C.conv || {}).intro || 'Günlük hayatta en çok ihtiyaç duyacağın durumlar: kalıplar, diyaloglar ve ipuçları.')) +
      `<div class="grid g3">${T.map(x => `<a class="card mod" href="#/konusma/${esc(x.id)}"><div class="ic" style="background:var(--gold-soft)">${esc(x.emoji || '💬')}</div><div><b>${esc(x.title)}</b><small>${esc(x.summary || '')}</small><small style="margin-top:4px">${(x.phrases || []).length} ifade · ${(x.dialogs || []).length} diyalog</small></div></a>`).join('')}</div>`;
  };
  // Rehberdeki ifade sözlükte varsa aynı kimlikle favorilenir / Same id as the dictionary entry when present
  function byArTr(p) { const h = (IX.ar.get(normAr(p.ar)) || []).find(e => e._tr === normTr(p.tr)); return h ? { id: h.id } : {}; }

  // ── Gramer / Grammar ──
  function blocksHtml(blocks) {
    return (blocks || []).map(b => {
      if (b.type === 'text') return `<p>${esc(b.text)}</p>`;
      if (b.type === 'tip') return `<div class="tip">💡 ${esc(b.text)}</div>`;
      if (b.type === 'examples') return `<div class="ex-list">${(b.items || []).map(x => `<div class="ex-item"><span class="ar">${esc(x.ar)}</span>${playBtn(x.ar)}<span><b>${esc(x.ok || '')}</b> <span style="font-family:monospace;color:var(--teal);font-size:13px">${esc(x.fr || '')}</span></span><span style="color:var(--ink2)">${esc(x.tr)}</span></div>`).join('')}</div>`;
      if (b.type === 'table') return `${b.title ? `<h3>${esc(b.title)}</h3>` : ''}<div class="tbl-wrap"><table class="t"><thead><tr>${(b.head || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${(b.rows || []).map(r => `<tr>${r.map(c => `<td${isAr(c) ? ' class="ar"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      if (b.type === 'list') return `<ul class="tips">${(b.items || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      return '';
    }).join('');
  }
  ROUTES.gramer = function (a) {
    const L = (C.grammar || {}).lessons || [];
    const l = a[0] && L.find(x => x.id === a[0]);
    if (l) {
      const i = L.indexOf(l);
      view.innerHTML = pageHead(esc((l.emoji || '') + ' ' + l.title), esc(l.summary || ''), '', '<a href="#/gramer">Gramer</a>') +
        `<div class="card pad lesson fade">${blocksHtml(l.blocks)}</div><div style="display:flex;justify-content:space-between;margin-top:16px;gap:10px">${i > 0 ? `<a class="btn ghost" href="#/gramer/${esc(L[i - 1].id)}">← ${esc(L[i - 1].title)}</a>` : '<span></span>'}${i < L.length - 1 ? `<a class="btn pri" href="#/gramer/${esc(L[i + 1].id)}">${esc(L[i + 1].title)} →</a>` : ''}</div>`;
      return;
    }
    view.innerHTML = pageHead('Gramer', 'Mısır lehçesinin temel yapıları: sade anlatım, tablolar ve sesli örneklerle.', `<a class="btn ghost" href="#/fiiller">${ic('verb')} Fiil çekimleri</a>`) +
      `<div class="grid g3">${L.map((x, k) => `<a class="card mod" href="#/gramer/${esc(x.id)}"><div class="ic" style="background:#F1E8FB">${esc(x.emoji || '✍️')}</div><div><b>${k + 1}. ${esc(x.title)}</b><small>${esc(x.summary || '')}</small></div></a>`).join('')}</div>`;
  };

  // ── Fiiller / Verbs ──
  const PRON = [['ana', 'ben', 'أنا'], ['enta', 'sen (e)', 'إنت'], ['enti', 'sen (k)', 'إنتي'], ['howa', 'o (e)', 'هو'], ['heya', 'o (k)', 'هي'], ['ehna', 'biz', 'إحنا'], ['ento', 'siz', 'إنتو'], ['homma', 'onlar', 'هم']];
  ROUTES.fiiller = function (a, q) {
    const V = (C.grammar || {}).verbs || [];
    if (a[0] !== undefined && V[+a[0]]) {
      const v = V[+a[0]];
      const tbl = (name, o) => {
        if (!o) return '';
        const neg = PRON.some(p => o[p[0]] && o[p[0]].neg);
        return `<h3>${name}</h3><div class="tbl-wrap"><table class="t"><thead><tr><th>Zamir</th><th>Arapça</th><th>Franko</th>${neg ? '<th>Olumsuz</th>' : ''}<th></th></tr></thead><tbody>${PRON.filter(p => o[p[0]]).map(p => { const c = o[p[0]], n = c.neg; return `<tr><td><b>${p[1]}</b> <span class="ar" style="color:var(--muted)">${p[2]}</span></td><td class="ar">${esc(c.ar || c)}</td><td style="font-family:monospace;color:var(--teal)">${esc(c.fr || '')}</td>${neg ? `<td>${n ? `<span class="ar" style="font-size:19px">${esc(n.ar)}</span> <small style="font-family:monospace;color:var(--muted)">${esc(n.fr || '')}</small>` : ''}</td>` : ''}<td>${playBtn(c.ar || c)}</td></tr>`; }).join('')}</tbody></table></div>`;
      };
      const forms = [['Geçmiş zaman (o)', v.past], ['Geniş/şimdiki zaman (ben)', v.pres], ['Emir', v.imp]].filter(x => x[1] && x[1].ar);
      const TYPES = { regular: 'düzenli fiil', hollow: 'orta harfi zayıf (içi boş) fiil', defective: 'son harfi zayıf fiil', doubled: 'çift ünsüzlü fiil', irregular: 'düzensiz fiil', form2: '2. kalıp (şeddeli)', form3: '3. kalıp (uzun a)', form8: '8. kalıp (-t-)' };
      view.innerHTML = pageHead(esc(v.tr), v.type ? 'Fiil türü: ' + esc(TYPES[v.type] || v.type) + (v.note ? ' · ' + esc(v.note) : '') : esc(v.note || ''), '', '<a href="#/fiiller">Fiiller</a>') +
        `<div class="grid g3">${forms.map(f => `<div class="card pad"><span class="tag">${f[0]}</span><div class="ar" style="font-size:32px;text-align:right">${esc(f[1].ar)}</div><div><b>${esc(f[1].ok || '')}</b> <span style="font-family:monospace;color:var(--teal)">${esc(f[1].fr || '')}</span></div><div style="margin-top:6px">${playBtn(f[1].ar)}</div></div>`).join('')}</div>
        <div class="card pad lesson" style="margin-top:16px">${v.conj ? tbl('Geçmiş zaman çekimi', v.conj.past) + tbl('Şimdiki zaman çekimi (b-)', v.conj.pres) + tbl('Gelecek zaman (ha-)', v.conj.fut) : '<p style="color:var(--muted)">Bu fiilin tam çekim tablosu yok; Gramer bölümündeki genel çekim kurallarına bakın.</p>'}</div>`;
      return;
    }
    view.innerHTML = pageHead('Fiiller', 'Mısır lehçesinde en çok kullanılan fiiller: geçmiş, şimdiki zaman ve çekimleri.') +
      `<div class="gsearch" style="max-width:none;margin-bottom:16px"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="vIn" type="search" placeholder="Fiil ara (ör. gitmek, اكل, akal)…" value="${esc(q.q || '')}"></div>
      <div class="card" style="overflow:hidden"><div class="tbl-wrap" style="margin:0;border:0"><table class="t"><thead><tr><th>Türkçe</th><th>Geçmiş (o)</th><th>Şimdiki (ben)</th><th></th></tr></thead><tbody id="vBody"></tbody></table></div></div>
      <div class="note" style="margin-top:16px">⚡ Sözlükte <b>${E.filter(e => e.cat === 'Fiiller').length}</b> fiil daha var: <a href="#/sozluk?cat=Fiiller">Sözlükteki tüm fiilleri gör →</a> · Çekim kuralları için <a href="#/gramer">Gramer</a> bölümüne bakın.</div>`;
    const draw = () => {
      const s = $('#vIn').value.trim(), t = normTr(s), n = normAr(s), f = normFr(s);
      const rows = V.map((v, i) => [v, i]).filter(([v]) => !s || normTr(v.tr).includes(t) || (v.past && (normAr(v.past.ar).includes(n) && n || normFr(v.past.fr).includes(f) && f)) || (v.pres && normAr(v.pres.ar).includes(n) && n));
      $('#vBody').innerHTML = rows.map(([v, i]) => `<tr style="cursor:pointer" data-href="#/fiiller/${i}"><td><b>${esc(v.tr)}</b>${v.conj ? ' <span class="lv">çekim</span>' : ''}</td><td><span class="ar" style="font-size:20px">${esc((v.past || {}).ar || '')}</span> <small style="color:var(--muted)">${esc((v.past || {}).fr || '')}</small></td><td><span class="ar" style="font-size:20px">${esc((v.pres || {}).ar || '')}</span> <small style="color:var(--muted)">${esc((v.pres || {}).fr || '')}</small></td><td>${ic('arrow')}</td></tr>`).join('') || `<tr><td colspan="4" class="empty">Fiil bulunamadı</td></tr>`;
    };
    $('#vIn').oninput = draw;
    $('#vBody').onclick = ev => { const tr = ev.target.closest('[data-href]'); if (tr) go(tr.dataset.href); };
    draw();
  };

  // ── Alıştırmalar / Exercises ──
  const normAns = s => isAr(s) ? normAr(s) : normFr(normTr(s));
  const accept = (val, ex) => { const v = normAns(val); return !!v && [ex.answer].concat(ex.alts || []).some(x => normAns(x) === v); };
  function exerciseHtml(x, k) {
    const head = `<div class="qn">Soru ${k + 1}</div>`;
    const qt = s => `<div class="qt">${isAr(s) ? `<span class="ar">${esc(s)}</span>` : esc(s)}</div>`;
    if (x.type === 'mc') return `<div class="card q" data-k="${k}">${head}${qt(x.q)}<div class="opts">${x.options.map((o, j) => `<button class="opt${isAr(o) ? ' ar' : ''}" data-o="${j}">${esc(o)}</button>`).join('')}</div><div class="fbx"></div></div>`;
    if (x.type === 'fill' || x.type === 'translate') return `<div class="card q" data-k="${k}">${head}${x.type === 'translate' ? `<div class="tag">${x.from === 'ar' ? 'Türkçeye çevir' : 'Mısır Arapçasına çevir (Arapça harf veya Franko)'}</div>` : ''}${qt(x.q)}${x.hint ? `<div style="font-size:13px;color:var(--muted)">İpucu: ${esc(x.hint)}</div>` : ''}<form class="ans-in"><input aria-label="Cevap" placeholder="Cevabınız…" autocomplete="off"><button class="btn pri">Kontrol</button></form><div class="fbx"></div></div>`;
    if (x.type === 'write') return `<div class="card q" data-k="${k}">${head}${qt(x.q)}<textarea style="min-height:90px;border-radius:12px;border:1.5px solid var(--line);padding:10px;background:var(--surface)" aria-label="Cevap"></textarea><button class="btn ghost sm" data-model style="align-self:flex-start">Örnek cevabı göster</button><div class="fbx"></div></div>`;
    if (x.type === 'match') {
      const right = x.pairs.map((p, j) => [p[1], j]).sort(() => Math.random() - .5);
      return `<div class="card q" data-k="${k}">${head}<div class="qt">Eşleştir</div><div class="match"><div style="display:flex;flex-direction:column;gap:8px">${x.pairs.map((p, j) => `<button data-l="${j}" class="${isAr(p[0]) ? 'ar' : ''}">${esc(p[0])}</button>`).join('')}</div><div style="display:flex;flex-direction:column;gap:8px">${right.map(([t, j]) => `<button data-r="${j}" class="${isAr(t) ? 'ar' : ''}">${esc(t)}</button>`).join('')}</div></div><div class="fbx"></div></div>`;
    }
    if (x.type === 'order') return `<div class="card q" data-k="${k}">${head}<div class="qt">Kelimeleri doğru sıraya koy${x.tr ? ': ' + esc(x.tr) : ''}</div><div class="order-ans"></div><div class="order-pool">${x.words.map((w, j) => `<button data-w="${j}">${esc(w)}</button>`).join('')}</div><div style="display:flex;gap:8px"><button class="btn pri sm" data-check>Kontrol</button><button class="btn ghost sm" data-reset>Sıfırla</button></div><div class="fbx"></div></div>`;
    return '';
  }
  function bindExercises(root, list, onScore) {
    let done = 0, ok = 0;
    const fin = (el, good, msg) => {
      if (el.dataset.done) return;
      el.dataset.done = 1;
      done++; if (good) ok++;
      if (good) addXP(5);
      $('.fbx', el).innerHTML = `<div class="fb ${good ? 'right' : 'wrong'}">${good ? '✅ Doğru!' : '❌ Doğru cevap:'} ${msg || ''}</div>`;
      onScore && onScore(ok, done);
    };
    const ansHtml = x => { const a = String(x.answer); return isAr(a) ? `<span class="ar">${esc(a)}</span>` : esc(a); };
    $$('.q', root).forEach(el => {
      const x = list[+el.dataset.k];
      if (x.type === 'mc') $$('.opt', el).forEach(b => b.onclick = () => {
        const j = +b.dataset.o, good = j === x.answer;
        $$('.opt', el).forEach((o, n) => { o.disabled = true; if (n === x.answer) o.classList.add('right'); });
        if (!good) b.classList.add('wrong');
        fin(el, good, good ? esc(x.explain || '') : ansHtml({ answer: x.options[x.answer] }) + (x.explain ? ' — ' + esc(x.explain) : ''));
      });
      if (x.type === 'fill' || x.type === 'translate') $('form', el).onsubmit = ev => {
        ev.preventDefault();
        const v = $('input', el).value;
        if (!v.trim()) return;
        const good = accept(v, x);
        $('input', el).disabled = true;
        fin(el, good, good ? '' : ansHtml(x) + (x.alts && x.alts.length ? ` <span style="font-weight:500;color:var(--muted)">(${esc(x.alts.slice(0, 2).join(' · '))})</span>` : ''));
      };
      if (x.type === 'write') $('[data-model]', el).onclick = () => { $('.fbx', el).innerHTML = `<div class="note"><b>Örnek cevap:</b> ${isAr(x.model) ? `<span class="ar" style="font-size:20px">${esc(x.model)}</span>` : esc(x.model)}</div>`; };
      if (x.type === 'match') {
        let sel = null, miss = 0, got = 0;
        $$('[data-l]', el).forEach(b => b.onclick = () => { if (b.classList.contains('done')) return; $$('[data-l]', el).forEach(z => z.classList.remove('sel')); b.classList.add('sel'); sel = b; });
        $$('[data-r]', el).forEach(b => b.onclick = () => {
          if (!sel || b.classList.contains('done')) return;
          if (sel.dataset.l === b.dataset.r) { sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done'); got++; sel = null; if (got === x.pairs.length) fin(el, miss === 0, miss ? miss + ' hatayla tamamlandı' : ''); }
          else { miss++; b.classList.add('bad'); setTimeout(() => b.classList.remove('bad'), 450); }
        });
      }
      if (x.type === 'order') {
        const pool = $('.order-pool', el), ans = $('.order-ans', el);
        el.onclick = ev => {
          const b = ev.target.closest('[data-w]');
          if (b && !el.dataset.done) (b.parentNode === pool ? ans : pool).appendChild(b);
        };
        $('[data-reset]', el).onclick = () => $$('[data-w]', ans).forEach(b => pool.appendChild(b));
        $('[data-check]', el).onclick = () => {
          const v = $$('[data-w]', ans).map(b => b.textContent).join(' ');
          if (!v) return;
          fin(el, normAr(v) === normAr(x.answer) || normFr(v) === normFr(x.answer), `<span class="ar">${esc(x.answer)}</span>`);
        };
      }
    });
  }
  ROUTES.alistirma = function (a) {
    const U = (C.workbook || {}).units || [];
    const u = a[0] && U.find(x => x.id === a[0]);
    const best = store.get('wb', {});
    if (u) {
      view.innerHTML = pageHead(esc((u.emoji || '') + ' ' + u.title), esc(u.instructions || ''), `<div class="card" style="padding:10px 16px;font-weight:800" id="wbScore">0 / ${u.exercises.length}</div>`, '<a href="#/alistirma">Çalışma Defteri</a>') +
        `<div class="grid" id="wbList">${u.exercises.map(exerciseHtml).join('')}</div>`;
      bindExercises($('#wbList'), u.exercises, (ok, done) => {
        $('#wbScore').textContent = ok + ' doğru · ' + done + ' / ' + u.exercises.length;
        if (done === u.exercises.length) { best[u.id] = Math.max(best[u.id] || 0, Math.round(ok / done * 100)); store.set('wb', best); toast('Ünite tamamlandı: %' + Math.round(ok / done * 100)); if (ok / done >= .8) confetti(); }
      });
      return;
    }
    view.innerHTML = pageHead('Çalışma Defteri', 'Etkileşimli alıştırmalar. Cevaplarını Arapça harflerle ya da Franko ile yazabilirsin; anında kontrol edilir.') +
      `<div class="grid g3">${U.map(x => `<a class="card mod" href="#/alistirma/${esc(x.id)}"><div class="ic" style="background:#E0F2FE">${esc(x.emoji || '📝')}</div><div><b>${esc(x.title)}</b><small>${x.exercises.length} alıştırma${best[x.id] != null ? ' · En iyi: %' + best[x.id] : ''}</small></div></a>`).join('')}</div>`;
  };

  // ── Test / Quiz ──
  ROUTES.test = function (a, q) {
    const cats = D.cats.filter(c => E.some(e => e.cat === c.name && e.k === 'w'));
    if (!q.start) {
      view.innerHTML = pageHead('Test Çöz', 'Rastgele 10 soruluk test. Kategori ve soru türünü seç.') +
        `<div class="card pad"><div class="tag" style="margin-bottom:8px">Soru türü</div><div class="chips" id="tMode"><button class="chip on" data-v="tr">Türkçe → Arapça</button><button class="chip" data-v="ar">Arapça → Türkçe</button><button class="chip" data-v="listen">🔊 Dinle ve seç</button></div>
        <div class="tag" style="margin:18px 0 8px">Kategori</div><div class="chips" id="tCat"><button class="chip on" data-v="">Karışık</button>${cats.map(c => `<button class="chip" data-v="${esc(c.name)}">${esc(c.emoji || '')} ${esc(c.name)}</button>`).join('')}</div>
        <div style="margin-top:20px"><button class="btn gold" id="tGo">${ic('quiz')} Teste başla</button></div></div>`;
      ['#tMode', '#tCat'].forEach(s => $(s).onclick = ev => { const b = ev.target.closest('.chip'); if (!b) return; $$('.chip', $(s)).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      $('#tGo').onclick = () => go(`#/test?start=1&m=${$('#tMode .on').dataset.v}&cat=${encodeURIComponent($('#tCat .on').dataset.v)}`);
      return;
    }
    const mode = q.m || 'tr';
    let pool = E.filter(e => e.k === 'w' && (!q.cat || e.cat === q.cat));
    if (pool.length < 4) pool = E.filter(e => e.k === 'w');
    const seen = new Set();
    pool = pool.filter(e => { const k = e._tr; if (seen.has(k)) return false; seen.add(k); return true; });
    const qs = pool.slice().sort(() => Math.random() - .5).slice(0, 10).map(e => {
      const distract = pool.filter(x => x !== e && x._ar !== e._ar && x._tr !== e._tr).sort(() => Math.random() - .5).slice(0, 3);
      const opts = distract.concat([e]).sort(() => Math.random() - .5);
      return { e: e, opts: opts, ans: opts.indexOf(e) };
    });
    let i = 0, ok = 0;
    const draw = () => {
      if (i >= qs.length) {
        const pct = Math.round(ok / qs.length * 100);
        if (pct >= 80) confetti();
        const hist = store.get('tests', []); hist.push({ t: Date.now(), p: pct }); store.set('tests', hist.slice(-50));
        view.innerHTML = `<div class="fc-wrap"><div class="card score fade"><div style="font-size:48px">${pct >= 80 ? '🏆' : pct >= 50 ? '👏' : '💪'}</div><b>%${pct}</b><p>${ok} / ${qs.length} doğru</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn pri" id="re">Yeni test</button><a class="btn ghost" href="#/test">Ayarlar</a></div></div></div>`;
        $('#re').onclick = () => ROUTES.test(a, q);
        return;
      }
      const x = qs[i], e = x.e;
      const prompt = mode === 'tr' ? `<div class="qt" style="font-size:24px">${esc(e.em || '')} ${esc(e.tr)}</div><div style="color:var(--muted)">Mısır Arapçası karşılığı hangisi?</div>`
        : mode === 'ar' ? `<div class="qt"><span class="ar" style="font-size:40px">${esc(e.ar)}</span></div><div style="color:var(--muted)">${esc(e.ok)} — anlamı nedir?</div>`
          : `<div class="qt">${playBtn(e.ar)} <span style="color:var(--muted);font-size:15px">Dinle ve doğru anlamı seç</span></div>`;
      view.innerHTML = `<div class="fc-wrap fade"><div class="crumb"><a href="#/test">Test</a> › Soru ${i + 1}/${qs.length}</div><div class="prog"><i style="width:${i / qs.length * 100}%"></i></div>
        <div class="card q">${prompt}<div class="opts">${x.opts.map((o, j) => mode === 'tr' ? `<button class="opt ar" data-o="${j}">${esc(o.ar)}<div style="font-family:var(--ui-font);font-size:12px;color:var(--muted);direction:ltr">${esc(o.ok)}</div></button>` : `<button class="opt" data-o="${j}">${esc(o.tr)}</button>`).join('')}</div><div class="fbx"></div>
        <button class="btn pri" id="nx" hidden>Sonraki ${ic('arrow')}</button></div></div>`;
      if (mode === 'listen') setTimeout(() => speak(e.ar), 250);
      $$('.opt').forEach(b => b.onclick = () => {
        const j = +b.dataset.o, good = j === x.ans;
        if (good) { ok++; addXP(10); }
        $$('.opt').forEach((o, n) => { o.disabled = true; if (n === x.ans) o.classList.add('right'); });
        if (!good) b.classList.add('wrong');
        $('.fbx').innerHTML = `<div class="fb ${good ? 'right' : 'wrong'}">${good ? '✅ Doğru' : '❌ Yanlış'} — <span class="ar">${esc(e.ar)}</span> ${esc(e.ok)} = ${esc(e.tr)}</div>`;
        if (mode !== 'listen') speak(e.ar);
        $('#nx').hidden = false;
        $('#nx').focus();
      });
      $('#nx').onclick = () => { i++; draw(); };
    };
    draw();
  };

  // ── Favoriler / Favourites ──
  ROUTES.favoriler = function () {
    const list = Array.from(favs).map(id => byId.get(id)).filter(Boolean);
    view.innerHTML = pageHead('Favorilerim', 'Yıldızladığın kelime ve ifadeler bu cihazda saklanır.') +
      (list.length ? `<div class="grid gauto">${list.map(e => entryHtml(e)).join('')}</div>` : `<div class="card empty"><b>⭐</b>Henüz favori yok. Kelime kartlarındaki yıldız simgesine dokunarak ekleyebilirsin.</div>`);
  };

  // ── Genel arama kutusu / Global search ──
  function initSearch() {
    const inp = $('#gsInput'), pop = $('#gsPop');
    let act = -1, items = [];
    const close = () => { pop.hidden = true; act = -1; };
    const show = () => {
      const v = inp.value.trim();
      if (!v) return close();
      items = search(v, 8);
      pop.innerHTML = items.map((e, k) => `<div class="gs-item${k === act ? ' act' : ''}" data-k="${k}"><b>${esc(e.tr)}</b><span class="ar">${esc(e.ar)}</span><small>${esc(e.ok)} · ${esc(e.cat)}</small></div>`).join('') +
        `<a class="gs-more" href="#/ceviri?q=${encodeURIComponent(v)}">“${esc(v)}” için çeviriye git →</a>`;
      pop.hidden = false;
    };
    inp.oninput = () => { act = -1; show(); };
    inp.onkeydown = ev => {
      if (ev.key === 'ArrowDown') { act = Math.min(items.length - 1, act + 1); show(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { act = Math.max(-1, act - 1); show(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { ev.preventDefault(); const e = items[act]; go(e ? '#/sozluk?q=' + encodeURIComponent(e.tr.split('/')[0].trim()) : '#/ceviri?q=' + encodeURIComponent(inp.value.trim())); close(); inp.blur(); }
      else if (ev.key === 'Escape') { close(); inp.blur(); }
    };
    pop.onclick = ev => {
      const it = ev.target.closest('.gs-item');
      if (it) { const e = items[+it.dataset.k]; go('#/sozluk?q=' + encodeURIComponent(e.tr.split('/')[0].trim())); close(); }
      if (ev.target.closest('.gs-more')) close();
    };
    document.addEventListener('click', ev => { if (!ev.target.closest('#gsearch')) close(); });
    document.addEventListener('keydown', ev => { if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); inp.focus(); inp.select(); } });
  }

  // ── Menü, tema, ortak tıklamalar / Menu, theme, shared clicks ──
  // Diyaloğu satır satır, konuşan balonu vurgulayarak çalar / Plays a dialogue line by line, highlighting the speaker
  function playDialog(d, box, btn) {
    addXP(3);
    const lines = (d.lines || []).map(l => l.ar), bubs = $$('.bub', box);
    let i = 0;
    try { if (curAudio) curAudio.pause(); } catch (e) {}
    const mark = n => bubs.forEach((b, k) => { b.style.outline = k === n ? '3px solid var(--gold)' : ''; });
    btn.classList.add('playing');
    const next = () => {
      if (i >= lines.length || !document.body.contains(box)) { mark(-1); btn.classList.remove('playing'); return; }
      const n = i++, k = audioKey(lines[n]);
      mark(n);
      if (bubs[n]) bubs[n].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!audioIdx || !audioIdx.has(k)) return setTimeout(next, 400);
      const a = curAudio = newAudio(k);
      a.onended = () => setTimeout(next, 350);
      a.onerror = next;
      a.play().catch(next);
    };
    loadAudioIdx().then(next);
  }
  function setSpeedBtn() { const b = $('#speedBtn'); if (b) { b.textContent = slow ? '0,75×' : '1×'; b.title = slow ? 'Yavaş dinleme açık' : 'Normal hız'; b.classList.toggle('on', slow); } }
  function closeSide() { $('#side').classList.remove('open'); const s = $('.scrim'); if (s) s.remove(); }
  function openSide() { $('#side').classList.add('open'); const s = document.createElement('div'); s.className = 'scrim'; s.onclick = closeSide; document.body.appendChild(s); }
  function setThemeIcon() { const dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches); $('#themeBtn').innerHTML = ic(dark ? 'sun' : 'moon'); return dark; }
  document.addEventListener('click', ev => {
    const say = ev.target.closest('[data-say]');
    if (say) { ev.preventDefault(); ev.stopPropagation(); speak(say.dataset.say, say); return; }
    const fav = ev.target.closest('[data-fav]');
    if (fav) {
      const raw = fav.dataset.fav, id = raw;
      if (!byId.has(id)) { toast('Bu ifade sözlükte yok; favorilere eklenemedi'); return; }
      if (favs.has(id)) { favs.delete(id); toast('Favorilerden çıkarıldı'); } else { favs.add(id); toast('⭐ Favorilere eklendi'); }
      saveFavs();
      $$(`[data-fav="${raw}"]`).forEach(b => b.classList.toggle('on', favs.has(id)));
      buildNav();
      return;
    }
    const cp = ev.target.closest('[data-copy]');
    if (cp) { navigator.clipboard && navigator.clipboard.writeText(cp.dataset.copy).then(() => toast('Kopyalandı')); return; }
    if (ev.target.closest('#bMore')) { openSide(); }
  }, true);
  $('#menuBtn').onclick = openSide;
  // Yukarı çık düğmesi / Back-to-top button
  const toTop = $('#toTop');
  addEventListener('scroll', () => { toTop.hidden = scrollY < 400; }, { passive: true });
  toTop.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  $('#speedBtn').onclick = () => { slow = !slow; store.set('slow', slow); setSpeedBtn(); toast(slow ? '🐢 Yavaş dinleme açık' : 'Normal hızda dinleme'); };
  setSpeedBtn();
  $('#themeBtn').onclick = () => { const dark = setThemeIcon(); const t = dark ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', t); store.set('theme', t); try { localStorage.setItem('masri.theme', t); } catch (e) {} setThemeIcon(); };

  // Üyelik modülü (members.js) için arayüz / API for the membership module
  window.MASRI_APP = {
    store: store, ROUTES: ROUTES, view: view, esc: esc, ic: ic, pageHead: pageHead, toast: toast, go: go, confetti: confetti,
    buildNav: buildNav, render: render, xpState: xpState, lvlOf: lvlOf, lvlName: lvlName,
    reloadState: () => { favs = new Set(store.get('favs', [])); cards = store.get('cards', {}); }
  };
  buildNav();
  initSearch();
  setThemeIcon();
  window.addEventListener('hashchange', render);
  render();
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    // Yeni sürüm devreye girince sayfa bir kez kendini yeniler / Reload once when a new version takes over
    const hadCtrl = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  }
})();
