/* Arapça Öğren — Üyelik ve Yönetim (Firebase)
   Misafirler: ana sayfa, çeviri, sözlük, fabrika dili, alfabe, konuşma, gramer, fiiller açık.
   Onaylı üyeler: + kelime kartları, çalışma defteri, test, favoriler; ilerleme buluta kaydedilir (cihazlar arası).
   Admin (Google ile giriş, doğrulanmış e-posta): kullanıcı onayı, kullanıcı listesi, yedekleme / geri yükleme, duyuru.
   assets/fb-config.js boşsa modül devre dışıdır ve site herkese açık çalışır.
   Asıl güvenlik Firestore kurallarıyla sağlanır (tools/firestore.rules). */
(function () {
  'use strict';
  const A = window.MASRI_APP;
  const CFG = window.MASRI_FB;
  if (!A || !CFG || !CFG.apiKey) return;

  const ADMIN = 'baydogan.sevtap@gmail.com';
  const MEMBER_ROUTES = ['kartlar', 'alistirma', 'test', 'favoriler'];
  const SYNC_KEYS = ['xp', 'cards', 'favs', 'wb', 'tests', 'streak'];
  const SDK = 'https://www.gstatic.com/firebasejs/10.13.2/';
  const { store, ROUTES, view, esc, ic, pageHead, toast, go } = A;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // role: guest | pending | member | admin | disabled — çevrimdışıyken son bilinen rol kullanılır / last known role offline
  const ST = { ready: false, user: null, prof: null, role: store.get('role', 'guest'), announce: null, db: null, auth: null };
  window.MASRI_AUTH = ST;
  const isMember = () => ST.role === 'member' || ST.role === 'admin';
  const isAdmin = () => ST.role === 'admin';

  // ── Menü ve erişim / Menu and access ──
  window.MASRI_GATE = r => !MEMBER_ROUTES.includes(r) || isMember();
  window.MASRI_NAV_FILTER = nav => {
    const out = nav.map(n => MEMBER_ROUTES.includes(n[0]) && !isMember() ? [n[0], n[1], n[2], null, 'lock'] : n);
    if (isAdmin()) out.push(['h', 'Yönetim'], ['admin', 'shield', 'Yönetim Paneli', null, null, '#F97316'], ['admin/kullanicilar', 'users', 'Kullanıcılar', () => ST.pendingCount || '', null, '#38BDF8'], ['admin/yedek', 'save', 'Yedekleme', null, null, '#22C55E'], ['admin/duyuru', 'mega', 'Duyuru', null, null, '#FF5DA2']);
    return out;
  };

  function acctBtn() {
    const b = $('#acctBtn');
    if (!b) return;
    b.hidden = false;
    if (ST.user) {
      const nm = (ST.prof && ST.prof.name) || ST.user.displayName || ST.user.email || '?';
      b.innerHTML = `<span class="avatar${isAdmin() ? ' adm' : ''}">${esc(nm.trim().charAt(0).toLocaleUpperCase('tr'))}</span>`;
      b.title = nm + (isAdmin() ? ' (Admin)' : ST.role === 'pending' ? ' (onay bekliyor)' : '');
      b.href = '#/hesabim';
    } else { b.innerHTML = ic('user'); b.title = 'Giriş yap / Üye ol'; b.href = '#/giris'; }
  }
  function refresh() { store.set('role', ST.role); acctBtn(); A.buildNav(); A.render(); }

  // ── Firebase yükleme / Loading Firebase ──
  const loadJS = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();
  loadJS(SDK + 'firebase-app-compat.js').then(() => Promise.all([loadJS(SDK + 'firebase-auth-compat.js'), loadJS(SDK + 'firebase-firestore-compat.js')])).then(() => {
    // EMS ile aynı Firebase projesi: ayrı uygulama adı → oturumlar karışmaz; veriler ar_* koleksiyonlarında
    const app = firebase.initializeApp(CFG, 'arapca');
    ST.auth = app.auth();
    ST.db = app.firestore();
    ST.auth.getRedirectResult().catch(e => toast(errTr(e)));
    ST.auth.onAuthStateChanged(onUser);
    ST.db.collection('ar_site').doc('settings').onSnapshot(d => { ST.announce = d.exists ? d.data().announce || null : null; banner(); }, () => {});
  }).catch(() => { ST.ready = true; acctBtn(); });

  let profUnsub = null;
  async function onUser(u) {
    if (profUnsub) { profUnsub(); profUnsub = null; }
    ST.user = u || null;
    if (!u) { ST.prof = null; ST.role = 'guest'; ST.ready = true; refresh(); return; }
    const adm = u.email === ADMIN && u.emailVerified;
    const ref = ST.db.collection('ar_users').doc(u.uid);
    try {
      const snap = await ref.get();
      if (!snap.exists) {
        await ref.set({ email: u.email || '', name: u.displayName || (u.email || '').split('@')[0], status: adm ? 'approved' : 'pending', role: adm ? 'admin' : 'member', createdAt: TS(), lastSeen: TS() });
      } else ref.update({ lastSeen: TS(), name: snap.data().name || u.displayName || '' }).catch(() => {});
    } catch (e) { console.warn('[Üyelik / Membership]', e); }
    // Onay anında menüler açılsın diye profil canlı izlenir / Live profile so approval unlocks instantly
    profUnsub = ref.onSnapshot(d => {
      ST.prof = d.exists ? d.data() : null;
      const before = ST.role;
      ST.role = adm ? 'admin' : !ST.prof ? 'pending' : ST.prof.status === 'approved' ? 'member' : ST.prof.status === 'disabled' ? 'disabled' : 'pending';
      ST.ready = true;
      if (isMember() && before !== ST.role) syncDown();
      if (before === 'pending' && ST.role === 'member') { A.confetti(); toast('🎉 Üyeliğin onaylandı! Tüm bölümler açıldı.'); }
      refresh();
    }, () => { ST.ready = true; refresh(); });
    if (isAdmin()) watchPending();
  }
  function watchPending() {
    ST.db.collection('ar_users').where('status', '==', 'pending').onSnapshot(q => { ST.pendingCount = q.size; A.buildNav(); }, () => {});
  }

  // ── İlerleme senkronu / Progress sync ──
  let pushT = null, muted = false;
  window.MASRI_ONSET = k => {
    if (muted || !SYNC_KEYS.includes(k) || !isMember() || !ST.user) return;
    clearTimeout(pushT);
    pushT = setTimeout(pushUp, 2500);
  };
  function pushUp() {
    if (!ST.user || !isMember()) return;
    const data = {};
    SYNC_KEYS.forEach(k => { data[k] = store.get(k, null); });
    const x = data.xp || {};
    ST.db.collection('ar_progress').doc(ST.user.uid).set({ data: JSON.stringify(data), xp: x.total || 0, updatedAt: TS() }).catch(e => console.warn('[Senkron / Sync]', e));
  }
  async function syncDown() {
    try {
      const d = await ST.db.collection('ar_progress').doc(ST.user.uid).get();
      if (d.exists && d.data().data) {
        const R = JSON.parse(d.data().data), L = {};
        SYNC_KEYS.forEach(k => { L[k] = store.get(k, null); });
        const M = mergeProgress(L, R);
        muted = true;
        SYNC_KEYS.forEach(k => { if (M[k] != null) store.set(k, M[k]); });
        muted = false;
        A.reloadState();
      }
      pushUp();
      A.buildNav();
      A.render();
    } catch (e) { console.warn('[Senkron / Sync]', e); }
  }
  // Cihaz ve bulut ilerlemesi birleştirilir; hiçbir şey kaybolmaz / Device and cloud progress are merged; nothing is lost
  function mergeProgress(L, R) {
    const M = {};
    const lx = L.xp || { total: 0, n: 0, day: '' }, rx = R.xp || { total: 0, n: 0, day: '' };
    M.xp = { total: Math.max(lx.total || 0, rx.total || 0), day: lx.day >= rx.day ? lx.day : rx.day, n: lx.day === rx.day ? Math.max(lx.n || 0, rx.n || 0) : (lx.day > rx.day ? lx.n : rx.n) || 0 };
    M.cards = Object.assign({}, R.cards || {});
    Object.entries(L.cards || {}).forEach(([id, c]) => { const o = M.cards[id]; if (!o || (c.t || 0) > (o.t || 0)) M.cards[id] = c; });
    M.favs = Array.from(new Set([].concat(R.favs || [], L.favs || [])));
    M.wb = Object.assign({}, R.wb || {});
    Object.entries(L.wb || {}).forEach(([k, v]) => { M.wb[k] = Math.max(M.wb[k] || 0, v); });
    const seen = new Set();
    M.tests = [].concat(R.tests || [], L.tests || []).filter(t => { if (seen.has(t.t)) return false; seen.add(t.t); return true; }).sort((a, b) => a.t - b.t).slice(-50);
    const ls = L.streak || { last: '', n: 0 }, rs = R.streak || { last: '', n: 0 };
    M.streak = ls.last > rs.last ? ls : rs.last > ls.last ? rs : { last: ls.last, n: Math.max(ls.n || 0, rs.n || 0) };
    return M;
  }

  // ── Hata mesajları / Error messages ──
  function errTr(e) {
    const c = (e && e.code) || '';
    return ({
      'auth/invalid-email': 'E-posta adresi geçersiz.', 'auth/user-not-found': 'Bu e-postayla kayıtlı üye yok.', 'auth/wrong-password': 'Şifre yanlış.',
      'auth/invalid-credential': 'E-posta veya şifre yanlış.', 'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.',
      'auth/weak-password': 'Şifre en az 6 karakter olmalı.', 'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
      'auth/popup-closed-by-user': 'Google penceresi kapatıldı.', 'auth/network-request-failed': 'İnternet bağlantısı yok.',
      'auth/unauthorized-domain': 'Bu alan adı Firebase ayarlarında yetkili değil.', 'permission-denied': 'Bu işlem için yetkiniz yok.'
    })[c] || ('Bir hata oluştu' + (c ? ' (' + c + ')' : '') + '.');
  }

  // ── Kilitli sayfa / Locked page ──
  ROUTES.__locked = function () {
    const p = ST.role === 'pending', d = ST.role === 'disabled';
    view.innerHTML = `<div class="card auth-card fade" style="max-width:620px;margin:20px auto;text-align:center">
      <div class="lock-ic">${p ? '⏳' : d ? '⛔' : '🔒'}</div>
      <h1 style="margin:6px 0">${p ? 'Üyeliğin onay bekliyor' : d ? 'Hesabın pasif' : 'Bu bölüm üyelere özel'}</h1>
      <p style="color:var(--muted)">${p ? 'Yönetici üyeliğini onayladığında bu bölümler kendiliğinden açılacak. Sayfayı yenilemene gerek yok.' : d ? 'Hesabın yönetici tarafından pasif yapıldı. Bilgi için yöneticiyle iletişime geç.' : 'Ücretsiz üye ol, yönetici onayından sonra şunlar açılır:'}</p>
      ${!p && !d ? `<ul class="perks"><li>🃏 Kelime kartları (3 kutu yöntemi)</li><li>📝 Çalışma defteri ve 🎯 testler</li><li>⭐ Favoriler</li><li>☁️ İlerlemen buluta kaydedilir: telefonda ve bilgisayarda aynı seviye</li></ul>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn gold" href="#/giris?t=kayit">Üye ol</a><a class="btn ghost" href="#/giris">Giriş yap</a></div>` : ''}
    </div>`;
  };

  // ── Giriş / Kayıt / Login and sign-up ──
  ROUTES.giris = function (a, q) {
    if (ST.user) { go('#/hesabim'); return; }
    let tab = q.t === 'kayit' ? 'kayit' : 'giris';
    const draw = () => {
      view.innerHTML = `<div class="card auth-card fade">
        <div class="auth-tabs"><button class="${tab === 'giris' ? 'on' : ''}" data-t="giris">Giriş yap</button><button class="${tab === 'kayit' ? 'on' : ''}" data-t="kayit">Üye ol</button></div>
        <button class="btn ghost google" id="gBtn"><svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Google ile ${tab === 'kayit' ? 'üye ol' : 'giriş yap'}</button>
        <div class="or"><span>veya e-posta ile</span></div>
        <form id="aForm" class="auth-form">
          ${tab === 'kayit' ? '<label>Ad Soyad<input name="name" required autocomplete="name" placeholder="Adın ve soyadın"></label>' : ''}
          <label>E-posta<input name="email" type="email" required autocomplete="email" placeholder="ornek@mail.com"></label>
          <label>Şifre<input name="pass" type="password" required minlength="6" autocomplete="${tab === 'kayit' ? 'new-password' : 'current-password'}" placeholder="En az 6 karakter"></label>
          <button class="btn pri" type="submit">${tab === 'kayit' ? 'Üye ol' : 'Giriş yap'}</button>
          ${tab === 'giris' ? '<button type="button" class="linkbtn" id="forgot">Şifremi unuttum</button>' : '<p class="hint">Üyeliğin yönetici onayından sonra aktif olur. Onaylanınca kartlar, testler ve alıştırmalar açılır.</p>'}
        </form><div id="aMsg"></div></div>`;
      $$('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
      const msg = (t, ok) => { $('#aMsg').innerHTML = `<div class="fb ${ok ? 'right' : 'wrong'}" style="margin-top:12px">${esc(t)}</div>`; };
      $('#gBtn').onclick = async () => {
        if (!ST.auth) return msg('Bağlantı kuruluyor, birkaç saniye sonra tekrar deneyin.');
        const pr = new firebase.auth.GoogleAuthProvider();
        pr.setCustomParameters({ prompt: 'select_account' });
        try { await ST.auth.signInWithPopup(pr); go('#/hesabim'); }
        catch (e) { if (/popup-blocked|operation-not-supported/.test(e.code || '')) ST.auth.signInWithRedirect(pr); else msg(errTr(e)); }
      };
      $('#aForm').onsubmit = async ev => {
        ev.preventDefault();
        if (!ST.auth) return msg('Bağlantı kuruluyor, birkaç saniye sonra tekrar deneyin.');
        const f = new FormData(ev.target), email = String(f.get('email')).trim(), pass = String(f.get('pass'));
        const btn = $('button[type=submit]', ev.target);
        btn.disabled = true;
        try {
          if (tab === 'kayit') {
            const r = await ST.auth.createUserWithEmailAndPassword(email, pass);
            await r.user.updateProfile({ displayName: String(f.get('name')).trim() });
            await ST.db.collection('ar_users').doc(r.user.uid).set({ name: String(f.get('name')).trim() }, { merge: true }).catch(() => {});
            r.user.sendEmailVerification().catch(() => {});
          } else await ST.auth.signInWithEmailAndPassword(email, pass);
          go('#/hesabim');
        } catch (e) { msg(errTr(e)); btn.disabled = false; }
      };
      const fg = $('#forgot');
      if (fg) fg.onclick = async () => {
        const email = ($('input[name=email]').value || '').trim();
        if (!email) return msg('Önce e-posta adresini yaz.');
        try { await ST.auth.sendPasswordResetEmail(email); msg('Şifre sıfırlama bağlantısı e-postana gönderildi.', true); } catch (e) { msg(errTr(e)); }
      };
    };
    draw();
  };

  // ── Hesabım / My account ──
  ROUTES.hesabim = function () {
    if (!ST.user) { go('#/giris'); return; }
    const x = A.xpState(), l = A.lvlOf(x.total), p = ST.prof || {};
    const badge = { admin: ['Admin', '#F97316'], member: ['Onaylı üye', '#22C55E'], pending: ['Onay bekliyor', '#FFB020'], disabled: ['Pasif', '#FF5D73'] }[ST.role] || ['Misafir', '#94A3B8'];
    view.innerHTML = pageHead('Hesabım', '') + `<div class="grid g2" style="align-items:start">
      <div class="card pad"><div style="display:flex;gap:14px;align-items:center"><span class="avatar big${isAdmin() ? ' adm' : ''}">${esc((p.name || ST.user.email || '?').charAt(0).toLocaleUpperCase('tr'))}</span><div><b style="font-size:19px">${esc(p.name || ST.user.displayName || '')}</b><div style="color:var(--muted)">${esc(ST.user.email || '')}</div><span class="pill" style="--pc:${badge[1]}">${badge[0]}</span></div></div>
        <form id="nmForm" class="auth-form" style="margin-top:16px"><label>Görünen ad<input name="name" value="${esc(p.name || '')}" required></label><button class="btn ghost sm" type="submit">Adı kaydet</button></form>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">${isAdmin() ? `<a class="btn gold" href="#/admin">${ic('shield')} Yönetim paneli</a>` : ''}<button class="btn ghost" id="outBtn">${ic('out')} Çıkış yap</button></div></div>
      <div class="card pad"><span class="tag">İlerlemem ${isMember() ? '· ☁️ buluta kaydediliyor' : ''}</span><div style="font-size:26px;font-weight:900;margin-top:6px">Seviye ${l} · ${esc(A.lvlName(l))}</div><div style="color:var(--muted)">${x.total} XP · bugün ${x.n} XP</div>
        ${ST.role === 'pending' ? '<div class="note" style="margin-top:12px">⏳ Üyeliğin yönetici onayı bekliyor. Onaylanınca kartlar, testler ve alıştırmalar açılacak.</div>' : ''}
        ${ST.user.providerData.some(pd => pd.providerId === 'password') && !ST.user.emailVerified ? '<div class="note" style="margin-top:12px">📧 E-posta adresini doğrulamadın. Gelen kutundaki bağlantıya tıkla.</div>' : ''}</div></div>`;
    $('#outBtn').onclick = async () => { pushUp(); await ST.auth.signOut(); toast('Çıkış yapıldı'); go('#/'); };
    $('#nmForm').onsubmit = async ev => {
      ev.preventDefault();
      const nm = new FormData(ev.target).get('name').trim();
      try { await ST.db.collection('ar_users').doc(ST.user.uid).update({ name: nm }); await ST.user.updateProfile({ displayName: nm }); toast('Ad kaydedildi'); } catch (e) { toast(errTr(e)); }
    };
  };

  // ── Yönetim paneli / Admin panel ──
  const fmtD = t => { const d = t && t.toDate ? t.toDate() : t && t._ts ? new Date(t._ts) : null; return d ? d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; };
  const ST_LBL = { approved: ['Onaylı', '#22C55E'], pending: ['Bekliyor', '#FFB020'], disabled: ['Pasif', '#FF5D73'] };
  ROUTES.admin = function (a) {
    if (!isAdmin()) { view.innerHTML = `<div class="card empty"><b>🔒</b>Bu sayfa yalnız yöneticiye açık.</div>`; return; }
    const sub = a[0] || '';
    if (sub === 'kullanicilar') return adminUsers();
    if (sub === 'yedek') return adminBackup();
    if (sub === 'duyuru') return adminAnnounce();
    adminHome();
  };
  async function loadUsers() {
    const [u, p] = await Promise.all([ST.db.collection('ar_users').get(), ST.db.collection('ar_progress').get()]);
    const xp = {};
    p.forEach(d => { xp[d.id] = d.data().xp || 0; });
    return u.docs.map(d => Object.assign({ id: d.id, xp: xp[d.id] || 0 }, d.data()));
  }
  async function adminHome() {
    view.innerHTML = pageHead('🛡️ Yönetim Paneli', 'Üyeleri onayla, verileri yedekle, duyuru yayınla.') + `<div id="adm" class="empty">Yükleniyor…</div>`;
    try {
      const U = await loadUsers(), now = Date.now();
      const c = s => U.filter(u => u.status === s).length;
      const act = U.filter(u => u.lastSeen && u.lastSeen.toDate && now - u.lastSeen.toDate().getTime() < 7 * 864e5).length;
      const pend = U.filter(u => u.status === 'pending');
      if (!$('#adm')) return;
      $('#adm').outerHTML = `<div class="stats">
        <div class="stat vivid" style="--g1:#7C5CFF;--g2:#C084FC"><div class="ic">👥</div><div><b>${U.length}</b><small>toplam üye</small></div></div>
        <div class="stat vivid" style="--g1:#FFB020;--g2:#FF7A45"><div class="ic">⏳</div><div><b>${c('pending')}</b><small>onay bekleyen</small></div></div>
        <div class="stat vivid" style="--g1:#22C55E;--g2:#2EC4F1"><div class="ic">✅</div><div><b>${c('approved')}</b><small>onaylı üye</small></div></div>
        <div class="stat vivid" style="--g1:#FF5D73;--g2:#FF5DA2"><div class="ic">🔥</div><div><b>${act}</b><small>son 7 günde aktif</small></div></div></div>
        <div class="sec-h"><h2>⏳ Onay bekleyenler</h2><a href="#/admin/kullanicilar">Tüm kullanıcılar →</a></div>
        ${pend.length ? `<div class="grid">${pend.map(u => `<div class="card pad urow"><div><b>${esc(u.name || '')}</b><div style="color:var(--muted);font-size:13px">${esc(u.email || '')} · ${fmtD(u.createdAt)}</div></div><div class="uact"><button class="btn ok sm" data-ap="${u.id}">Onayla</button><button class="btn no sm" data-rj="${u.id}">Reddet</button></div></div>`).join('')}</div>` : '<div class="card empty" style="padding:24px">Bekleyen üye yok 🎉</div>'}
        <div class="sec-h"><h2>Hızlı işlemler</h2></div>
        <div class="grid g3"><a class="card mod vivid-mod" style="--mc:#38BDF8" href="#/admin/kullanicilar"><div class="ic">👥</div><div><b>Kullanıcılar</b><small>Onayla, pasif yap, sil</small></div></a>
        <a class="card mod vivid-mod" style="--mc:#22C55E" href="#/admin/yedek"><div class="ic">💾</div><div><b>Yedekleme</b><small>Yedek al, yedekten geri yükle</small></div></a>
        <a class="card mod vivid-mod" style="--mc:#FF5DA2" href="#/admin/duyuru"><div class="ic">📣</div><div><b>Duyuru</b><small>Ana sayfada mesaj göster</small></div></a></div>`;
      bindUserActions(adminHome);
    } catch (e) { if ($('#adm')) $('#adm').textContent = errTr(e); }
  }
  function bindUserActions(again) {
    const upd = (id, data, msg) => ST.db.collection('ar_users').doc(id).update(data).then(() => { toast(msg); again(); }).catch(e => toast(errTr(e)));
    $$('[data-ap]').forEach(b => b.onclick = () => upd(b.dataset.ap, { status: 'approved' }, '✅ Üyelik onaylandı'));
    $$('[data-rj]').forEach(b => b.onclick = () => { if (confirm('Bu üyelik başvurusu reddedilip hesap pasif yapılsın mı?')) upd(b.dataset.rj, { status: 'disabled' }, 'Başvuru reddedildi'); });
    $$('[data-ds]').forEach(b => b.onclick = () => { if (confirm('Bu kullanıcı pasif yapılsın mı? Üyelere özel bölümlere erişemez.')) upd(b.dataset.ds, { status: 'disabled' }, 'Kullanıcı pasif yapıldı'); });
    $$('[data-pd]').forEach(b => b.onclick = () => upd(b.dataset.pd, { status: 'pending' }, 'Kullanıcı beklemeye alındı'));
    $$('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('Kullanıcının üyelik kaydı ve ilerlemesi silinsin mi? Bu işlem geri alınamaz (yedeğiniz yoksa).')) return;
      Promise.all([ST.db.collection('ar_users').doc(b.dataset.del).delete(), ST.db.collection('ar_progress').doc(b.dataset.del).delete()]).then(() => { toast('Kullanıcı silindi'); again(); }).catch(e => toast(errTr(e)));
    });
  }
  async function adminUsers() {
    view.innerHTML = pageHead('👥 Kullanıcılar', 'Üyeleri onayla, pasif yap veya sil. İlerleme XP olarak görünür.', '', '<a href="#/admin">Yönetim</a>') + `<div class="gsearch" style="max-width:none;margin-bottom:12px"><svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="uq" placeholder="Ad veya e-posta ara…"></div><div id="ul" class="empty">Yükleniyor…</div>`;
    try {
      const U = (await loadUsers()).sort((a, b) => ({ pending: 0, approved: 1, disabled: 2 }[a.status] || 3) - ({ pending: 0, approved: 1, disabled: 2 }[b.status] || 3) || b.xp - a.xp);
      const draw = () => {
        const q = ($('#uq').value || '').toLocaleLowerCase('tr');
        const L = U.filter(u => !q || (u.name || '').toLocaleLowerCase('tr').includes(q) || (u.email || '').toLowerCase().includes(q));
        if (!$('#ul')) return;
      $('#ul').outerHTML = `<div id="ul" class="card" style="overflow:hidden"><div class="tbl-wrap" style="margin:0;border:0"><table class="t"><thead><tr><th>Ad</th><th>E-posta</th><th>Durum</th><th>XP / Seviye</th><th>Son giriş</th><th>Kayıt</th><th></th></tr></thead><tbody>${L.map(u => {
          const sl = u.role === 'admin' ? ['Admin', '#F97316'] : ST_LBL[u.status] || ['?', '#94A3B8'], me = ST.user && u.id === ST.user.uid;
          return `<tr><td><b>${esc(u.name || '')}</b></td><td>${esc(u.email || '')}</td><td><span class="pill" style="--pc:${sl[1]}">${sl[0]}</span></td><td>${u.xp} XP · Sv. ${A.lvlOf(u.xp)}</td><td>${fmtD(u.lastSeen)}</td><td>${fmtD(u.createdAt)}</td>
            <td class="uact">${me || u.role === 'admin' ? '' : `${u.status !== 'approved' ? `<button class="btn ok sm" data-ap="${u.id}">Onayla</button>` : ''}${u.status === 'approved' ? `<button class="btn ghost sm" data-pd="${u.id}">Beklemeye al</button>` : ''}${u.status !== 'disabled' ? `<button class="btn ghost sm" data-ds="${u.id}">Pasif yap</button>` : ''}<button class="btn no sm" data-del="${u.id}">Sil</button>`}</td></tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">Kullanıcı yok</td></tr>'}</tbody></table></div></div>`;
        bindUserActions(adminUsers);
      };
      $('#uq').oninput = draw;
      draw();
    } catch (e) { if ($('#ul')) $('#ul').textContent = errTr(e); }
  }

  // ── Yedekleme / Backup & restore ──
  const ser = v => v && v.toDate ? { _ts: v.toDate().getTime() } : Array.isArray(v) ? v.map(ser) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, ser(x)])) : v;
  const deser = v => v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && '_ts' in v ? firebase.firestore.Timestamp.fromMillis(v._ts) : Array.isArray(v) ? v.map(deser) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deser(x)])) : v;
  async function snapshot() {
    const out = { app: 'arapca-ogren', version: 1, createdAt: Date.now(), by: ST.user.email, collections: {} };
    for (const c of ['users', 'progress', 'site']) {
      const q = await ST.db.collection(c).get();
      out.collections[c] = {};
      q.forEach(d => { out.collections[c][d.id] = ser(d.data()); });
    }
    return out;
  }
  function download(obj) {
    const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arapca-yedek-' + new Date(obj.createdAt || Date.now()).toISOString().slice(0, 16).replace(/[T:]/g, '-') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function restore(obj) {
    if (!obj || obj.app !== 'arapca-ogren' || !obj.collections) throw new Error('Bu dosya bir Arapça Öğren yedeği değil.');
    const ops = [];
    Object.entries(obj.collections).forEach(([c, docs]) => { if (['users', 'progress', 'site'].includes(c)) Object.entries(docs).forEach(([id, data]) => ops.push([c, id, deser(data)])); });
    for (let i = 0; i < ops.length; i += 400) {
      const b = ST.db.batch();
      ops.slice(i, i + 400).forEach(([c, id, data]) => b.set(ST.db.collection(c).doc(id), data));
      await b.commit();
    }
    return ops.length;
  }
  async function adminBackup() {
    view.innerHTML = pageHead('💾 Yedekleme', 'Üyeler, ilerlemeler ve site ayarları yedeklenir. Sözlük ve içerikler zaten GitHub deposunda sürüm geçmişiyle saklanıyor.', '', '<a href="#/admin">Yönetim</a>') + `
      <div class="grid g3">
        <div class="card pad"><b>⬇️ Dosyaya yedek al</b><p style="color:var(--muted)">Tüm üye verisi bilgisayarına .json dosyası olarak iner.</p><button class="btn pri" id="bDl">Yedeği indir</button></div>
        <div class="card pad"><b>☁️ Buluta yedek al</b><p style="color:var(--muted)">Yedeğin bir kopyası Firebase'de saklanır (son 10 yedek).</p><button class="btn gold" id="bCloud">Buluta yedekle</button></div>
        <div class="card pad"><b>⬆️ Dosyadan geri yükle</b><p style="color:var(--muted)">Daha önce indirdiğin yedek dosyasını seç.</p><input type="file" id="bFile" accept="application/json,.json" hidden><button class="btn ghost" id="bUp">Dosya seç</button></div>
      </div>
      <div class="sec-h"><h2>Buluttaki yedekler</h2></div><div id="bList" class="empty">Yükleniyor…</div>`;
    const ask = what => { const t = prompt(what + '\n\nMevcut veriler yedektekiyle değiştirilecek. Onaylamak için GERİ YÜKLE yazın:'); return t && t.trim().toLocaleUpperCase('tr') === 'GERİ YÜKLE'; };
    $('#bDl').onclick = async () => { try { download(await snapshot()); toast('Yedek indirildi'); } catch (e) { toast(errTr(e)); } };
    $('#bCloud').onclick = async () => {
      try {
        const s = await snapshot(), json = JSON.stringify(s);
        if (json.length > 900000) { download(s); toast('Yedek bulut sınırını aşıyor; dosya olarak indirildi'); return; }
        await ST.db.collection('ar_backups').add({ createdAt: TS(), by: ST.user.email, users: Object.keys(s.collections.users).length, json: json });
        const old = await ST.db.collection('ar_backups').orderBy('createdAt', 'desc').get();
        old.docs.slice(10).forEach(d => d.ref.delete());
        toast('☁️ Buluta yedeklendi'); adminBackup();
      } catch (e) { toast(errTr(e)); }
    };
    $('#bUp').onclick = () => $('#bFile').click();
    $('#bFile').onchange = async ev => {
      const f = ev.target.files[0];
      if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!ask('“' + f.name + '” dosyasından geri yüklenecek.')) return;
        toast('Önce mevcut durum buluta yedekleniyor…');
        await ST.db.collection('ar_backups').add({ createdAt: TS(), by: ST.user.email, note: 'Geri yükleme öncesi otomatik', json: JSON.stringify(await snapshot()) }).catch(() => {});
        const n = await restore(obj);
        toast('✅ Geri yüklendi (' + n + ' kayıt)'); adminBackup();
      } catch (e) { toast(e.message || errTr(e)); }
    };
    try {
      const q = await ST.db.collection('ar_backups').orderBy('createdAt', 'desc').limit(10).get();
      if (!$('#bList')) return;
      $('#bList').outerHTML = q.empty ? '<div class="card empty" style="padding:24px">Henüz bulut yedeği yok.</div>' : `<div class="grid">${q.docs.map(d => { const b = d.data(); return `<div class="card pad urow"><div><b>${fmtD(b.createdAt)}</b><div style="color:var(--muted);font-size:13px">${esc(b.by || '')}${b.users != null ? ' · ' + b.users + ' üye' : ''}${b.note ? ' · ' + esc(b.note) : ''}</div></div><div class="uact"><button class="btn ghost sm" data-bd="${d.id}">İndir</button><button class="btn gold sm" data-br="${d.id}">Geri yükle</button><button class="btn no sm" data-bx="${d.id}">Sil</button></div></div>`; }).join('')}</div>`;
      const get = async id => JSON.parse((await ST.db.collection('ar_backups').doc(id).get()).data().json);
      $$('[data-bd]').forEach(b => b.onclick = async () => download(await get(b.dataset.bd)));
      $$('[data-br]').forEach(b => b.onclick = async () => { if (!ask('Seçilen bulut yedeğinden geri yüklenecek.')) return; try { const n = await restore(await get(b.dataset.br)); toast('✅ Geri yüklendi (' + n + ' kayıt)'); } catch (e) { toast(e.message || errTr(e)); } });
      $$('[data-bx]').forEach(b => b.onclick = () => { if (confirm('Bu bulut yedeği silinsin mi?')) ST.db.collection('ar_backups').doc(b.dataset.bx).delete().then(adminBackup); });
    } catch (e) { if ($('#bList')) $('#bList').textContent = errTr(e); }
  }

  // ── Duyuru / Announcement ──
  function adminAnnounce() {
    const a = ST.announce || {};
    view.innerHTML = pageHead('📣 Duyuru', 'Ana sayfanın en üstünde herkese görünen mesaj.', '', '<a href="#/admin">Yönetim</a>') + `<div class="card pad" style="max-width:720px">
      <form id="anF" class="auth-form"><label>Duyuru metni<textarea name="text" rows="3" maxlength="400" placeholder="ör. Yarın vardiya 8:00'de başlıyor. / بكرة الوردية الساعة ٨">${esc(a.text || '')}</textarea></label>
      <label>Renk<select name="tone"><option value="info"${a.tone === 'info' ? ' selected' : ''}>Mavi · bilgi</option><option value="ok"${a.tone === 'ok' ? ' selected' : ''}>Yeşil · güzel haber</option><option value="warn"${a.tone === 'warn' ? ' selected' : ''}>Turuncu · dikkat</option></select></label>
      <label class="chk"><input type="checkbox" name="on"${a.on ? ' checked' : ''}> Duyuruyu yayınla</label>
      <div style="display:flex;gap:10px"><button class="btn pri" type="submit">Kaydet</button></div></form></div>`;
    $('#anF').onsubmit = async ev => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      try { await ST.db.collection('ar_site').doc('settings').set({ announce: { text: String(f.get('text')).trim(), tone: f.get('tone'), on: !!f.get('on'), updatedAt: TS() } }, { merge: true }); toast('📣 Duyuru kaydedildi'); } catch (e) { toast(errTr(e)); }
    };
  }
  function banner() {
    const old = $('#annBar');
    if (old) old.remove();
    const a = ST.announce;
    if (!a || !a.on || !a.text || location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] !== '') return;
    const el = document.createElement('div');
    el.id = 'annBar';
    el.className = 'ann ' + (a.tone || 'info');
    el.innerHTML = `<span>📣</span><div>${esc(a.text)}</div>`;
    view.insertBefore(el, view.firstChild);
  }
  window.MASRI_AFTER_RENDER = () => banner();

  // ── Başlangıç / Start ──
  acctBtn();
  A.buildNav();
  A.render();
})();
