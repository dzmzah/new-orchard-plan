// Jedna strona online dla Ani. Zawsze ten sam adres, zawsze aktualna wersja.
// Ania pisze uwage pod postem -> leci do naszego arkusza. My odpowiadamy w arkuszu
// i przy nastepnym wgraniu jej uwaga i nasza odpowiedz sa juz na stronie, dla wszystkich.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = ROOT + '/_src';

const P = SRC + '/posty';  // zrodla trzymamy w repo (12.10: edytor online)
const PARK = P + '/_PARKING — pazdziernik, tydzien 3+';
const OUT = process.env.OUT || ROOT;

const FORMULARZ = 'https://docs.google.com/forms/d/e/1FAIpQLSfXUDJxtEYE5RAiDyHYWxn-geG9OvXuQLmq-AbZs6R5tc2i8w/formResponse';
const MOST = 'https://script.google.com/macros/s/AKfycbyLbLzV8xSBz_67Lk9igL_lnt-qzsZbGwgGUdjZ9oP-6dPc6hb93HGuG5BMnyzo54yD/exec';
const TOKEN = 'no2026';

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function blok(txt, znacznik) {
  const i = txt.indexOf(znacznik);
  if (i < 0) return '';
  const p = i + znacznik.length;
  const r = txt.slice(p);
  const m = r.match(/\n(?=---|UWAGA)/);
  return r.slice(0, m ? m.index : r.length).trim();
}

// ---------- historia uwag: wpisujemy tu to, co przyszlo od Ani, razem z nasza odpowiedzia ----------
// klucz = id posta. Przy kazdym wgraniu strony Ania widzi to pod swoim postem.
const HISTORIA = {
  'p-04': [['26.09', 'Ja bym tylko zmienila kolejnosc klatek: krotki but, sredni i wysoki.',
    'Zrobione, post otwiera krotki. Opublikowany 26.09 o 20:30.', 'zrobione'],
    ['27.09', 'Jest ok', 'Dziekujemy.', 'zrobione']],
  'p-01': [['27.09', 'Jest ok', 'Dziekujemy. Post poszedl 25.09 o 17:00.', 'zrobione']],
  'p-05': [['27.09', 'To tez mi sie podobalo, a teraz tego nie ma w planie. (ankieta Short / Mid / Long)',
    'Wypadla przy przepisywaniu planu, nasz blad. Wraca na 28.09 w Stories, razem z zaproszeniem na liste.', 'zrobione']],
  'p-12': [['27.09', 'Kurcze teraz zauwazylam, ze ta spodnica zle wyglada - nie nasza. Mozna usunac post i poprawic?',
    'Post zdjety tego samego dnia z Instagrama i z Facebooka.', 'zrobione'],
    ['27.09 20:16', 'Uzyjcie naszych zdjec z sesji, nie AI. I tutaj pierwotnie miala byc karuzela - wezcie te klatki z planu 15.10. COPY wole to co bylo we wczesniejszych propozycjach.',
    'Kadr juz jest Wasz, ze sklepu, z jesiennej sesji. Twoje copy wklejone doslownie. Karuzela z klatek z 15.10 - robimy.', 'robimy']],
  'p-13': [['24.09', 'Wkladka troche nie ten ksztalt.',
    'Kadr wymieniony na prawdziwy packshot Waszej wkladki ze sklepu.', 'zrobione'],
    ['27.09 20:16', 'Do tego juz dawalam poprawki do copy - i nie sa tu uwzglednione.',
    'Masz racje, przeoczylismy. Chodzilo o punkt 6 z Twojego maila z 22.09: sa DWIE wymienne wkladki, klasyczna z futerkiem i cienka bez futerka. Copy przepisane.', 'zrobione']],
  'p-11': [['27.09 20:16', 'Co ten text w ogole znaczy? Ten post mial byc o tym, ze jesli wahasz sie miedzy rozmiarami to pomozemy dobrac. Zrezygnowaliscie z tego? Mielismy probowac rozkrecic dyskusje pod postem w komentarzach.',
    'Nie zrezygnowalismy, zgubilismy sens przy przepisywaniu. Przepraszamy.', 'zrobione'],
    ['27.09 wieczor', 'Moja propozycja copy: 39 or 40? Between sizes? Tell us the sizes you are between. We are here to help you choose. Need a different size? Exchanges are always free.',
    'Wklejone doslownie. Ta wersja zastepuje poprzednia.', 'zrobione'],
    ['27.09 wieczor', 'W pierwotnym planie tu miala sie rozwinac dyskusja na temat rozmiarow pod tym postem, moderowana prawdopodobnie.',
    'Tak robimy. Pierwszy komentarz nasz, zeby otworzyc rozmowe, a przez pierwsze trzy godziny po publikacji odpowiadamy kazdemu w ciagu godziny i doradzamy konkretny rozmiar.', 'zrobione']],
  'p-03': [['22.09 mail', 'Italian handmade / produkcja - to obszar, ktory zdecydowanie mozemy pokazywac mocniej. Materialy z Europy, nie z Chin, tradycje przekazywane od pokolen.',
    'Copy przepisane na te fakty.', 'zrobione']],
  'p-09': [['23.09', 'Zupelnie inny but, do wymiany.',
    'Jeszcze nie zamkniete. Bierzemy Wasz packshot ze sklepu zamiast przegenerowania - tak jak przy spodnicy.', 'robimy']],
  'p-10': [['23.09', 'Przod troche za dlugi, jakby modelka miala bardzo duzy rozmiar stopy.',
    'Jeszcze nie zamkniete. Tak samo - podmieniamy na Wasz packshot.', 'robimy']],
};

// ---------- czytanie postow ----------
async function zbierz() {
  const lista = [];
  for (const [katalog, etap] of [[P, 'wrzesien i poczatek pazdziernika'], [PARK, 'pazdziernik, od trzeciego tygodnia']]) {
    for (const f of fs.readdirSync(katalog).sort()) {
      const d = katalog + '/' + f;
      if (!fs.statSync(d).isDirectory()) continue;
      const o = d + '/OPIS.txt';
      if (!fs.existsSync(o)) continue;
      const t = fs.readFileSync(o, 'utf8');
      const nr = f.slice(0, 2);
      const id = (katalog === P ? 'p-' : 'q-') + nr;
      const kadry = fs.readdirSync(d).filter((x) => /^kadr\d+\.jpg$/i.test(x)).sort();
      const pliki = [];
      // Dwa rozmiary: maly idzie na karte, duzy dopiero po kliknieciu w kadr.
      // Wczesniej karta ciagnela pliki po 200 kB, ktore i tak widac jako miniature.
      for (let i = 0; i < kadry.length; i++) {
        const nazwa = `${id}-${i + 1}.jpg`;
        const zrodlo = sharp(d + '/' + kadry[i]);
        await zrodlo.clone().resize(900, 1200, { fit: 'inside' }).jpeg({ quality: 82 })
          .toFile(OUT + '/kadry/' + nazwa);
        await zrodlo.clone().resize(420, 560, { fit: 'inside' }).jpeg({ quality: 72 })
          .toFile(OUT + '/kadry/m-' + nazwa);
        pliki.push('kadry/' + nazwa);
      }
      lista.push({
        id, etap,
        dzien: (t.match(/^DZIEN: *(.*)$/m) || [, ''])[1].trim(),
        format: (t.match(/^FORMAT: *(.*)$/m) || [, ''])[1].trim(),
        temat: (t.match(/^TEMAT: *(.*)$/m) || [, ''])[1].trim() || f.split(' — ')[1] || f,
        status: (t.match(/^STATUS: *(.*)$/m) || [, ''])[1].trim(),
        podpis: blok(t, '--- PODPIS DO WKLEJENIA ---'),
        ekran: blok(t, '--- TEKST NA EKRANIE ---'),
        produkty: blok(t, '--- PRODUKTY DO OZNACZENIA ---').split('\n')
          .map((s) => s.trim()).filter((s) => s.startsWith('http')),
        film: fs.readdirSync(d).some((x) => x.endsWith('.mp4')),
        // Zah 06.10: rolki tez maja byc na stronie do obejrzenia, nie tylko okladka.
        filmSrc: (() => {
          const mp4 = fs.readdirSync(d).filter((x) => x.endsWith('.mp4') && !/upload/i.test(x))[0];
          if (!mp4) return '';
          const cache = ROOT + '/_gen/_filmy';
          fs.mkdirSync(cache, { recursive: true });
          const c = cache + '/' + id + '.mp4';
          if (!fs.existsSync(c) || fs.statSync(c).mtimeMs < fs.statSync(d + '/' + mp4).mtimeMs)
            spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', d + '/' + mp4, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', c]);
          if (!fs.existsSync(c)) return '';
          fs.copyFileSync(c, OUT + '/kadry/' + id + '.mp4');
          return 'kadry/' + id + '.mp4';
        })(),
        kadry: pliki,
        folder: d,
      });
    }
  }
  return lista;
}

// ---------- poprzednie wersje postow ----------
// Ania wraca do tego, co bylo wczesniej, wiec stara wersja zostaje widoczna przy poscie.
const POPRZEDNIE = {
  'p-04': {
    folder: P + '/04 sob 26.09 — One boot three heights/_poprzednia wersja (lookbook z dzinsami)',
    kiedy: 'wersja opublikowana 26.09 o 20:30',
    podpis: 'One boot, three winters.\nShort for the city, mid for most days, long for the days that mean it.',
    dlaczego: 'Kadry byly z lookbooka w studio, w dzinsach. Twoja uwaga: „te spodnie jeansowe nam to zaburzyly”. Nowa wersja stoi na Waszym kadrze z przedpokoju.',
  },
  'p-12': {
    folder: P + '/12 nd 27.09 — Preorder czerwona spodnica/_poprzednia wersja (wygenerowana, odrzucona przez Anie)',
    kiedy: 'wersja opublikowana i zdjeta 27.09',
    podpis: 'Back. Five per size, then that is it.\nPre-order now, shipping after 15 October.',
    dlaczego: 'Spodnica w kadrze byla wygenerowana i nie wygladala jak Wasza. Twoje slowa: „ta spodnica zle wyglada, nie nasza”. Teraz jest Wasze zdjecie ze sklepu, a copy jest Twoje.',
  },
};

async function poprzedniaHTML(id) {
  const w = POPRZEDNIE[id];
  if (!w || !fs.existsSync(w.folder)) return '';
  const pliki = fs.readdirSync(w.folder).filter((f) => /^kadr\d+\.jpg$/i.test(f)).sort();
  const obr = [];
  for (let i = 0; i < pliki.length; i++) {
    const nazwa = `stare-${id}-${i + 1}.jpg`;
    await sharp(w.folder + '/' + pliki[i]).resize(500, 640, { fit: 'inside' }).jpeg({ quality: 76 })
      .toFile(OUT + '/kadry/' + nazwa);
    obr.push('kadry/' + nazwa);
  }
  return `<details class="stara"><summary>Jak ten post wygladal wczesniej</summary>
    <div class="staraT">${esc(w.kiedy)}</div>
    ${obr.length ? `<div class="kadry male">${obr.map((o) => `<img src="${o}" alt="" loading="lazy">`).join('')}</div>` : ''}
    ${w.podpis ? `<div class="pod">${esc(w.podpis)}</div>` : ''}
    <p class="ekr">${esc(w.dlaczego)}</p>
  </details>`;
}

// ---------- Pliki na Drive ZOVU + dokladne nazwy produktow (05.10) ----------
// Zahar: "zeby u kazdego posta byl folder z plikami w pelnej jakosci i to, co oznaczyc w IG".
const DRIVE = 'https://drive.google.com/drive/folders/';
const PLIKI = {
  'p-11': '1EJ0uWLi91FHSm7dhkB2BgrBgX7cY8YaW', 'q-01': '1jdswdoYakPuid8d-ffwueo3WQEBeZJHV',
  'q-02': '1ru7O4la-1e1vH-dTmkWT6DlUoW0qbyvp', 'q-03': '1VUwta2RuDii970YQ2vQkoItPxP2l8ArN',
  'q-04': '1uets9BsjKVyjHtDzWmEdAuAn-SvmAk5y', 'q-05': '10_mFYg58aUhgeZCeramUKJlB9VOdY5OZ',
  'q-06': '1CdkDRuwn1c3K20FFG9ZQcstiT5pgPj7y', 'q-07': '1phaTN6bnDo6fnmkJF3F1V_bZBCjkKafC',
  'q-08': '1oEoMwZzhh5UXt7ctS8L2Mew-3uOFvG1e', 'q-09': '1wyD9fnGOQTpMcnRbx5loeCdCaG80qonF',
  'p-17': '1I5iA8K8t98sHEaT2NGgU_xfxE2po6BMm', 'reklama': '1ER_u7_m9pNHpUa_5IrXR7zkl1xi7mOk1', 'reklama2': '1KqNYMDKrgC6Ul41eMzvXIsd026dptNYs', 'urodziny': '1nWGf-LAEdlQgqufpcimjBVPukwKPn149', 'p-20': '1gkmxMIf6Ugqk6thqJywS1qV5SC6gtlkT',
};
const SKLEP = fs.existsSync(ROOT + '/_gen/shop_now.json') ? JSON.parse(fs.readFileSync(ROOT + '/_gen/shop_now.json', 'utf8')).products : [];
const nazwaProduktu = (u) => {
  const h = u.split('?')[0].split('/').pop().trim().split(/\s/)[0];
  const p = SKLEP.find((x) => x.handle === h);
  return p ? p.title : h.replace(/-/g, ' ');
};
const plikiBtn = (klucz) => PLIKI[klucz]
  ? `<a class="pliki" href="${DRIVE}${PLIKI[klucz]}" target="_blank" rel="noopener">Pliki &middot; pelna jakosc + tekst</a>` : '';

// czas publikacji do automatycznego przenoszenia do Archiwum w przegladarce (06.10)
const kiedy = (d) => { const m = String(d).split('(')[0].match(/(\d{1,2})\.(\d{2})(?:[^0-9]+(\d{1,2}):(\d{2}))?/); if (!m) return ''; const p2 = (x) => String(x).padStart(2, '0'); return '2026-' + m[2] + '-' + p2(m[1]) + 'T' + (m[3] ? p2(m[3]) + ':' + m[4] : '23:59') + ':00'; };
// ---------- widok ----------
const historiaHTML = (id) => {
  const h = HISTORIA[id];
  if (!h) return '';
  return `<div class="hist"><div class="histT">Twoje wczesniejsze uwagi</div>` +
    h.map(([kiedy, jej, my, stan]) => `
      <div class="hi ${stan === 'zrobione' ? 'ok' : ''}">
        <div class="hk">${esc(kiedy)} <span class="hs">${stan === 'zrobione' ? 'zrobione' : 'jeszcze robimy'}</span></div>
        <blockquote>${esc(jej)}</blockquote>
        <p>${esc(my)}</p>
      </div>`).join('') + '</div>';
};

const kartaHTML = (p) => `
<section class="k zw" id="${p.id}" data-kiedy="${kiedy(p.dzien)}" data-typ="posty">
  <div class="gl"><span class="dat">${esc(p.dzien)}</span><h3>${esc(p.temat)}</h3>
    ${/^PRZENIESION/i.test(p.status) ? '<span class="przen">przeniesiony</span>' : ''}</div>
  <div class="met">${esc(p.format)}${p.film && !p.filmSrc ? ' &middot; jest tez gotowy film' : ''}</div>
  ${p.filmSrc ? `<div class="kadry"><video src="${p.filmSrc}" controls playsinline preload="metadata" ${p.kadry[0] ? `poster="${p.kadry[0].replace('kadry/', 'kadry/m-')}"` : ''} style="width:260px;max-width:100%;border-radius:6px;background:#000"></video></div>` : ''}
  ${p.kadry.length && !p.filmSrc ? `<div class="kadry">${p.kadry.map((k) => {
    const maly = k.replace('kadry/', 'kadry/m-');
    return `<img src="${maly}" data-duzy="${k}" alt="" loading="lazy" decoding="async">`;
  }).join('')}</div>` : ''}
  ${p.podpis ? `<div class="pod">${esc(p.podpis)}</div>` : ''}
  ${p.ekran && p.ekran !== '—' ? `<div class="ekr"><b>Na ekranie / Stories:</b><br>${esc(p.ekran).replace(/\n/g, '<br>')}</div>` : ''}
  ${p.produkty.length
    ? `<div class="prd tow"><span class="towE">W poscie oznaczamy:</span>${p.produkty.map((u) =>
        `<a href="${u.trim().split(" ")[0]}" target="_blank" rel="noopener">${esc(nazwaProduktu(u))}</a>`).join('')}</div>`
    : `<div class="prd tow brakTow"><span class="towE">W poscie oznaczamy:</span><i>nic &mdash; w tym kadrze nie pokazujemy produktu</i></div>`}
  ${plikiBtn(p.id)}
  ${p.status ? `<div class="st">${esc(p.status)}</div>` : ''}
  ${p.stara || ''}
  ${historiaHTML(p.id)}
  <div class="uw" data-id="${p.id}" data-tytul="${esc(p.dzien + ' — ' + p.temat)}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;

// ---------- budowa ----------
fs.rmSync(OUT + "/kadry", { recursive: true, force: true });  // .git zostaje
fs.mkdirSync(OUT + '/kadry', { recursive: true });
const posty = await zbierz();
for (const p of posty) p.stara = await poprzedniaHTML(p.id);

// data z pola DZIEN, np. "pt 25.09" -> liczba do sortowania
const dataLiczba = (d) => {
  const m = String(d).match(/(\d{1,2})\.(\d{2})/);
  if (!m) return -1;          // bez daty — na sam dol siatki, jeszcze nie wie kiedy wyjdzie
  return +m[2] * 100 + +m[1];
};

// miejsce na wstawke miedzy postami — Ania: "cos wskoczy nieoczekiwanie"
const wstawka = (gdzie) => `
<div class="wst" data-tytul="[wstawka] ${esc(gdzie)}">
  <button class="wstB">+ dodaj cos tutaj</button>
  <div class="wstP">
    <textarea placeholder="Co ma tu wejsc?"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz</button><span class="zap"></span></div>
  </div>
</div>`;

// ---------- archiwum ----------
// Zahar 05.10: to, co juz wyszlo, znika z planu i idzie do zakladki Archiwum.
const DZIS = (() => { const d = new Date(); return (d.getMonth() + 1) * 100 + d.getDate(); })();
const wyszlo = (p) => /^OPUBLIKOWAN/i.test(p.status) || (dataLiczba(p.dzien) > 0 && dataLiczba(p.dzien) < DZIS);
const wszystkiePosty = posty;
// ---------- 1. POSTY ----------
const tylkoStories = (fm) => /^\s*stories\b/i.test(fm);
let sekPosty = '';
let etapTeraz = '';
// Pozycje WYLACZNIE dla Stories maja swoja zakladke — tutaj robily dublet
// (ta sama rzecz dwa razy, takze w koszyku uwag).
// Kolejnosc idzie po DACIE, nie po numerze teczki. Po przenosinach numery przestaly
// sie zgadzac z kalendarzem i post z 28.09 ladowal miedzy 05.10 a 06.10.
const ETAPY = ['wrzesien i poczatek pazdziernika', 'pazdziernik, od trzeciego tygodnia'];
const klucz = (p) => {
  const e = ETAPY.indexOf(p.etap);
  const d = dataLiczba(p.dzien);
  return (e < 0 ? 9 : e) * 100000 + (d < 0 ? 9999 : d);   // bez daty — na koniec swojego etapu
};
const wgKalendarza = (a, b) => klucz(a) - klucz(b);

const doPostow = posty.filter((p) => !tylkoStories(p.format) && !wyszlo(p)).sort(wgKalendarza);
for (let i = 0; i < doPostow.length; i++) {
  const p = doPostow[i];
  if (p.etap !== etapTeraz) { etapTeraz = p.etap; sekPosty += `<h2>${esc(p.etap)}</h2>`; }
  const poprz = i > 0 ? doPostow[i - 1] : null;
  sekPosty += wstawka(poprz ? `miedzy ${poprz.dzien} a ${p.dzien}` : `przed ${p.dzien}`);
  sekPosty += kartaHTML(p);
}
if (doPostow.length) sekPosty += wstawka(`po ${doPostow[doPostow.length - 1].dzien}`);

// ---------- 2. FEED ----------
// do siatki wchodzi wszystko, co zostaje na profilu.
// odpadaja tylko te pozycje, ktore sa WYLACZNIE Stories — czyli format zaczyna sie od STORIES.
const wFeedzie = posty.filter((p) => p.kadry.length && !tylkoStories(p.format));
const wgDaty = [...wFeedzie].sort((a, b) => dataLiczba(b.dzien) - dataLiczba(a.dzien));
let sekFeed = `<div class="jak" style="margin:0 0 16px">
  <b>Tak ulozy sie Wasz profil.</b> Czytamy od gory &mdash; na Instagramie nowy post wskakuje w lewy gorny rog
  i spycha reszte w dol, wiec na dole siatki jest zawsze najstarszy. Stories w siatce nie ma, bo nie zostaja na profilu.<br><br>
  Publikujemy o dwoch porach, na zmiane: <b>14:00</b> albo <b>20:00</b>. Przejrzelismy Wasze posty z ostatnich miesiecy &mdash;
  wiekszosc tych, ktore poszly najlepiej, wychodzila wlasnie w tych godzinach.<br><br>
  Kliknij w kadr, zeby przejsc do tego postu.</div>
<div class="gora">&uarr; gora profilu &middot; najnowszy</div>
<div class="siatka">` +
  wgDaty.map((p) => `<a href="#${p.id}" class="sk" data-go="${p.id}">
    <img src="${p.kadry[0]}" alt="" loading="lazy"><span>${esc(p.dzien)}</span></a>`).join('') +
`</div><div class="gora">&darr; dol profilu &middot; najstarszy</div>
<section class="k" id="f-siatka">
  <div class="gl"><h3>Cala siatka profilu</h3></div>
  <p class="ekr">To jest pierwsza rzecz do zatwierdzenia &mdash; dopiero po niej dopracowujemy szczegoly pojedynczych postow.</p>
  <div class="uw" data-id="f-siatka" data-tytul="[feed] Cala siatka profilu">
    <textarea placeholder="Co zmienic w kolejnosci albo w kadrach?"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;

// ---------- 3. STORIES ----------
// Tylko te pozycje, ktore naprawde ida w Stories. Plansze sa realne:
// albo lezy plik story*.jpg w folderze, albo cala pozycja jest Stories i kadry nia sa.
const zeStoriesWsz = posty.filter((p) => /stories/i.test(p.format)).sort(wgKalendarza);
const zeStories = zeStoriesWsz.filter((p) => !wyszlo(p));
const zeStoriesArch = zeStoriesWsz.filter((p) => wyszlo(p));
let sekStories = `<div class="jak" style="margin:0 0 16px">Stories nie zostaja na profilu, wiec nie ma ich w siatce.
Tu sa gotowe plansze &mdash; dokladnie to, co zobacza ludzie. Kliknij w plansze, zeby otworzyc ja na caly ekran.</div>`;
async function storyHTML(p) {
  let out = '';
  const sid = 's' + p.id;
  let obr = [];
  const wlasne = fs.readdirSync(p.folder).filter((x) => /^story\d+\.jpg$/i.test(x)).sort();
  if (wlasne.length) {
    for (let i = 0; i < wlasne.length; i++) {
      const nazwa = `st-${p.id}-${i + 1}.jpg`;
      await sharp(p.folder + '/' + wlasne[i]).resize(620, 1103, { fit: 'inside' }).jpeg({ quality: 80 })
        .toFile(OUT + '/kadry/' + nazwa);
      obr.push('kadry/' + nazwa);
    }
  } else if (tylkoStories(p.format)) {
    obr = p.kadry;
  }
  out += `
<section class="k zw" id="${sid}" data-kiedy="${kiedy(p.dzien)}" data-typ="stories">
  <div class="gl"><span class="dat">${esc(p.dzien)}</span><h3>${esc(p.temat)}</h3>
    ${obr.length ? `<span class="plansz">${obr.length} plansz${obr.length === 1 ? 'a' : 'e'}</span>` : '<span class="przen">plansze do zrobienia</span>'}</div>
  <div class="met">${esc(p.format)}</div>
  ${obr.length ? `<div class="kadry pion">${obr.map((o) => `<img src="${o}" alt="" loading="lazy">`).join('')}</div>` : ''}
  ${p.ekran && p.ekran !== '—' ? `<div class="pod">${esc(p.ekran).replace(/\n/g, '<br>')}</div>` : ''}
  ${plikiBtn(p.id)}
  <div class="uw" data-id="${sid}" data-tytul="[stories] ${esc(p.dzien + ' — ' + p.temat)}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
  return out;
}
for (let si = 0; si < zeStories.length; si++) {
  const p = zeStories[si];
  const poprzS = si > 0 ? zeStories[si - 1] : null;
  sekStories += wstawka(poprzS ? `w stories miedzy ${poprzS.dzien} a ${p.dzien}` : `w stories przed ${p.dzien}`);
  sekStories += await storyHTML(p);
}
if (zeStories.length) sekStories += wstawka(`w stories po ${zeStories[zeStories.length - 1].dzien}`);

let sekArchiwum = `<div class="jak" style="margin:0 0 16px">Tu trafia wszystko, co juz wyszlo (samo, o godzinie publikacji), i to, z czego zrezygnowalas. Najnowsze na gorze.</div>`;
const archPosty = posty.filter((p) => !tylkoStories(p.format) && wyszlo(p)).sort((a, b) => wgKalendarza(b, a));
sekArchiwum += '<h2>Posty</h2><div id="archPosty">' + archPosty.map(kartaHTML).join('') + '</div>';
sekArchiwum += '<h2>Stories</h2><div id="archStories">'; for (const p of [...zeStoriesArch].reverse()) sekArchiwum += await storyHTML(p); sekArchiwum += '</div><h2>Odrzucone</h2><div id="archOdrz"><p class="ekr" id="archOdrzPusto">Na razie nic.</p></div>';


// ---------- reklama w Meta ----------
const KRE = SRC + '/kreacje/IDEA-ZERO-SHEEP';
// NAZW NIE RUSZAMY. Uwagi Ani sa przypiete do pozycji po nazwie — kazda zmiana
// odczepia jej wczesniejsze uwagi od kart. Probowalem 29.09 poprawic opisy tak,
// zeby zgadzaly sie ze zdjeciem, i odpadlo 15 jej uwag naraz.
// Zeby to zrobic porzadnie, trzeba najpierw umiec przepisac pozycje w arkuszu.
const KRE_LISTA = [
  ['G2', 'feed', 'Bezowy dlugi i zielony krotki, martwa natura'],
  ['G3', 'feed', 'Karmelowy na sniegu'],
  ['G4', 'feed', 'Dziewczyna na tle gor'],
  ['G5', 'feed', 'Czarny krotki, kostka brukowa'],
  ['G6', 'feed', 'Para w kawiarni'],
  ['G7', 'feed', 'Zielone na graffiti'],
  ['G8', 'feed', 'Bezowy dlugi, wnetrze'],
  ['G9', 'feed', 'Czarne w miescie'],
  ['F1', 'feed', 'Wkladka i but'],
  ['S1', 'stories', 'Krotki czarny, schody'],
  ['S2', 'stories', 'Dlugi bezowy, las'],
  ['S3', 'stories', 'Sredni karmelowy'],
  ['S4', 'stories', 'Pies w plaszczu'],
  ['S5', 'stories', 'Skarpety i but'],
  ['S6', 'stories', 'Czarne na deszczu'],
  ['S7', 'stories', 'Zielone na graffiti'],
  ['S8', 'stories', 'Dziewczyna w gorach z psem'],
  ['S9', 'stories', 'Dalmatynczyk lezy, jasne buty'],
];

// Ania, trzeci dzien z rzedu: "jak dajesz reklame w meta to musisz dodac pod
// reklama teksty tak jakbys dawal post oraz button cta - i tego nie mamy".
// Teksty byly gotowe od 25.09, ale lezaly w CSV u nas na dysku, czyli dla niej
// ich nie bylo. Od teraz caly copy stoi pod kazdym kadrem, tak jak to zobaczy
// czlowiek w Meta: naglowek, tekst pod obrazkiem, opis przy przycisku i CTA.
const CSV = SRC + '/kreacje/KREACJE-I-LINKI.csv';
const COPY = {};
if (fs.existsSync(CSV)) {
  const w = fs.readFileSync(CSV, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  for (const l of w.slice(1)) {
    const k = l.split(';');
    const m = /^NO_([A-Z0-9]+)_(EN|DE)_/.exec(k[0]);
    if (!m) continue;
    COPY[m[1] + '-' + m[2].toLowerCase()] =
      { naglowek: k[4], opis: k[5], tekst: k[6], cta: k[7], link: k[9] };
  }
}

function blokCopy(id) {
  const en = COPY[id + '-en'], de = COPY[id + '-de'];
  if (!en && !de) return '';
  const jeden = (c, flaga, gdzie) => !c ? '' : `
    <div class="rekCopy">
      <div class="rekJez">${flaga} ${gdzie}</div>
      <div class="rekPole"><span>tekst pod obrazkiem</span>${esc(c.tekst)}</div>
      <div class="rekPole"><span>naglowek</span>${esc(c.naglowek)}</div>
      <div class="rekPole"><span>opis przy przycisku</span>${esc(c.opis)}</div>
      <div class="rekPole"><span>przycisk</span><b>${esc(c.cta)}</b> &rarr; <a href="${c.link}" target="_blank" rel="noopener">strona z butami</a></div>
    </div>`;
  return `<div class="rekCopyGrupa">${jeden(en, '&#127468;&#127463;', 'EN &mdash; Szwajcaria')}${jeden(de, '&#127465;&#127466;', 'DE &mdash; Niemcy i Austria')}</div>`;
}

async function kadrRek(id, fm, jez) {
  const zr = fm === 'stories' ? `${KRE}/stories/${id}-${jez}-9x16.jpg` : `${KRE}/${id}-${jez}.jpg`;
  if (!fs.existsSync(zr)) return null;
  const nazwa = `r-${id}-${jez}.jpg`;
  await sharp(zr).resize(760, 1100, { fit: 'inside' }).jpeg({ quality: 78 }).toFile(OUT + '/kadry/' + nazwa);
  return 'kadry/' + nazwa;
}

let sekReklama = plikiBtn('reklama') + `
<div class="jak" style="margin:0 0 16px">Te kadry nie pojawiaja sie na profilu &mdash; widza je tylko ludzie,
do ktorych kierujemy reklame. Kazdy kadr jest po angielsku (Szwajcaria) i po niemiecku (Niemcy i Austria).
<b>Nic z tego nie zostalo jeszcze uruchomione</b> &mdash; czekamy na Twoje tak.<br><br>
Budzet: <b>500 &euro; miesiecznie</b>. Pierwsze dziesiec dni to test po 25 &euro; dziennie, potem cala druga
polowa idzie juz tylko na te kadry, ktore dowioza. Na koncie ustawiamy limit laczny, zeby nie dalo sie
wydac wiecej nawet przez pomylke. Raport co dwa dni.</div>`;

for (const [id, fm, nazwa] of KRE_LISTA) {
  const en = await kadrRek(id, fm, 'en');
  const de = await kadrRek(id, fm, 'de');
  if (!en && !de) continue;
  const rid = 'r-' + id;
  sekReklama += `
<section class="k zw" id="${rid}">
  <div class="gl"><span class="dat">${fm === 'feed' ? 'Feed 1080×1350' : 'Stories 1080×1920'}</span><h3>${esc(nazwa)}</h3></div>
  <div class="kadry">
    ${en ? `<img src="${en}" alt="" loading="lazy" title="EN — Szwajcaria">` : ''}
    ${de ? `<img src="${de}" alt="" loading="lazy" title="DE — Niemcy i Austria">` : ''}
  </div>
  <div class="ekr">Po lewej wersja angielska, po prawej niemiecka.</div>
  ${blokCopy(id)}
  <div class="uw" data-id="${rid}" data-tytul="[reklama] ${esc(nazwa)}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
}

// ---------- reklama, linia 2: styl / komfort / jakosc ----------
// 05.10: Ania chciala druga linie (nie tylko vegan). Kreacje zatwierdzili Zahar i Mat.
// Teksty pod reklama ulozone wedlug jej wlasnego copy z linii 1 (KREACJE-I-LINKI.csv).
const L2 = SRC + '/kreacje/LINIA2';
const L2_UTM = (p, id, j) => `https://theneworchard.com/products/${p}?utm_source=facebook&utm_medium=paid&utm_campaign=styl-1025&utm_content=L2-${id}-${j}`;
const L2_OPIS = { en: 'Zurich-born. European-made.', de: 'In Zürich geboren. In Europa gefertigt.' };
const L2_LISTA = [
  ['1', 'Karteczka &bdquo;Warm. Trocken. Sch&ouml;n.&ldquo;', ['1_postit'], 'classic-vegan-short-black-unisex',
    { naglowek: 'Warm. Dry. Handmade in Italy.', tekst: 'You know that feeling: warm feet all day. Fluffy faux fur inside, two insoles to swap with the weather. Goes with everything. Handmade in Italy.' },
    { naglowek: 'Warm. Trocken. Handgefertigt in Italien.', tekst: 'Du kennst das Gefühl: den ganzen Tag warme Füße. Flauschiges Kunstfell innen, zwei Einlegesohlen zum Wechseln je nach Wetter. Passt zu allem. Handgefertigt in Italien.' }],
  ['2', 'Glos klientek &bdquo;Warm und trocken&ldquo;', ['2_warm_trocken'], 'classic-vegan-long-black',
    { naglowek: 'Warm and dry. Handmade in Italy.', tekst: '"Warm and dry" is what our customers mention most. Our boots keep water out for up to 2.5 hours in snow and rain. Handmade in Italy.' },
    { naglowek: 'Warm und trocken. Handgefertigt in Italien.', tekst: '„Warm und trocken“ – das sagen unsere Kundinnen am häufigsten. Unsere Boots halten bis zu 2,5 Stunden Schnee und Regen draußen. Handgefertigt in Italien.' }],
  ['3', 'Karuzela &bdquo;1 Boot. 3 Looks.&ldquo; (3 kadry)', ['3_karuzela_1', '3_karuzela_2', '3_karuzela_3'], 'classic-vegan-long-black',
    { naglowek: 'One boot. Three looks.', tekst: 'You know these boots. Now see them in the city, on the runway and on a weekend walk. The same pair, every time. Handmade in Italy.' },
    { naglowek: 'Ein Boot. Drei Looks.', tekst: 'Du kennst diese Boots. Jetzt in der Stadt, auf dem Laufsteg und am Wochenende. Immer dasselbe Paar. Handgefertigt in Italien.' }],
  ['4', 'Z wybiegu na ulice', ['4_laufsteg_strasse'], 'classic-vegan-long-black',
    { naglowek: 'From the runway to the street.', tekst: 'Shown at Zurich Fashion Week. Made for your everyday. The same style, warm and comfortable. Handmade in Italy.' },
    { naglowek: 'Vom Laufsteg auf die Straße.', tekst: 'Gezeigt auf der Zurich Fashion Week. Gemacht für deinen Alltag. Derselbe Style, warm und bequem. Handgefertigt in Italien.' }],
];

// Ania do linii 1 dala JEDEN tekst na wszystkie kreacje (uwagi 153-170), z tym samym szkieletem:
// 'You know these boots.' / czym sa nasze / krotka fraza o stylu / 'Handmade in Italy.'. Linia 2 tak samo.
const L2_EN = { naglowek: 'Style. Comfort. Quality.', tekst: 'You know these boots. Ours keep you warm and dry, every day, from the city to the mountains. Timeless style. Handmade in Italy.' };
const L2_DE = { naglowek: 'Style. Komfort. Qualität.', tekst: 'Du kennst diese Boots. Unsere halten dich warm und trocken, Tag für Tag, von der Stadt bis in die Berge. Zeitloser Style. Handgefertigt in Italien.' };
for (const r of L2_LISTA) { r[4] = L2_EN; r[5] = L2_DE; }
async function kadrL2(plik) {
  const zr = `${L2}/${plik}.jpg`;
  if (!fs.existsSync(zr)) return null;
  const nazwa = `l2-${plik}.jpg`.toLowerCase();
  await sharp(zr).resize(760, 1100, { fit: 'inside' }).jpeg({ quality: 78 }).toFile(OUT + '/kadry/' + nazwa);
  return 'kadry/' + nazwa;
}
let sekReklama2 = plikiBtn('reklama2') + `
<div class="jak" style="margin:0 0 16px">Druga linia reklamy: <b>styl, komfort, jakosc</b>. Vegan jest tu tylko dodatkiem,
na pierwszym planie jest to, jak buty wygladaja i jak sie w nich chodzi. Cztery pomysly, kazdy po angielsku
(Szwajcaria) i po niemiecku (Niemcy i Austria), w wersji na feed i do stories.<br><br>
<b>Nic z tego nie jest jeszcze uruchomione</b> &mdash; czekamy na Twoje tak. Tekst pod reklama jest jeden dla wszystkich
czterech, zbudowany dokladnie tak jak Twoj tekst do pierwszej linii.</div>`;
for (const [id, nazwa, pliki, produkt, en, de] of L2_LISTA) {
  const rid = 'r2-' + id;
  const rzad = async (fm) => {
    const out = [];
    for (const j of ['EN', 'DE']) for (const p of pliki) {
      const k = await kadrL2(`${p}_${j}_${fm}`);
      if (k) out.push(`<img src="${k}" alt="" loading="lazy" title="${j}">`);
    }
    return out.join('');
  };
  const c = (t, j) => ({ ...t, opis: L2_OPIS[j], cta: j === 'en' ? 'Shop now' : 'Jetzt shoppen', link: L2_UTM(produkt, id, j) });
  COPY['L2' + id + '-en'] = c(en, 'en');
  COPY['L2' + id + '-de'] = c(de, 'de');
  sekReklama2 += `
<section class="k zw" id="${rid}">
  <div class="gl"><span class="dat">pokaz sr 07.10</span><h3>${nazwa}</h3></div>
  <div class="ekr">Feed 1080×1350 &mdash; najpierw angielska, potem niemiecka.</div>
  <div class="kadry">${await rzad('4x5')}</div>
  <div class="ekr">Stories 1080×1920.</div>
  <div class="kadry">${await rzad('9x16')}</div>
  ${blokCopy('L2' + id)}
  <div class="uw" data-id="${rid}" data-tytul="[reklama 2] ${nazwa.replace(/&[a-z]+;/g, '')}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
}

// ---------- promocja urodzinowa 29.10-01.11 (Zah 06.10) ----------
// 3 pomysly x 3 rozne zdjecia, kazde EN + DE. Zatwierdzili Zah i Mat 06.10, Ania widzi na statusie 09.10.
const URO = SRC + '/kreacje/URODZINY';
const URO_LINK = (j) => `https://theneworchard.com/collections/all-vegan-products?utm_source=facebook&utm_medium=paid&utm_campaign=urodziny-1025&utm_content=${j}`;
COPY['URO-en'] = { naglowek: '5 years. −40% on all boots.', tekst: 'You know these boots. Five years ago, on World Vegan Day, we made our first pair. To celebrate, all boots are 40% off until 1 November. Handmade in Italy.', opis: '29.10 – 01.11', cta: 'Shop now', link: URO_LINK('en') };
COPY['URO-de'] = { naglowek: '5 Jahre. −40 % auf alle Boots.', tekst: 'Du kennst diese Boots. Vor fünf Jahren, am Weltvegantag, haben wir unser erstes Paar gemacht. Zum Geburtstag: −40 % auf alle Boots bis 1. November. Handgefertigt in Italien.', opis: '29.10. – 01.11.', cta: 'Jetzt shoppen', link: URO_LINK('de') };
const URO_LISTA = [
  ['tort', 'Pomysl 1 &mdash; Tort ze swieczka &bdquo;5&ldquo;',
   'Wasze zdjecia z jesiennej sesji. Obok butow stoi maly tort ze swieczka &bdquo;5&ldquo; &mdash; tylko tort jest dorysowany, cala reszta to Wasze oryginalne zdjecie: twarze i buty bez zmian.',
   'EN: &bdquo;5 years. &minus;40%.&ldquo; / &bdquo;Born on World Vegan Day.&ldquo; / &bdquo;Thank you for 5 years.&ldquo;<br>DE: &bdquo;5 Jahre. &minus;40 %.&ldquo; / &bdquo;Geboren am Weltvegantag.&ldquo; / &bdquo;Danke f&uuml;r 5 Jahre.&ldquo;'],
  ['foto', 'Pomysl 2 &mdash; Zdjecie na caly kadr i jedna linijka',
   'Wasze zdjecie bez niczego na srodku, na dole logo i jedno zdanie. Wyglada jak Wasz zwykly post, rozni sie tylko linijka z promocja.',
   'EN: &bdquo;5 years &middot; Birthday sale&ldquo; / &bdquo;&minus;40% &middot; Birthday sale&ldquo; / &bdquo;5 years of warm feet&ldquo;<br>DE: &bdquo;5 Jahre &middot; Birthday sale&ldquo; / &bdquo;&minus;40 % &middot; Birthday sale&ldquo; / &bdquo;5 Jahre warme F&uuml;&szlig;e&ldquo;'],
  ['journal', 'Pomysl 3 &mdash; Jak w czasopismie modowym (wybieg Zurich Fashion Week)',
   'Zdjecia z Waszego pokazu na ZFW, cienki szeryfowy kroj jak w czasopismie modowym, po prawej stronie. Na pierwszym kadrze przekreslona cena.',
   'EN: &bdquo;The Birthday Sale &mdash; vegan boots from <s>&euro;239</s> &euro;143.40&ldquo; / &bdquo;Five years since our first step.&ldquo; / &bdquo;It&rsquo;s our birthday.&ldquo;<br>DE: &bdquo;The Birthday Sale &mdash; vegane Boots ab <s>&euro;239</s> &euro;143,40&ldquo; / &bdquo;F&uuml;nf Jahre seit unserem ersten Schritt.&ldquo; / &bdquo;Wir haben Geburtstag.&ldquo;'],
];
async function kadrUro(plik) {
  const zr = `${URO}/${plik}.jpg`;
  if (!fs.existsSync(zr)) return null;
  const nazwa = `u-${plik}.jpg`.toLowerCase();
  await sharp(zr).resize(760, 1100, { fit: 'inside' }).jpeg({ quality: 78 }).toFile(OUT + '/kadry/' + nazwa);
  return 'kadry/' + nazwa;
}
let sekUrodziny = plikiBtn('urodziny') + `
<div class="jak" style="margin:0 0 16px"><b>Promocja urodzinowa &minus;40 %, 29.10 &ndash; 01.11.</b> 1 listopada 2021, w World Vegan Day,
wystartowala marka &mdash; w tym roku 5 lat. Trzy pomysly, w kazdym trzy rozne zdjecia (zadne nie powtarza sie z innymi reklamami),
kazde po angielsku (Szwajcaria) i po niemiecku (Niemcy i Austria), na feed 1080&times;1350. Wersje do stories robimy po Twoim wyborze.<br><br>
<b>Dlaczego tak:</b> w Waszym koncie reklamowym z sezonu 2025/26 reklamy z duzym &bdquo;&minus;40%&ldquo; i duza iloscia tekstu klikaly
najslabiej (CTR 0,5&ndash;0,9 %). Najtanszy zakup w calym sezonie dala reklama z prawdziwym zdjeciem (Green Week z psem, 36 &euro; za zakup).
Dlatego tutaj zdjecie jest duze, a tekst maly.<br><br>
<b>Nic nie jest uruchomione</b> &mdash; czekamy na Twoje tak.<br><br>
<b>Pytania do Ciebie przed startem:</b><br>
1. &minus;40 % na wszystkie buty czy na caly sklep?<br>
2. Kod rabatowy czy rabat automatyczny w sklepie?<br>
3. Ceny: w reklamie jest &euro; (Short &euro;239 &rarr; &euro;143,40). Jaka cena w CHF dla Szwajcarii?<br>
4. Modele juz przecenione (np. Short Caramel, Grey) &mdash; &minus;40 % od ceny regularnej czy od obecnej?<br>
5. Link z reklamy: osobna strona promocji czy kolekcja? Na razie wpisalismy cala kolekcje.</div>`;
for (const [kl, nazwa, opis, teksty] of URO_LISTA) {
  const rid = 'u-' + kl;
  const out = [];
  for (const j of ['EN', 'DE']) for (const n of [1, 2, 3]) {
    const k = await kadrUro(`${kl}_${n}_${j}_4x5`);
    if (k) out.push(`<img src="${k}" alt="" loading="lazy" title="${j}">`);
  }
  sekUrodziny += `
<section class="k zw" id="${rid}">
  <div class="gl"><span class="dat">29.10 &ndash; 01.11</span><h3>${nazwa}</h3></div>
  <div class="ekr">${opis}</div>
  <div class="ekr">Feed 1080&times;1350 &mdash; najpierw trzy angielskie, potem trzy niemieckie.</div>
  <div class="kadry">${out.join('')}</div>
  <div class="ekr"><b>Na zdjeciach:</b><br>${teksty}</div>
  ${blokCopy('URO')}
  <div class="uw" data-id="${rid}" data-tytul="[urodziny] ${nazwa.replace(/&[a-z]+;/g, '')}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
}

// ---------- 15.10: nowe propozycje urodzin (12.10) + Green Week — Ania prosila, zeby byly tu, nie w czacie ----------
async function kadrKr(dir, plik, pref) {
  const zr = `${dir}/${plik}`;
  if (!fs.existsSync(zr)) return null;
  const nazwa = `${pref}-${plik}`.toLowerCase().replace(/[^a-z0-9._-]/g, '_');
  // wideo w _src jest juz scisniete (540p) — kopiujemy, bo automat na serwerze nie ma ffmpeg
  if (plik.endsWith('.mp4')) { fs.copyFileSync(zr, OUT + '/kadry/' + nazwa); return 'kadry/' + nazwa; }
  await sharp(zr).resize(760, 1100, { fit: 'inside' }).jpeg({ quality: 78 }).toFile(OUT + '/kadry/' + nazwa);
  return 'kadry/' + nazwa;
}
async function sekcjaKr(rid, daty, tytul, opis, dir, pliki, pref, tag) {
  const out = [];
  for (const f of pliki) { const k = await kadrKr(dir, f, pref); if (k) out.push(k.endsWith('.mp4') ? `<video src="${k}" muted loop playsinline controls preload="metadata"></video>` : `<img src="${k}" alt="" loading="lazy">`); }
  return `
<section class="k zw" id="${rid}">
  <div class="gl"><span class="dat">${daty}</span><h3>${tytul}</h3></div>
  <div class="ekr">${opis}</div>
  <div class="kadry">${out.join('')}</div>
  <div class="uw" data-id="${rid}" data-tytul="[${tag}] ${tytul.replace(/&[a-z]+;/g, '')}">
    <textarea placeholder="Napisz, co zmienic albo ktory wybierasz (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
}
const URO2 = URO + '/v2_40_i_5_lat', URO3 = URO + '/v3_nowe_3';
const URO_NOWE = [
  ['u2-1', '1 &mdash; &bdquo;5 years. 5 days. &minus;40%&ldquo;', 'Zielony pas z tekstem po lewej, Wasze zdjecie po prawej. Wersja na 5 dni: 28.10 &ndash; 01.11.', URO2, ['1_5lat_5dni_EN_4x5.jpg']],
  ['u2-2', '2 &mdash; &bdquo;8% for every year we&rsquo;ve been around&ldquo;', '5 lat &times; 8 % = &minus;40 %. Karta z wyliczeniem na Waszym zdjeciu z gor.', URO2, ['2_8proc_za_rok_EN_4x5.jpg']],
  ['u2-3', '3 &mdash; &bdquo;5 winters of warm feet.&ldquo;', 'Duze zdjecie z psem, jedna linijka na dole.', URO2, ['3_5_zim_EN_4x5.jpg']],
  ['u2-4', '4 &mdash; &bdquo;Born on World Vegan Day.&ldquo;', 'Polaroid z podpisem &bdquo;since 1.11.2021&ldquo;.', URO2, ['4_world_vegan_day_EN_4x5.jpg']],
  ['u2-5', '5 &mdash; Zaproszenie', 'Kadr-zaproszenie na urodziny.', URO2, ['5_zaproszenie_EN_4x5.jpg']],
  ['u3-a', 'A &mdash; &bdquo;5 years. &minus;40%&ldquo; &mdash; piec par', 'Piec kolorow obok siebie, kazdy &bdquo;rok&ldquo; to inna para.', URO3, ['A_5lat_5par_EN_4x5.jpg']],
  ['u3-b', 'B &mdash; &bdquo;Made to last.&ldquo; &mdash; nowa para i ta sama po 5 zimach', 'Po prawej potrzebne Wasze zdjecie tej samej pary po pieciu zimach.', URO3, ['B_5_zim_pozniej_EN_4x5.jpg']],
  ['u3-c', 'C &mdash; List od Ciebie', 'Krotki liscik podpisany &bdquo;Ania&ldquo; na Waszym zdjeciu z gor. Tekst do Twojej poprawki.', URO3, ['C_list_od_Ani_EN_4x5.jpg']],
];
let sekUroNowe = `<div class="jak" style="margin:0 0 16px"><b>Nowe propozycje (12.10) &mdash; to te, ktore wysylalismy w czacie.</b>
Wybierz jeden wariant (albo napisz pod nim, co zmienic). Z wybranego robimy komplet: post, stories 9:16, reklama EN + DE, slajd na strone i newsletter.
Na razie wersje angielskie, niemieckie dorobimy po wyborze. Nizej sa pierwsze propozycje z 06.10.</div>`;
for (const [rid, t, o, d, f] of URO_NOWE) sekUroNowe += await sekcjaKr(rid, '29.10 &ndash; 01.11', t, o, d, f, 'u2', 'urodziny');
sekUrodziny = sekUroNowe + '<h2 class="dzial" style="margin-top:28px">Pierwsze propozycje (06.10)</h2>' + sekUrodziny;
// ---------- 22.10: wersja v5 do akceptu — wszystkie poprawki Ani (16–17.10, rozmowa 19.10), tylko data konca, banery www + newsletter ----------
const URO5 = URO + '/v5_22-10';
const URO5_LISTA = [
  ['u5-a', 'A &mdash; piec nog (zeszloroczne 4 nogi + slipper)', 'Twoja poprawka: piata noga w slipperze. Post 4:5 i kwadrat 1:1.', ['A_nogi_5_par_EN_4x5.jpg', 'A_nogi_5_par_DE_4x5.jpg', 'A_nogi_5_par_EN_1x1.jpg', 'A_nogi_5_par_DE_1x1.jpg']],
  ['u5-t1', 'Tort 1 &mdash; &bdquo;Celebrate 5. Save 40%.&ldquo;', 'Twoje haslo.', ['tort_1_EN_4x5.jpg', 'tort_1_DE_4x5.jpg']],
  ['u5-t23', 'Tort 2 i 3', 'Bez slowa &bdquo;sale&ldquo;.', ['tort_2_EN_4x5.jpg', 'tort_2_DE_4x5.jpg', 'tort_3_EN_4x5.jpg', 'tort_3_DE_4x5.jpg']],
  ['u5-j', 'Journal 1&ndash;3', 'Bez &bdquo;sale&ldquo;, tylko data konca.', ['journal_1_EN_4x5.jpg', 'journal_1_DE_4x5.jpg', 'journal_2_EN_4x5.jpg', 'journal_2_DE_4x5.jpg', 'journal_3_EN_4x5.jpg', 'journal_3_DE_4x5.jpg']],
  ['u5-1', '&bdquo;5 years. 7 days. &minus;40%&ldquo;', '', ['1_5lat_7dni_EN_4x5.jpg', '1_5lat_7dni_DE_4x5.jpg']],
  ['u5-3', '&bdquo;5 winters of warm feet.&ldquo;', 'W tekscie posta dopisane &bdquo;birthday&ldquo;.', ['3_5_zim_EN_4x5.jpg', '3_5_zim_DE_4x5.jpg']],
  ['u5-4', '&bdquo;Born on World Vegan Day.&ldquo;', '', ['4_world_vegan_day_EN_4x5.jpg', '4_world_vegan_day_DE_4x5.jpg']],
  ['u5-5', 'Zaproszenie', 'Twoj tekst, wieksze napisy, inne zdjecie.', ['5_zaproszenie_EN_4x5.jpg', '5_zaproszenie_DE_4x5.jpg']],
  ['u5-b1', 'BANER www + newsletter &mdash; wariant 1: piec nog', 'Wybierz jeden z trzech wariantow banera. Na gorze strona (komputer), pod spodem naglowek newslettera. Wersje na telefon zrobimy z wybranego.', ['baner_www_nogi_EN.jpg', 'baner_newsletter_nogi_EN.jpg', 'baner_www_nogi_DE.jpg', 'baner_newsletter_nogi_DE.jpg']],
  ['u5-b2', 'BANER www + newsletter &mdash; wariant 2: zdjecie z zaproszenia', '', ['baner_www_zaproszenie_EN.jpg', 'baner_newsletter_zaproszenie_EN.jpg', 'baner_www_zaproszenie_DE.jpg', 'baner_newsletter_zaproszenie_DE.jpg']],
  ['u5-b3', 'BANER www + newsletter &mdash; wariant 3: z psem w gorach', '', ['baner_www_5zim_EN.jpg', 'baner_newsletter_5zim_EN.jpg', 'baner_www_5zim_DE.jpg', 'baner_newsletter_5zim_DE.jpg']],
];
let sekUro5 = `<div class="jak" style="margin:0 0 16px"><b>WERSJA DO AKCEPTU (22.10) &mdash; wszystkie Twoje poprawki.</b>
&minus;40 % na wszystkie buty i slippersy, do 1.11 (World Vegan Day). Early access z kodem BIRTHDAY40 25.10. Na grafikach tylko data konca, tak jak prosilas. Haslo &bdquo;Celebrate 5. Save 40%.&ldquo;, bez slowa &bdquo;sale&ldquo;.<br><br>
<b>Tekst reklamy EN:</b> Celebrate 5. Save 40%. &mdash; Five years ago, on World Vegan Day, we made our very first pair. To say thank you, all vegan shoes are 40% off until 1 November. Handmade in Italy. [Shop now]<br>
<b>Tekst reklamy DE:</b> 5 Jahre feiern. 40 % sparen. &mdash; Vor f&uuml;nf Jahren, am Weltvegantag, haben wir unser erstes Paar gemacht. Als Dankesch&ouml;n: &minus;40 % auf alle veganen Schuhe bis 1. November. Handgefertigt in Italien. [Jetzt shoppen]<br><br>
Zatwierdz albo napisz pod kreacja, co zmienic. Przy banerach napisz, ktory wariant idzie na strone i do newslettera. Nizej starsze propozycje (do wgladu).</div>`;
for (const [rid, t, o, f] of URO5_LISTA) sekUro5 += await sekcjaKr(rid, 'do 1.11', t, o, URO5, f, 'u5', 'urodziny v5');
sekUrodziny = sekUro5 + '<h2 class="dzial" style="margin-top:28px">Wczesniejsze propozycje</h2>' + sekUrodziny;
// ---------- 23.10: v6 — uwagi Ani z 22.10 wieczorem (−40% duze, tort bez tortu, jesienne zaproszenie, baner do mailingu) ----------
const URO6 = URO + '/v6_23-10';
const URO6_LISTA = [
  ['u6-t1', 'Tort 1 &mdash; &bdquo;Celebrate 5. Save 40%.&ldquo;', 'Dluzsze niebo, ostatnia linijka na niebie, wiekszym i grubszym fontem.', ['tort_1_EN_4x5.jpg', 'tort_1_DE_4x5.jpg']],
  ['u6-t2', 'Tort 2 &mdash; Born on World Vegan Day', '&bdquo;5 YEARS LATER&ldquo; wieksze i bold, &minus;40% duze, cala ostatnia linijka wieksza.', ['tort_2_EN_4x5.jpg', 'tort_2_DE_4x5.jpg']],
  ['u6-t3', 'Tort 3 &mdash; dziewczyna w gorach w dlugich bezowych', 'Bez tortu (oryginalne zdjecie z sesji), &minus;40% duze.', ['tort_3_EN_4x5.jpg', 'tort_3_DE_4x5.jpg']],
  ['u6-j', 'Journal 1&ndash;3', 'Duze &minus;40% na wszystkich, przy niebieskiej spodnicy &minus;40% obok ceny.', ['journal_1_EN_4x5.jpg', 'journal_1_DE_4x5.jpg', 'journal_2_EN_4x5.jpg', 'journal_2_DE_4x5.jpg', 'journal_3_EN_4x5.jpg', 'journal_3_DE_4x5.jpg']],
  ['u6-3', '&bdquo;5 winters of warm feet.&ldquo;', 'Duze &minus;40%.', ['3_5_zim_EN_4x5.jpg', '3_5_zim_DE_4x5.jpg']],
  ['u6-5', 'Zaproszenie', 'Jesienne zdjecie z sesji (kozuch, zielone buty), tekst bez zmian.', ['5_zaproszenie_EN_4x5.jpg', '5_zaproszenie_DE_4x5.jpg']],
  ['u6-bw', 'BANER z tortem (zielony blok) &mdash; do newslettera i reklam', 'Uklad jak wariant 3, inne zdjecie z tej sesji + tort, duze &minus;40%. Na strone glowna 25.10 o polnocy wchodzi to samo zdjecie z tortem, a napis i przycisk robi strona (EN i DE), bo obrazek w sliderze jest jeden na oba jezyki.', ['baner_www_tort_desktop_EN.jpg', 'baner_www_tort_mobile_EN.jpg', 'baner_www_tort_desktop_DE.jpg', 'baner_www_tort_mobile_DE.jpg']],
  ['u6-bn', 'BANER do newslettera &mdash; dziewczyna w gorach', 'Bez tortu, &minus;40% duze. Jesli wolisz nogi, zostaje wersja z nogami nizej (v5).', ['baner_newsletter_gory_EN.jpg', 'baner_newsletter_gory_DE.jpg']],
];
let sekUro6 = `<div class="jak" style="margin:0 0 16px"><b>POPRAWKI (23.10) &mdash; wszystkie Twoje uwagi z 22.10 wieczorem.</b> Reszta kreacji bez zmian, zostaje z wersji 22.10 nizej. Zatwierdz albo napisz pod kreacja, co jeszcze zmienic.</div>`;
for (const [rid, t, o, f] of URO6_LISTA) sekUro6 += await sekcjaKr(rid, 'do 1.11', t, o, URO6, f, 'u6', 'urodziny v6');
// 23.10 wieczór: animacje 9:16 — plan rolek IG/FB/TikTok/YouTube Shorts 24.10–1.11 (do akceptu Ani)
const ANIM = URO6 + '/ANIMACJE'; // sciśnięte kopie 540p w repo (automat na serwerze nie ma D:)
const ANIM_PLAN = [
  ['rolka-3', '24.10 wieczor', 'Zaproszenie &mdash; &bdquo;jutro startujemy&ldquo;', '3_urodziny_zaproszenie_EN_9x16.mp4'],
  ['rolka-1', '25.10', 'Piec swieczek &mdash; start &minus;40%', '1_urodziny_5_swieczek_EN_9x16.mp4'],
  ['rolka-2', '26.10', 'Piec par nog', '2_urodziny_5_par_nog_EN_9x16.mp4'],
  ['rolka-6', '27.10', 'Caramel &minus;40%', '6_caramel_40_EN_9x16.mp4'],
  ['rolka-10', '28.10', 'Cieple stopy', '10_cieple_stopy_EN_9x16.mp4'],
  ['rolka-7', '29.10', 'Ceny 4 modeli', '7_ceny_4_modele_EN_9x16.mp4'],
  ['rolka-5', '30.10', 'Halloween &mdash; dynie', '5_halloween_dynie_EN_9x16.mp4'],
  ['rolka-8', '31.10', 'Tablica &mdash; ostatnie dni', '8_tablica_7dni_5lat_EN_9x16.mp4'],
  ['rolka-9', '1.11', 'Ostatni dzien &mdash; World Vegan Day', '9_ostatni_dzien_wvd_EN_9x16.mp4'],
  ['rolka-4', 'w zapasie', 'Halloween &mdash; wieczor', '4_halloween_wieczor_EN_9x16.mp4'],
];
let sekAnim = `<div class="jak" style="margin:0 0 16px"><b>ROLKI NA URODZINY (23.10) &mdash; plan publikacji 24.10 &ndash; 1.11.</b> Jedna animacja dziennie na Instagram, Facebook, TikTok i YouTube Shorts. Kazda jest tez po niemiecku. Zatwierdz albo napisz pod rolka, co zmienic. Bez Twojego ok nic nie planujemy.</div>`;
for (const [rid, dat, t, f] of ANIM_PLAN) sekAnim += await sekcjaKr(rid, dat, t, '', ANIM, [f], 'anim', 'rolki urodziny');
sekUro6 = sekAnim + '<h2 class="dzial" style="margin-top:28px">Grafiki (23.10)</h2>' + sekUro6;
sekUrodziny = sekUro6 + '<h2 class="dzial" style="margin-top:28px">Wersja 22.10 (reszta kreacji)</h2>' + sekUrodziny;


const GW = SRC + '/kreacje/GREENWEEK', GW2 = GW + '/v2_5_idei';
const GW_LISTA = [
  ['g2-1', '1 &mdash; Cena', 'Duze &bdquo;&minus;40%&ldquo; i konkretna cena modelu (Medium &euro;259 &rarr; &euro;155).', GW2, ['1_oferta_cena_EN_4x5.jpg']],
  ['g2-2', '2 &mdash; Karteczka &bdquo;No Black Friday. Green Week.&ldquo;', 'Zolta karteczka na Waszym zdjeciu z psem.', GW2, ['2_karteczka_EN_4x5.jpg']],
  ['g2-3', '3 &mdash; Opinia klientek &bdquo;Warm and dry.&ldquo;', 'Najczestsze zdanie z opinii klientek jako naglowek.', GW2, ['3_opinia_EN_4x5.jpg']],
  ['g2-4', '4 &mdash; Prezent &bdquo;The warmest gift this winter.&ldquo;', 'Green Week jako zakup prezentow przed swietami.', GW2, ['4_prezent_EN_4x5.jpg']],
  ['g2-5', '5 &mdash; Odliczanie &bdquo;9 days. &minus;40%.&ldquo;', 'Kalendarz 22&ndash;30.11 na dole, kazdego dnia skreslamy jeden.', GW2, ['5_odliczanie_EN_4x5.jpg']],
  ['g1-1', 'Pierwsza propozycja &mdash; &bdquo;No Black Friday. Green Week.&ldquo;', 'EN i DE.', GW, ['GreenWeek_1_EN_4x5.jpg', 'GreenWeek_1_DE_4x5.jpg']],
  ['g1-2', 'Pierwsza propozycja &mdash; &bdquo;Less black. More green.&ldquo;', 'EN i DE.', GW, ['GreenWeek_2_EN_4x5.jpg', 'GreenWeek_2_DE_4x5.jpg']],
  ['g1-3', 'Pierwsza propozycja &mdash; &bdquo;Green Week. Warm feet.&ldquo;', 'EN i DE.', GW, ['GreenWeek_3_EN_4x5.jpg', 'GreenWeek_3_DE_4x5.jpg']],
];
let sekGreen = `<div class="jak" style="margin:0 0 16px"><b>Green Week &minus;40 %, 22 &ndash; 30.11 &mdash; to jest tez nasz Black Friday (27.11).</b>
Nie robimy osobnej akcji na Black Friday: Green Week ja zastepuje i daje powod (&bdquo;No Black Friday. Green Week.&ldquo;).
Wybierz kierunek albo napisz pod nim, co zmienic. Zdjecia mozemy podmienic na nowsze z sesji. Po wyborze: wersje DE, stories 9:16, newsletter, slajd.</div>`;
for (const [rid, t, o, d, f] of GW_LISTA) sekGreen += await sekcjaKr(rid, '22 &ndash; 30.11', t, o, d, f, 'gw', 'green week');

// ---------- 16.10: Caramel −20 % do akceptu ----------
const CAR = SRC + '/kreacje/CARAMEL';
const CAR_LISTA = [
  ['c-1', '1 &mdash; &bdquo;Caramel season. &minus;20%&ldquo;', 'Zdjecie z sesji (bialy plaszcz, dalmatynczyk, Medium Caramel). Link: Medium Caramel.', ['1_klasyk_EN_4x5.jpg', '1_klasyk_DE_4x5.jpg']],
  ['c-2', '2 &mdash; Cena Medium &euro;207.20 zamiast &euro;259', 'Noga na stopniu, Medium Caramel. Link: Medium Caramel.', ['2_cena_medium_EN_4x5.jpg', '2_cena_medium_DE_4x5.jpg']],
  ['c-3', '3 &mdash; &bdquo;Short or Medium?&ldquo;', 'Obie modele obok siebie z cenami. Link: strona z caramel.', ['3_short_czy_medium_EN_4x5.jpg', '3_short_czy_medium_DE_4x5.jpg']],
  ['c-4', '4 &mdash; Karteczka', 'Karteczka &bdquo;Caramel &minus;20% Short &amp; Medium&ldquo; na zdjeciu z dalmatynczykiem. Link: Medium Caramel.', ['4_karteczka_EN_4x5.jpg', '4_karteczka_DE_4x5.jpg']],
  ['c-5', '5 &mdash; Odliczanie &bdquo;10 days. &minus;20%.&ldquo;', 'Kalendarz 16&ndash;25.10, zdjecie Short Caramel. Link: Short Caramel.', ['5_odliczanie_EN_4x5.jpg', '5_odliczanie_DE_4x5.jpg']],
  ['c-post', 'Post i story na Instagram', 'Post 4:5 i story 9:16 (z przyciskiem SHOP CARAMEL) oraz reklama 1:1.', ['pro_post_4x5.jpg', 'pro_story_9x16.jpg', 'pro_ad_1x1.jpg']],
  ['c-slajd', 'Pierwszy slajd na stronie', 'Wersja A (karmelowy panel + dalmatynczyk) albo B (jasny panel + spacer), do tego wersja mobile.', ['pro_slajd_desktop.jpg', 'pro_slajd_desktop_B.jpg', 'pro_slajd_mobile.jpg']],
];
let sekCaramel = `<div class="jak" style="margin:0 0 16px"><b>Caramel &minus;20 %, Short i Medium, do 25.10.</b>
Reklama: 5 wariantow, kazdy po angielsku i po niemiecku. Wybierz te, ktore puszczamy (mozna kilka &mdash; Meta sama pokaze lepszy), albo napisz pod nim, co zmienic.
Nizej post i story na Instagram oraz slajd na strone. Nic nie jest uruchomione &mdash; czekamy na Twoje ok.</div>`;
for (const [rid, t, o, f] of CAR_LISTA) sekCaramel += await sekcjaKr(rid, '16 &ndash; 25.10', t, o, CAR, f, 'car', 'caramel');

// 16.10 popoludnie: jesienne kreacje z sesji Klementyny + copy (prosba Ani)
const CARJ = CAR + '/jesien';
const COPY_CARJ = `<div class="jak" style="margin:0 0 16px;white-space:pre-line"><b>Copy pod post i reklame</b>
<b>Post IG/FB &mdash; EN</b>
Autumn looks better in caramel.
Our Classic Vegan Boots in Caramel, Short and Medium, are now 20% off until 25 October. Handcrafted in Italy, lined with soft faux fur.
Need a different size? Exchanges are always free. 🤍

<b>Post IG/FB &mdash; DE</b>
Der Herbst steht dir in Caramel.
Unsere Classic Vegan Boots in Caramel, Short und Medium, gibt es bis zum 25. Oktober mit 20 % Rabatt. Handgefertigt in Italien, mit weichem Kunstfellfutter.
Passt die Grösse nicht? Der Umtausch ist immer kostenlos. 🤍

<b>Reklama Meta &mdash; EN</b>
Tekst: Long walks, golden leaves, warm feet. Classic Vegan Boots in Caramel, handcrafted in Italy, now 20% off until 25 October. Not the right fit? Exchanges are always free.
Naglowek: Caramel season &mdash; 20% off
Przycisk: Shop now

<b>Reklama Meta &mdash; DE</b>
Tekst: Lange Spaziergänge, goldenes Laub, warme Füsse. Classic Vegan Boots in Caramel, handgefertigt in Italien, bis zum 25. Oktober mit 20 % Rabatt. Passt die Grösse nicht? Der Umtausch ist immer kostenlos.
Naglowek: Caramel-Saison &mdash; 20 % Rabatt
Przycisk: Jetzt entdecken</div>`;
const CARJ_LISTA = [
  ['cj-6', 'Jesien 6 &mdash; Twoj kadr z logo + &bdquo;&minus;20% on caramel&ldquo;', 'Sesja Klementyny, jesien dorobiona. Link: strona z caramel.', ['6_jesien_45_EN_4x5.jpg', '6_jesien_45_DE_4x5.jpg']],
  ['cj-7', 'Jesien 7 &mdash; But w dloni, cena Medium', 'Medium Caramel &euro;207.20 zamiast &euro;259. Link: Medium Caramel.', ['7_jesien_94_EN_4x5.jpg', '7_jesien_94_DE_4x5.jpg']],
  ['cj-8', 'Jesien 8 &mdash; &bdquo;Autumn looks better in caramel.&ldquo;', 'Twoje zdanie z newslettera na niebie. Link: strona z caramel.', ['8_niebo_90_EN_4x5.jpg', '8_niebo_90_DE_4x5.jpg']],
  ['cj-9', 'Jesien 9 &mdash; Odliczanie &bdquo;10 days. &minus;20%.&ldquo;', 'Kalendarz 16&ndash;25.10 na jesiennym zdjeciu. Link: Medium Caramel.', ['9_odliczanie_91_EN_4x5.jpg', '9_odliczanie_91_DE_4x5.jpg']],
  ['cj-10', 'Jesien 10 &mdash; Karteczka na Twoim jesiennym zdjeciu', 'Twoja wersja jesienna (dziewczyna na trawie). Link: strona z caramel.', ['10_karteczka_40_EN_4x5.jpg', '10_karteczka_40_DE_4x5.jpg']],
];
sekCaramel += `<h2 class="dzial" style="margin-top:28px">Nowe jesienne (16.10) &mdash; z sesji Klementyny</h2>` + COPY_CARJ;
for (const [rid, t, o, f] of CARJ_LISTA) sekCaramel += await sekcjaKr(rid, '16 &ndash; 25.10', t, o, CARJ, f, 'car', 'caramel');

// ---------- mailing ----------
for (const [zr, cel] of [[SRC + '/maile/mail-01-en.html', 'mail-01-en.html'],
                         [SRC + '/maile/mail-01-de.html', 'mail-01-de.html']])
  if (fs.existsSync(zr)) fs.copyFileSync(zr, OUT + '/' + cel);

let sekMailing = `
<section class="k" id="m-01">
  <div class="gl"><span class="dat">gotowe, czeka na Twoja zgode</span><h3>List pierwszy &mdash; czerwona spodnica</h3></div>
  <div class="met">EN i DE &middot; jedna kampania, jezyk podstawia sie sam wedlug tego, jak ktos sie zapisal</div>
  <div class="pod">Temat A: She&rsquo;s back &mdash; five per size
Temat B (test): The red skirt goes back into production</div>
  <p class="ekr">Zbudowany na Waszych wlasnych zdjeciach z tej samej jesiennej sesji, nic nie jest generowane.
  Jedna rzecz, jeden przycisk, a cena stoi na samym przycisku. Na dole cztery pozostale kolory spodnicy.
  Idzie na <b>Locale EN &mdash; 1205 osob</b> i <b>Locale DE &mdash; 179 osob</b>.
  Przed wysylka dostajesz test na swoje Yahoo, tak jak zawsze.</p>
  <div class="prd"><b>Zobacz gotowy list:</b><br>
    <a href="mail-01-en.html" target="_blank" rel="noopener">wersja angielska</a><br>
    <a href="mail-01-de.html" target="_blank" rel="noopener">wersja niemiecka</a></div>
  <div class="st">Dlaczego tak: cztery ostatnie kampanie mialy 38&ndash;46 % otwarc, ale tylko 2 % klikniec
  i zero zamowien. Otwieraja, wiec problem nie jest w temacie ani w nadawcy &mdash; problem jest w kliknieciu.
  Dlatego jedna rzecz zamiast katalogu i prawdziwy powod, zeby kliknac dzisiaj: piec sztuk na rozmiar.</div>
  <div class="uw" data-id="m-01" data-tytul="[mailing] List pierwszy — czerwona spodnica">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;

// ---------- 6. STRATEGIA ----------
const STRATEGIA = [
  ['Po co to wszystko', 'Jeden cel na ten sezon: <b>sprzedac 600 par</b>. Wszystko, co nie pracuje na sprzedaz, odpada. Nie liczymy postow ani obserwujacych.'],
  ['Kiedy publikujemy', 'Dwie pory: <b>14:30</b> albo <b>20:30</b>. Przejrzelismy Wasze posty z ostatnich miesiecy &mdash; wiekszosc tych, ktore poszly najlepiej, wychodzila wlasnie w tych godzinach.'],
  ['Jakim jezykiem', 'Profil po angielsku, bez hashtagow, tak jak prowadzicie go od zawsze. Niemiecki idzie wylacznie jako osobna kreacja w Meta i na profil nie trafia &mdash; Niemcy to 34 % zamowien, a tylko 8,7 % obserwujacych.'],
  ['O czym mowimy', 'Piec stalych tematow zamiast dwunastu: <b>wkladka i komfort</b>, <b>Italian handmade i europejskie materialy</b>, <b>ciepło i sucho do 2,5 h</b>, <b>psy i adopcje od 2021</b>, <b>Szwajcaria i nagrody</b>. Kazdy post nalezy do jednego z nich.'],
  ['Czego nie robimy', 'Nie robimy reklamy porownawczej z UGG &mdash; w platnej reklamie w ogole, w organice tylko bez marki i bez cudzego buta w kadrze. Nie robimy wymiany starych butow na nowe. Nie oglaszamy programu przyjmowania starych butow do recyklingu &mdash; za niespelnione obietnice ekologiczne w UE i Szwajcarii sa kary.'],
  ['Produkt zawsze z Waszego zdjecia', 'Twoje slowa z 27.09: &bdquo;AI przerabia produkty tak, ze nie wygladaja jak nasze&rdquo;. Od teraz: but, spodnica czy kurtka zawsze z Waszej sesji albo z packshotu ze sklepu. Generacja moze byc najwyzej tlem.'],
  ['Kazdy post linkuje produkt', 'Katalog Shopify jest podpiety, 88 pozycji zatwierdzonych, Instagram to aktywny kanal sprzedazy. Kazdy post, na ktorym widac produkt, idzie z oznaczonym produktem. Wczesniej tego nie robilismy i to byl nasz blad.'],
  ['Reklama', 'Traffic w 90 % przypadkow, engagement tylko tam, gdzie chodzi o zasieg a nie o sprzedaz. Posty informacyjne nie sa promowane. Szwajcaria w tym sezonie bez platnej reklamy, jedyny wyjatek to Blickfang 20&ndash;22.11 &mdash; Zurych i okolice, na engagement.'],
  ['Mailing', 'Jedna kampania, jezyk podstawia sie sam wedlug tego, jak ktos sie zapisal. Przed kazda wysylka test na Twoje Yahoo. Baza idzie czesciami, zeby nie wpasc w spam. Locale EN 1205 osob, Locale DE 179.'],
  ['Listopad trzymamy osobno', 'World Vegan Day 1.11, Wasze piate urodziny, World Vegan Month, 11.11 i Black Friday planujemy oddzielnie &mdash; listopad robi 36 % sprzedazy i zasluguje na wlasny plan.'],
];
let sekStrategia = `<div class="jak" style="margin:0 0 16px">To sa ustalenia, na ktorych stoi caly plan.
Jesli cos tu sie nie zgadza, to zmiana tutaj zmienia wszystkie posty nizej &mdash; dlatego warto zaczac wlasnie stad.</div>`;
STRATEGIA.forEach(([tyt, tresc2], i) => {
  sekStrategia += `
<section class="k" id="st-${i}">
  <div class="gl"><h3>${tyt}</h3></div>
  <p class="co">${tresc2}</p>
  <div class="uw" data-id="st-${i}" data-tytul="[strategia] ${esc(tyt)}">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;
});

// ---------- 7. TWOJE UWAGI — tabela ze statusami ----------
// Zrodlo: arkusz z uwagami. Status ustawiamy my:
//   0 = nie zrobione (czerwone), 1 = w robocie (zolte), 2 = zrobione (zielone)
const STATUSY = ['nie zrobione', 'w robocie', 'zrobione'];
const KLASY = ['nie', 'robi', 'gotowe'];

const UWAGI = [
  ['27.09 20:16', 'pt 25.09 — Co jest w srodku', 'Jest ok', '', 'Dziekujemy. Post poszedl 25.09 o 17:00.', 2],
  ['27.09 20:16', 'pon 28.09 — Ankieta Short / Mid / Long', 'Jest ok', '', 'Plansze gotowe, sa w zakladce Stories.', 2],
  ['27.09 20:16', 'sob 26.09 — One boot three heights', 'Jest ok', '', 'Kadr zmieniony na Wasz z przedpokoju, bo dzinsy zaburzaly feed. Post przeniesiony na wt 29.09 o 14:30.', 1],
  ['27.09 20:16', 'nd 27.09 — Pre-order czerwona spodnica', 'Do poprawki', 'Uzyjcie naszych zdjec z sesji, nie AI.', 'Kadr jest juz Wasz, ze sklepu, z jesiennej sesji. Zero generowania.', 2],
  ['27.09 20:16', 'nd 27.09 — Pre-order czerwona spodnica', 'Do poprawki', 'Tutaj pierwotnie miala byc karuzela — wezcie te klatki z planu 15.10.', 'Jeszcze nie zrobione. Karuzela z klatek z 15.10 jest w robocie.', 0],
  ['27.09 20:16', 'nd 27.09 — Pre-order czerwona spodnica', 'Do poprawki', 'COPY wole to co bylo we wczesniejszych propozycjach: She is back. Five per size. Missed her last time? Preorder now. The next batch is already in production.', 'Wklejone doslownie, slowo w slowo.', 2],
  ['27.09 20:16', 'Tak bedzie wygladal profil', '', 'Nie podoba mi sie ten z dn 2.10 — wczesniej cos innego bylo w planie, mozemy trzymac sie ustalonego wczesniej feedu?', 'Jeszcze nie zrobione. Wracamy do wczesniejszej kolejnosci feedu i wymieniamy kadr z 02.10.', 0],
  ['27.09 20:16', 'wt 29.09 — Removable insole', 'Do poprawki', 'Do tego juz dawalam poprawki do copy i nie sa tu uwzglednione.', 'Masz racje, przeoczylismy. Chodzilo o punkt 6 z Twojego maila z 22.09: sa DWIE wymienne wkladki. Copy przepisane.', 2],
  ['27.09 20:16', 'sr 30.09 — 39 czy 40', '', 'Co ten text w ogole znaczy? Ten post mial byc o tym, ze jesli wahasz sie miedzy rozmiarami to pomozemy dobrac.', 'Zgubilismy sens przy przepisywaniu. Twoje copy wklejone doslownie.', 2],
  ['27.09 wieczor', 'sr 30.09 — 39 czy 40', '', 'Mielismy probowac rozkrecic dyskusje pod postem, moderowana prawdopodobnie.', 'Tak robimy: pierwszy komentarz nasz, a przez trzy godziny po publikacji odpowiadamy kazdemu w ciagu godziny.', 1],
  ['27.09 czat', 'Mailing', '', 'Logo jest nie nasze, sprawdzcie fonty z brandbookiem. W Klaviyo sa gotowe templatey.', 'Sprawdzone, masz racje: logo bylo zlozone z tekstu, a font nie byl ustawiony wcale. Przerabiamy na Wasz szablon z Klaviyo.', 1],
  ['27.09 czat', 'Mailing', '', 'Najpierw newsletter powitalny z prosba o review, spodnica jako drugi, za tydzien.', 'Przyjete. Czekamy na Twoj tekst do powitalnego.', 1],
  ['27.09 czat', 'Posty', '', 'Musisz linkowac produkty w postach.', 'Katalog jest podpiety, 88 pozycji zatwierdzonych, Instagram to aktywny kanal. Przy kazdym poscie sa juz konkretne produkty do oznaczenia.', 2],
  ['27.09 czat', 'Caly dokument', '', 'Musimy pracowac na JEDNYM dokumencie, nie chce kolejnych linkow.', 'Ta strona. Adres sie nie zmienia, zaden plik wiecej nie idzie.', 2],
  ['27.09 czat', 'Copy', '', 'Nie podobaja mi sie copy, nie czuje tego. Wgrajcie posty z naszych ostatnich 2 miesiecy.', 'Przeczytalismy Wasze podpisy z lipca i sierpnia i przepisalismy wszystkie teksty na Wasz jezyk.', 2],
  ['27.09 czat', 'Caly dokument', '', 'Powinna byc mozliwosc dodania czegos miedzy postami.', 'Miedzy kazdymi dwoma postami jest przycisk „dodaj cos tutaj”.', 2],
  ['23.09 rozmowa', 'sob 03.10 — Cold feet', 'Do poprawki', 'Zupelnie inny but, do wymiany.', 'Jeszcze nie zrobione. Podmieniamy na Wasz packshot ze sklepu.', 0],
  ['23.09 rozmowa', 'nd 04.10 — World Animal Day', 'Do poprawki', 'Przod troche za dlugi, jakby modelka miala bardzo duzy rozmiar stopy.', 'Jeszcze nie zrobione. Tak samo, podmiana na Wasz packshot.', 0],
  ['23.09 rozmowa', 'Caly dokument', '', 'Te uwagi co daje — znikaja. Musza byc w historii.', 'Zrobione. Ta tabela jest ta historia i zostaje na stronie.', 2],
  ['23.09 rozmowa', 'Reklama', '', 'Zeby byl zawsze podglad, ile juz wydane.', 'Zrobione, zakladka Wydatki.', 2],
  ['22.09 mail', 'pt 02.10 — Recznie szyte we Wloszech', '', 'Italian handmade mozemy pokazywac mocniej: materialy z Europy, nie z Chin, tradycje od pokolen.', 'Copy przepisane na te fakty.', 2],
];

let sekUwagiTab = `<div class="jak" style="margin:0 0 16px">
  Wszystko, co nam napisalas, w jednym miejscu i z kolorem:
  <b class="kol nie">czerwone</b> jeszcze nie zrobione,
  <b class="kol robi">zolte</b> wzielismy do pracy,
  <b class="kol gotowe">zielone</b> zrobione.
  Uwage mozesz w kazdej chwili poprawic albo wycofac &mdash; przyciski sa przy niej, przy poscie.
  Nic stad nie znika.</div>
`;


// ---------- 7b. stary rejestr (zostaje jako opis) ----------
const REJESTR = [
  ['23.09 rozmowa', 'Tam te uwagi co daje &mdash; znikaja. Jezeli mam dawac uwagi, to one musza byc w takiej historii.', 'Zrobione. Teraz wszystko jest na tej stronie i zostaje przy poscie.', 1],
  ['23.09 rozmowa', 'Mozemy zrobic zakladke Kalendarz i ten podglad feedu chcialabym miec.', 'Zrobione. Zakladka Feed pokazuje cala siatke profilu, a Posty ida po kolei po datach.', 1],
  ['23.09 rozmowa', 'Spodnice mozna juz dzisiaj wrzucac albo jutro.', 'Nasz blad &mdash; stala w planie na 27.10, miesiac za pozno. Poprawione.', 1],
  ['23.09 rozmowa', 'Po prostu usuncie ten post adoption stories, chce pokazac prawdziwych ludzi w parku, z psami.', 'Stary usuniety. Nowy zrobiony na Twoim materiale &mdash; Patricia i Oscar.', 1],
  ['23.09 rozmowa', 'Do podmiany te buty, co napisalam. (02.10 i 04.10)', 'Jeszcze nie zamkniete. Podmieniamy na Wasze packshoty ze sklepu, nie przegenerowujemy.', 0],
  ['23.09 rozmowa', 'Zeby byl zawsze podglad, ile juz wydane na reklame.', 'Zrobione, zakladka Wydatki. Aktualizujemy co dwa dni.', 1],
  ['24.09 czat', 'Wezcie nogi w butach z tego lookbooka.', 'Zrobione, kadry z Waszego lookbooka.', 1],
  ['26.09 czat', 'Zmienilabym kolejnosc klatek: krotki, sredni, wysoki.', 'Zrobione, post otwiera krotki.', 1],
  ['27.09 czat', 'Ta spodnica zle wyglada &mdash; nie nasza.', 'Post zdjety tego samego dnia. Kadr zastapiony Waszym zdjeciem ze sklepu.', 1],
  ['27.09 czat', 'AI przerabia produkty tak, ze nie wygladaja jak nasze.', 'Przyjete jako zasada, jest w zakladce Strategia.', 1],
  ['27.09 czat', 'Musisz linkowac produkty w postach.', 'Przy kazdym poscie sa juz konkretne produkty do oznaczenia.', 1],
  ['27.09 czat', 'Musimy pracowac na JEDNYM dokumencie.', 'Ta strona. Zaden plik wiecej nie idzie.', 1],
  ['27.09 czat', 'Nie podobaja mi sie copy, nie czuje tego. Wgrajcie posty z naszych ostatnich 2 miesiecy.', 'Zrobione. Przeczytalismy Wasze podpisy z lipca i sierpnia i przepisalismy wszystkie teksty na Wasz jezyk.', 1],
  ['27.09 czat', 'Ankieta Short / Mid / Long wypadla z planu.', 'Wraca na 28.09 w Stories razem z zaproszeniem na liste.', 1],
  ['27.09 czat', 'Macie w ogole gotowy email do mejlingu?', 'Tak, EN i DE. Jest w zakladce Mailing, mozna go otworzyc i przeczytac.', 1],
  ['27.09 czat', 'Logo jest nie nasze, sprawdzcie fonty z brandbookiem.', 'Masz racje &mdash; logo bylo zlozone z tekstu, a font nie byl ustawiony wcale. Przerabiamy list na Wasz szablon z Klaviyo.', 0],
  ['27.09 czat', 'Najpierw zatwierdzamy feed i plan publikacji, potem dopracowujemy szczegoly.', 'Tak robimy. Zakladka Feed jest pierwsza i to od niej zaczynamy.', 1],
  ['27.09 czat', 'Powinna byc mozliwosc dodania czegos miedzy postami.', 'Zrobione. Miedzy kazdymi dwoma postami jest przycisk &bdquo;dodaj cos tutaj&rdquo;.', 1],
  ['22.09 mail', 'Reklamy porownawczej z UGG raczej nie powinnismy robic.', 'Zgoda, nie robimy w platnej reklamie.', 1],
  ['22.09 mail', 'Sa dwie wymienne wkladki, klasyczna z futerkiem i cienka bez.', 'Przeoczylismy to wczesniej. Copy do 29.09 przepisane.', 1],
];
let sekUwagi = `<div class="jak" style="margin:0 0 16px">Wszystko, co nam powiedzialas &mdash; z rozmowy, z czatu i z maila &mdash;
i co z tym zrobilismy. Zielone to zamkniete, pomaranczowe to jeszcze u nas.</div><div class="rej">`;
REJESTR.forEach(([kiedy, jej, my, ok]) => {
  sekUwagi += `<div class="hi ${ok ? 'ok' : ''}">
    <div class="hk">${esc(kiedy)} <span class="hs">${ok ? 'zrobione' : 'jeszcze robimy'}</span></div>
    <blockquote>${jej}</blockquote><p>${my}</p></div>`;
});
sekUwagi += '</div>';

// ---------- 8. WYDATKI ----------
const sekWydatki = `
<section class="k" id="w-budzet">
  <div class="gl"><h3>Ile wydane na reklame</h3></div>
  <p class="co">Prosilas o to 23.09: &bdquo;zeby byl zawsze podglad, ile juz wydane&rdquo;. Aktualizujemy co dwa dni.</p>
  <div class="tabOtocz"><table>
    <tr><th>Miesiac</th><th>Plan</th><th>Wydane</th><th>Zostaje z sezonu</th><th>Co robimy</th></tr>
    <tr class="gotowe"><td>wrzesien</td><td>0 &euro;</td><td><b>0 &euro;</b></td><td>2 500 &euro;</td><td>nic nie uruchomione, budzet zaoszczedzony</td></tr>
    <tr class="robi"><td>pazdziernik</td><td>500 &euro;</td><td>0 &euro;</td><td>2 000 &euro;</td><td>start 28.09, dziesiec dni testu po 25 &euro;</td></tr>
    <tr><td>listopad</td><td>900 &euro;</td><td>&mdash;</td><td>1 100 &euro;</td><td>World Vegan Day, urodziny, 11.11, Black Friday</td></tr>
    <tr><td>grudzien</td><td>300 &euro;</td><td>&mdash;</td><td>800 &euro;</td><td>swieta, ostatnie wysylki</td></tr>
    <tr><td>styczen</td><td>800 &euro;</td><td>&mdash;</td><td>0 &euro;</td><td>Veganuary, drugi najmocniejszy miesiac</td></tr>
    <tr class="suma"><td><b>razem sezon</b></td><td><b>2 500 &euro;</b></td><td><b>0 &euro;</b></td><td><b>2 500 &euro;</b></td><td></td></tr>
  </table></div>
  <div class="tabOtocz"><table>
    <tr><th>Data</th><th>Kampania</th><th>Wydane</th><th>Klikniecia</th><th>Sprzedaz</th></tr>
    <tr><td colspan="5" style="color:var(--cichy)">Nic jeszcze nie uruchomione. Pierwszy wiersz pojawi sie tu we wtorek, po pierwszej dobie.</td></tr>
  </table></div>
  <p class="co">Budzet nie jest miesieczny, tylko <b>na caly sezon: 2 500 &euro;</b> &mdash; i to my decydujemy,
  w ktorym miesiacu ile z niego idzie. Wrzesien konczymy z <b>zerem wydanym</b>, wiec cale 2 500 &euro;
  jest wciaz do dyspozycji i mozemy je przesunac tam, gdzie naprawde sprzedaje.</p>
  <p class="co">Ruszamy <b>w poniedzialek 28.09</b>. Pierwsze dziesiec dni to test po 25 &euro; dziennie,
  potem reszta budzetu idzie juz tylko na te kreacje, ktore dowioza. Na koncie stoi limit laczny,
  zeby nie dalo sie wydac wiecej nawet przez pomylke.</p>
  <p class="co">Wazne z Waszych danych: <b>listopad i styczen daly 74 % zakupow</b> zeszlego sezonu,
  a cena zakupu spadala tam z 200&ndash;400 &euro; do 56 &euro;. Dlatego nie rozkladamy budzetu po rowno
  na piec miesiecy, tylko trzymamy wiekszosc na listopad i styczen.</p>
  <div class="prd" style="margin-top:16px"><b>Panele, w ktorych to wszystko zyje</b> &mdash; wchodzi sie po zalogowaniu:<br>
    <a href="https://business.facebook.com/adsmanager/manage/campaigns?business_id=1263389747480576" target="_blank" rel="noopener">Meta &mdash; Menedzer reklam</a><br>
    <a href="https://business.facebook.com/latest/posts/published_posts?asset_id=100996139119897&business_id=1263389747480576" target="_blank" rel="noopener">Meta &mdash; opublikowane posty</a><br>
    <a href="https://business.facebook.com/commerce/381850851471748/home/?business_id=1263389747480576" target="_blank" rel="noopener">Meta &mdash; Menedzer sprzedazy i katalog</a><br>
    <a href="https://ads.google.com/aw/campaigns" target="_blank" rel="noopener">Google Ads</a><br>
    <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a><br>
    <a href="https://www.klaviyo.com/campaigns" target="_blank" rel="noopener">Klaviyo &mdash; kampanie mailowe</a>
  </div>
  <div class="uw" data-id="w-budzet" data-tytul="[wydatki] Budzet reklamowy">
    <textarea placeholder="Napisz, co zmienic (nieobowiazkowo)"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz uwage</button><span class="zap"></span></div>
  </div>
</section>`;

// ---------- POMYSLY ----------
// Luzny zeszyt na pomysly, wspolny. Celowo bez stanow i bez decyzji —
// to nie jest pozycja planu, tylko miejsce, zeby mysl nie uciekla.
const sekPomysly = `
<section class="k bezFiltru" id="pomysl-zeszyt" data-osobno="1">
  <div class="gl"><h3>Zeszyt pomyslow</h3></div>
  <p class="co">Miejsce na luzne pomysly &mdash; Twoje i nasze. Temat na post, produkt ktory warto pokazac,
  akcja na swieta, cokolwiek. Nie musi byc dopracowane ani od razu w planie &mdash; zapisujemy tutaj,
  zeby nie ucieklo, i wracamy do tego przy ukladaniu kolejnych tygodni.</p>
  <p class="co">Widzimy to samo z obu stron i od razu. Pomysl mozna potem poprawic albo wycofac,
  tak samo jak uwage pod postem.</p>
  <div class="uw" data-id="pomysl-zeszyt" data-tytul="[pomysly] Zeszyt pomyslow">
    <textarea placeholder="Co przyszlo Ci do glowy?"></textarea>
    <div class="uwStopka"><button class="zapisz">Zapisz pomysl</button><span class="zap"></span></div>
  </div>
</section>`;

// Zahar 05.10: na telefonie dlugo sie przewija i nic nie wiadomo. Piec zakladek zamiast dziesieciu,
// na gorze planu to, co czeka na Anie i co wychodzi w tym tygodniu.
const wiersz = (p, pref) => `<a class="rz" href="#${pref}${p.id}" data-go="${pref}${p.id}"><span class="rzD">${esc(p.dzien.split('(')[0].trim())}</span><span class="rzT">${esc(p.temat)}</span></a>`;
const czeka = posty.filter((p) => !wyszlo(p) && /CZEKA/i.test(p.status)).sort(wgKalendarza);
const tydzien = posty.filter((p) => { const d = dataLiczba(p.dzien); return !wyszlo(p) && d >= DZIS && d <= DZIS + 7; }).sort(wgKalendarza);
const pref = (p) => (tylkoStories(p.format) ? 's' : '');
const sekGora = `<div class="skrot">
  <div class="skrB"><div class="skrT">Czeka na Twoje ok <b>${czeka.length + 1}</b></div>
    ${czeka.map((p) => wiersz(p, pref(p))).join('')}
    <a class="rz" href="#r2-1" data-go="r2-1"><span class="rzD">sr 07.10</span><span class="rzT">Reklama &mdash; linia 2 (styl)</span></a></div>
  <div class="skrB"><div class="skrT">W tym tygodniu <b>${tydzien.length}</b></div>
    ${tydzien.length ? tydzien.map((p) => wiersz(p, pref(p))).join('') : '<div class="rzP">nic zaplanowanego</div>'}</div>
</div>`;
const SEKCJE = [
  ['posty', 'Posty', sekGora + sekPosty],
  ['stories', 'Stories', sekStories],
  ['feed', 'Feed', sekFeed],
  ['reklama2', 'Reklama &mdash; linia 2 (styl)', sekReklama2],
  ['caramel', 'Caramel &minus;20 %', sekCaramel],
  ['urodziny', 'Urodziny &minus;40 %', sekUrodziny],
  ['greenweek', 'Green Week &minus;40 % / Black Friday', sekGreen],
  ['reklama', 'Reklama &mdash; linia 1 (vegan)', sekReklama],
  ['archiwum', 'Archiwum', sekArchiwum],
  ['wiecej', 'Wiecej', '<h2>Jak to dziala</h2>' + '__JAK__' + '<h2>Wasze kanaly</h2>' + '__LINKI__' + '<h2>Mailing</h2>' + sekMailing + '<h2>Strategia</h2>' + sekStrategia + '<h2>Wydatki</h2>' + sekWydatki + '<h2>Pomysly</h2>' + sekPomysly],
];
// Zahar: z zakladek dalo sie wybrac tylko jedna, a nie bylo jak zobaczyc calosci.
const NAW = '<nav class="naw"><button class="zak" data-sek="wszystko">Wszystko</button>' +
  SEKCJE.map(([id, nazwa], i) =>
  `<button class="zak${i === 0 ? ' akt' : ''}" data-sek="${id}">${nazwa}</button>`).join('') + '<a href="raporty/" class="nawRap" onclick="this.href=this.getAttribute(\'href\').split(\'?\')[0]+\'?t=\'+Date.now()">Raporty</a><span id="zywo">na zywo</span></nav>';
let tresc = SEKCJE.map(([id, nazwa, html], i) =>
  `<div class="sek" id="sek-${id}"${i === 0 ? '' : ' hidden'}><h2 class="dzial">${nazwa}</h2>${html}</div>`).join('');

// ---------- pasek z linkami: profile i sklep, jedno klikniecie ----------
const IKONA = {
  ig: '<path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.83.9 1.4.18.43.38 1.05.43 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2a3.8 3.8 0 0 1-.9 1.4c-.42.43-.83.7-1.4.9-.43.18-1.05.38-2.2.43-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.4-.9 3.8 3.8 0 0 1-.9-1.4c-.18-.43-.38-1.05-.43-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.42-.43.83-.7 1.4-.9.43-.18 1.05-.38 2.2-.43C8.4 2.2 8.8 2.2 12 2.2zm0 1.8c-3.1 0-3.5 0-4.8.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.83-.4.4-.63.8-.83 1.3-.16.4-.35 1-.4 2.1C2.5 9.5 2.5 9.9 2.5 13s0 3.5.07 4.8c.05 1.1.24 1.7.4 2.1.2.5.44.9.83 1.3.4.4.8.63 1.3.83.4.16 1 .35 2.1.4 1.3.06 1.7.07 4.8.07s3.5 0 4.8-.07c1.1-.05 1.7-.24 2.1-.4.5-.2.9-.44 1.3-.83.4-.4.63-.8.83-1.3.16-.4.35-1 .4-2.1.06-1.3.07-1.7.07-4.8V12c0-3.1 0-3.5-.07-4.8-.05-1.1-.24-1.7-.4-2.1a3.5 3.5 0 0 0-.83-1.3 3.5 3.5 0 0 0-1.3-.83c-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4z"/><path d="M12 7.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zm0 8.1a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4z"/><circle cx="17.1" cy="6.9" r="1.15"/>',
  fb: '<path d="M14 8.5V7c0-.7.5-.9.9-.9H16V3.6h-2.1c-2.4 0-2.9 1.8-2.9 2.9v2H9.5v2.9h1.5V21H14v-9.6h2.2l.3-2.9H14z"/>',
  sklep: '<path d="M6 2.5h12l1.6 4.3a1 1 0 0 1-.94 1.35H5.34a1 1 0 0 1-.94-1.35L6 2.5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 9.5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 13.5h5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  tag: '<path d="M3.5 11.2V4.2a.7.7 0 0 1 .7-.7h7l9.3 9.3a1.4 1.4 0 0 1 0 2l-6.3 6.3a1.4 1.4 0 0 1-2 0L3.5 11.2z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7.6" cy="7.6" r="1.3"/>',
  pin: '<path d="M12 2.2a9.8 9.8 0 0 0-3.6 18.9c-.08-.76-.15-1.94.03-2.78.17-.76 1.1-4.84 1.1-4.84s-.28-.56-.28-1.4c0-1.3.76-2.28 1.7-2.28.8 0 1.19.6 1.19 1.33 0 .8-.51 2.01-.78 3.13-.22.94.47 1.7 1.4 1.7 1.68 0 2.97-1.77 2.97-4.33 0-2.26-1.63-3.85-3.95-3.85-2.69 0-4.27 2.02-4.27 4.1 0 .81.31 1.68.7 2.16a.28.28 0 0 1 .07.27c-.07.3-.23.94-.26 1.07-.04.17-.14.21-.32.13-1.2-.56-1.95-2.31-1.95-3.72 0-3.03 2.2-5.81 6.34-5.81 3.33 0 5.92 2.37 5.92 5.54 0 3.31-2.09 5.97-4.98 5.97-.97 0-1.89-.5-2.2-1.1l-.6 2.29c-.22.84-.8 1.9-1.2 2.54A9.8 9.8 0 1 0 12 2.2z"/>',
  tt: '<path d="M16.6 2.2h-2.9v12.1a2.2 2.2 0 1 1-2.2-2.2c.2 0 .4 0 .6.07V9.2a5.2 5.2 0 1 0 4.5 5.15V8.2a6 6 0 0 0 3.5 1.12V6.4a3.4 3.4 0 0 1-3.5-3.36V2.2z"/>',
  li: '<path d="M5 3.5a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8zM3.4 8.8h3.3V21H3.4V8.8zm5.6 0h3.15v1.67h.05c.44-.8 1.5-1.66 3.1-1.66 3.3 0 3.9 2.1 3.9 4.9V21h-3.3v-5.6c0-1.34-.03-3.06-1.9-3.06-1.9 0-2.2 1.46-2.2 2.96V21H9V8.8z"/>',
};
const link = (ikona, tekst, url, glowny) =>
  `<a class="lnk${glowny ? ' gl' : ''}" href="${url}" target="_blank" rel="noopener">
     <svg viewBox="0 0 24 24" aria-hidden="true">${IKONA[ikona]}</svg><span>${tekst}</span></a>`;

const LINKI = `<section class="kanaly">
  <div class="kanalyGl"><span class="kanalyE">Wasze kanaly</span><span class="kanalyP">klikasz i jestes na miejscu</span></div>
  <div class="linki">
  ${link('sklep', 'Sklep', 'https://theneworchard.com/', true)}
  ${link('ig', 'Instagram', 'https://www.instagram.com/neworchard_/', true)}
  ${link('fb', 'Facebook', 'https://www.facebook.com/NewOrchardVeganShoes', true)}
  ${link('tt', 'TikTok', 'https://www.tiktok.com/@neworchard_vegan', true)}
  ${link('pin', 'Pinterest', 'https://www.pinterest.com/theneworchardveganshoes/', true)}
  ${link('li', 'LinkedIn', 'https://www.linkedin.com/company/neworchard', true)}
  <span class="lnkPrzerwa"></span>
  ${link('tag', 'Short', 'https://theneworchard.com/collections/short-vegan-shoes')}
  ${link('tag', 'Mid', 'https://theneworchard.com/collections/mid-calf-vegan-shoes')}
  ${link('tag', 'Long', 'https://theneworchard.com/collections/long-winter-vegan-shoes')}
  ${link('tag', 'Spodnice', 'https://theneworchard.com/collections/vegan-skirts')}
  ${link('tag', 'Dla psow', 'https://theneworchard.com/collections/dog-vegan-hoodies')}
  ${link('tag', 'Wkladki', 'https://theneworchard.com/collections/extra-insoles')}
  ${link('tag', 'Akcesoria', 'https://theneworchard.com/collections/accessories')}
  ${link('tag', 'Bestsellery', 'https://theneworchard.com/collections/bestsellers')}
  </div>
</section>`;

tresc = tresc.replace('__LINKI__', LINKI).replace('__JAK__', fs.readFileSync(ROOT + '/_gen/_jak_dziala.html.txt','utf8'));
const STYL = fs.readFileSync(ROOT + '/_gen/styl_strony.css', 'utf8');
const WERSJA = String(Date.now());
const JS_BAZA = fs.readFileSync(ROOT + '/_gen/skrypt_strony.js', 'utf8')
  .replace('__WERSJA__', WERSJA)
  .replace('__MOST__', MOST)
  .replace('__TOKEN__', TOKEN);
const JS = JS_BAZA.replace('__ZESPOL__', 'false');   // strona glowna to widok Ani

// Kopia z zywej strony (Mat, 11.10): strzalki przewijania menu + styl przycisku Raporty.
// Folder raporty/ generator nie rusza.
const STRZALKI = fs.readFileSync(ROOT + '/_gen/_strzalki_menu.html', 'utf8');
const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>New Orchard — plan i uwagi</title>
<link rel="icon" type="image/svg+xml" href="favicon.svg?w=${WERSJA}">
<link rel="icon" type="image/png" sizes="96x96" href="favicon.png?w=${WERSJA}">
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png?w=${WERSJA}">
<meta name="theme-color" content="#2c4d23">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Figtree:wght@400;500;600&display=swap">
<style>${STYL}</style></head><body>
<header class="belka">
  <div class="belkaW">
    <img class="znak" src="logo-bialy.png?w=${WERSJA}" alt="New Orchard" width="34" height="30">
    <div class="belkaT"><span class="marka">NEW ORCHARD</span><span class="belkaPod">plan i uwagi</span></div>
    <span class="belkaZovu">powered by <b>ZOVU</b></span>
  </div>
</header>
<div class="oklada"><img src="oklada.jpg?w=${WERSJA}" alt=""><div class="okladaT"><div class="okladaIn"><span class="okladaE">wrzesien &mdash; pazdziernik 2026</span><strong>Plan tresci</strong><span class="okladaI">${posty.length} pozycji &middot; ${wFeedzie.length} w siatce profilu</span></div></div></div>
<div class="w">

  <section id="pulpit" class="pulpit" hidden></section>
  ${NAW}
  <div id="stanyPasek" class="stanyPasek" hidden></div>
  ${tresc}
</div>

<button id="koszyk" aria-label="Twoje uwagi">
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4l4 4 4-4h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 7h10M7 11h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
  <span>Twoje uwagi</span><b id="koszykLicz">0</b>
</button>
<button id="naGore" aria-label="Na gore" hidden>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>
<div id="zaslona"></div>
<aside id="szuflada" aria-hidden="true">
  <header>
    <div class="szNag"><h4>Twoje uwagi</h4><div class="szPod" id="szPodpis"></div></div>
    <button id="zamknijSz" aria-label="Zamknij">&times;</button>
  </header>
  <div class="szTresc" id="tabUwag"><div class="ekr">Wczytuje...</div></div>
</aside>
<div id="lupa"><button id="zamknijLupe" aria-label="Zamknij">&times;</button><img src="" alt=""></div>
<script>${JS}</script>${STRZALKI}</body></html>`;

// Nazwy kadrow sie nie zmieniaja, wiec przegladarka pokazywala stare zdjecia
// mimo swiezej strony. Numer wersji przy kazdym kadrze to konczy.
const zeStemplem = (t, przedrostek) =>
  t.split('src="' + przedrostek + 'kadry/').join('src="' + przedrostek + 'kadry/')
   .replace(new RegExp('src="(' + przedrostek.replace('.', '\\.') + 'kadry/[^"]+)"', 'g'),
            (m, p) => 'src="' + p + '?w=' + WERSJA + '"');
fs.writeFileSync(OUT + '/index.html', zeStemplem(html, ''), 'utf8');

// Dwie prawdziwe strony, a nie przekierowanie. Adres sam decyduje o trybie
// i zostaje w pasku, wiec zawsze wiadomo, ktory widok sie oglada.
//   neworchard.zovu.pl         — widok Ani
//   neworchard.zovu.pl/zovu    — widok nasz (i /zespol, stary adres)
const htmlZespolu = html
  .replace('<script>' + JS + '</script>', '<script>' + JS_BAZA.replace('__ZESPOL__', 'true') + '</script>')
  .split('src="kadry/').join('src="../kadry/')      // obrazki i maile leza pietro wyzej
  .split('data-duzy="kadry/').join('data-duzy="../kadry/')
  .split('href="mail-').join('href="../mail-')
  .split("fetch('wersja.txt").join("fetch('../wersja.txt")
  .split('src="logo').join('src="../logo')
  .split('src="oklada').join('src="../oklada')
  .split('href="favicon').join('href="../favicon')
  .split('href="apple-touch').join('href="../apple-touch')
  // Panel ma byc widocznie inny niz widok Ani, nie tylko innym adresem:
  // inna ikona w karcie, inny tytul i znak w belce.
  .split('../favicon.svg').join('../favicon-zovu.svg')
  .split('../favicon.png').join('../favicon-zovu.png')
  .replace('<title>New Orchard — plan i uwagi</title>', '<title>PANEL ZOVU — New Orchard</title>')
  .replace('<span class="belkaPod">plan i uwagi</span>',
    '<span class="belkaPod">panel zespolu</span><span class="belkaPanel">ZOVU &middot; ADMIN</span>')
  .replace('<span class="belkaZovu">powered by <b>ZOVU</b></span>',
    '<span class="belkaZovu">widok wewnetrzny &mdash; <b>nie pokazujemy klientce</b></span>')
  .replace('<body>', '<body class="panel">')
  .replace('<a href="raporty/" class="nawRap"', '<button class="zak" data-sek="zespol">Dla nas</button><a href="../raporty/" class="nawRap"')
  .replace('\n</div>\n\n<button id="koszyk"', fs.readFileSync(ROOT + '/_gen/_zespol_sekcja.html', 'utf8') + '\n</div>\n\n<button id="koszyk"');
for (const folder of ['zovu', 'zespol']) {
  fs.mkdirSync(OUT + '/' + folder, { recursive: true });
  fs.writeFileSync(OUT + '/' + folder + '/index.html', zeStemplem(htmlZespolu, '../'), 'utf8');
}
fs.rmSync(OUT + '/klient', { recursive: true, force: true });   // niepotrzebne: / to juz widok Ani

fs.writeFileSync(OUT + '/wersja.txt', WERSJA, 'utf8');
console.log('postow:', posty.length);
console.log('kadrow:', fs.readdirSync(OUT + '/kadry').length);
console.log('index.html:', (fs.statSync(OUT + '/index.html').size / 1024).toFixed(0), 'kB');
