#!/usr/bin/env python3
"""tools/src/verbs.txt + nouns.txt -> data/verbs.js ("Cümle Kur" sayfası için çekimlenmiş fiil biçimleri).
Her biçim [arapça, franko]. Kişi sırası: 0 ben, 1 sen(e), 2 sen(k), 3 o(e), 4 o(k), 5 biz, 6 siz, 7 onlar."""
import json, os, re

S = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'verbs.js')


def pair(x):
    x = (x or '').strip()
    if not x:
        return None
    a, f = x.split('~')
    return [a.strip(), f.strip()]


def endc(fr):  # franco ünsüzle mi bitiyor
    return bool(fr) and fr[-1] not in 'aeiouy'


def strip_final(ar, fr):
    return re.sub('[اىي]$', '', ar), re.sub('[ay]$', '', fr)


def negf(form):
    # ما + biçim + ش (Mısır: ماكتبتش); baştaki hemze/ا düşer, sondaki ى → ا
    a = re.sub('^[أإاآ]', '', form[0]); a = re.sub('ى$', 'ا', a)
    f = re.sub('^[ae]', '', form[1])
    return ['ما' + a + 'ش', 'ma' + f + ('ish' if endc(f) else 'sh')]


def conj(line):
    f = line.split('|')
    f += [''] * (9 - len(f))
    tr, P, C, Sx, I, p3f, p3p, flags, part = f[:9]
    P, C, Sx, p3f, p3p = pair(P), pair(C), pair(Sx), pair(p3f), pair(p3p)
    flags = [x for x in flags.split(',') if x]
    d = 'd' in flags
    v = 'v' in flags
    ana = None
    neg3 = None
    for x in flags:
        if x.startswith('neg3='):
            neg3 = [pair(y) for y in x[5:].split(';')]
        if x.startswith('ana='):
            ana = pair(x[4:])
    imps = [pair(x) for x in I.split(';')] if I else []
    past, pastneg, pres, fut, subj = [], [], [], [], []
    # geçmiş
    cons = [('ت', 't'), ('ت', 't'), ('تي', 'ti'), None, None, ('نا', 'na'), ('توا', 'too'), None]
    for i in range(8):
        if i == 3:
            form = P
        elif i == 4:
            form = p3f
        elif i == 7:
            form = p3p
        else:
            form = [C[0] + cons[i][0], C[1] + cons[i][1]]
        past.append(form)
        pastneg.append(negf(form))
    if neg3:
        pastneg[3], pastneg[4], pastneg[7] = neg3[0], neg3[1], neg3[2]
    # şimdiki/gelecek kökü
    def sform(i):
        if i == 0 and ana:
            return ana
        pa, pf = ['أ', 'ت', 'ت', 'ي', 'ت', 'ن', 'ت', 'ي'][i], ['a', 'ti', 'ti', 'yi', 'ti', 'ni', 'ti', 'yi'][i]
        if v:
            pf = ['a', 't', 't', 'y', 't', 'n', 't', 'y'][i]
        ar, fr = pa + Sx[0], pf + Sx[1]
        if i == 2 or i == 6:
            base_ar, base_fr = (strip_final(ar, fr) if d else (ar, fr))
            if i == 2:
                ar, fr = base_ar + 'ي', base_fr + 'y' if d else fr + 'i'
                if not d:
                    fr = (pf + Sx[1]) + 'i'
            else:
                ar, fr = base_ar + 'وا', base_fr + 'oo' if d else (pf + Sx[1]) + 'oo'
                if not d:
                    fr = (pf + Sx[1]) + 'oo'
        elif i == 7:
            base_ar, base_fr = (strip_final(ar, fr) if d else (ar, fr))
            ar, fr = base_ar + 'وا', (base_fr + 'oo' if d else fr + 'oo')
        return [ar, fr]
    for i in range(8):
        s = sform(i)
        subj.append(s)
        a0 = s[0]
        if i == 0:
            a0 = re.sub('^[أآ]', 'ا', a0)
            fr0 = s[1][1:] if s[1].startswith('a') else s[1]
            pres.append(['ب' + a0, 'ba' + fr0])
            fut.append(['ه' + re.sub('^ا', '', a0) if not v else 'ها' + a0[1:], 'ha' + fr0])
        else:
            pres.append(['ب' + a0, 'bi' + s[1]])
            fut.append(['ه' + a0, 'ha' + s[1]])
    imp = []
    if imps:
        m = imps[0]
        if len(imps) == 3:
            imp = imps
        else:
            if d:
                b = strip_final(*m)
                imp = [m, [b[0] + 'ي', b[1] + 'y'], [b[0] + 'وا', b[1] + 'oo']]
            else:
                imp = [m, [m[0] + 'ي', m[1] + 'i'], [m[0] + 'وا', m[1] + 'oo']]
    impneg = []
    for k, i in enumerate((1, 2, 6)):
        a, fr = pres_neg = subj[i]
        impneg.append(['م' + re.sub('ى$', 'ا', a) + 'ش', 'ma' + fr + ('ish' if endc(fr) else 'sh')])
    out = {'tr': tr, 'past': past, 'pastneg': pastneg, 'pres': pres, 'fut': fut, 'subj': subj, 'imp': imp, 'impneg': impneg}
    pm = pair(part)
    if pm:
        out['part'] = [pm, [pm[0] + 'ة', pm[1] + 'a'], [pm[0] + 'ين', pm[1] + 'een']]
    return out


def main():
    verbs = []
    for ln in open(os.path.join(S, 'verbs.txt'), encoding='utf-8'):
        ln = ln.strip()
        if not ln or ln.startswith('#'):
            continue
        verbs.append(conj(ln))
    for i, v in enumerate(verbs):
        v['id'] = 'v' + str(i)
    # yardımcı kipler: istemek/gerek/yapabilmek
    nouns = []
    for ln in open(os.path.join(S, 'nouns.txt'), encoding='utf-8'):
        ln = ln.strip()
        if not ln or ln.startswith('#'):
            continue
        k, tr, ar, fr = ln.split('|')
        nouns.append({'k': k, 'tr': tr, 'ar': ar, 'fr': fr})
    js = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    open(OUT, 'w', encoding='utf-8').write('/* Cümle Kur: çekimlenmiş fiiller ve sözlük — otomatik üretilir (tools/build_verbs.py) */\nwindow.MASRI_VERBS=' + js({'verbs': verbs, 'nouns': nouns}) + ';\n')
    n = sum(len(v['past']) + len(v['pastneg']) + len(v['pres']) + len(v['fut']) + len(v['subj']) + len(v['imp']) + len(v['impneg']) + len(v.get('part', [])) for v in verbs)
    print('fiil', len(verbs), 'biçim', n, 'sözcük', len(nouns), 'bayt', os.path.getsize(OUT))


if __name__ == '__main__':
    main()
