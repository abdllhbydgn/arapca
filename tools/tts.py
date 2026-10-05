#!/usr/bin/env python3
"""Mısır lehçesi seslendirme (ar-EG Salma) — GitHub Actions içinde çalışır (.github/workflows/tts.yml).

Portaldaki tüm Arapça metinleri (sözlük, örnek cümleler, konuşma rehberi, diyaloglar, gramer, fiiller, alfabe)
toplar; her biri için audio/<anahtar>.mp3 üretir. Yalnızca eksik olanlar seslendirilir. audio/index.json, mevcut
seslerin anahtar listesidir; site bu listeye bakarak kayıtlı sesi çalar, yoksa cihazın sesine düşer.

Anahtar: metnin FNV-1a 32 bit özeti (UTF-8) + "-" + karakter uzunluğu. Aynı hesap assets/app.js içinde de yapılır.
"""
import asyncio, json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
AUDIO = os.path.join(ROOT, 'audio')
VOICE = os.environ.get('TTS_VOICE', 'ar-EG-SalmaNeural')
RATE = os.environ.get('TTS_RATE', '-12%')
LIMIT = int(os.environ.get('TTS_LIMIT', '0') or 0)
CONC = int(os.environ.get('TTS_CONCURRENCY', '6'))
AR = re.compile('[؀-ۿ]')


def clean(t):
    return re.sub(r'\s+', ' ', str(t or '')).strip()


def key(t):
    t = clean(t)
    h = 0x811C9DC5
    for b in t.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, '08x') + '-' + str(len(t))


def load_js(path, var):
    s = open(path, encoding='utf-8').read()
    i = s.index('=') + 1
    return json.loads(s[i:].rstrip().rstrip(';'))


def collect():
    texts = []
    add = lambda t: texts.append(clean(t)) if t and AR.search(str(t)) else None
    d = load_js(os.path.join(ROOT, 'data', 'dict.js'), 'MASRI_DICT')
    c = load_js(os.path.join(ROOT, 'data', 'content.js'), 'MASRI')
    for e in d['entries']:
        add(e['ar'])
        if e.get('ex'):
            add(e['ex'].get('ar'))
    for q in c.get('quotes', []):
        add(q.get('ar'))
    for L in c.get('alphabet', {}).get('letters', []):
        add(L.get('letter'))
        for w in L.get('words', []):
            add(w.get('ar'))
    for t in c.get('conv', {}).get('topics', []):
        for p in t.get('phrases', []):
            add(p.get('ar'))
        for dlg in t.get('dialogs', []):
            for l in dlg.get('lines', []):
                add(l.get('ar'))
    g = c.get('grammar', {})
    for l in g.get('lessons', []):
        for b in l.get('blocks', []):
            for x in b.get('items', []) if b.get('type') == 'examples' else []:
                add(x.get('ar'))
            for r in b.get('rows', []) if b.get('type') == 'table' else []:
                for cell in r:
                    add(cell)
    for v in g.get('verbs', []):
        for f in ('past', 'pres', 'imp'):
            if v.get(f):
                add(v[f].get('ar'))
        for tense in (v.get('conj') or {}).values():
            for p in tense.values():
                if isinstance(p, dict):
                    add(p.get('ar'))
                    if p.get('neg'):
                        add(p['neg'].get('ar'))
    for u in c.get('workbook', {}).get('units', []):
        for x in u.get('exercises', []):
            add(x.get('answer') if isinstance(x.get('answer'), str) else None)
    seen, out = set(), []
    for t in texts:
        if t and t not in seen:
            seen.add(t)
            out.append(t)
    return out


# Mısır ağzına göre harekelenmiş seslendirme metinleri (anahtar → metin) / Egyptian-vocalised TTS input
try:
    TTS_TEXT = json.load(open(os.path.join(ROOT, 'tools', 'src', 'tts_text.json'), encoding='utf-8'))
except Exception:
    TTS_TEXT = {}


def speakable(t):
    v = TTS_TEXT.get(key(t))
    if v:
        t = v
    # "مشي / بمشي" gibi alternatifler kısa duraklamayla okunur / Alternatives are read with a short pause
    t = re.sub(r'\s*/\s*', '، ', t)
    # Kahire halk ağzı: ق yutulur, hemze okunur (قلم → 'alam). Yazı değişmez, yalnız ses /
    # Cairo street pronunciation: ق is a glottal stop. Only the audio input changes, not the displayed text
    t = t.replace('ق', 'أ')
    return t


def rv(t):
    # Seslendirme girdisinin özeti; kural değişince ilgili sesler yeniden üretilir / Hash of the TTS input
    return key(speakable(t) + '|' + VOICE + '|' + RATE).split('-')[0]


async def main():
    import edge_tts
    os.makedirs(AUDIO, exist_ok=True)
    texts = collect()
    keys = {}
    for t in texts:
        k = key(t)
        if k in keys and keys[k] != t:
            print('UYARI: anahtar çakışması', k, file=sys.stderr)
        keys[k] = t
    try:
        old_rv = json.load(open(os.path.join(AUDIO, 'index.json'))).get('rv', {})
    except Exception:
        old_rv = {}
    # Eski kayıtlarda rv yoksa: yalnız ق içerenler yeniden seslendirilir / Without rv: only texts with ق are redone
    stale = lambda k, t: (old_rv.get(k) != rv(t)) if old_rv else ('ق' in t)
    todo = [(k, t) for k, t in keys.items() if not os.path.exists(os.path.join(AUDIO, k + '.mp3')) or stale(k, t)]
    if LIMIT:
        todo = todo[:LIMIT]
    print(f'{len(keys)} metin, {len(todo)} yeni seslendirilecek ({VOICE})')
    sem = asyncio.Semaphore(CONC)
    done = fail = 0

    async def one(k, t):
        nonlocal done, fail
        async with sem:
            path = os.path.join(AUDIO, k + '.mp3')
            err = None
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(speakable(t), VOICE, rate=RATE).save(path + '.part')
                    if os.path.getsize(path + '.part') > 500:
                        os.replace(path + '.part', path)
                        done += 1
                        if done % 250 == 0:
                            print(done, 'tamam', flush=True)
                        return
                except Exception as e:
                    err = e
                await asyncio.sleep(2 + attempt * 3)
            fail += 1
            if os.path.exists(path + '.part'):
                os.remove(path + '.part')
            print('HATA', k, t[:40], err, file=sys.stderr)

    await asyncio.gather(*(one(k, t) for k, t in todo))
    # Artık sitede geçmeyen metinlerin sesleri silinir / Clips for texts no longer on the site are removed
    removed = 0
    for f in os.listdir(AUDIO):
        if f.endswith('.mp3') and f[:-4] not in keys:
            os.remove(os.path.join(AUDIO, f))
            removed += 1
    if removed:
        print(f'{removed} kullanılmayan ses silindi')
    have = sorted(f[:-4] for f in os.listdir(AUDIO) if f.endswith('.mp3'))
    json.dump({'voice': VOICE, 'keys': have, 'rv': {k: rv(keys[k]) for k in have if k in keys}}, open(os.path.join(AUDIO, 'index.json'), 'w'), separators=(',', ':'))
    print(f'bitti: {done} yeni, {fail} hata, toplam {len(have)} ses')


if __name__ == '__main__':
    asyncio.run(main())
