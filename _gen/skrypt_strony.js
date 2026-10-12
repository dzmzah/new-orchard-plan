(function () {
  var MOST = '__MOST__';          // Apps Script: czyta i zapisuje do arkusza
  var TOKEN = '__TOKEN__';
  var KLUCZ = 'no-strona';

  var STATUSY = [
    { id: 'nowa', nazwa: 'nie zrobione', klasa: 'nie' },
    { id: 'poprawka', nazwa: 'do poprawki', klasa: 'popr' },
    { id: 'w robocie', nazwa: 'w robocie', klasa: 'robi' },
    { id: 'czeka', nazwa: 'czeka na Twoja zgode', klasa: 'czeka' },
    { id: 'zrobione', nazwa: 'zatwierdzone', klasa: 'gotowe' },
    { id: 'odrzucone', nazwa: 'odrzucone', klasa: 'odrz' },
  ];
  // ---- filtr po stanie: chowa pozycje, ktore juz sa zamkniete ----
  // Dziala tak samo na glownym ekranie i w koszyku, po obu stronach.
  // Nic nie kasuje — odznaczony stan po prostu znika z widoku i wraca
  // jednym klikiem. Wybor siedzi w przegladarce, u kazdego swoj.
  var WSZYSTKIE_STANY = ['nowa', 'poprawka', 'w robocie', 'czeka', 'zrobione', 'odrzucone'];
  var STANY = (function () {
    try {
      var z = JSON.parse(localStorage.getItem('no-stany') || 'null');
      if (z && z.length) {
        z = z.filter(function (s) { return WSZYSTKIE_STANY.indexOf(s) >= 0; });
        if (z.length) return z;
      }
    } catch (e) {}
    return WSZYSTKIE_STANY.slice();
  })();
  function zapiszStany() { try { localStorage.setItem('no-stany', JSON.stringify(STANY)); } catch (e) {} }
  // czy pigulki filtrow sa rozwiniete — domyslnie nie, zeby koszyk zaczynal sie od uwag
  var FILTRY_OTW = (function () {
    try { return localStorage.getItem('no-filtry') === '1'; } catch (e) { return false; }
  })();
  function zapiszFiltry() { try { localStorage.setItem('no-filtry', FILTRY_OTW ? '1' : '0'); } catch (e) {} }
  function ilePozycji(n) {
    var d = n % 10, s = n % 100;
    if (n === 1) return '1 pozycja';
    if (d >= 2 && d <= 4 && (s < 12 || s > 14)) return n + ' pozycje';
    return n + ' pozycji';
  }
  // "bez zatwierdzone" brzmialo jak blad — kazdy stan ma swoja forme po "bez"
  var STAN_BEZ = {
    'nowa': 'nie zrobionych', 'poprawka': 'tych do poprawki', 'w robocie': 'tych w robocie',
    'czeka': 'czekajacych na zgode', 'zrobione': 'zatwierdzonych', 'odrzucone': 'odrzuconych',
  };
  // jednym zdaniem: co jest wlaczone, zeby nie trzeba bylo rozwijac dla sprawdzenia
  function opisFiltrow(grupy) {
    var cz = [];
    if (WYBRANA_SEKCJA !== 'wszystkie') {
      var przy = document.querySelector('.naw .zak[data-sek="' + WYBRANA_SEKCJA + '"]');
      cz.push(przy ? przy.textContent.replace(/\d+$/, '').trim() : WYBRANA_SEKCJA);
    }
    if (CZYTANIE === 'nowe') cz.push('tylko nowe');
    if (CZYTANIE === 'przeczytane') cz.push('tylko przeczytane');
    if (STANY.length !== WSZYSTKIE_STANY.length) {
      cz.push(STANY.length === 1 ? 'tylko ' + stanNazwa(STANY[0])
        : 'bez ' + WSZYSTKIE_STANY.filter(function (s) { return STANY.indexOf(s) < 0; })
            .map(function (s) { return STAN_BEZ[s] || stanNazwa(s); }).join(', '));
    }
    if (!cz.length) return ilePozycji(grupy.length) + ', nic nie odfiltrowane';
    return cz.join(' · ') + ' · ' + ilePozycji(grupy.length);
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest ? e.target.closest('.szCzytB') : null;
    if (!c) return;
    CZYTANIE = c.dataset.czyt;
    try { localStorage.setItem(KLUCZ + ':czytanie', CZYTANIE); } catch (err) {}
    rysujTabele();
  });
  function stanWidoczny(s) { return STANY.indexOf(s || 'nowa') >= 0; }

  // do poprawki wraca na poczatek kolejki — to znaczy, ze robota jeszcze przed nami
  var PORZ = { 'nowa': 0, '': 0, 'poprawka': 1, 'w robocie': 2, 'czeka': 3, 'zrobione': 4, 'odrzucone': 5 };
  var KOLEJ_ST = ['nowa', 'poprawka', 'w robocie', 'czeka', 'zrobione', 'odrzucone'];
  function stanKlasa(s) {
    var z = STATUSY.filter(function (x) { return x.id === s; })[0];
    return z ? z.klasa : 'nie';
  }
  function stanNazwa(s) {
    var z = STATUSY.filter(function (x) { return x.id === s; })[0];
    return z ? z.nazwa : 'nie zrobione';
  }

  // ---- tryb zespolu: tylko my widzimy przyciski statusu ----
  // O trybie decyduje SAM ADRES, nic nie jest zapamietywane w przegladarce:
  //   neworchard.zovu.pl         — widok Ani
  //   neworchard.zovu.pl/zespol  — widok nasz
  // Wczesniej tryb siedzial w pamieci przegladarki, wiec oba adresy
  // pokazywaly to samo i nie dalo sie sprawdzic, co widzi Ania.
  var ZESPOL = __ZESPOL__;
  // stare linki z ?zespol=1 maja dalej dzialac
  if (location.search.indexOf('zespol=1') >= 0) ZESPOL = true;
  if (location.search.indexOf('zespol=0') >= 0) ZESPOL = false;
  try { localStorage.removeItem(KLUCZ + ':zespol'); } catch (e) {}

  // ---- rozmowa z arkuszem ----
  var UWAGI = [];
  // Nasze swieze klikniecie jest wazniejsze od odpowiedzi arkusza.
  // Arkusz odpowiada z opoznieniem, wiec bez tego wybor sam by sie cofal.
  var SWIEZE = {};
  function zapamietajStan(nr, status) {
    if (nr > 0) SWIEZE[nr] = { status: status, kiedy: Date.now() };
  }
  function nalozSwieze() {
    var teraz = Date.now();
    Object.keys(SWIEZE).forEach(function (nr) {
      if (teraz - SWIEZE[nr].kiedy > 20000) { delete SWIEZE[nr]; return; }
      var u = UWAGI.filter(function (x) { return x.nr === +nr; })[0];
      if (u) u.status = SWIEZE[nr].status;
    });
  }

  // Jedna kolejka zapisow do arkusza. Bez niej dwa szybkie klikniecia
  // wysylaly sie rownolegle i do arkusza trafialo to, ktore wrocilo pozniej.
  var KOLEJKA = [];
  var JEDZIE = false;
  var DOCELOWY = {};                 // nr wiersza -> stan, ktory ma tam finalnie byc
  function doArkusza(dane, po) {
    if (dane.akcja === 'status' && dane.nr > 0) {
      DOCELOWY[dane.nr] = dane.status;
      // starsze zadanie dla tego samego wiersza nie ma juz sensu
      KOLEJKA = KOLEJKA.filter(function (z) {
        return !(z.dane.akcja === 'status' && z.dane.nr === dane.nr);
      });
    }
    KOLEJKA.push({ dane: dane, po: po });
    ruszKolejke();
  }
  function ruszKolejke() {
    if (JEDZIE) return;
    if (!KOLEJKA.length) { sprawdzZapis(); return; }
    JEDZIE = true;
    var z = KOLEJKA.shift();
    // jesli w miedzyczasie ten wiersz dostal nowszy stan, wysylamy ten nowszy
    if (z.dane.akcja === 'status' && z.dane.nr > 0 && DOCELOWY[z.dane.nr] !== undefined) {
      z.dane.status = DOCELOWY[z.dane.nr];
    }
    wyslijCicho(z.dane)
      .then(function (j) { return z.po ? z.po(j) : null; })
      ['catch'](function () {})
      .then(function () { JEDZIE = false; ruszKolejke(); });
  }
  // po opróznieniu kolejki sprawdzamy, czy arkusz naprawde ma to, co ekran
  var SPRAWDZANIE = null;
  function sprawdzZapis() {
    if (SPRAWDZANIE) clearTimeout(SPRAWDZANIE);
    SPRAWDZANIE = setTimeout(function () {
      SPRAWDZANIE = null;
      if (JEDZIE || KOLEJKA.length) return;
      var chce = DOCELOWY; DOCELOWY = {};
      if (!Object.keys(chce).length) { pobierz().then(przerysuj); return; }
      fetch(MOST, { method: 'GET' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) return;
        var poprawki = 0;
        (j.uwagi || []).forEach(function (u) {
          if (chce[u.nr] !== undefined && u.status !== chce[u.nr]) {
            poprawki++;
            doArkusza({ akcja: 'status', nr: u.nr, status: chce[u.nr] });
          }
        });
        if (!poprawki) {
          UWAGI = j.uwagi || []; INDEKS = null; nalozSwieze(); wyrownajWszystkie(); przerysuj();
          try { localStorage.setItem(KLUCZ + ':dane', JSON.stringify(UWAGI)); } catch (e) {}
        }
      })['catch'](function () {});
    }, 900);
  }

  function pobierz() {
    return fetch(MOST, { method: 'GET' }).then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.ok) {
          UWAGI = j.uwagi || []; INDEKS = null; nalozSwieze(); wyrownajWszystkie();
          if (j.wersja >= 3 && !MOST_UMIE_PLIKI) { MOST_UMIE_PLIKI = true; dodajPrzyciskiPlikow(); }
        }
        return UWAGI;
      })
      ['catch'](function () { return UWAGI; });
  }
  // cicho: zapisuje i oddaje odpowiedz, ale NIE przerysowuje ekranu.
  // dzieki temu w srodku lancucha nikt nie zobaczy stanu posredniego.
  function wyslijCicho(dane) {
    dane.token = TOKEN;
    // kazdy zapis podpisuje sie, kto go zrobil — stad bierze sie "zmienione przez"
    if (dane.kto === undefined) dane.kto = ZESPOL ? 'ZOVU' : 'Ania';
    return fetch(MOST, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(dane),
    }).then(function (r) { return r.json(); });
  }
  function wyslij(dane) {
    return wyslijCicho(dane).then(function (j) {
      if (j && j.ok) { UWAGI = j.uwagi || []; INDEKS = null; nalozSwieze(); przerysuj(); }
      return j;
    });
  }

  // zmiana od razu widoczna, zapis leci w tle
  function odRazu(nr, zmiany, dane) {
    var u = UWAGI.filter(function (x) { return x.nr === nr; })[0];
    if (u) { for (var k in zmiany) u[k] = zmiany[k]; if (zmiany.status) zapamietajStan(nr, zmiany.status); }
    przerysuj();
    return wyslij(dane)['catch'](function () {
      pobierz().then(przerysuj);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- uwagi przy konkretnej pozycji ----
  // stare uwagi przyszly z przedrostkiem [co i kiedy publikujemy] i ze stara data,
  // a posty zdazyly sie przenumerowac — dlatego porownujemy po samym temacie.
  var OGONKI = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ż': 'z', 'ź': 'z' };
  var PAMIEC_KLUCZY = {};
  function klucz(s) {
    var wejscie = String(s || '');
    if (PAMIEC_KLUCZY[wejscie] !== undefined) return PAMIEC_KLUCZY[wejscie];
    return (PAMIEC_KLUCZY[wejscie] = liczKlucz(wejscie));
  }
  function liczKlucz(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, ' ')                  // [co i kiedy publikujemy]
      .replace(/\([^)]*\)/g, ' ')                   // (przeniesiony z 27.09)
      .replace(/[ąćęłńóśżź]/g, function (z) { return OGONKI[z] || z; })
      .replace(/[a-zа-я]{2,4}\s*\d{1,2}\.\d{2}/g, ' ')  // pon 28.09
      .replace(/[^a-z0-9а-я]/g, '');                // zostaja same litery i cyfry
  }
  // pozycje, ktore zmienily nazwe — tego zadna regula sama nie zgadnie
  var ALIASY = {
    'cisza': 'ankietashortmidlong',
    'takbedziewygladalprofil': 'calasiatkaprofilu',
  };
  function pasuje(a, b) {
    var x = klucz(a), y = klucz(b);
    if (!x || !y) return false;
    if (ALIASY[x]) x = ALIASY[x];
    if (ALIASY[y]) y = ALIASY[y];
    return x === y || x.indexOf(y) >= 0 || y.indexOf(x) >= 0;
  }
  var ZNACZNIK = 'STATUS POSTU';
  function jestZnacznikiem(u) { return u.ocena === ZNACZNIK; }

  // Przy kazdej uwadze widac, od kogo jest, a jesli ktos pozniej cos przy niej
  // ruszyl — kiedy i kto. Zeby nie trzeba bylo zgadywac, czyja to ostatnia reka.
  function ktoTo(k) { return k === 'ZOVU' ? 'ZOVU' : (k === 'Ania' ? 'Ania' : k); }
  function kto(u) {
    var h = u.kto ? ' &middot; ' + (u.kto === 'ZOVU' ? 'od nas' : 'od Ani') : '';
    if (u.zmieniono && u.zmieniono !== u.czas) {
      h += '<span class="uwZm">zmienione ' + esc(u.zmieniono) +
        (u.ktoZmienil ? ', ' + esc(ktoTo(u.ktoZmienil)) : '') + '</span>';
    }
    return h;
  }

  // indeks budowany raz na przerysowanie — bez niego kazde klikniecie
  // przemielalo wszystkie uwagi razy wszystkie posty i strona mulila
  var INDEKS = null;
  function przeliczIndeks() {
    INDEKS = { uwagi: {}, znaczniki: {}, doslownie: {} };
    UWAGI.forEach(function (u) {
      if (u.status === 'cofnieta') return;
      var k = klucz(u.pozycja);
      if (ALIASY[k]) k = ALIASY[k];
      var gdzie = jestZnacznikiem(u) ? INDEKS.znaczniki : INDEKS.uwagi;
      (gdzie[k] = gdzie[k] || []).push(u);
      // Wszystkie wstawki maja po obrobce ten sam klucz (znikaja nawiasy i daty),
      // wiec dla nich trzymamy osobny indeks po pelnym, surowym tytule.
      if (!jestZnacznikiem(u)) {
        var d = String(u.pozycja || '').trim();
        (INDEKS.doslownie[d] = INDEKS.doslownie[d] || []).push(u);
      }
    });
  }
  function zIndeksu(zbior, tytul) {
    if (!INDEKS) przeliczIndeks();
    // Wstawki: tylko dokladny tytul. Po obrobce wszystkie maja ten sam klucz,
    // wiec dopasowanie rozmyte pokazywalo te sama uwage przy kazdej wstawce.
    if (/^\[wstawka\]/i.test(String(tytul || '')) && zbior === INDEKS.uwagi) {
      return INDEKS.doslownie[String(tytul).trim()] || [];
    }
    var k = klucz(tytul);
    if (ALIASY[k]) k = ALIASY[k];
    if (zbior[k]) return zbior[k];
    var wynik = [];
    for (var kk in zbior) {
      if (kk.indexOf(k) >= 0 || k.indexOf(kk) >= 0) wynik = wynik.concat(zbior[kk]);
    }
    return wynik;
  }
  function dla(tytul) { if (!INDEKS) przeliczIndeks(); return zIndeksu(INDEKS.uwagi, tytul); }
  // W arkuszu potrafi lezec wiecej niz jeden znacznik tego samego postu
  // (post zmienil nazwe i doszedl nowy wiersz). Prawda jest zawsze NAJNOWSZY,
  // czyli ten o najwyzszym numerze wiersza — inaczej strona czytala jeden,
  // a zapisywala drugi i stan "nie chcial sie zmienic".
  function znacznikiPostu(tytul) {
    if (!INDEKS) przeliczIndeks();
    return zIndeksu(INDEKS.znaczniki, tytul).slice().sort(function (a, b) { return a.nr - b.nr; });
  }
  function znacznikPostu(tytul) {
    var w = znacznikiPostu(tytul);
    return w[w.length - 1];
  }

  // Stan postu jest jeden. Prostujemy rozjazdy TYLKO po swiezym odczycie z arkusza
  // i nigdy nie ruszamy tego, co przed chwila kliknelismy — inaczej wybor sam by sie cofal.
  function wyrownajWszystkie() {
    [].slice.call(document.querySelectorAll('.uw[data-tytul]')).forEach(function (el) {
      var tytul = el.dataset.tytul;
      var kartaW = el.closest('.k');
      if (el.classList.contains('wst') || (kartaW && kartaW.dataset.osobno)) return;
      var zn = znacznikPostu(tytul);
      if (!zn || !zn.status || zn.status === 'cofnieta') return;
      if (SWIEZE[zn.nr]) return;
      dla(tytul).forEach(function (u) {
        if (SWIEZE[u.nr] || u.status === zn.status) return;
        u.status = zn.status;
        // puste kto: to porzadkowanie robi sama strona, a nie osoba przy niej —
        // inaczej nasza zmiana ladowala w arkuszu podpisana jej imieniem
        if (u.nr > 0) doArkusza({ akcja: 'status', nr: u.nr, status: zn.status, kto: '' });
      });
    });
  }

  // osobno = kazdy wpis pod ta pozycja jest osobna rzecza (zeszyt pomyslow,
  // dopiski miedzy postami), wiec decyzje podejmuje sie przy kazdym z osobna,
  // a nie jednym stanem dla calej karty
  // Zalacznik siedzi w tresci jako zwykly odnosnik — tutaj zamieniamy go
  // na samo zdjecie, zeby nie trzeba bylo nigdzie klikac.
  var ZAL = /\[plik:([A-Za-z0-9]+)\]/g;
  var PLIKI = {};
  var WLOCIE = {};
  function zZalacznikami(html) {
    return html.replace(ZAL, function (_, id) {
      return '<img class="zal" data-plik="' + id + '" alt="">';
    });
  }
  // Zdjecie lezy w arkuszu, wiec dociagamy je osobno i zapamietujemy w
  // przegladarce — drugi raz tego samego pliku juz nie sciagamy.
  function dociagnijZalaczniki() {
    [].slice.call(document.querySelectorAll('img.zal[data-plik]')).forEach(function (im) {
      var id = im.dataset.plik;
      if (im.src && im.src.slice(0, 5) === 'data:') return;
      if (PLIKI[id]) { im.src = PLIKI[id]; return; }
      var zPamieci = null;
      try { zPamieci = localStorage.getItem('no-plik:' + id); } catch (e) {}
      if (zPamieci) { PLIKI[id] = zPamieci; im.src = zPamieci; return; }
      if (WLOCIE[id]) return;
      WLOCIE[id] = 1;
      fetch(MOST + '?token=' + TOKEN + '&plik=' + id)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok || !j.dane) return;
          var url = 'data:' + (j.typ || 'image/jpeg') + ';base64,' + j.dane;
          PLIKI[id] = url; WLOCIE[id] = 0;
          try { localStorage.setItem('no-plik:' + id, url); } catch (e) {}
          [].slice.call(document.querySelectorAll('img.zal[data-plik="' + id + '"]'))
            .forEach(function (x) { x.src = url; });
        })['catch'](function () { WLOCIE[id] = 0; });
    });
  }


  function wierszUwagi(u, osobno) {
    var kl = stanKlasa(u.status);
    var h = '<div class="uwEl ' + kl + '" data-nr="' + u.nr + '">' +
      '<div class="uwGl"><span class="uwCzas">' + esc(u.czas) + kto(u) + '</span>' +
      
      '<span class="uwSt"><i></i>' + stanNazwa(u.status) + '</span></div>' +
      '<div class="uwTxt">' + zZalacznikami(esc(u.uwaga).replace(/\n/g, '<br>')) + '</div>' +
      (u.odpowiedz ? '<div class="uwOdp"><b>Nasza odpowiedz:</b> ' + esc(u.odpowiedz) + '</div>' : '') +
      // Przy samym poscie Ania juz tego nie widzi — poprawia i wycofuje
      // w jednym miejscu, w koszyku. Tu ma czysto.
      '<div class="uwAkc">' +
        (ZESPOL ? '<button class="mini edy">Popraw</button>' +
                  '<button class="mini cof usun">Usun</button>' : '');
    // Stany stoja raz, w pasku "ten post" nad karta. Powtarzanie ich przy
    // kazdej uwadze dawalo te sama liste dwa razy pod rzad.
    if (ZESPOL) h += '<button class="mini odp">Odpowiedz</button>';
    if (ZESPOL && osobno) {
      h += '<span class="uwSep"></span><select class="mini stSel">' + STATUSY.map(function (st) {
        return '<option value="' + st.id + '"' + (u.status === st.id ? ' selected' : '') + '>' + st.nazwa + '</option>';
      }).join('') + '</select>';
    }
    h += '</div></div>';
    return h;
  }

  // Ta sama uwaga potrafi przyjsc dwoma droga: wpieczona w strone przy budowaniu
  // i zywa z arkusza. Wtedy na karcie stala dwa razy — zostawiamy zywa wersje,
  // bo przy niej sa przyciski i widac, kto i kiedy ja ruszyl.
  function odsiejPowtorki(karta, moje) {
    var teksty = moje.map(function (u) {
      return String(u.uwaga || '').replace(/\s+/g, ' ').trim().slice(0, 45).toLowerCase();
    }).filter(function (t) { return t.length > 12; });
    if (!teksty.length) return;
    [].slice.call(karta.querySelectorAll('.hist .hi')).forEach(function (el) {
      var cyt = el.querySelector('blockquote');
      if (!cyt) return;
      var t = cyt.textContent.replace(/\s+/g, ' ').trim().slice(0, 45).toLowerCase();
      if (teksty.indexOf(t) >= 0) el.hidden = true;
    });
    var hist = karta.querySelector('.hist');
    if (hist && !hist.querySelector('.hi:not([hidden])')) hist.hidden = true;
  }

  function rysujPrzyPostach() {
    // Takze wstawki miedzy postami. Ania napisala uwage przez "+ dodaj cos tutaj",
    // uwaga byla w koszyku, a na stronie nie bylo po niej sladu, bo rysowalismy
    // tylko pola przy postach.
    [].slice.call(document.querySelectorAll('.uw, .wst')).forEach(function (u) {
      var tytul = u.dataset.tytul;
      // Lista uwag musi stac POZA zwijanym polem pisania. Wczesniej siedziala
      // w srodku i razem z nim znikala — uwaga byla napisana, widac ja bylo
      // w koszyku, a na karcie postu nie bylo po niej sladu, dopoki ktos nie
      // kliknal "napisz uwage".
      var lista = (u.parentNode && u.parentNode.querySelector(':scope > .uwLista')) || u.querySelector('.uwLista');
      if (!lista) {
        lista = document.createElement('div');
        lista.className = 'uwLista';
      }
      if (u.classList.contains('wst')) {
        // wstawka sama w sobie jest zwijana — lista siedzi w niej, ale nad
        // przyciskiem i poza zwijanym pudelkiem
        if (lista.parentNode !== u || u.firstChild !== lista) u.insertBefore(lista, u.firstChild);
      } else if (u.parentNode) {
        var przedCzym = u.previousElementSibling && u.previousElementSibling.classList.contains('uwOtw')
          ? u.previousElementSibling : u;
        if (lista.nextElementSibling !== przedCzym) u.parentNode.insertBefore(lista, przedCzym);
      } else if (!lista.parentNode) {
        u.insertBefore(lista, u.firstChild);
      }
      // Jak ktos wlasnie pisze odpowiedz albo poprawia uwage, nie przerysowujemy
      // tej listy — inaczej pudelko znika w trakcie pisania i nie da sie nic
      // dokonczyc. Wracamy do rysowania, gdy pudelko sie zamknie.
      if (lista.querySelector('.odpBox')) return;
      var moje = dla(tytul);
      var kartaU = u.closest('.k');
      var osobno = u.classList.contains('wst') || !!(kartaU && kartaU.dataset.osobno);
      lista.innerHTML = moje.length
        ? moje.map(function (x) { return wierszUwagi(x, osobno); }).join('')
        : '';
      if (lista.querySelector('img.zal')) dociagnijZalaczniki();
      var karta = u.closest('.k');
      if (karta && !u.classList.contains('wst')) odsiejPowtorki(karta, moje);
    });
  }

  // ---- ktory koszyk jest otwarty ----
  var WYBRANA_SEKCJA = 'wszystkie';
  try { WYBRANA_SEKCJA = localStorage.getItem(KLUCZ + ':koszyk') || 'wszystkie'; } catch (e) {}
  // wszystkie / nowe / przeczytane
  var CZYTANIE = 'wszystkie';
  try { CZYTANIE = localStorage.getItem(KLUCZ + ':czytanie') || 'wszystkie'; } catch (e) {}

  // ---- kolejnosc w szufladzie: stala w trakcie pracy ----
  var KOLEJNOSC = [];
  function ustalKolejnosc(lista) {
    KOLEJNOSC = lista.slice()
      .sort(function (a, b) { return (PORZ[a.status] || 0) - (PORZ[b.status] || 0) || a.nr - b.nr; })
      .map(function (u) { return u.nr; });
  }
  function przeliczKolejnosc() { KOLEJNOSC = []; }

  // ---- tabela w zakladce Twoje uwagi ----
  function rysujTabele() {
    var cel = document.getElementById('tabUwag');
    if (!cel) return;
    var lista = UWAGI.filter(function (u) {
      return u.status !== 'cofnieta' && !jestZnacznikiem(u) && (u.uwaga || u.ocena);
    });
    // grupujemy po poscie: jedna glowka z miniaturka, pod nia jej uwagi
    var grupy = [], indeks = {};

    // Najpierw KAZDA pozycja z planu, po kolei jak na stronie — zeby dalo sie
    // przejsc caly plan z jednego miejsca, a nie tylko te miejsca, przy ktorych
    // ktos juz cos napisal.
    [].slice.call(document.querySelectorAll('.uw[data-tytul]')).forEach(function (pole) {
      // zeszyt pomyslow to nie pozycja planu — w koszyku nie ma czego zatwierdzac
      if (/^\[pomysly\]/i.test(pole.dataset.tytul || '')) return;
      var g = miejsceZPola(pole);
      if (!g) return;
      if (indeks[g.id]) return;
      indeks[g.id] = { miejsce: g, pozycja: g.tytul, uwagi: [],
                       sekcja: g.sekcja, sekNazwa: g.sekNazwa, kolej: g.kolej };
      grupy.push(indeks[g.id]);
    });

    lista.forEach(function (u) {
      var g = miejsceDla(u.pozycja);
      var k = g ? g.id : ('x' + klucz(u.pozycja));
      if (!indeks[k]) {
        indeks[k] = { miejsce: g, pozycja: u.pozycja, uwagi: [],
                      sekcja: g ? g.sekcja : 'inne', sekNazwa: g ? g.sekNazwa : 'Inne',
                      kolej: g ? g.kolej : 9999 };
        grupy.push(indeks[k]);
      }
      indeks[k].uwagi.push(u);
    });
    // kolejnosc dokladnie taka, jak posty ida na stronie
    grupy.sort(function (a, b) { return a.kolej - b.kolej; });
    grupy.forEach(function (g) { g.uwagi.sort(function (a, b) { return a.nr - b.nr; }); });

    // osobny koszyk na kazda sekcje
    var licznikiSekcji = {}, kolejnoscSekcji = [];
    grupy.forEach(function (g) {
      if (!licznikiSekcji[g.sekcja]) { licznikiSekcji[g.sekcja] = { nazwa: g.sekNazwa, ile: 0, otwarte: 0 }; kolejnoscSekcji.push(g.sekcja); }
      licznikiSekcji[g.sekcja].pozycji = (licznikiSekcji[g.sekcja].pozycji || 0) + 1;
      g.uwagi.forEach(function (u) {
        licznikiSekcji[g.sekcja].ile++;
        if (u.status !== 'zrobione') licznikiSekcji[g.sekcja].otwarte++;
      });
    });
    if (WYBRANA_SEKCJA !== 'wszystkie' && !licznikiSekcji[WYBRANA_SEKCJA]) WYBRANA_SEKCJA = 'wszystkie';

    // Trzy rzedy pigulek zajmowaly pol ekranu, zanim doszlo sie do pierwszej uwagi.
    // Domyslnie sa zwiniete pod jednym przyciskiem, ktory od razu mowi, co jest wlaczone.
    // Trzy rzeczy, ktore wczesniej lezaly jedna na drugiej, sa teraz rozdzielone:
    //  - wybor zakladki zostaje tutaj, bo z niego korzysta sie najczesciej,
    //  - nowe/przeczytane przeniesione do naglowka, tam gdzie i tak byl podpis,
    //  - sortowanie po stanie chowa sie pod przyciskiem "Sortuj".
    var filtry = '<div class="szGora">' +
      '<div class="szFiltry szSekcje"><button class="szF' + (WYBRANA_SEKCJA === 'wszystkie' ? ' akt' : '') +
      '" data-sekcja="wszystkie">Wszystkie <b>' + grupy.length + '</b></button>';
    kolejnoscSekcji.forEach(function (s) {
      filtry += '<button class="szF' + (WYBRANA_SEKCJA === s ? ' akt' : '') + '" data-sekcja="' + s + '">' +
        esc(licznikiSekcji[s].nazwa) + ' <b>' + (licznikiSekcji[s].pozycji || 0) + '</b></button>';
    });
    filtry += '</div>';

    // druga linia: nowe od drugiej strony albo juz przeczytane
    var ileNowych = grupy.filter(function (g) { return g.uwagi.some(jestNowa); }).length;

    // nowe / przeczytane siedza w naglowku, w miejscu podpisu — zero dodatkowej wysokosci
    (function () {
      var pod = document.getElementById('szPodpis');
      if (!pod) return;
      if (!grupy.length) { pod.textContent = 'jeszcze nic tu nie ma'; return; }
      pod.innerHTML = '<span class="szPodIle">' + ilePozycji(grupy.length) + '</span>' +
        '<button class="szCzytB' + (CZYTANIE === 'wszystkie' ? ' akt' : '') + '" data-czyt="wszystkie">wszystkie</button>' +
        '<button class="szCzytB nowe' + (CZYTANIE === 'nowe' ? ' akt' : '') + '" data-czyt="nowe">nowe <b>' + ileNowych + '</b></button>' +
        '<button class="szCzytB' + (CZYTANIE === 'przeczytane' ? ' akt' : '') + '" data-czyt="przeczytane">przeczytane <b>' + (grupy.length - ileNowych) + '</b></button>';
    })();
    filtry += '<div class="szFiltry szStany"></div></div>';

    // ten sam filtr stanow co na glownym ekranie
    grupy = grupy.filter(function (g) {
      var m2 = g.miejsce;
      return stanWidoczny(statusPostu(m2 ? m2.tytul : g.pozycja) || 'nowa');
    });
    if (WYBRANA_SEKCJA !== 'wszystkie') grupy = grupy.filter(function (g) { return g.sekcja === WYBRANA_SEKCJA; });
    // Kiedy wszystko jest juz przeczytane, filtr "nowe" zostawialby pusty koszyk
    // i nie bylo widac dlaczego. Zdejmujemy go sami.
    if (CZYTANIE === 'nowe' && !ileNowych) {
      CZYTANIE = 'wszystkie';
      try { localStorage.setItem(KLUCZ + ':czytanie', CZYTANIE); } catch (err) {}
    }
    if (CZYTANIE !== 'wszystkie') {
      var chceNowe = CZYTANIE === 'nowe';
      grupy = grupy.map(function (g) {
        var kopia = {};
        for (var k in g) kopia[k] = g[k];
        kopia.uwagi = g.uwagi.filter(function (u) { return jestNowa(u) === chceNowe; });
        return kopia;
      }).filter(function (g) { return g.uwagi.length || !chceNowe; });
    }
    var h = filtry;
    var ostatniaSekcja = null;
    grupy.forEach(function (g) {
      var m = g.miejsce;
      var st = m ? statusPostu(m.tytul) : null;
      if (WYBRANA_SEKCJA === 'wszystkie' && g.sekcja !== ostatniaSekcja) {
        ostatniaSekcja = g.sekcja;
        h += '<div class="szDzial">' + esc(g.sekNazwa) + '</div>';
      }
      var swiezaGrupa = g.uwagi.some(jestNowa);
      h += '<div class="grupa' + (st ? ' ' + stanKlasa(st) : '') + (swiezaGrupa ? ' swiezaGr' : '') + '">' +
        '<div class="grGl" data-idzie="' + esc(m ? m.tytul : g.pozycja) + '">' +
          (m && m.obraz ? '<img src="' + m.obraz + '" alt="" loading="lazy">' : '<span class="grBrak"></span>') +
          '<div class="grOpis"><b>' + esc(m ? m.nazwa : g.pozycja) + '</b>' +
            (m && m.data ? '<span class="grData">' + esc(m.data) + '</span>' : '') +
            (st ? '<span class="pStan ' + stanKlasa(st) + '"><i></i>' + stanNazwa(st) + '</span>' : '') +
            // ten sam slad co przy poscie: kiedy ostatnio ruszone i czyja reka
            (function () {
              var z = znacznikPostu(m ? m.tytul : g.pozycja);
              if (!z || !z.zmieniono) return '';
              return '<span class="stZm">ostatnia zmiana ' + esc(z.zmieniono) +
                (z.ktoZmienil ? ' &middot; ' + esc(ktoTo(z.ktoZmienil)) : '') + '</span>';
            })() +
          '</div><span class="grStrz">&rarr;</span></div>';
      g.uwagi.forEach(function (u) {
        h += wierszSzuflady(u);
      });
      // Przy pozycji, pod ktora sa uwagi, stan jest tylko do odczytu — zmienia
      // sie go przy konkretnej uwadze tuz nad tym miejscem. Ale pozycja bez
      // zadnej uwagi nie ma czego kliknac, wiec tam zostaje wybierak.
      var samStan = ZESPOL && !g.uwagi.length;
      h += '<div class="grDecyzja grStan"><span class="grStanEt">stan pozycji</span>' +
        (samStan
          ? '<select class="mini pstSel" data-tytul="' + esc(m ? m.tytul : g.pozycja) + '">' +
              STATUSY.map(function (s) {
                return '<option value="' + s.id + '"' + (st === s.id ? ' selected' : '') + '>' + s.nazwa + '</option>';
              }).join('') + '</select>'
          : '<span class="grStanWart ' + stanKlasa(st) + '"><i></i>' + stanNazwa(st) + '</span>') +
        '</div>';
      // Ania decyduje takze stad — nie musi wracac do posta na stronie
      if (!ZESPOL) {
        var tyt = esc(m ? m.tytul : g.pozycja);
        h += '<div class="grDecyzja">' +
          '<button class="zatw' + (st === 'zrobione' ? ' akt' : '') + '" data-tytul="' + tyt + '">Zatwierdzam</button>' +
          '<button class="dopop' + (st === 'poprawka' ? ' akt' : '') + '" data-tytul="' + tyt + '">Do poprawki</button>' +
          // w koszyku stalo samo "Nie" i nie bylo jasne, czego dotyczy —
          // ten sam napis co pod postem
          '<button class="odrzuc' + (st === 'odrzucone' ? ' akt' : '') + '" data-tytul="' + tyt + '">Nie, rezygnujemy</button>' +
          '</div>';
      }
      h += '</div>';
    });

    var zUwagami = grupy.filter(function (g) { return g.uwagi.length; }).length;
    // pusty koszyk zawsze mowi, dlaczego jest pusty, i daje wyjscie jednym klikiem —
    // inaczej dalo sie zostac z czarnym ekranem i nie bylo w co kliknac
    if (!grupy.length) {
      var czemu = [];
      if (WYBRANA_SEKCJA !== 'wszystkie') czemu.push('zakladka');
      if (CZYTANIE !== 'wszystkie') czemu.push(CZYTANIE === 'nowe' ? 'tylko nowe' : 'tylko przeczytane');
      if (STANY.length !== WSZYSTKIE_STANY.length) czemu.push('stan: ' + STANY.map(stanNazwa).join(', '));
      h += '<p class="pustoFiltr">Nic nie pasuje' +
        (czemu.length ? ' — ukryte przez: ' + esc(czemu.join(', ')) + '.' : '.') +
        ' <button class="wrocStany">Pokaz wszystkie</button></p>';
    }
    if (cel.querySelector('.odpBox')) return;   // ktos pisze — nie wyrywamy mu pudelka
    cel.innerHTML = h + '<div class="ekr" style="margin-top:14px">' + grupy.length +
      ' pozycji w planie, uwagi sa przy ' + zUwagami + '.</div>';
    if (cel.querySelector('img.zal')) dociagnijZalaczniki();
    // pasek stanow zyje w swiezo wstawionym HTML, wiec wypelniamy go od razu —
    // przy samym otwarciu koszyka pelne przerysowanie jeszcze nie leci
    rysujPasekStanow();
  }

  // gdzie ta uwaga siedzi na stronie: karta, nazwa, data, kadr, sekcja i kolejnosc
  // to samo, ale liczone wprost z pola na stronie — bez zgadywania po tytule,
  // bo dopasowanie rozmyte potrafilo skleic dwie rozne pozycje w jedna
  function miejsceZPola(pole) {
    var wszystkie = [].slice.call(document.querySelectorAll('.uw[data-tytul], .wst[data-tytul]'));
    return zbudujMiejsce(pole, wszystkie);
  }
  function miejsceDla(pozycja) {
    var wszystkie = [].slice.call(document.querySelectorAll('.uw[data-tytul], .wst[data-tytul]'));
    var pole = wszystkie.filter(function (x) { return pasuje(x.dataset.tytul, pozycja); })[0];
    if (!pole) return null;
    return zbudujMiejsce(pole, wszystkie);
  }
  function zbudujMiejsce(pole, wszystkie) {
    var karta = pole.closest('.k') || pole;
    var img = karta.querySelector ? karta.querySelector('.kadry img') : null;
    var h3 = karta.querySelector ? karta.querySelector('.gl h3') : null;
    var dat = karta.querySelector ? karta.querySelector('.gl .dat') : null;
    var sek = pole.closest('.sek');
    return {
      id: karta.id || ('x' + wszystkie.indexOf(pole)),
      tytul: pole.dataset.tytul,
      nazwa: h3 ? h3.textContent : pole.dataset.tytul,
      data: dat ? dat.textContent : '',
      obraz: img ? img.getAttribute('src') : null,
      sekcja: sek ? sek.id.replace('sek-', '') : 'inne',
      sekNazwa: nazwaSekcji(sek),
      kolej: wszystkie.indexOf(pole),   // dokladnie ta kolejnosc, co na stronie
    };
  }
  function nazwaSekcji(sek) {
    if (!sek) return 'Inne';
    var id = sek.id.replace('sek-', '');
    var przy = document.querySelector('.naw .zak[data-sek="' + id + '"]');
    return przy ? przy.textContent.trim() : id;
  }

  function wierszSzuflady(u) {
    var swieza = jestNowa(u);
    return '<div class="uwEl ' + stanKlasa(u.status) + (swieza ? ' swieza' : '') + '" data-nr="' + u.nr + '">' +
        '<div class="uwGl"><span class="uwCzas">' + esc(u.czas) + kto(u) +
        (swieza ? '<span class="nowaEt">NOWE</span>' : '') + '</span>' +
        
        '<span class="uwSt"><i></i>' + stanNazwa(u.status) + '</span></div>' +
        (u.uwaga
          ? (u.uwaga.length > 90
              ? '<details class="uwZwin"><summary>' + esc(u.uwaga.slice(0, 80)) + '…</summary>' +
                '<div class="uwTxt">' + zZalacznikami(esc(u.uwaga).split('\n').join('<br>')) + '</div></details>'
              : '<div class="uwTxt">' + zZalacznikami(esc(u.uwaga).split('\n').join('<br>')) + '</div>')
          : '') +
        (u.odpowiedz ? '<div class="uwOdp"><b>Nasza odpowiedz:</b> ' + esc(u.odpowiedz) + '</div>' : '') +
        '<div class="uwAkc">' +
          '<button class="mini edy">Popraw</button>' +
          '<button class="mini cof usun">Usun</button>' +
          // Szesc przyciskow stanu przy KAZDEJ uwadze dawalo te sama liste
          // po kilka razy pod rzad. Zostaje jedno pole wyboru na uwage.
          (ZESPOL ? '<span class="uwSep"></span>' +
            '<select class="mini stSel">' + STATUSY.map(function (st) {
              return '<option value="' + st.id + '"' + (u.status === st.id ? ' selected' : '') + '>' + st.nazwa + '</option>';
            }).join('') + '</select>' +
            '<button class="mini odp">Odpowiedz</button>' : '') +
        '</div></div>';
  }

  // status calego postu: najgorszy ze statusow jego uwag
  function statusPostu(tytul) {
    var zn = znacznikPostu(tytul);
    if (zn && zn.status) return zn.status;
    var moje = dla(tytul).filter(function (u) { return u.uwaga || u.ocena; });
    // pozycja, ktorej jeszcze nikt nie tknal, czeka na jej slowo —
    // caly plan ma byc przez nia przejrzany, nie tylko to, co juz poprawialismy
    if (!moje.length) return 'czeka';
    var naj = 9;
    moje.forEach(function (u) { naj = Math.min(naj, PORZ[u.status] || 0); });
    return KOLEJ_ST[naj] || 'nowa';
  }

  // karta ma miescic sie na ekranie: widac kadr, date, nazwe i stan.
  // tekst, produkty, historia i stara wersja chowaja sie pod jedno rozwiniecie.
  function zwinSzczegoly(karta) {
    if (karta.dataset.zwinieteSzcz) return;
    // produkty zostaja na wierzchu — to byla jej wyrazna prosba, zeby kazdy post linkowal towar
    var doSchowania = [].slice.call(karta.querySelectorAll(':scope > .pod, :scope > .ekr, :scope > .st, :scope > .stara, :scope > .hist'));
    if (!doSchowania.length) { karta.dataset.zwinieteSzcz = '1'; return; }
    var d = document.createElement('details');
    d.className = 'szcz';
    var s = document.createElement('summary');
    s.textContent = 'Tekst postu, historia uwag i poprzednie wersje';
    d.appendChild(s);
    karta.insertBefore(d, doSchowania[0]);
    doSchowania.forEach(function (el) { d.appendChild(el); });
    karta.dataset.zwinieteSzcz = '1';
  }

  // Porzadek na karcie — tak samo u nas i u Ani: szczegoly zwiniete,
  // pole pisania na koncu i tez zwiniete. Wczesniej robilo sie to tylko
  // w trybie zespolu, wiec ona dostawala cala sciane tekstu.
  function uporzadkujKarte(karta) {
    zwinSzczegoly(karta);
    var pole = karta.querySelector('.uw');
    if (pole) {
      if (karta.lastElementChild !== pole) karta.appendChild(pole);
      if (!pole.dataset.zwiniete) {
        pole.dataset.zwiniete = '1';
        pole.classList.add('zwin');
        var otw = document.createElement('button');
        otw.className = 'uwOtw';
        otw.textContent = '+ napisz uwage do tego postu';
        otw.addEventListener('click', function () {
          pole.classList.toggle('zwin');
          if (!pole.classList.contains('zwin')) pole.querySelector('textarea').focus();
        });
        pole.parentNode.insertBefore(otw, pole);
      }
    }
  }

  // przyciski gotowosci na samym poscie — dzialaja takze wtedy, gdy nie ma zadnej uwagi
  function dodajPrzyciskiPostu(karta, tytul, teraz) {
    var pas = null;
    if (ZESPOL) {
      pas = karta.querySelector('.pAkc');
      if (!pas) {
        pas = document.createElement('div');
        pas.className = 'pAkc';
        karta.appendChild(pas);   // najpierw czytasz post, potem decydujesz
      }
    }
    uporzadkujKarte(karta);       // pole pisania zawsze ladujE na samym koncu
    if (!ZESPOL) return;
    if (karta.dataset.osobno) {
      // jeden wspolny stan przestawialby wszystkie wpisy naraz — tu decyzja
      // stoi przy kazdym pomysle z osobna
      pas.innerHTML = '<span class="pAkcE">decyzje sa przy kazdym pomysle nizej</span>';
      return;
    }
    pas.innerHTML = '<span class="pAkcE">ten post:</span>' + STATUSY.map(function (s) {
      return '<button class="mini pst' + (teraz === s.id ? ' akt' : '') + '" data-st="' + s.id +
        '" data-tytul="' + esc(tytul) + '">' + s.nazwa + '</button>';
    }).join('');
  }

  // Dla Ani: decyzja przy KAZDYM poscie i zawsze dostepna. Nawet jesli cos juz
  // zatwierdzila, moze to cofnac do poprawki i napisac, co konkretnie zmienic.
  function dodajPrzyciskAkceptu(karta, tytul, teraz) {
    var stary = karta.querySelector('.pAkcept');
    if (ZESPOL) { if (stary) stary.remove(); return; }
    var d = stary;
    if (!d) {
      d = document.createElement('div');
      d.className = 'pAkcept';
      var uw = karta.querySelector('.uw');
      var otw = karta.querySelector('.uwOtw');
      if (otw) karta.insertBefore(d, otw);
      else if (uw) karta.insertBefore(d, uw);
      else karta.appendChild(d);
    }
    var napis = teraz === 'czeka' ? 'Poprawione. Pasuje tak?' : 'Twoja decyzja:';
    var nowy = '<span>' + napis + '</span>' +
      '<button class="zatw' + (teraz === 'zrobione' ? ' akt' : '') + '" data-tytul="' + esc(tytul) + '">Zatwierdzam</button>' +
      '<button class="dopop' + (teraz === 'poprawka' ? ' akt' : '') + '" data-tytul="' + esc(tytul) + '">Do poprawki</button>' +
      // kategoryczne nie: tego postu w ogole nie robimy
      '<button class="odrzuc' + (teraz === 'odrzucone' ? ' akt' : '') + '" data-tytul="' + esc(tytul) + '">Nie, rezygnujemy</button>';
    if (d.innerHTML !== nowy) d.innerHTML = nowy;
  }

  // "Do poprawki" i "Nie" od Ani: post wraca do nas i od razu otwiera sie pole,
  // zeby napisala, co konkretnie ma byc inaczej albo dlaczego rezygnujemy
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.dopop, button.odrzuc') : null;
    if (!b) return;
    zgraj(b.dataset.tytul, b.classList.contains('odrzuc') ? 'odrzucone' : 'poprawka');
    var karta = b.closest('.k');
    if (!karta) return;
    var pole = karta.querySelector('.uw');
    if (pole) {
      pole.classList.remove('zwin');
      var ta = pole.querySelector('textarea');
      if (ta) ta.focus();
    }
  });

  function rysujStatusyPostow() {
    [].slice.call(document.querySelectorAll('.uw[data-tytul]')).forEach(function (u) {
      var karta = u.closest('.k');
      if (!karta) return;
      var st = statusPostu(u.dataset.tytul);
      karta.classList.remove('p-nie', 'p-robi', 'p-czeka', 'p-gotowe', 'p-popr', 'p-odrz');
      var zn = karta.querySelector('.pStan');
      if (!st) {
        if (zn) zn.remove();
        if (!karta.classList.contains('bezFiltru')) karta.classList.toggle('ukryty', !stanWidoczny('nowa'));
        dodajPrzyciskiPostu(karta, u.dataset.tytul, null);
        return;
      }
      karta.classList.add('p-' + stanKlasa(st));
      if (!karta.classList.contains('bezFiltru')) karta.classList.toggle('ukryty', !stanWidoczny(st));
      if (!zn) {
        zn = document.createElement('span');
        zn.className = 'pStan';
        var gl = karta.querySelector('.gl');
        if (gl) gl.appendChild(zn); else karta.insertBefore(zn, karta.firstChild);
      }
      zn.className = 'pStan ' + stanKlasa(st);
      zn.innerHTML = '<i></i>' + stanNazwa(st);
      // obok stanu: kiedy ostatnio ktos go ruszyl i kto
      var znacz = znacznikPostu(u.dataset.tytul);
      var kiedyEl = karta.querySelector('.stZm');
      if (znacz && znacz.zmieniono) {
        if (!kiedyEl) {
          kiedyEl = document.createElement('span');
          kiedyEl.className = 'stZm';
          zn.parentNode.insertBefore(kiedyEl, zn.nextSibling);
        }
        kiedyEl.textContent = 'ostatnia zmiana ' + znacz.zmieniono +
          (znacz.ktoZmienil ? ' · ' + ktoTo(znacz.ktoZmienil) : '');
      } else if (kiedyEl) { kiedyEl.remove(); }
      dodajPrzyciskiPostu(karta, u.dataset.tytul, st);
      dodajPrzyciskAkceptu(karta, u.dataset.tytul, st);
      // ten sam kolor na kafelku w siatce feedu
      var kafel = document.querySelector('.siatka .sk[data-go="' + karta.id + '"]');
      if (kafel) {
        kafel.classList.remove('nie', 'robi', 'czeka', 'gotowe', 'popr', 'odrz');
        kafel.classList.add(stanKlasa(st));
      }
    });
  }

  // ile pozycji siedzi w kazdym stanie — liczymy z kart na stronie,
  // dzieki temu ta sama liczba pasuje i na glownym ekranie, i w koszyku
  function policzStany() {
    var licz = {};
    WSZYSTKIE_STANY.forEach(function (s) { licz[s] = 0; });
    [].slice.call(document.querySelectorAll('.uw[data-tytul]')).forEach(function (u) {
      if (u.closest('.bezFiltru')) return;
      var st = statusPostu(u.dataset.tytul) || 'nowa';
      if (licz[st] === undefined) licz[st] = 0;
      licz[st]++;
    });
    return licz;
  }
  // krotsze napisy, zeby caly pasek miescil sie w jednej linii
  var STAN_KROTKO = {
    'nowa': 'nie zrobione', 'poprawka': 'do poprawki', 'w robocie': 'w robocie',
    'czeka': 'czeka', 'zrobione': 'zatwierdzone', 'odrzucone': 'odrzucone',
  };
  // Wybor dziala jak zakladki, nie jak odhaczanie: klikasz stan i widzisz tylko
  // jego, klikasz jeszcze raz albo "Wszystkie" i wracaja wszystkie.
  function pasekStanowHTML(licz) {
    var caly = STANY.length === WSZYSTKIE_STANY.length;
    var wybrany = STANY.length === 1 ? STANY[0] : null;
    var h = '<button class="szF stanF' + (caly ? ' akt' : '') + '" data-stan="wszystkie">Wszystkie</button>';
    WSZYSTKIE_STANY.forEach(function (s) {
      // pusty stan tylko zabiera miejsce, chyba ze wlasnie na nim stoimy
      if (!licz[s] && wybrany !== s) return;
      h += '<button class="szF stanF ' + stanKlasa(s) + (wybrany === s ? ' akt' : '') + '" data-stan="' + s + '">' +
        '<i></i>' + (STAN_KROTKO[s] || stanNazwa(s)) + ' <b>' + (licz[s] || 0) + '</b></button>';
    });
    return h;
  }
  function opisStanow() {
    if (STANY.length === WSZYSTKIE_STANY.length) return 'widac wszystko';
    if (STANY.length === 1) return 'tylko ' + stanNazwa(STANY[0]);
    return 'bez ' + WSZYSTKIE_STANY.filter(function (s) { return STANY.indexOf(s) < 0; })
      .map(function (s) { return STAN_BEZ[s] || stanNazwa(s); }).join(', ');
  }
  function rysujPasekStanow() {
    var licz = policzStany();
    var g = document.getElementById('stanyPasek');
    if (g) {
      // to samo co w koszyku: jeden przycisk, pigulki pod nim
      g.innerHTML = pasekStanowHTML(licz);
      g.hidden = false;
    }
    var k = document.querySelector('.szTresc .szStany');
    if (k) k.innerHTML = pasekStanowHTML(licz);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.stanF') : null;
    if (!b) return;
    var s = b.dataset.stan;
    if (s === 'wszystkie') STANY = WSZYSTKIE_STANY.slice();
    // klik w ten sam stan drugi raz zdejmuje filtr, zeby nie trzeba bylo celowac
    // w "Wszystkie"
    else if (STANY.length === 1 && STANY[0] === s) STANY = WSZYSTKIE_STANY.slice();
    else STANY = [s];
    zapiszStany();
    rysujWszystko();
  });

  // Po schowaniu kart zostawaly same przyciski "dodaj cos tutaj" i naglowki
  // etapow — pusta lista napisow. Chowamy je razem z kartami.
  function posprzatajPoFiltrze() {
    var pelny = STANY.length === WSZYSTKIE_STANY.length;
    // Pusta wstawka ma sens tylko przy pelnej liscie, ale wstawka, w ktorej
    // ktos cos napisal, musi byc widoczna zawsze — inaczej uwaga znika razem
    // z nia i wyglada, jakby jej nie bylo.
    [].slice.call(document.querySelectorAll('.wst')).forEach(function (w) {
      var maUwage = !!w.querySelector('.uwLista .uwEl');
      w.classList.toggle('ukryty', !pelny && !maUwage);
    });
    // naglowek etapu znika, gdy pod nim nie zostala zadna karta
    [].slice.call(document.querySelectorAll('.sek h2:not(.dzial)')).forEach(function (h) {
      var el = h.nextElementSibling, widac = false;
      while (el && el.tagName !== 'H2') {
        if (el.classList && el.classList.contains('k') && !el.classList.contains('ukryty')) { widac = true; break; }
        el = el.nextElementSibling;
      }
      h.classList.toggle('ukryty', !widac);
    });
    // sekcja bez ani jednej karty mowi o tym wprost, zamiast swiecic pustka
    [].slice.call(document.querySelectorAll('.sek')).forEach(function (sek) {
      var wszystkieK = [].slice.call(sek.querySelectorAll('.k')).filter(function (k) {
        return !k.classList.contains('bezFiltru');
      });
      var kart = wszystkieK.length;
      var widocznych = wszystkieK.filter(function (k) {
        return !k.classList.contains('ukryty');
      }).length;
      var info = sek.querySelector('.pustoFiltr');
      if (kart && !widocznych) {
        if (!info) {
          info = document.createElement('p');
          info.className = 'pustoFiltr';
          sek.appendChild(info);
        }
        info.innerHTML = 'Nic tu nie pasuje do wybranych stanow. ' +
          '<button class="wrocStany">Pokaz wszystkie</button>';
      } else if (info) info.remove();
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.wrocStany')) return;
    STANY = WSZYSTKIE_STANY.slice();
    WYBRANA_SEKCJA = 'wszystkie';
    CZYTANIE = 'wszystkie';
    zapiszStany();
    try {
      localStorage.setItem(KLUCZ + ':czytanie', CZYTANIE);
      localStorage.setItem(KLUCZ + ':koszyk', WYBRANA_SEKCJA);
    } catch (err) {}
    rysujWszystko();
  });

  // ---- pulpit: tylko nasza wersja ----
  // Jedno miejsce, z ktorego widac, co sie pali: co wychodzi najblizej, co ona
  // odeslala do poprawki, co czeka na jej slowo i co napisala od ostatniego razu.
  function dataZDnia(d) {
    var m = String(d || '').match(/(\d{1,2})\.(\d{2})/);
    if (!m) return null;
    var dzien = +m[1], mies = +m[2];
    return new Date(2026, mies - 1, dzien);
  }
  function rysujPulpit() {
    var cel = document.getElementById('pulpit');
    if (!cel || !ZESPOL) return;
    var dzis = new Date(); dzis.setHours(0, 0, 0, 0);
    var pozycje = [].slice.call(document.querySelectorAll('.uw[data-tytul]'))
      .filter(function (u) { return !u.closest('.bezFiltru'); })
      .map(function (u) {
        var karta = u.closest('.k');
        var m = miejsceZPola(u);
        return {
          tytul: u.dataset.tytul,
          nazwa: m ? m.nazwa : u.dataset.tytul,
          data: m ? m.data : '',
          kiedy: dataZDnia(m ? m.data : ''),
          stan: statusPostu(u.dataset.tytul) || 'nowa',
          karta: karta,
        };
      });
    var licz = {};
    pozycje.forEach(function (p) { licz[p.stan] = (licz[p.stan] || 0) + 1; });

    // najblizsze publikacje, ktore jeszcze nie sa zatwierdzone
    var najblizsze = pozycje.filter(function (p) { return p.kiedy && p.kiedy >= dzis; })
      .sort(function (a, b) { return a.kiedy - b.kiedy; }).slice(0, 4);
    // przeterminowane: data minela, a stan nie jest zamkniety
    var spoznione = pozycje.filter(function (p) {
      return p.kiedy && p.kiedy < dzis && p.stan !== 'zrobione' && p.stan !== 'odrzucone';
    }).sort(function (a, b) { return a.kiedy - b.kiedy; });
    // co napisala od ostatniego zajrzenia
    var nowe = UWAGI.filter(jestNowa).filter(function (u) { return !jestZnacznikiem(u); });

    function kafel(tytul, wartosc, opis, klasa) {
      return '<div class="pKafel ' + (klasa || '') + '"><span class="pLiczba">' + wartosc + '</span>' +
        '<span class="pTytul">' + tytul + '</span>' +
        (opis ? '<span class="pOpis">' + opis + '</span>' : '') + '</div>';
    }
    function lista(poz, pusto) {
      if (!poz.length) return '<p class="pPusto">' + pusto + '</p>';
      return '<ul class="pLista">' + poz.map(function (p) {
        return '<li><button class="pSkok" data-idzie="' + esc(p.tytul) + '">' +
          '<span class="pData">' + esc(p.data || '') + '</span>' +
          '<span class="pNazwa">' + esc(p.nazwa) + '</span>' +
          '<span class="pStanMini ' + stanKlasa(p.stan) + '"><i></i>' + stanNazwa(p.stan) + '</span>' +
          '</button></li>';
      }).join('') + '</ul>';
    }

    cel.hidden = false;
    cel.innerHTML =
      '<div class="pGl"><h2>Pulpit</h2><span class="pDzis">' +
        dzis.toLocaleDateString('pl-PL', { weekday: 'long', day: '2-digit', month: 'long' }) + '</span></div>' +
      '<div class="pKafle">' +
        kafel('do poprawki', licz['poprawka'] || 0, 'ona odeslala', (licz['poprawka'] ? 'pilne' : '')) +
        kafel('czeka na jej zgode', licz['czeka'] || 0, 'po naszej stronie nic') +
        kafel('w robocie', licz['w robocie'] || 0, 'robimy teraz') +
        kafel('zatwierdzone', licz['zrobione'] || 0, 'mozna publikowac') +
        kafel('nowe od Ani', nowe.length, 'od ostatniego razu', (nowe.length ? 'pilne' : '')) +
      '</div>' +
      '<div class="pKol">' +
        '<div class="pBlok"><h3>Najblizsze publikacje</h3>' + lista(najblizsze, 'Nic nie stoi w kalendarzu.') + '</div>' +
        '<div class="pBlok"><h3>Termin minal, a pozycja otwarta</h3>' + lista(spoznione, 'Nic nie wisi.') + '</div>' +
      '</div>';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.pSkok') : null;
    if (!b) return;
    var cel = [].slice.call(document.querySelectorAll('.uw,.wst'))
      .filter(function (x) { return x.dataset.tytul === b.dataset.idzie; })[0];
    if (!cel) return;
    var sek = cel.closest('.sek');
    if (sek) pokazSekcje(sek.id.replace('sek-', ''));
    setTimeout(function () {
      var karta = cel.closest('.k') || cel;
      karta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      karta.classList.add('blysk'); karta.classList.add('otw');
      setTimeout(function () { karta.classList.remove('blysk'); }, 1600);
    }, 120);
  });

  function rysujWszystko() { INDEKS = null; rysujPrzyPostach(); rysujTabele(); rysujStatusyPostow(); odswiezLicznik(); rysujPasekStanow(); posprzatajPoFiltrze(); rysujPulpit(); }
  // pelne przerysowanie raz na klatke: klikniecie odpowiada natychmiast,
  // a trzy kolejne wywolania z jednego lancucha zlewaja sie w jedno
  var CZEKA_RYS = false;
  function przerysuj() {
    setTimeout(dodajPrzyciskiPlikow, 0);
    setTimeout(dociagnijZalaczniki, 0);
    if (CZEKA_RYS) return;
    CZEKA_RYS = true;
    (window.requestAnimationFrame || function (f) { setTimeout(f, 16); })(function () {
      CZEKA_RYS = false;
      rysujWszystko();
    });
  }
  // natychmiastowy slad klikniecia, zanim dojdzie do pelnego przerysowania
  function odMaluj(b) {
    var rodzic = b.parentNode;
    if (!rodzic) return;
    var bracia = rodzic.querySelectorAll("button.st, button.pst");
    for (var i = 0; i < bracia.length; i++) bracia[i].classList.remove("akt");
    b.classList.add("akt");
  }

  // Stan uwagi w koszyku wybieramy z listy rozwijanej, nie szescioma
  // przyciskami przy kazdej uwadze — wczesniej ta sama lista powtarzala sie
  // tyle razy, ile bylo uwag pod postem.
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (!s || !s.classList || !s.classList.contains('stSel')) return;
    var el = s.closest('.uwEl');
    if (!el) return;
    var nr = +el.dataset.nr;
    var nowyStan = s.value;
    var u2 = UWAGI.filter(function (x) { return x.nr === nr; })[0];
    if (u2) u2.status = nowyStan;
    zapamietajStan(nr, nowyStan);
    zgraj(u2 ? u2.pozycja : '', null);
    doArkusza({ akcja: 'status', nr: nr, status: nowyStan });
  });

  // ---- akcje na uwagach ----
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.mini') : null;
    if (!b) return;
    var el = b.closest('.uwEl');
    if (!el) return;
    var nr = +el.dataset.nr;
    var u = UWAGI.filter(function (x) { return x.nr === nr; })[0];
    if (!u) return;

    if (b.classList.contains('edy')) {
      // poprawianie wprost w koszyku, bez okienka przegladarki —
      // okienko potrafi byc zablokowane i wtedy nic sie nie dzieje
      if (el.querySelector('.odpBox')) { el.querySelector('.odpBox').remove(); return; }
      var boxE = document.createElement('div');
      boxE.className = 'odpBox';
      boxE.innerHTML = '<textarea placeholder="Popraw swoja uwage..."></textarea>' +
        '<div class="odpAkc"><button class="mini zapE">Zapisz zmiane</button>' +
        '<button class="mini anu">Anuluj</button></div>';
      el.appendChild(boxE);
      var taE = boxE.querySelector('textarea');
      taE.value = u.uwaga || '';
      taE.focus();
      boxE.querySelector('.anu').addEventListener('click', function () { boxE.remove(); });
      boxE.querySelector('.zapE').addEventListener('click', function () {
        var nowy = taE.value.trim();
        boxE.remove();
        odRazu(nr, { uwaga: nowy }, { akcja: 'edytuj', nr: nr, ocena: u.ocena, uwaga: nowy });
      });
    } else if (b.classList.contains('cof')) {
      if (el.querySelector('.odpBox')) { el.querySelector('.odpBox').remove(); return; }
      var boxC = document.createElement('div');
      boxC.className = 'odpBox';
      boxC.innerHTML = '<div class="pytanie">Usunac te uwage? Zniknie z listy u obu stron.</div>' +
        '<div class="odpAkc"><button class="mini cofT">Tak, usun</button>' +
        '<button class="mini anu">Zostaw</button></div>';
      el.appendChild(boxC);
      boxC.querySelector('.anu').addEventListener('click', function () { boxC.remove(); });
      boxC.querySelector('.cofT').addEventListener('click', function () {
        boxC.remove();
        odRazu(nr, { status: 'cofnieta' }, { akcja: 'usun', nr: nr });
      });
    } else if (b.classList.contains('st')) {
      // zmiana przy pojedynczej uwadze podciaga za soba stan calego postu
      var nowyStan = b.dataset.st;
      odMaluj(b);
      var u2 = UWAGI.filter(function (x) { return x.nr === nr; })[0];
      if (u2) u2.status = nowyStan;
      zapamietajStan(nr, nowyStan);
      // stan calego postu podciagamy OD RAZU, nie po odpowiedzi arkusza —
      // dzieki temu koszyk i glowna lista zmieniaja sie w tej samej chwili
      zgraj(u2 ? u2.pozycja : '', null);
      doArkusza({ akcja: 'status', nr: nr, status: nowyStan });
    } else if (b.classList.contains('odp')) {
      if (el.querySelector('.odpBox')) { el.querySelector('.odpBox').remove(); return; }
      var box = document.createElement('div');
      box.className = 'odpBox';
      box.innerHTML = '<textarea placeholder="Napisz odpowiedz dla Ani..."></textarea>' +
        '<div class="odpAkc"><button class="mini zap2">Zapisz odpowiedz</button>' +
        '<button class="mini anu">Anuluj</button></div>';
      el.appendChild(box);
      var ta = box.querySelector('textarea');
      ta.value = u.odpowiedz || '';
      ta.focus();
      box.querySelector('.anu').addEventListener('click', function () { box.remove(); });
      box.querySelector('.zap2').addEventListener('click', function () {
        var o = ta.value.trim();
        var st = u.status === 'zrobione' ? 'zrobione' : (u.status || 'w robocie');
        box.remove();
        odRazu(nr, { odpowiedz: o, status: st }, { akcja: 'status', nr: nr, status: st, odpowiedz: o });
      });
    }
  });

  // Ania zatwierdza poprawiony post
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.zatw') : null;
    if (!b) return;
    // zawsze klikalne — moze zatwierdzic, potem sie rozmyslic i znow zatwierdzic
    zgraj(b.dataset.tytul, 'zrobione');
  });

  // Jeden stan na post. Zmiana z gory schodzi na wszystkie jego uwagi,
  // zmiana przy uwadze podnosi sie do postu. Zeby nigdy nie bylo dwoch roznych kolorow.
  function zgraj(tytul, wymuszony) {
    if (!tytul) { przerysuj(); return Promise.resolve(); }
    // Zeszyt pomyslow nie jest pozycja planu: nie ma stanu, wiec nie zakladamy
    // mu znacznika. Inaczej kazdy zapisany pomysl rodzil wiersz "STATUS POSTU",
    // ktory potem swiecil jako nieprzeczytany przy zakladce.
    if (/^\[pomysly\]/i.test(tytul)) { przerysuj(); return Promise.resolve(); }
    var moje = dla(tytul);
    var cel = wymuszony;
    if (!cel) {                       // bez wymuszenia bierzemy najmniej zaawansowana uwage
      var naj = 9;
      moje.forEach(function (u) { naj = Math.min(naj, PORZ[u.status] || 0); });
      cel = moje.length ? KOLEJ_ST[naj] : null;
    }
    var kolejka = [];
    if (wymuszony) {
      moje.forEach(function (u) {
        if (u.status !== cel) { u.status = cel; zapamietajStan(u.nr, cel); kolejka.push({ akcja: 'status', nr: u.nr, status: cel }); }
      });
    }
    var wszystkieZn = znacznikiPostu(tytul);
    var zn = wszystkieZn[wszystkieZn.length - 1];
    if (cel) {
      if (zn) {
        // wszystkie znaczniki tego postu ida na ten sam stan, zeby dublet
        // z arkusza nie ciagnal posta z powrotem
        wszystkieZn.forEach(function (z) {
          if (z.status !== cel) { z.status = cel; zapamietajStan(z.nr, cel); kolejka.push({ akcja: 'status', nr: z.nr, status: cel }); }
        });
      } else {
        UWAGI.push({ nr: -1, czas: '', pozycja: tytul, ocena: ZNACZNIK, uwaga: '', status: cel, odpowiedz: '', kto: 'ZOVU' });
        kolejka.push({ akcja: 'dodaj', pozycja: tytul, ocena: ZNACZNIK, uwaga: '', status: cel, kto: 'ZOVU', doStatusu: cel });
      }
    }
    przerysuj();
    kolejka.forEach(function (z) {
      var doSt = z.doStatusu; delete z.doStatusu;
      doArkusza(z, doSt ? function (j) {
        // arkusz przy dodawaniu i tak zapisuje "nowa", wiec poprawiamy swiezy wiersz
        if (!j || !j.ok) return;
        var swiezy = (j.uwagi || []).filter(function (u) {
          return u.ocena === ZNACZNIK && pasuje(u.pozycja, tytul) && u.status !== 'cofnieta';
        }).pop();
        if (swiezy && swiezy.status !== doSt) doArkusza({ akcja: 'status', nr: swiezy.nr, status: doSt });
      } : null);
    });
    return Promise.resolve();
  }

  // stan pozycji, przy ktorej nie ma zadnej uwagi
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (!s || !s.classList || !s.classList.contains('pstSel')) return;
    zgraj(s.dataset.tytul, s.value)['catch'](function () { pobierz().then(przerysuj); });
  });

  // klik w przycisk gotowosci calego postu
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button.pst') : null;
    if (!b) return;
    var tytul = b.dataset.tytul, nowy = b.dataset.st;
    odMaluj(b);
    zgraj(tytul, nowy)['catch'](function () { pobierz().then(przerysuj); });
    return;
  });


  // przelaczanie koszykow w szufladzie
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.szF[data-sekcja]') : null;
    if (!b) return;
    WYBRANA_SEKCJA = b.dataset.sekcja;
    try { localStorage.setItem(KLUCZ + ':koszyk', WYBRANA_SEKCJA); } catch (err) {}
    rysujTabele();
  });

  // przelaczanie: wszystkie / nowe / przeczytane
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.szF[data-czyt]') : null;
    if (!b) return;
    CZYTANIE = b.dataset.czyt;
    try { localStorage.setItem(KLUCZ + ':czytanie', CZYTANIE); } catch (err) {}
    rysujTabele();
  });

  // klik w nazwe pozycji: zamykamy szuflade i skaczemy do tego miejsca
  document.addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('.uwGdzie[data-idzie], .grGl[data-idzie]') : null;
    if (!g) return;
    var tytul = g.dataset.idzie;
    var cel = [].slice.call(document.querySelectorAll('.uw,.wst'))
      .filter(function (x) { return x.dataset.tytul === tytul; })[0];
    if (!cel) return;
    otworzSz(false);
    var sek = cel.closest('.sek');
    if (sek) pokazSekcje(sek.id.replace('sek-', ''));
    setTimeout(function () {
      var karta = cel.closest('.k') || cel;
      karta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      karta.classList.add('blysk'); karta.classList.add('otw');
      setTimeout(function () { karta.classList.remove('blysk'); }, 1600);
    }, 120);
  });

  // ---- zakladki ----
  function pokazSekcje(id) {
    // "Wszystko" pokazuje wszystkie zakladki naraz, jedna pod druga
    var caloscOtwarta = id === 'wszystko';
    [].slice.call(document.querySelectorAll('.sek')).forEach(function (s) {
      s.hidden = caloscOtwarta ? false : s.id !== 'sek-' + id;
    });
    if (caloscOtwarta) {
      [].slice.call(document.querySelectorAll('.naw .zak')).forEach(function (b) {
        b.classList.toggle('akt', b.dataset.sek === 'wszystko');
      });
      try { localStorage.setItem(KLUCZ + ':zak', id); } catch (e) {}
      return;
    }
    [].slice.call(document.querySelectorAll('.naw .zak')).forEach(function (b) {
      b.classList.toggle('akt', b.dataset.sek === id);
    });
    try { localStorage.setItem(KLUCZ + ':zak', id); } catch (e) {}
  }
  [].slice.call(document.querySelectorAll('.naw .zak')).forEach(function (b) {
    b.addEventListener('click', function () { pokazSekcje(b.dataset.sek); window.scrollTo(0, 0); });
  });
  try {
    var z = localStorage.getItem(KLUCZ + ':zak');
    if (z === 'wszystko' || (z && document.getElementById('sek-' + z))) pokazSekcje(z);
  } catch (e) {}

  [].slice.call(document.querySelectorAll('.siatka .sk')).forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var cel = document.getElementById(a.dataset.go);
      var sekS = cel && cel.closest('.sek'); pokazSekcje(sekS ? sekS.id.replace('sek-', '') : 'posty'); if (cel) cel.classList.add('otw');
      if (cel) setTimeout(function () { cel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
    });
  });

  function doKotwicy() {
    var h = (location.hash || '').replace('#', '');
    if (!h) return;
    var cel = document.getElementById(h);
    if (!cel) return;
    if (cel.classList) cel.classList.add('otw');
    var sek = cel.closest ? cel.closest('.sek') : null;
    if (sek) pokazSekcje(sek.id.replace('sek-', ''));
    setTimeout(function () { cel.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
  }

  // ---- pisanie nowej uwagi ----
  var szkic = {};
  try { szkic = JSON.parse(localStorage.getItem(KLUCZ + ':szkic') || '{}'); } catch (e) {}
  function zapiszSzkic() { try { localStorage.setItem(KLUCZ + ':szkic', JSON.stringify(szkic)); } catch (e) {} }

  // Niedokonczony tekst lezy w tej przegladarce i przezywa zamkniecie karty
  // czy zgasniecie komputera. Ale dopiero "Zapisz uwage" wysyla go do nas,
  // wiec musi byc widac, ze to jeszcze szkic.
  function pokazSzkic(u) {
    var ta = u.querySelector('textarea');
    if (!ta) return;
    var pasek = u.querySelector('.szkicI');
    var jest = !!(ta.value || '').trim();
    if (!jest) { if (pasek) pasek.remove(); return; }
    if (!pasek) {
      pasek = document.createElement('div');
      pasek.className = 'szkicI';
      var stopka = u.querySelector('.uwStopka');
      if (stopka) u.insertBefore(pasek, stopka); else u.appendChild(pasek);
    }
    pasek.textContent = szkic[u.dataset.id] && szkic[u.dataset.id].nr
      ? 'Zapisane automatycznie — druga strona juz to widzi.'
      : 'Zapisuje sie samo za chwile...';
  }

  // AUTOZAPIS. Tekst dociera do drugiej strony sam, bez klikania "Zapisz" —
  // wystarczy przestac pisac na kilka sekund. Pierwszy raz zaklada wiersz,
  // kazdy nastepny poprawia ten sam, zeby nie robic dziesieciu kopii.
  var ZEGARY = {};
  function zaplanujAutozapis(u) {
    var id = u.dataset.id;
    if (ZEGARY[id]) clearTimeout(ZEGARY[id]);
    // Ania: "powinny sie same zapisywac co dluzszy odstep bo tak to zapisuje
    // to samo, jesli ktos powoli pisze". Szesc sekund bylo za krotko.
    ZEGARY[id] = setTimeout(function () { autozapis(u); }, 15000);
  }
  function autozapis(u) {
    var id = u.dataset.id;
    var ta = u.querySelector('textarea');
    var tekst = ((ta && ta.value) || '').trim();
    var s = szkic[id];
    if (!tekst || !s) return;
    // Jak Ania cos pisze przy poscie, to znaczy, ze cos jest do zmiany. Post
    // od razu idzie na "do poprawki", zeby nie lezal u nas jako zamkniety.
    // Odpuszczamy tylko wtedy, gdy przy tym samym pisaniu sama klilnela
    // decyzje nad postem — wtedy jej wybor jest wazniejszy.
    // Uwaga: nie patrzymy na obecny stan postu. Post zatwierdzony przez NAS
    // tez ma wrocic do poprawki, bo wlasnie o tym jest jej nowa uwaga.
    if (!ZESPOL && !s.ocena && !s.oznaczone) {
      s.oznaczone = 1; zapiszSzkic();
      zgraj(u.dataset.tytul, 'poprawka');
    }
    var ocena = zDecyzji(u.dataset.tytul);
    if (s.nr) {
      doArkusza({ akcja: 'edytuj', nr: s.nr, ocena: ocena, uwaga: tekst });
      pokazSzkic(u);
      return;
    }
    if (s.wysylam) return;
    s.wysylam = true;
    doArkusza({
      akcja: 'dodaj', pozycja: u.dataset.tytul, ocena: ocena, uwaga: tekst,
      kto: ZESPOL ? 'ZOVU' : 'Ania',
    }, function (j) {
      s.wysylam = false;
      if (!j || !j.ok) return;
      var swiezy = (j.uwagi || []).filter(function (x) {
        return x.uwaga === tekst && pasuje(x.pozycja, u.dataset.tytul) && x.status !== 'cofnieta';
      }).pop();
      if (swiezy) { s.nr = swiezy.nr; zapiszSzkic(); pokazSzkic(u); }
    });
  }

  // ostrzezenie przy zamykaniu karty, gdy cos jest napisane a niezapisane
  window.addEventListener('beforeunload', function (e) {
    var cos = Object.keys(szkic).some(function (k) { return (szkic[k].tekst || '').trim(); });
    if (!cos) return;
    e.preventDefault();
    e.returnValue = '';
  });

  var pola = [].slice.call(document.querySelectorAll('.uw')).concat([].slice.call(document.querySelectorAll('.wst')));
  pola.forEach(function (u, n) {
    if (!u.dataset.id) u.dataset.id = 'wst-' + n;
    var id = u.dataset.id;
    var ta = u.querySelector('textarea');
    var s = szkic[id] || {};
    if (s.tekst) { ta.value = s.tekst; if (u.classList.contains('wst')) u.classList.add('otw'); }
    if (s.ocena) {
      var bb = u.querySelector('button[data-st="' + s.ocena + '"]');
      if (bb) bb.classList.add('akt');
    }
    u.querySelectorAll('.uwbtn button').forEach(function (b) {
      b.addEventListener('click', function () {
        var byl = b.classList.contains('akt');
        u.querySelectorAll('.uwbtn button').forEach(function (x) { x.classList.remove('akt'); });
        if (!byl) b.classList.add('akt');
        szkic[id] = { ocena: byl ? '' : b.dataset.st, tekst: ta.value };
        zapiszSzkic(); odswiezLicznik();
      });
    });
    ta.addEventListener('input', function () {
      var akt = u.querySelector('.uwbtn button.akt');
      // Wczesniej kazde nacisniecie klawisza podmienialo caly szkic i gubilo
      // numer juz zapisanego wiersza oraz znacznik "wlasnie wysylam". Przy wolnym
      // pisaniu autozapis zdazyl wystartowac, tekst leciał dalej, a druga proba
      // zakladala NOWY wiersz — i ta sama uwaga stala w arkuszu dwa razy.
      var byl = szkic[id] || {};
      szkic[id] = {
        ocena: akt ? akt.dataset.st : '',
        tekst: ta.value,
        nr: byl.nr,
        wysylam: byl.wysylam,
        oznaczone: byl.oznaczone,
      };
      zapiszSzkic(); odswiezLicznik(); pokazSzkic(u); zaplanujAutozapis(u);
    });
    pokazSzkic(u);
    var przyc = u.querySelector('.wstB');
    if (przyc) przyc.addEventListener('click', function () { u.classList.toggle('otw'); if (u.classList.contains('otw')) ta.focus(); });
  });

  // ---- ile nowego od drugiej strony ----
  // Czerwona kropka na koszyku: tyle pozycji zmienila druga strona, odkad
  // ostatnio tu zagladalismy. My liczymy zmiany Ani, ona nasze.
  var OBCY = ZESPOL ? 'Ania' : 'ZOVU';
  var WIDZIANE = {};
  try { WIDZIANE = JSON.parse(localStorage.getItem(KLUCZ + ':widziane') || '{}'); } catch (e) {}
  function zapiszWidziane() {
    try { localStorage.setItem(KLUCZ + ':widziane', JSON.stringify(WIDZIANE)); } catch (e) {}
  }
  function jestNowa(u) {
    // sam znacznik stanu nie jest wiadomoscia — nie ma czego czytac
    return u.status !== 'cofnieta' && !jestZnacznikiem(u) && u.ktoZmienil === OBCY &&
      !!u.zmieniono && WIDZIANE[u.nr] !== u.zmieniono;
  }
  function noweOdNich() { return UWAGI.filter(jestNowa); }
  function odswiezNowosci() {
    var ile = noweOdNich().length;
    var kropka = document.getElementById('nowosci');
    if (!kropka) {
      var kosz = document.getElementById('koszyk');
      if (!kosz) return;
      kropka = document.createElement('b');
      kropka.id = 'nowosci';
      kosz.appendChild(kropka);
    }
    kropka.textContent = ile > 99 ? '99+' : ile;
    kropka.hidden = ile === 0;
    var kosz2 = document.getElementById('koszyk');
    if (kosz2) kosz2.classList.toggle('maNowe', ile > 0);
    kropka.title = ile ? ile + ' nowych zmian od drugiej strony' : '';
  }
  function odhaczNowosci() {
    noweOdNich().forEach(function (u) { WIDZIANE[u.nr] = u.zmieniono; });
    zapiszWidziane();
    odswiezNowosci();
    przerysuj();
  }

  // Czerwone liczby przy zakladkach: ile nowego czeka w Feedzie, w Postach,
  // w Stories i tak dalej — zeby nie trzeba bylo chodzic po wszystkich.
  function odswiezZakladki() {
    var ile = {};
    noweOdNich().forEach(function (u) {
      var m = miejsceDla(u.pozycja);
      var s = m ? m.sekcja : 'inne';
      ile[s] = (ile[s] || 0) + 1;
    });
    [].slice.call(document.querySelectorAll('.naw .zak[data-sek]')).forEach(function (z) {
      var n = ile[z.dataset.sek] || 0;
      var b = z.querySelector('.zakNowe');
      if (!n) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('span');
        b.className = 'zakNowe';
        z.appendChild(b);
      }
      b.textContent = n;
    });
  }

  function odswiezLicznik() {
    odswiezNowosci();
    odswiezZakladki();
    var otwarte = UWAGI.filter(function (u) {
      return u.status !== 'cofnieta' && u.status !== 'zrobione' && !jestZnacznikiem(u) && (u.uwaga || u.ocena);
    }).length;
    var k = document.getElementById('koszykLicz');
    if (k) { k.textContent = otwarte; k.classList.toggle('pusto', otwarte === 0); }
  }

  function etykieta(o) { return o === 'ok' ? 'Jest ok' : (o === 'zmiana' ? 'Do poprawki' : ''); }
  // co Ania wybrala nad postem — to trafia do arkusza razem z jej tekstem
  function zDecyzji(tytul) {
    var st = statusPostu(tytul);
    if (st === 'zrobione') return 'Jest ok';
    if (st === 'poprawka') return 'Do poprawki';
    if (st === 'odrzucone') return 'Nie, rezygnujemy';
    return '';
  }

  // zapis jednej uwagi, od razu
  [].slice.call(document.querySelectorAll('.zapisz')).forEach(function (b) {
    b.addEventListener('click', function () {
      var u = b.closest('.uw') || b.closest('.wst');
      if (!u) return;
      var ta = u.querySelector('textarea');
      var akt = u.querySelector('.uwbtn button.akt');
      var tekst = (ta.value || '').trim();
      if (!akt && !tekst) { ta.focus(); return; }
      // ocena bierze sie z decyzji nad postem, a nie z osobnych przyciskow
      if (!ZESPOL && !akt && tekst) zgraj(u.dataset.tytul, 'poprawka');
      var ocenaZDecyzji = akt ? etykieta(akt.dataset.st) : zDecyzji(u.dataset.tytul);
      var zap = u.querySelector('.zap');
      var byly = szkic[u.dataset.id] || {};
      if (ZEGARY[u.dataset.id]) clearTimeout(ZEGARY[u.dataset.id]);
      b.disabled = true; b.textContent = 'Zapisuje...';
      wyslij(byly.nr
        ? { akcja: 'edytuj', nr: byly.nr, ocena: ocenaZDecyzji, uwaga: tekst }
        : { akcja: 'dodaj', pozycja: u.dataset.tytul, ocena: ocenaZDecyzji, uwaga: tekst,
            kto: ZESPOL ? 'ZOVU' : 'Ania' }).then(function () {
        ta.value = '';
        u.querySelectorAll('.uwbtn button').forEach(function (x) { x.classList.remove('akt'); });
        delete szkic[u.dataset.id]; zapiszSzkic(); pokazSzkic(u);
        if (zap) { zap.textContent = 'Zapisane ✓'; zap.classList.add('jest'); setTimeout(function () { zap.classList.remove('jest'); }, 4000); }
        b.disabled = false; b.textContent = b.closest('.wst') ? 'Zapisz' : 'Zapisz uwage';
      })['catch'](function () {
        b.disabled = false; b.textContent = 'Sprobuj jeszcze raz';
      });
    });
  });

  // ---- szuflada z uwagami, jak koszyk ----
  var szuf = document.getElementById('szuflada');
  var zasl = document.getElementById('zaslona');
  function otworzSz(tak) {
    if (!szuf) return;
    szuf.classList.toggle('otw', tak);
    zasl.classList.toggle('otw', tak);
    szuf.setAttribute('aria-hidden', tak ? 'false' : 'true');
    document.body.style.overflow = tak ? 'hidden' : '';
    // zajrzeliśmy do koszyka — czerwona kropka gasnie
    if (!tak) odhaczNowosci();
  }
  var kosz = document.getElementById('koszyk');
  if (kosz) kosz.addEventListener('click', function () { otworzSz(true); });
  var zamk = document.getElementById('zamknijSz');
  if (zamk) zamk.addEventListener('click', function () { otworzSz(false); });
  if (zasl) zasl.addEventListener('click', function () { otworzSz(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') otworzSz(false); });

  // ---- zalaczniki ----
  // Ania pisala, ze czasem chce cos zaznaczyc, a nie opisywac slowami — dotad
  // robila zdjecie ekranu telefonem. Teraz wrzuca plik wprost tutaj: zdjecie
  // jedzie na Dysk, a w tresci uwagi zostaje odnosnik, ktory strona pokazuje
  // juz jako obrazek. Zmniejszamy przed wyslaniem, zeby telefon nie czekal
  // po minucie na kazde zdjecie z aparatu.
  function zmniejsz(plik, max) {
    return new Promise(function (gotowe, zle) {
      var fr = new FileReader();
      fr.onerror = zle;
      fr.onload = function () {
        var im = new Image();
        im.onerror = zle;
        im.onload = function () {
          var s = Math.min(1, max / Math.max(im.width, im.height));
          var pl = document.createElement('canvas');
          pl.width = Math.round(im.width * s);
          pl.height = Math.round(im.height * s);
          pl.getContext('2d').drawImage(im, 0, 0, pl.width, pl.height);
          gotowe(pl.toDataURL('image/jpeg', 0.82).split(',')[1]);
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(plik);
    });
  }

  // Dopoki most nie umie przyjac pliku, przycisku nie ma wcale — lepiej niz
  // martwy przycisk, ktory odpowiada bledem. Wlaczy sie sam po aktualizacji mostu.
  var MOST_UMIE_PLIKI = false;
  function dodajPrzyciskiPlikow() {
    if (!MOST_UMIE_PLIKI) return;
    [].slice.call(document.querySelectorAll('.uwStopka')).forEach(function (st) {
      if (st.querySelector('.plikB')) return;
      var l = document.createElement('label');
      l.className = 'plikB';
      l.innerHTML = '+ dodaj plik<input type="file" accept="image/*" hidden>';
      var zn = st.querySelector('.zap');
      if (zn) st.insertBefore(l, zn); else st.appendChild(l);
    });
  }

  document.addEventListener('change', function (e) {
    var we = e.target;
    if (!we || we.type !== 'file' || !we.closest('.plikB')) return;
    var plik = we.files && we.files[0];
    if (!plik) return;
    var stopka = we.closest('.uwStopka');
    var pole = stopka.parentNode.querySelector('textarea');
    var znak = stopka.querySelector('.zap');
    var napis = we.closest('.plikB').childNodes[0];
    napis.nodeValue = 'wgrywam…';
    zmniejsz(plik, 1600).then(function (dane) {
      return wyslijCicho({ akcja: 'plik', dane: dane, typ: 'image/jpeg', nazwa: plik.name });
    }).then(function (j) {
      napis.nodeValue = '+ dodaj plik';
      we.value = '';
      if (!j || !j.ok || !j.znacznik) { if (znak) znak.textContent = 'nie udalo sie wgrac'; return; }
      if (pole) {
        pole.value = (pole.value ? pole.value.replace(/\s+$/, '') + '\n' : '') + j.znacznik;
        pole.dispatchEvent(new Event('input', { bubbles: true }));
        pole.focus();
      }
      if (znak) {
        znak.textContent = 'plik dodany';
        setTimeout(function () { if (znak.textContent === 'plik dodany') znak.textContent = ''; }, 2500);
      }
    })['catch'](function () {
      napis.nodeValue = '+ dodaj plik';
      we.value = '';
      if (znak) znak.textContent = 'nie udalo sie wgrac';
    });
  });

  // ---- lupa ----
  // Przy otwartym zdjeciu strona pod spodem nie przewija sie, zeby po zamknieciu
  // wrocic dokladnie w to samo miejsce. Zamyka sie krzyzykiem, klikiem w tlo
  // albo Escape.
  var lupa = document.getElementById('lupa');
  var lupaY = 0;
  function otworzLupe(src) {
    if (!lupa) return;
    lupaY = window.pageYOffset || document.documentElement.scrollTop || 0;
    lupa.querySelector('img').src = src;
    lupa.style.display = 'flex';
    document.body.classList.add('bezScrolla');
    document.body.style.top = '-' + lupaY + 'px';
  }
  function zamknijLupe() {
    if (!lupa || lupa.style.display === 'none' || !lupa.style.display) return;
    lupa.style.display = 'none';
    document.body.classList.remove('bezScrolla');
    document.body.style.top = '';
    window.scrollTo(0, lupaY);
  }
  document.addEventListener('click', function (e) {
    var i = e.target;
    if (i.tagName === 'IMG' && i.classList.contains('zal')) { otworzLupe(i.src); return; }
    // Miniatury w koszyku i na listach tez maja sie powiekszac — wczesniej lupa
    // lapala tylko kadry na kartach, a w koszyku klikniecie nie robilo nic.
    if (i.tagName === 'IMG' && !i.closest('#lupa') && /\/kadry\//.test(i.src)) {
      // Duzy kadr bierzemy z adresu miniatury (m-...), a nie z atrybutu — atrybut
      // jest wzgledny wobec katalogu strony i w panelu (/zovu/) prowadzil donikad.
      otworzLupe(i.src.replace('/kadry/m-', '/kadry/'));
    }
  });
  if (lupa) lupa.addEventListener('click', function (e) {
    // klik w samo zdjecie nie zamyka, zeby dalo sie je obejrzec spokojnie
    if (e.target.tagName === 'IMG') return;
    zamknijLupe();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zamknijLupe(); });

  // ---- start ----
  // Most do arkusza potrafi odpowiadac i minute (Google budzi skrypt). Do tego
  // czasu strona stala bez stanow, bez pasku i z zerem przy koszyku, jakby nic
  // nie dzialalo. Dlatego przy kazdej udanej odpowiedzi chowamy dane u siebie
  // i przy nastepnym wejsciu pokazujemy je od razu, a swieze podmieniamy, gdy
  // most odpowie.
  (function () {
    try {
      var z = JSON.parse(localStorage.getItem(KLUCZ + ':dane') || 'null');
      if (z && z.length) { UWAGI = z; INDEKS = null; rysujWszystko(); }
    } catch (e) {}
  })();
  odswiezLicznik();
  pobierz().then(function () {
    try { localStorage.setItem(KLUCZ + ':dane', JSON.stringify(UWAGI)); } catch (e) {}
    rysujWszystko(); doKotwicy();
  });
  // ---- na zywo u wszystkich ----
  // Strona sama dociaga zmiany z arkusza: czesto, kiedy karta jest przed oczami,
  // rzadko kiedy stoi w tle. Dzieki temu Ania widzi nasza zmiane, a my jej,
  // bez odswiezania — i bez zajezdzania arkusza pytaniami przez cala dobe.
  // Trzy biegi zamiast jednego: szybko, kiedy ktos naprawde pracuje na stronie,
  // wolniej kiedy tylko ja ma otwarta, najwolniej w tle. Arkusz Google ma dzienny
  // limit czasu pracy — stale 3 sekundy przez caly dzien wyczerpalyby go do wieczora
  // i most przestalby odpowiadac wszystkim.
  // Zahar: ma sie odswiezac natychmiast, bez zwalniania.
  var PRZY_PRACY = 2000, OTWARTA = 2000, W_TLE = 30000;
  var OSTATNI_RUCH = Date.now();
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach(function (z) {
    window.addEventListener(z, function () { OSTATNI_RUCH = Date.now(); }, { passive: true });
  });
  var TYKANIE = null, OBECNY_BIEG = null;
  function jakiBieg() {
    if (document.hidden) return W_TLE;
    return (Date.now() - OSTATNI_RUCH < 90000) ? PRZY_PRACY : OTWARTA;
  }
  function naZywo() {
    var co = jakiBieg();
    if (co === OBECNY_BIEG && TYKANIE) return;
    OBECNY_BIEG = co;
    if (TYKANIE) clearInterval(TYKANIE);
    TYKANIE = setInterval(function () {
      naZywo();                                  // bieg moze sie w miedzyczasie zmienic
      if (JEDZIE || KOLEJKA.length) return;      // w trakcie zapisu nie przeszkadzamy
      pobierz().then(function () { przerysuj(); pokazOdswiezenie(); });
    }, co);
  }
  function pokazOdswiezenie() {
    var e = document.getElementById('zywo');
    if (!e) return;
    var d = new Date();
    e.textContent = 'na zywo, ostatnio ' +
      ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  document.addEventListener('visibilitychange', function () {
    naZywo();
    // wracasz do karty — od razu swieze dane, bez czekania na nastepne tykniecie
    if (!document.hidden) pobierz().then(function () { przerysuj(); pokazOdswiezenie(); });
  });
  window.addEventListener('focus', function () {
    if (JEDZIE || KOLEJKA.length) return;
    pobierz().then(function () { przerysuj(); pokazOdswiezenie(); });
  });
  // Sam plan (posty, kadry, teksty) jest wpieczony w strone przy budowaniu.
  // Zeby nikt nie siedzial na starej wersji, strona pilnuje znacznika wersji
  // i sama sie przeladowuje — ale nigdy w trakcie pisania uwagi.
  var MOJA_WERSJA = '__WERSJA__';
  function czyNowaWersja() {
    fetch('wersja.txt?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (w) {
        w = (w || '').trim();
        if (!w || w === MOJA_WERSJA) return;
        var piszeCos = Object.keys(szkic).some(function (k) {
          return (szkic[k].tekst || '').trim();
        });
        if (piszeCos || JEDZIE || KOLEJKA.length) { pokazNowaWersje(); return; }
        location.reload();
      })
      ['catch'](function () {});
  }
  function pokazNowaWersje() {
    if (document.getElementById('nowaW')) return;
    var d = document.createElement('div');
    d.id = 'nowaW';
    d.innerHTML = 'Jest nowsza wersja planu. <button id="wczytajW">Wczytaj</button>';
    document.body.appendChild(d);
    document.getElementById('wczytajW').addEventListener('click', function () { location.reload(); });
  }
  setInterval(czyNowaWersja, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) czyNowaWersja(); });
  // Sam adres strony przegladarka trzyma w pamieci dziesiec minut (tak ustawia
  // GitHub Pages), wiec po wejsciu z zakladki dalo sie ogladac wczorajsza wersje
  // i nie bylo tego po czym poznac. Sprawdzamy znacznik od razu po otwarciu
  // i potem co minute.
  setTimeout(czyNowaWersja, 1200);
  setInterval(czyNowaWersja, 60000);

  // ---- strzalka na gore ----
  // Strony sa dlugie, a zakladki siedza na samej gorze.
  var gora = document.getElementById('naGore');
  if (gora) {
    gora.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    var pokazGore = function () { gora.hidden = window.scrollY < 600; };
    window.addEventListener('scroll', pokazGore, { passive: true });
    pokazGore();
  }

  naZywo();
})();

// ---- telefon: karty zwiniete do jednej linii, skroty na gorze planu (05.10) ----
document.addEventListener('click', function (e) {
  var r = e.target.closest ? e.target.closest('a.rz[data-go]') : null;
  if (r) {
    e.preventDefault();
    var cel = document.getElementById(r.dataset.go);
    if (!cel) return;
    var sek = cel.closest('.sek');
    [].slice.call(document.querySelectorAll('.sek')).forEach(function (s) { s.hidden = s !== sek; });
    [].slice.call(document.querySelectorAll('.naw .zak')).forEach(function (b) { b.classList.toggle('akt', sek && b.dataset.sek === sek.id.replace('sek-', '')); });
    cel.classList.add('otw');
    setTimeout(function () { cel.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return;
  }
  var gl = e.target.closest ? e.target.closest('.k.zw > .gl') : null;
  if (!gl || e.target.closest('button,a,input,textarea,select')) return;
  gl.parentNode.classList.toggle('otw');
});
// "Czeka na Twoje ok" liczy sie na zywo: co Ania juz zatwierdzila albo odrzucila, znika z listy
setInterval(function () {
  var blok = document.querySelector('.skrB');
  if (!blok) return;
  var n = 0;
  [].slice.call(blok.querySelectorAll('a.rz[data-go]')).forEach(function (r) {
    var k = document.getElementById(r.dataset.go);
    var gotowe = k && (k.classList.contains('p-gotowe') || k.classList.contains('p-odrz'));
    r.style.display = gotowe ? 'none' : '';
    if (!gotowe) n++;
  });
  var b = blok.querySelector('.skrT b');
  if (b && b.textContent !== String(n)) b.textContent = n;
  var pusto = blok.querySelector('.rzP');
  if (!n && !pusto) blok.insertAdjacentHTML('beforeend', '<div class="rzP">wszystko zatwierdzone</div>');
  if (n && pusto) pusto.remove();
}, 1000);
// ---- Archiwum samo (06.10): po godzinie publikacji post/stories przechodzi do Archiwum
// z oznaczeniem OPUBLIKOWANY; to, z czego Ania zrezygnowala (Nie, rezygnujemy), idzie do Archiwum → Odrzucone.
function przeniesDoArchiwum() {
  var teraz = Date.now();
  var cel = { posty: document.getElementById('archPosty'), stories: document.getElementById('archStories') };
  var odrz = document.getElementById('archOdrz');
  [].slice.call(document.querySelectorAll('.k.zw')).forEach(function (k) {
    var wArch = k.closest('#sek-archiwum');
    if (k.classList.contains('p-odrz')) {
      if (odrz && k.parentNode !== odrz) { odrz.appendChild(k); var pu = document.getElementById('archOdrzPusto'); if (pu) pu.remove(); }
      return;
    }
    // cofnieta rezygnacja: wraca z Odrzuconych na swoje miejsce przy nastepnym wczytaniu strony
    var t = k.dataset.kiedy ? Date.parse(k.dataset.kiedy) : NaN;
    if (!isNaN(t) && t <= teraz) {
      var gl = k.querySelector(':scope > .gl');
      if (gl && !gl.querySelector('.opubl')) gl.insertAdjacentHTML('beforeend', '<span class="opubl">opublikowany</span>');
      var c = cel[k.dataset.typ];
      if (c && !wArch) c.insertBefore(k, c.firstChild);
    }
  });
  // wiersze skrotow, ktorych karta juz jest w Archiwum, znikaja z "W tym tygodniu"
  [].slice.call(document.querySelectorAll('.skrB a.rz[data-go]')).forEach(function (r) {
    var k = document.getElementById(r.dataset.go);
    if (k && k.closest('#sek-archiwum')) r.style.display = 'none';
  });
}
setTimeout(przeniesDoArchiwum, 1500);
setInterval(przeniesDoArchiwum, 60000);
