// Kalendarz raportów: miesiące sezonu, tydzień z raportem da się kliknąć.
// Nowy raport = nowa linia w RAPORTY (poniedziałek tygodnia, adres strony).
(function(){
  var RAPORTY=[
    {od:'2026-10-05',url:'tydzien-1.html',nr:1},
    {od:'2026-10-12',url:'./',nr:2}
  ];
  var MIES=['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  var el=document.getElementById('kalendarz');if(!el)return;
  var biezacy=+el.getAttribute('data-nr');
  function iso(d){return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2)}
  function raport(pon){for(var i=0;i<RAPORTY.length;i++)if(RAPORTY[i].od===iso(pon))return RAPORTY[i];return null}
  var dzis=iso(new Date()),h='';
  for(var m=9;m<=12;m++){ // październik 2026 – styczeń 2027
    var rok=m>11?2027:2026,mi=m%12,pierwszy=new Date(rok,mi,1),ost=new Date(rok,mi+1,0);
    var pon=new Date(pierwszy);pon.setDate(pon.getDate()-((pon.getDay()+6)%7));
    h+='<div class="kMies"><div class="kNaz">'+MIES[mi]+' '+rok+'</div><div class="kSiatka"><span>pn</span><span>wt</span><span>śr</span><span>cz</span><span>pt</span><span>sb</span><span>nd</span>';
    while(pon<=ost){
      var r=raport(pon),kl='kTydz'+(r?' jest':'')+(r&&r.nr===biezacy?' teraz':'');
      h+=r?'<a class="'+kl+'" href="'+r.url+'" title="Raport · tydzień '+r.nr+'">':'<div class="'+kl+'">';
      for(var d=0;d<7;d++){var x=new Date(pon);x.setDate(pon.getDate()+d);
        h+='<span class="'+(x.getMonth()!==mi?'poza':'')+(iso(x)===dzis?' dzis':'')+'">'+x.getDate()+'</span>';}
      h+=r?'</a>':'</div>';
      pon.setDate(pon.getDate()+7);
    }
    h+='</div></div>';
  }
  el.innerHTML='<div class="kNagl">Wybierz tydzień <span>zielone tygodnie mają raport</span></div><div class="kMiesiace">'+h+'</div>';
  var s=document.createElement('style');
  s.textContent='#kalendarz{background:var(--karta);border:1px solid var(--ramka);border-radius:14px;padding:16px 18px;margin:0 0 30px}'+
  '.kNagl{font:500 15px Jost,sans-serif;margin-bottom:12px}.kNagl span{font:400 12.5px Figtree,sans-serif;color:var(--cichy);margin-left:8px}'+
  '.kMiesiace{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}'+
  '.kMies{min-width:0}.kNaz{font-size:13px;font-weight:600;margin-bottom:6px}'+
  '.kSiatka{display:grid;grid-template-columns:1fr;gap:2px;font-size:12px;text-align:center}'+
  '.kSiatka>span{display:inline-block;width:14.28%;color:var(--cichy);font-size:11px}'+
  '.kTydz{display:grid;grid-template-columns:repeat(7,1fr);border-radius:7px;padding:3px 0;color:var(--tekst);text-decoration:none}'+
  '.kTydz .poza{color:#c9c3b6}.kTydz .dzis{font-weight:700;text-decoration:underline}'+
  '.kTydz.jest{background:var(--jasny);color:var(--zielen);font-weight:600}.kTydz.jest:hover{background:#d6e2d1}'+
  '.kTydz.teraz{background:var(--zielen);color:#fff}.kTydz.teraz .poza{color:rgba(255,255,255,.6)}'+
  '@media (max-width:760px){.kMiesiace{grid-template-columns:repeat(2,1fr)}}';
  document.head.appendChild(s);
  // nagłówek dni tygodnia w jednym wierszu
  [].forEach.call(el.querySelectorAll('.kSiatka'),function(g){var sp=[].slice.call(g.children,0,7),w=document.createElement('div');w.className='kTydz';w.style.color='var(--cichy)';w.style.fontSize='11px';sp.forEach(function(x){w.appendChild(x)});g.insertBefore(w,g.firstChild)});
})();
