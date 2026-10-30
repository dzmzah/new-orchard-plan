const tz='Europe/Zurich';
const f=v=>Math.round(v).toLocaleString('pl-PL');
const eur=v=>v==null?'—':Math.round(v).toLocaleString('pl-PL')+' €';
const eur2=v=>v==null?'—':v.toLocaleString('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1})+' €';
const dt=s=>new Date(s).toLocaleString('pl-PL',{timeZone:tz,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const dzien=s=>new Date(s).toLocaleDateString('sv-SE',{timeZone:tz});
const dmy=s=>new Date(s).toLocaleDateString('pl-PL',{day:'numeric',month:'2-digit'});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ly=s=>(+s.slice(0,4)-1)+s.slice(4);
const zm=(a,b,odwr)=>{if(a==null||b==null||!b)return '';const p=Math.round((a/b-1)*100);const kol=odwr==='n'?'var(--cichy)':((odwr?p<=0:p>=0)?'var(--zielen)':'var(--zm)');return `<span class="zmn" style="color:${kol};font-weight:600">${p>=0?'+':''}${p} %</span>`};
function kanal0(o){
  const k=(o.kody||[]).join(' ').toUpperCase(), s=(o.zrodlo||'').toLowerCase(), us=(o.utm_source||'').toLowerCase(), uc=(o.utm_campaign||'').toLowerCase();
  if(k.includes('BIRTHDAY40')) return ['Mail early access (kod)','mail'];
  if(k.includes('WELCOME')) return ['Mail powitalny (kod)','mail'];
  if(us.includes('klaviyo')||s==='email') return ['Mail (kampania)','mail'];
  if(us==='meta'||us==='facebook'||uc.includes('urodziny40')||uc.includes('katalog')) return ['Reklama Meta','meta'];
  if(us.includes('igshopping')) return ['Instagram Shopping','ig'];
  if(us==='instagram'||s.includes('instagram')) return ['Instagram','ig'];
  if(us==='pinterest') return ['Pinterest','ig'];
  if(s.includes('google')) return ['Google','dir'];
  if(s==='direct') return ['Wejście bezpośrednie','dir'];
  return ['Nieznane','nz'];
}
function zrodla(o){const a=[];if(o.klaviyo)a.push([o.klaviyo,'mail']);const b=kanal0(o);if(!a.length||b[1]==='meta'||b[1]==='ig')a.push(b);return a}
function kanal(o){return zrodla(o)[0]}
const tag=(n,c)=>`<span class="tg ${c}">${esc(n)}</span>`;

fetch('dane.json?t='+Date.now()).then(r=>r.json()).then(d=>{
  document.getElementById('upd').textContent='aktualizacja '+dt(d.aktualizacja);
  const sel=document.getElementById('okres');
  sel.innerHTML=d.okresy.map(o=>`<option value="${o.id}">${esc(o.nazwa)}</option>`).join('');
  let pam='akcja';try{pam=localStorage.getItem('sp_okres')||'akcja'}catch(e){}
  if(d.okresy.some(o=>o.id===pam))sel.value=pam;
  sel.onchange=()=>{try{localStorage.setItem('sp_okres',sel.value)}catch(e){};render(d,d.okresy.find(o=>o.id===sel.value))};
  document.getElementById('mies').innerHTML='<tr><th>Miesiąc</th><th style="text-align:right">2026/27</th><th style="text-align:right">Rok temu</th><th style="text-align:right">Zmiana</th></tr>'+[...d.miesiace].sort((a,b)=>a.miesiac.localeCompare(b.miesiac)).map(m=>`<tr><td>${esc(m.nazwa)}</td><td class="l"><b>${m.teraz==null?'—':eur(m.teraz)}</b>${m.zam!=null?`<br><small style="color:var(--cichy)">${m.zam} zam.</small>`:''}</td><td class="l">${eur(m.rok_temu)}<br><small style="color:var(--cichy)">${m.zam_rok_temu} zam.</small></td><td class="l">${m.teraz==null?'—':zm(m.teraz,m.rok_temu)}</td></tr>`).join('');
  render(d,d.okresy.find(o=>o.id===sel.value));
}).catch(e=>{document.getElementById('upd').textContent='Błąd ładowania danych: '+e.message});

function render(d,O){
  const w=s=>{const x=dzien(s);return x>=O.od&&x<=O.do}, wl=s=>{const x=dzien(s);return x>=ly(O.od)&&x<=ly(O.do)};
  document.getElementById('tytul').textContent=O.nazwa;
  const z=d.zamowienia.filter(o=>!o.anulowane&&w(o.data)), netto=o=>o.kwota-(o.zwrot||0);
  const M=d.meta.filter(m=>m.dzien>=O.od&&m.dzien<=O.do), ML=(d.meta_ly||[]).filter(m=>m.dzien>=ly(O.od)&&m.dzien<=ly(O.do));
  const S=(a,k)=>a.reduce((x,m)=>x+(m[k]||0),0);
  const wyd=S(M,'wydatek'), wydL=S(ML,'wydatek'), kl=S(M,'klikniecia'), klL=S(ML,'klikniecia'), wys=S(M,'wyswietlenia'), wysL=S(ML,'wyswietlenia'), ko=S(M,'koszyki'), koL=S(ML,'koszyki'), zk=S(M,'zakupy'), zkL=S(ML,'zakupy'), wv=S(M,'wartosc'), wvL=S(ML,'wartosc');
  const mailZ=z.filter(o=>o.klaviyo), mailV=mailZ.reduce((a,o)=>a+netto(o),0);
  const KL=(d.klaviyo_ly||[]).filter(x=>wl(x.data)), mailL=KL.filter(x=>x.mail), mailVL=mailL.reduce((a,x)=>a+x.kwota,0);
  const sr=O.zam?O.teraz/O.zam:0, srL=O.zam_rok_temu?O.rok_temu/O.zam_rok_temu:0;
  const G=O.ga4||{teraz:{},rok:{}}, gt=G.teraz||{}, gl=G.rok||{};
  const gk=gt.googleKoszt||0, gkL=gl.googleKoszt||0, rekl=wyd+gk, reklL=wydL+gkL;
  const dni=Math.round((new Date(O.do)-new Date(O.od))/864e5)+1;
  // kafle
  const K=[
    ['mocny',eur(O.teraz),'sprzedaż (sklep + marketplace\'y)',`${O.zam} zamówień · rok temu ${eur(O.rok_temu)} (${O.zam_rok_temu} zam.) · ${zm(O.teraz,O.rok_temu)}`],
    ['',eur(rekl),'wydane na reklamę',`Meta ${eur(wyd)} · Google ${eur(gk)}<br>rok temu ${eur(reklL)} (Meta ${eur(wydL)} · Google ${eur(gkL)})`],
    ['',eur(mailV),'sprzedaż z maili (Klaviyo)',`${mailZ.length} zamówień · rok temu ${eur(mailVL)} (${mailL.length} zam.)`],
    ['',eur(sr),'średnie zamówienie',`rok temu ${eur(srL)} · ${zm(sr,srL)}`]];
  document.getElementById('kafle').innerHTML=K.map(k=>`<div class="kafel ${k[0]}"><div class="liczba">${k[1]}</div><div class="co">${k[2]}</div><div class="male">${k[3]}</div></div>`).join('');
  // porównanie paskami
  document.getElementById('rrPod').textContent=`${dmy(O.od)}–${dmy(O.do)}.${O.do.slice(0,4)} (${dni} ${dni===1?'dzień':'dni'}) kontra ${dmy(O.od)}–${dmy(O.do)}.${ly(O.do).slice(0,4)}. Sprzedaż i zamówienia: raporty Shopify (sklep + marketplace'y), ruch i Google Ads: GA4, reklama według Meta, maile według Klaviyo.`;
  const rr=[['Sprzedaż',O.teraz,O.rok_temu,' €'],['Zamówienia',O.zam,O.zam_rok_temu,''],['Średnie zamówienie',sr,srL,' €'],['Sprzedaż z maili',mailV,mailVL,' €'],['Zamówienia z maili',mailZ.length,mailL.length,''],['Wizyty na stronie',gt.sessions||0,gl.sessions||0,''],['Dodania do koszyka',gt.addToCarts||0,gl.addToCarts||0,''],['Przejścia do kasy',gt.checkouts||0,gl.checkouts||0,''],['Konwersja (zakupy / wizyty)',gt.sessions?(gt.ecommercePurchases||0)/gt.sessions*100:0,gl.sessions?(gl.ecommercePurchases||0)/gl.sessions*100:0,' %'],['Wydane na reklamę (Meta + Google)',rekl,reklL,' €','','n'],['Reklama jako % sprzedaży',O.teraz?rekl/O.teraz*100:0,O.rok_temu?reklL/O.rok_temu*100:0,' %','mniej = lepiej'],['Wydane na Meta',wyd,wydL,' €','','n'],['Wydane na Google Ads',gk,gkL,' €','','n'],['Kliknięcia w reklamy Meta',kl,klL,''],['Klikalność reklam Meta',wys?kl/wys*100:0,wysL?klL/wysL*100:0,' %'],['Koszyki z reklam Meta',ko,koL,''],['Koszt jednego koszyka',ko?wyd/ko:0,koL?wydL/koL:0,' €','mniej = lepiej'],['Zakupy wg piksela Meta',zk,zkL,''],['Wartość zakupów wg piksela',wv,wvL,' €']];
  const fm=(v,u)=>u===' %'?v.toLocaleString('pl-PL',{maximumFractionDigits:1})+u:(u===' €'&&v<100?v.toLocaleString('pl-PL',{maximumFractionDigits:1}):f(v))+u;
  document.getElementById('rr').innerHTML=rr.map(r=>{const mx=Math.max(r[1],r[2],0.0001);return `<div class="rrW"><div class="nz">${r[0]}${r[4]?` <span style="color:var(--cichy);font-size:12px">(${r[4]})</span>`:''}</div><div><div class="pas teraz"><i style="width:${Math.max(1,r[1]/mx*78)}%"></i><b>${fm(r[1],r[3])}</b> ${zm(r[1],r[2],r[5]||!!r[4])}</div><div class="pas rok" style="margin-top:4px"><i style="width:${Math.max(1,r[2]/mx*78)}%"></i>${fm(r[2],r[3])}</div></div></div>`}).join('');
  // ruch GA4 wg kanałów
  const PL={'Paid Social':'Reklama w social media','Direct':'Wejście bezpośrednie','Organic Search':'Wyszukiwarka (bezpłatnie)','Email':'Maile','Organic Social':'Social media (bezpłatnie)','Paid Search':'Google Ads (wyszukiwarka)','Referral':'Linki z innych stron','Paid Shopping':'Google Shopping (płatnie)','Organic Shopping':'Google Shopping (bezpłatnie)','Unassigned':'Nieprzypisane','Cross-network':'Google (Performance Max)','Display':'Reklama displayowa','Paid Video':'Reklama wideo','Organic Video':'Wideo (bezpłatnie)','SMS':'SMS','AI Assistant':'Asystenci AI (ChatGPT itp.)','Paid Other':'Inna reklama płatna'};
  const GK=(O.ga4_kanaly||[]).filter(k=>(k.teraz?.sesje||0)+(k.rok?.sesje||0)>0);
  document.getElementById('ruch').innerHTML='<tr><th>Kanał</th><th style="text-align:right">Wizyty</th><th style="text-align:right">Rok temu</th><th style="text-align:right">Koszyki</th><th style="text-align:right">Rok temu</th><th style="text-align:right">Zakupy</th><th style="text-align:right">Rok temu</th></tr>'+(GK.length?GK.map(k=>{const t=k.teraz||{},l=k.rok||{};return `<tr><td>${esc(PL[k.n]||k.n)}</td><td class="l"><b>${f(t.sesje||0)}</b> ${zm(t.sesje||0,l.sesje||0)}</td><td class="l" style="color:var(--cichy)">${f(l.sesje||0)}</td><td class="l"><b>${t.koszyki||0}</b></td><td class="l" style="color:var(--cichy)">${l.koszyki||0}</td><td class="l"><b>${t.zakupy||0}</b></td><td class="l" style="color:var(--cichy)">${l.zakupy||0}</td></tr>`}).join(''):'<tr><td colspan="7">Brak danych GA4</td></tr>');
  // kanały
  const kan={};z.forEach(o=>{const[n,c]=kanal(o);(kan[n]||=( {n,c,i:0,v:0}));kan[n].i++;kan[n].v+=netto(o)});
  const kll=Object.values(kan).sort((a,b)=>b.v-a.v), mx=Math.max(...kll.map(k=>k.v),1), mailsum=kll.filter(k=>k.c==='mail');
  document.getElementById('kanaly').innerHTML='<tr><th>Źródło</th><th style="text-align:right">Zamówień</th><th style="text-align:right">Teraz</th><th style="text-align:right">Rok temu</th><th style="width:30%"></th></tr>'+(kll.length?kll.map(k=>`<tr><td>${tag(k.n,k.c)}</td><td class="l">${k.i}</td><td class="l"><b>${eur(k.v)}</b></td><td class="l" style="color:var(--cichy)">${k.c==='meta'?eur(wvL)+'<br><small>wg piksela</small>':'—'}</td><td><div class="bar" style="width:${k.v/mx*100}%"></div></td></tr>`).join('')+`<tr><td><b>Wszystkie maile razem</b></td><td class="l">${mailZ.length}</td><td class="l"><b>${eur(mailV)}</b></td><td class="l">${eur(mailVL)}<br><small style="color:var(--cichy)">${mailL.length} zam.</small></td><td>${zm(mailV,mailVL)}</td></tr>`:'<tr><td colspan="5">Brak zamówień w tym okresie</td></tr>');
  // towary
  const why={};z.forEach(o=>{const[kn,kc]=kanal(o);o.towary.forEach(t=>{const m=t.match(/^(\d+)× (.*)$/);const q=m?+m[1]:1,n=m?m[2]:t;const e=why[n]||={};(e[kn]||={c:kc,q:0}).q+=q})});
  const pr={};(O.produkty||[]).forEach(p=>{(pr[p.n]||={n:p.n}).t=p});(O.produkty_rok||[]).forEach(p=>{(pr[p.n]||={n:p.n}).l=p});
  document.getElementById('towary').innerHTML='<tr><th>Produkt</th><th style="text-align:right">Teraz</th><th style="text-align:right">Rok temu</th><th>Dlaczego kupili</th></tr>'+Object.values(pr).sort((a,b)=>(b.t?.q||0)-(a.t?.q||0)||(b.l?.q||0)-(a.l?.q||0)).slice(0,18).map(p=>`<tr><td>${esc(p.n)}</td><td class="l">${p.t?`<b>${p.t.q} szt.</b><br><small style="color:var(--cichy)">${eur(p.t.s)}</small>`:'—'}</td><td class="l">${p.l?`${p.l.q} szt.<br><small style="color:var(--cichy)">${eur(p.l.s)}</small>`:'—'}</td><td>${Object.entries(why[p.n]||{}).sort((a,b)=>b[1].q-a[1].q).map(([k,v])=>tag(k+(v.q>1?' ×'+v.q:''),v.c)).join(' ')}</td></tr>`).join('');
  // kraje
  const kr={};(O.kraje||[]).forEach(k=>{(kr[k.n]||={n:k.n}).t=k});(O.kraje_rok||[]).forEach(k=>{(kr[k.n]||={n:k.n}).l=k});
  document.getElementById('kraje').innerHTML='<tr><th>Kraj</th><th style="text-align:right">Teraz</th><th style="text-align:right">Rok temu</th><th style="text-align:right">Zmiana</th></tr>'+Object.values(kr).sort((a,b)=>(b.t?.s||0)-(a.t?.s||0)).map(k=>`<tr><td>${esc(k.n)}</td><td class="l">${k.t?`<b>${eur(k.t.s)}</b><br><small style="color:var(--cichy)">${k.t.z} zam.</small>`:'—'}</td><td class="l">${k.l?`${eur(k.l.s)}<br><small style="color:var(--cichy)">${k.l.z} zam.</small>`:'—'}</td><td class="l">${k.t&&k.l?zm(k.t.s,k.l.s):''}</td></tr>`).join('');
  // zamówienia
  document.getElementById('zamPod').textContent=z.length?`${z.length} zamówień w sklepie internetowym, od najnowszego.`+(O.od<d.start?` Lista od ${new Date(d.start).toLocaleDateString('pl-PL')} (Shopify udostępnia ostatnie 60 dni).`:''):'Brak zamówień w tym okresie.';
  document.getElementById('zam').innerHTML=[...z].reverse().map(o=>`<div class="zw"><div class="kto"><b>${esc(o.nr)} · ${esc(o.kraj)}</b>${dt(o.data)}</div><div class="rz">${o.towary.map(t=>`<span>${esc(t)}</span>`).join('')}<span class="src">${zrodla(o).map(([n,c])=>tag(n,c)).join(' ')}</span></div><div class="kw">${eur2(o.kwota)}${o.zwrot?`<small style="color:var(--zm)">zwrot −${eur2(o.zwrot)}</small>`:''}</div></div>`).join('');
  // maile
  const KC=d.klaviyo.kampanie.filter(c=>c.wyslano&&w(c.wyslano));
  document.getElementById('kampanie').innerHTML='<tr><th>Kampania</th><th>Wysłano</th><th style="text-align:right">Odbiorcy</th><th style="text-align:right">Otwarcia</th><th style="text-align:right">Kliknięcia</th><th style="text-align:right">Wypisy</th><th style="text-align:right">Zamówienia</th><th style="text-align:right">Wartość</th></tr>'+(KC.length?KC.sort((a,b)=>String(b.wyslano).localeCompare(a.wyslano)).map(c=>`<tr><td>${esc(c.nazwa)}</td><td>${dt(c.wyslano)}</td><td class="l">${c.recipients}</td><td class="l">${c.opens_unique}<br><small style="color:var(--cichy)">${c.recipients?Math.round(c.opens_unique/c.recipients*100):0} %</small></td><td class="l">${c.clicks_unique}<br><small style="color:var(--cichy)">${c.recipients?(c.clicks_unique/c.recipients*100).toFixed(1):0} %</small></td><td class="l">${c.unsubscribes}</td><td class="l">${c.conversions}</td><td class="l"><b>${eur(c.conversion_value)}</b></td></tr>`).join(''):'<tr><td colspan="8">Brak kampanii w tym okresie</td></tr>');
  const fz={};mailZ.forEach(o=>{if(!/porzucon|powitaln|powrót|automatyczny/.test(o.klaviyo))return;(fz[o.klaviyo]||={n:o.klaviyo,i:0,v:0});fz[o.klaviyo].i++;fz[o.klaviyo].v+=netto(o)});
  document.getElementById('flowy').innerHTML='<tr><th>Automatyczne maile</th><th style="text-align:right">Zamówienia</th><th style="text-align:right">Wartość</th></tr>'+(Object.values(fz).length?Object.values(fz).sort((a,b)=>b.v-a.v).map(x=>`<tr><td>${esc(x.n)}</td><td class="l">${x.i}</td><td class="l"><b>${eur(x.v)}</b></td></tr>`).join(''):'<tr><td colspan="3">Brak zamówień z automatycznych maili w tym okresie</td></tr>');
  // meta po dniach + rok temu (ten sam dzień tygodnia = −364 dni)
  const lyDay=s=>new Date(new Date(s).getTime()-364*864e5).toISOString().slice(0,10);
  const byL=Object.fromEntries((d.meta_ly||[]).map(m=>[m.dzien,m]));
  document.getElementById('meta').innerHTML='<tr><th>Dzień</th><th style="text-align:right">Wydatek</th><th style="text-align:right">Kliknięcia</th><th style="text-align:right">Koszyki</th><th style="text-align:right">Zakupy</th><th style="text-align:right">Wartość</th></tr>'+[...M].reverse().map(m=>{const l=byL[lyDay(m.dzien)]||{};return `<tr><td>${new Date(m.dzien).toLocaleDateString('pl-PL',{weekday:'short',day:'2-digit',month:'2-digit'})}<br><small style="color:var(--cichy)">rok temu</small></td><td class="l"><b>${eur(m.wydatek)}</b><br><small style="color:var(--cichy)">${eur(l.wydatek||0)}</small></td><td class="l">${m.klikniecia}<br><small style="color:var(--cichy)">${l.klikniecia||0}</small></td><td class="l">${m.koszyki}<br><small style="color:var(--cichy)">${l.koszyki||0}</small></td><td class="l">${m.zakupy}<br><small style="color:var(--cichy)">${l.zakupy||0}</small></td><td class="l"><b>${eur(m.wartosc)}</b><br><small style="color:var(--cichy)">${eur(l.wartosc||0)}</small></td></tr>`}).join('')+`<tr><td><b>Razem</b><br><small style="color:var(--cichy)">rok temu</small></td><td class="l"><b>${eur(wyd)}</b><br><small style="color:var(--cichy)">${eur(wydL)}</small></td><td class="l">${kl}<br><small style="color:var(--cichy)">${klL}</small></td><td class="l">${ko}<br><small style="color:var(--cichy)">${koL}</small></td><td class="l">${zk}<br><small style="color:var(--cichy)">${zkL}</small></td><td class="l"><b>${eur(wv)}</b><br><small style="color:var(--cichy)">${eur(wvL)}</small></td></tr>`;
}
