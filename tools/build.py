#!/usr/bin/env python3
"""Merges the extracted JSON sources into /home/user/arapca/data/dict.js and data/content.js."""
import hashlib, json, os, re, unicodedata

S = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')


def load(name, default=None):
    p = os.path.join(S, name)
    return json.load(open(p)) if os.path.exists(p) else default


def nfc(s):
    s = unicodedata.normalize('NFKC', str(s or '')) if re.search('[ﭐ-﷿ﹰ-﻿]', str(s or '')) else str(s or '')
    return s.strip()


def norm_ar(s):
    s = re.sub('[ً-ٰٟـ]', '', s)
    s = re.sub('[أإآٱ]', 'ا', s).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'\s+', ' ', re.sub('[^ء-ي0-9 ]', ' ', s)).strip()


TRF = str.maketrans('çğıöşüâîûÇĞIİÖŞÜÂÎÛ', 'cgiosuaiuCGIIOSUAIU')


def norm_tr(s):
    s = str(s or '').replace('I', 'ı').replace('İ', 'i').lower().translate(TRF)
    s = re.sub(r'\([^)]*\)', ' ', s)
    return re.sub(r'\s+', ' ', re.sub('[^a-z0-9 ]', ' ', s)).strip()


# Kanonik kategoriler (sıra = menü sırası) / Canonical categories (order = menu order)
CATS = [
    ('Selamlaşma & Nezaket', '👋'), ('Günlük Konuşma', '💬'), ('Zamirler & Soru Kelimeleri', '❓'), ('Sayılar', '🔢'),
    ('Zaman & Takvim', '📅'), ('Aile & İnsanlar', '👨‍👩‍👧'), ('Meslekler', '💼'), ('Vücut & Sağlık', '🫀'),
    ('Yiyecek & İçecek', '🍽️'), ('Renkler', '🎨'), ('Ev & Eşyalar', '🏠'), ('Giyim', '👕'), ('Şehir & Ulaşım', '🚕'),
    ('Doğa & Hava', '🌤️'), ('Hayvanlar', '🐾'), ('Fiiller', '⚡'), ('Sıfatlar', '🏷️'), ('Yer & Yön', '🧭'),
    ('Alışveriş & Para', '🛍️'), ('Duygular', '😊'), ('Sosyal İlişkiler', '🤝'), ('İş & Ofis', '🗂️'),
    ('Fabrika & Tekstil', '🏭'), ('Teknik & Kalite', '🔧'), ('Okul & Eğitim', '🎓'), ('Teknoloji', '💻'),
    ('Acil Durumlar', '🚨'), ('Bağlaçlar & Edatlar', '🔗'), ("Mısır'a Özgü İfadeler", '🇪🇬'), ('Deyimler & Kalıplar', '📜'),
    ('Alfabe Kelimeleri', '🔤'),
]
CAT_NAMES = [c[0] for c in CATS]
# (anahtar kelime, kanonik ad) — ilk eşleşen kazanır / first match wins
RULES = [
    ('alfabe', 'Alfabe Kelimeleri'), ('selam', 'Selamlaşma & Nezaket'), ('nezaket', 'Selamlaşma & Nezaket'),
    ('zamir', 'Zamirler & Soru Kelimeleri'), ('soru kelime', 'Zamirler & Soru Kelimeleri'), ('sayi', 'Sayılar'),
    ('gunluk', 'Günlük Konuşma'), ('gun', 'Zaman & Takvim'), ('zaman', 'Zaman & Takvim'), ('takvim', 'Zaman & Takvim'), ('saat', 'Zaman & Takvim'),
    ('aile', 'Aile & İnsanlar'), ('insan', 'Aile & İnsanlar'), ('meslek', 'Meslekler'), ('vucut', 'Vücut & Sağlık'),
    ('saglik', 'Vücut & Sağlık'), ('hastane', 'Vücut & Sağlık'), ('yiyecek', 'Yiyecek & İçecek'), ('yemek', 'Yiyecek & İçecek'),
    ('mutfak', 'Yiyecek & İçecek'), ('restoran', 'Yiyecek & İçecek'), ('renk', 'Renkler'), ('ev ', 'Ev & Eşyalar'),
    ('ev&', 'Ev & Eşyalar'), ('esya', 'Ev & Eşyalar'), ('giyim', 'Giyim'), ('sehir', 'Şehir & Ulaşım'), ('ulasim', 'Şehir & Ulaşım'),
    ('seyahat', 'Şehir & Ulaşım'), ('doga', 'Doğa & Hava'), ('hava', 'Doğa & Hava'), ('hayvan', 'Hayvanlar'),
    ('fiil', 'Fiiller'), ('eylem', 'Fiiller'), ('sifat', 'Sıfatlar'), ('yon', 'Yer & Yön'), ('konum', 'Yer & Yön'),
    ('alisveris', 'Alışveriş & Para'), ('para', 'Alışveriş & Para'), ('ticaret', 'Alışveriş & Para'), ('duygu', 'Duygular'),
    ('sosyal', 'Sosyal İlişkiler'), ('ofis', 'İş & Ofis'), ('idari', 'İş & Ofis'), ('uretim', 'Fabrika & Tekstil'),
    ('fabrika', 'Fabrika & Tekstil'), ('tekstil', 'Fabrika & Tekstil'), ('dikim', 'Fabrika & Tekstil'), ('teknik', 'Teknik & Kalite'),
    ('kalite', 'Teknik & Kalite'), ('okul', 'Okul & Eğitim'), ('egitim', 'Okul & Eğitim'), ('teknoloji', 'Teknoloji'),
    ('acil', 'Acil Durumlar'), ('baglac', 'Bağlaçlar & Edatlar'), ('edat', 'Bağlaçlar & Edatlar'), ('zarf', 'Bağlaçlar & Edatlar'),
    ('misir', "Mısır'a Özgü İfadeler"), ('deyim', 'Deyimler & Kalıplar'), ('kalip', 'Deyimler & Kalıplar'),
    ('gunluk', 'Günlük Konuşma'), ('kendini', 'Günlük Konuşma'), ('sohbet', 'Günlük Konuşma'), ('tepki', 'Duygular'),
]


def canon(cat):
    k = norm_tr(cat).replace(' ve ', ' & ') + ' '
    raw = str(cat or '').lower().translate(TRF)
    for kw, name in RULES:
        if kw in k or kw in raw:
            return name
    return 'Günlük Konuşma'


def wc(s):
    return len(norm_tr(s).split())


entries, seen, ids = [], {}, set()


def sid(key):
    # Kelimeden türetilen sabit kimlik: veri yeniden üretilince kart ilerlemesi ve favoriler korunur /
    # Stable id derived from the word: card progress and favourites survive rebuilds
    h = int(hashlib.sha1(key.encode()).hexdigest()[:10], 16)
    i = ''
    while True:
        out = 'k' + base36(h) + i
        if out not in ids:
            ids.add(out)
            return out
        i = (i or 'a') + 'a'


def base36(n):
    d = '0123456789abcdefghijklmnopqrstuvwxyz'
    r = ''
    while n:
        n, m = divmod(n, 36)
        r = d[m] + r
    return r or '0'


def add(rec, k, src, cat, lv=None, em=None):
    ar, tr = nfc(rec.get('ar')), str(rec.get('tr') or '').strip()
    if not ar or not tr:
        return
    key = norm_ar(ar) + '|' + norm_tr(re.split(r'\s*[/;]\s*', tr)[0])
    if key in seen:
        e = seen[key]
        for f in ('ex', 'pl', 'fem', 'note'):
            if not e.get(f) and rec.get(f):
                e[f] = rec[f]
        return
    e = {'id': sid(key), 'ar': ar, 'fr': str(rec.get('fr') or '').strip(), 'ok': str(rec.get('ok') or '').strip(), 'tr': tr,
         'cat': cat, 'k': k, 'src': src}
    if lv or rec.get('level'):
        e['lv'] = lv or rec.get('level')
    if em or rec.get('emoji'):
        e['em'] = em or rec.get('emoji')
    for f in ('note', 'pl', 'fem'):
        if rec.get(f):
            e[f] = nfc(rec[f]) if f != 'note' else rec[f]
    if isinstance(rec.get('ex'), dict) and rec['ex'].get('ar'):
        e['ex'] = {x: nfc(rec['ex'].get(x, '')) if x == 'ar' else rec['ex'].get(x, '') for x in ('ar', 'fr', 'ok', 'tr')}
    entries.append(e)
    seen[key] = e


a1 = load('out_a1.json', {'cards': [], 'categories': [], 'intro': {}})
core = load('out_core.json', [])
conv = load('out_conversation.json', {'topics': []})
alpha = load('out_alphabet.json', {'letters': []})
gram = load('out_grammar.json', {'lessons': [], 'verbs': []})
wb = load('out_workbook.json', {'units': []})
exist = load('out_existing.json') or [dict(id=x['id'], ar=x['arabic'], fr='', ok=x['phonetic'], tr=x['translation'], cat=x['category']) for x in load('existing.json', [])]

for c in a1['cards']:
    add(c, 'w', 'a1', canon(c['cat']), 'A1', c.get('emoji'))
for c in core:
    add(c, 'w', 'core', canon(c.get('cat')), c.get('level'))
for t in conv['topics']:
    if t['id'] in ('konusma-testi',):
        continue
    for p in t.get('phrases', []):
        add(p, 'w' if wc(p.get('tr')) <= 2 and len(norm_ar(p.get('ar', '')).split()) <= 2 else 'p', 'conv', canon(t['title']))
for x in exist:
    if x.get('dup_of') is not None:
        continue
    add(x, 'w' if wc(x.get('tr')) <= 2 and len(norm_ar(x.get('ar', '')).split()) <= 2 else 'p', 'phr', canon(x.get('cat')))
for L in alpha['letters']:
    for w in L.get('words', []):
        add(w, 'w', 'alf', 'Alfabe Kelimeleri', 'A1', w.get('emoji'))

used = {}
for e in entries:
    used[e['cat']] = used.get(e['cat'], 0) + 1
cats = [{'name': n, 'emoji': em} for n, em in CATS if used.get(n)]

# Konuşma rehberindeki pratik sorular ve test → Çalışma Defteri / Conversation practice → workbook
units = list(wb['units'])
prac = []
for t in conv['topics']:
    items = t.get('practice') or (t.get('phrases') if t['id'] == 'konusma-testi' else None)
    if not items:
        continue
    ex = [{'type': 'translate', 'from': 'tr', 'q': p['tr'], 'answer': nfc(p['ar']), 'alts': [a for a in [p.get('fr'), p.get('ok')] if a]} for p in items if p.get('ar') and p.get('tr')]
    if ex:
        prac.append({'id': 'kp-' + t['id'], 'title': 'Konuşma pratiği: ' + t['title'] if t['id'] != 'konusma-testi' else t['title'], 'emoji': t.get('emoji') or '💬',
                     'instructions': 'Türkçe durumu Mısır Arapçasıyla söyle ve yaz (Arapça harf veya Franko). Cevabın kontrol edilir; birden fazla doğru söyleyiş olabilir, örnek cevaba bak.', 'exercises': ex})
units += prac

conv_out = {'intro': conv.get('intro', ''), 'topics': [{k: v for k, v in t.items() if k != 'practice'} for t in conv['topics']]}
content = {'a1': {'intro': a1.get('intro', {}), 'categories': a1.get('categories', [])}, 'alphabet': alpha, 'conv': conv_out,
           'grammar': gram, 'workbook': {'units': units}}

os.makedirs(OUT, exist_ok=True)
js = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
open(os.path.join(OUT, 'dict.js'), 'w').write('/* Mısır lehçesi sözlük verisi — otomatik üretilir (build.py) */\nwindow.MASRI_DICT=' + js({'entries': entries, 'cats': cats}) + ';\n')
open(os.path.join(OUT, 'content.js'), 'w').write('/* Portal içerikleri — otomatik üretilir (build.py) */\nwindow.MASRI=' + js(content) + ';\n')
by = {}
for e in entries:
    by[e['src']] = by.get(e['src'], 0) + 1
print('entries', len(entries), by, 'words', sum(e['k'] == 'w' for e in entries))
print('cats', [(c['name'], used[c['name']]) for c in cats])
print('units', len(units), 'sizes', os.path.getsize(os.path.join(OUT, 'dict.js')), os.path.getsize(os.path.join(OUT, 'content.js')))
