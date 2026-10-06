# Arapça Öğren (Mısır lehçesi portalı) — kalıcı çalışma kuralları ve harita

Canlı: https://abdllhbydgn.github.io/arapca/ — statik SPA (GitHub Pages), hash yönlendirme `#/sayfa`.
**Tüm dosyaları tarama.** Aşağıdaki haritadan ilgili dosyaya git, `grep -n` ile fonksiyonu bul, yalnız o bölümü oku.

## Kurallar
- Tüm Arapça metin ve seslendirme **Mısır (Kahire) halk ağzı** — konfeksiyon fabrikası/sokak dili. Fusha yok.
- Örnek: "Anlamadım" = مش فاهم (miş fâhim).
- Arayüz Türkçe. Kullanıcıya Türkçe açıkla; 2–3 dk sonra Ctrl+F5 de.
- Dal `claude/selam-pwr5q1`. Akış: commit → push → main'e PR → PR'ı birleştir. Commit/PR metnine model adı yazma.
- Site herkese açık; üyelik yalnız ek menü açar.
- Admin: baydogan.sevtap@gmail.com ve abdllhbydgn@gmail.com (doğrulanmış e-posta). Firebase projesi `baydogan-ailesi` (aile sitesiyle ortak): veriler `ar_*` koleksiyonlarında, kurallar `tools/firestore-arapca-blok.rules`. Profil fotoğrafı `ar_users.photo` (192px JPEG dataURL).
- Veri dosyalarını (`data/*.js`) elle düzenleme; `tools/src/*.json` → `python3 tools/build.py`.
- Her yayında sürüm artır:
  - `index.html` içinde `?v=N`;
  - `sw.js` içinde `?v=N` ve `CACHE_NAME arapca-ogren-vN`.

## Dosya haritası
| Dosya | İçerik |
|---|---|
| `index.html` | Kabuk: yan menü `#nav`, üst bar (`#gsInput` arama, `#acctBtn`, `#speedBtn`, `#themeBtn`), `#pnav` geri/ileri/ana sayfa, `#view` sayfa alanı, `#bnav` mobil alt menü, `#toTop` |
| `assets/app.js` (~90 KB) | Tüm uygulama (aşağıda) |
| `assets/members.js` | Firebase üyelik/admin (`MASRI_FB` boşsa pasif) |
| `assets/fb-config.js` | `window.MASRI_FB` = firebaseConfig (baydogan-ailesi) |
| `assets/app.css` | Tema; sonda pnav/totop, canlı tema, üyelik stilleri |
| `data/dict.js` (690 KB) | `window.MASRI_DICT={entries,cats}` — **okuma, grep kullan** |
| `data/content.js` (200 KB) | `window.MASRI={quotes,a1,alphabet,conv,grammar,workbook}` — **okuma, grep kullan** |
| `sw.js` | Çevrimdışı önbellek. Sayfa/veri: ağ-önce. mp3: önbellek-önce |
| `tools/build.py` | `tools/src/*.json` → `data/dict.js` + `data/content.js` |
| `tools/src/halk_overrides.json` | Kelime düzeltmeleri (id'ye göre) |
| `tools/src/out_*.json` | Kaynaklar: a1, core, conversation, alphabet, grammar, workbook, existing, factory, extra, quotes |
| `tools/src/tts_text.json` | Seslendirme için harekeli Kahire okunuşu `{audioKey: metin}` |
| `tools/tts.py` + `.github/workflows/tts.yml` | edge-tts `ar-EG-SalmaNeural` → `audio/<key>.mp3` + `audio/index.json` |
| `tools/firestore.rules` | Firestore kuralları |

### Seslendirme notları
- Ses üretimi yalnız GitHub Actions'ta çalışır (sandbox'tan Bing TTS engelli). Main'e `data/**` veya `tools/tts.py` push'u tetikler.
- `key` = FNV-1a 32 hex + '-' + uzunluk. JS'te `audioKey()` aynısını üretir.
- Yeni metin eklenirse `tts_text.json`'a harekeli okunuşunu da ekle.

## `assets/app.js` içinde fonksiyon yerleri (grep ile bul)
- **Yardımcılar:** `store`, `toast`, `ic(` (ikonlar), `entryHtml`, `search(`
- **XP/oyun:** `xpState`, `addXP`, `confetti`, `ringSvg`, `drawQuote` (günün sözü)
- **Ses:** `audioKey`, `speak(`, `playSequence`, `deviceSpeak`, `playDialog`
- **Menü:** `NAV` (yan menü listesi), `NAV_COL`, `buildNav`, `buildSideCard`
- **Yönlendirme:** `ROUTES`, `render(`, `parseHash`
- **Gezinme:** `NAVH`, `PAGE_NAMES`, `drawPnav`
- **Çeviri motoru:** `translate(`, `lookupTrToken`, `lookupArToken`, `pickForm`, `SRC_RANK`, `IX` (dizinler)
- **Sayfalar (`ROUTES.x`):**
  - `''` ana sayfa
  - `ceviri`, `fabrika`, `sozluk`, `kartlar` (`flashSession`)
  - `alfabe`, `konusma`, `gramer` (`blocksHtml`), `fiiller`
  - `alistirma` (`exerciseHtml`, `bindExercises`), `test`, `favoriler`
- **Dış API:** `window.MASRI_APP`, `MASRI_GATE`, `MASRI_AFTER_RENDER`, `MASRI_ONSET`

## `assets/members.js`
- **Sayfalar:**
  - `ROUTES.giris`, `ROUTES.hesabim`
  - `ROUTES.admin` (alt sayfalar `admin/kullanicilar`, `admin/yedek`, `admin/duyuru`)
- **Kavramlar:**
  - roller: guest/pending/member/admin/disabled;
  - üyeye özel sayfalar `MEMBER_ROUTES` (kartlar, alistirma, test, favoriler);
  - ilerleme senkronu: xp, cards, favs, wb, tests, streak.

## Test
- Yerel sunucu: `python3 -m http.server 8770` (repo kökünde).
- Tarayıcı testi: Playwright + `/opt/pw-browsers/chromium`. Mobil için 360/390 px genişlikte taşma kontrolü yap.

## ÖNCE ANLAT, SONRA YAP (kullanıcı kuralı)
- Yeni bir özellik, ayar, otomasyon, eklenti ya da kullanıcıdan bir işlem (silme, kurulum, ayar) isteyen her adımda: **önce ne yapacağını ve nedenini 2–3 kısa maddeyle anlat, kullanıcının onayını bekle, sonra yap.**
- Kullanıcıya adım adım, tek seferde tek iş ver; gerekirse ekran görüntüsü üzerinde işaretleyerek göster.
- Kısa ve net yaz; teknik terim kullanma.
