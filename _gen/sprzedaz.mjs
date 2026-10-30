// Dane do strony /sprzedaz/ — uruchamiane co godzinę przez GitHub Actions (sprzedaz.yml). Klucze z sekretów repo, nic nie trafia do kodu.
// Shopify: zamówienia od START (bez danych osobowych), Klaviyo: zamówienia przypisane mailom/flowom, Meta: wydatki i zakupy pikselem po dniach.
import fs from 'fs';
import crypto from 'crypto';
const START = process.env.START || new Date(Date.now() - 58 * 864e5).toISOString().slice(0, 10);
const env = k => { const v = process.env[k]; if (!v) throw new Error('brak ' + k); return v.trim(); };
const out = { aktualizacja: new Date().toISOString(), start: START, zamowienia: [], meta: [], klaviyo: { kampanie: [], flowy: [] } };

// Shopify
const tok = (await (await fetch('https://theneworchard.myshopify.com/admin/oauth/access_token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: env('SHOPIFY_ID'), client_secret: env('SHOPIFY_SECRET'), grant_type: 'client_credentials' }) })).json()).access_token;
const q = `{ orders(first:100, query:"created_at:>=${START}", sortKey:CREATED_AT) { nodes { legacyResourceId name createdAt cancelledAt displayFinancialStatus discountCodes totalPriceSet{shopMoney{amount currencyCode}} totalRefundedSet{shopMoney{amount}} shippingAddress{countryCodeV2} lineItems(first:15){nodes{title quantity}} customerJourneySummary{firstVisit{source utmParameters{source medium campaign}} lastVisit{source utmParameters{source medium campaign}}} } } }`;
const sj = await (await fetch('https://theneworchard.myshopify.com/admin/api/2025-07/graphql.json', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': tok }, body: JSON.stringify({ query: q }) })).json();
for (const o of sj.data.orders.nodes) {
  const lv = o.customerJourneySummary?.lastVisit || {}, u = lv.utmParameters || {};
  out.zamowienia.push({ id: o.legacyResourceId, nr: o.name, data: o.createdAt, kwota: +o.totalPriceSet.shopMoney.amount, zwrot: +(o.totalRefundedSet?.shopMoney?.amount || 0), anulowane: !!o.cancelledAt, kraj: o.shippingAddress?.countryCodeV2 || '', kody: o.discountCodes,
    towary: o.lineItems.nodes.map(l => (l.quantity > 1 ? l.quantity + '× ' : '') + l.title.replace(' (Unisex)', '').replace('Classic Vegan ', '')), zrodlo: lv.source || '', utm_source: u.source || '', utm_medium: u.medium || '', utm_campaign: u.campaign || '' });
}

// Okresy do wyboru + rok do roku (ShopifyQL — te same liczby co w raportach)
{ const sq = async q => (await (await fetch('https://theneworchard.myshopify.com/admin/api/2025-07/graphql.json', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': tok }, body: JSON.stringify({ query: `{ shopifyqlQuery(query: ${JSON.stringify(q)}) { parseErrors tableData { rows } } }` }) })).json()).data?.shopifyqlQuery?.tableData?.rows || [];
  const suma = rows => rows.reduce((a, r) => ({ s: a.s + (+r.total_sales || 0), z: a.z + (+r.orders || 0) }), { s: 0, z: 0 });
  const zr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }), y = +zr.slice(0, 4), m = +zr.slice(5, 7), ly = d => (+d.slice(0, 4) - 1) + d.slice(4);
  const iso = d => d.toISOString().slice(0, 10), minus = n => iso(new Date(new Date(zr).getTime() - n * 864e5));
  const pm = m === 1 ? [y - 1, 12] : [y, m - 1], ost = (yy, mm) => iso(new Date(Date.UTC(yy, mm, 0)));
  const MS = ['', 'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const sezon = (m >= 9 ? y : y - 1) + '-09-01';
  const okresy = [
    { id: 'akcja', nazwa: 'Akcja urodzinowa 24.10–1.11', od: '2026-10-24', do: zr < '2026-11-01' ? zr : '2026-11-01' },
    { id: 'dzis', nazwa: 'Dziś', od: zr, do: zr },
    { id: '7', nazwa: 'Ostatnie 7 dni', od: minus(6), do: zr },
    { id: '30', nazwa: 'Ostatnie 30 dni', od: minus(29), do: zr },
    { id: 'mies', nazwa: 'Ten miesiąc (' + MS[m] + ')', od: zr.slice(0, 8) + '01', do: zr },
    { id: 'pmies', nazwa: 'Poprzedni miesiąc (' + MS[pm[1]] + ')', od: `${pm[0]}-${String(pm[1]).padStart(2, '0')}-01`, do: ost(pm[0], pm[1]) },
    { id: 'sezon', nazwa: 'Sezon (od 1.09)', od: sezon, do: zr } ];
  out.okresy = [];
  for (const o of okresy) { const t = suma(await sq(`FROM sales SHOW total_sales, orders SINCE ${o.od} UNTIL ${o.do}`)), l = suma(await sq(`FROM sales SHOW total_sales, orders SINCE ${ly(o.od)} UNTIL ${ly(o.do)}`));
    const prod = async (a, b) => (await sq(`FROM sales SHOW net_items_sold, total_sales GROUP BY product_title SINCE ${a} UNTIL ${b} ORDER BY net_items_sold DESC LIMIT 12`)).filter(r => +r.net_items_sold > 0).map(r => ({ n: r.product_title.replace(' (Unisex)', '').replace('Classic Vegan ', ''), q: +r.net_items_sold, s: +(+r.total_sales).toFixed(2) }));
    const kraj = async (a, b) => (await sq(`FROM sales SHOW orders, total_sales GROUP BY shipping_country SINCE ${a} UNTIL ${b} ORDER BY orders DESC`)).filter(r => +r.orders > 0).map(r => ({ n: r.shipping_country || '?', z: +r.orders, s: +(+r.total_sales).toFixed(2) }));
    out.okresy.push({ ...o, teraz: +t.s.toFixed(2), zam: t.z, rok_temu: +l.s.toFixed(2), zam_rok_temu: l.z,
      produkty: await prod(o.od, o.do), produkty_rok: await prod(ly(o.od), ly(o.do)), kraje: await kraj(o.od, o.do), kraje_rok: await kraj(ly(o.od), ly(o.do)) }); }
  const mies = async (a, b) => (await sq(`FROM sales SHOW total_sales, orders GROUP BY month SINCE ${a} UNTIL ${b}`)).map(r => ({ m: String(r.month).slice(0, 7), s: +r.total_sales, z: +r.orders }));
  const t = await mies(sezon, zr), l = await mies(ly(sezon), ly(sezon).slice(0, 4) - 0 + 1 + '-01-31');
  out.miesiace = l.map(r => { const tm = (+r.m.slice(0, 4) + 1) + r.m.slice(4); const x = t.find(z => z.m === tm); return { miesiac: tm, nazwa: MS[+tm.slice(5, 7)], teraz: x ? +x.s.toFixed(2) : null, zam: x ? x.z : null, rok_temu: +r.s.toFixed(2), zam_rok_temu: r.z }; }); }

// Meta
const pick = (a, k) => +((a || []).find(x => x.action_type === k)?.value || 0);
const MT = env('META_TOKEN'), dzis = new Date().toISOString().slice(0, 10);
const mr = await (await fetch(`https://graph.facebook.com/v21.0/act_1262853788445873/insights?time_range={"since":"${START}","until":"${dzis}"}&time_increment=1&fields=spend,impressions,inline_link_clicks,actions,action_values&limit=100&access_token=${MT}`)).json();
{ const lyS='2025-10-24', lyE='2025-11-01'; const ml=await (await fetch(`https://graph.facebook.com/v21.0/act_1262853788445873/insights?time_range={"since":"${lyS}","until":"${lyE}"}&fields=spend,actions,action_values&access_token=${MT}`)).json(); const x=ml.data?.[0]||{}; out.meta_rok_temu={ wydatek:+(+(x.spend||0)).toFixed(2), zakupy:pick(x.actions,'offsite_conversion.fb_pixel_purchase'), wartosc:pick(x.action_values,'offsite_conversion.fb_pixel_purchase') }; }
for (const d of mr.data || []) out.meta.push({ dzien: d.date_start, wydatek: +(+d.spend).toFixed(2), wyswietlenia: +(d.impressions || 0), klikniecia: +(d.inline_link_clicks || 0), koszyki: pick(d.actions, 'offsite_conversion.fb_pixel_add_to_cart'), zakupy: pick(d.actions, 'offsite_conversion.fb_pixel_purchase'), wartosc: pick(d.action_values, 'offsite_conversion.fb_pixel_purchase') });

{ const lyS = (+START.slice(0, 4) - 1) + START.slice(4), lyE = (+dzis.slice(0, 4) - 1) + dzis.slice(4); out.meta_ly = [];
  let u = `https://graph.facebook.com/v21.0/act_1262853788445873/insights?time_range={"since":"${lyS}","until":"${lyE}"}&time_increment=1&fields=spend,impressions,inline_link_clicks,actions,action_values&limit=100&access_token=${MT}`;
  while (u) { const r = await (await fetch(u)).json(); for (const d of r.data || []) out.meta_ly.push({ dzien: d.date_start, wydatek: +(+d.spend).toFixed(2), wyswietlenia: +(d.impressions || 0), klikniecia: +(d.inline_link_clicks || 0), koszyki: pick(d.actions, 'offsite_conversion.fb_pixel_add_to_cart'), zakupy: pick(d.actions, 'offsite_conversion.fb_pixel_purchase'), wartosc: pick(d.action_values, 'offsite_conversion.fb_pixel_purchase') }); u = r.paging?.next; } }

// Klaviyo
const KH = { Authorization: 'Klaviyo-API-Key ' + env('KLAVIYO_KEY'), revision: '2024-10-15', accept: 'application/vnd.api+json', 'content-type': 'application/vnd.api+json' };
const kg = async (p, o = {}) => { for (let i = 0; i < 5; i++) { const r = await fetch('https://a.klaviyo.com/api/' + p, { headers: KH, ...o }); if (r.status === 429) { await new Promise(z => setTimeout(z, 3000)); continue; } return r.json(); } };
const po = (await kg('metrics')).data.find(m => m.attributes.name === 'Placed Order' && /Shopify/.test(m.attributes.integration?.name || '')).id;
const tf = { start: START + 'T00:00:00Z', end: new Date(Date.now() + 864e5).toISOString().slice(0, 10) + 'T00:00:00Z' };
const camps = (await kg("campaigns?filter=and(equals(messages.channel,'email'),equals(status,'Sent'))&fields[campaign]=name,send_time")).data.filter(c => (c.attributes.send_time || '') >= START && !/TEST/i.test(c.attributes.name));
if (camps.length) {
  const cr = await kg('campaign-values-reports', { method: 'POST', body: JSON.stringify({ data: { type: 'campaign-values-report', attributes: { statistics: ['recipients', 'opens_unique', 'clicks_unique', 'unsubscribes', 'conversions', 'conversion_value'], timeframe: tf, conversion_metric_id: po, filter: `contains-any(campaign_id,${JSON.stringify(camps.map(c => c.id))})` } } }) });
  for (const x of cr.data?.attributes?.results || []) { const c = camps.find(z => z.id === x.groupings.campaign_id); out.klaviyo.kampanie.push({ nazwa: c?.attributes.name.replace(/\s*\(ZOVU\).*$/, ''), wyslano: c?.attributes.send_time, ...x.statistics }); }
}
const fl = Object.fromEntries((await kg('flows?fields[flow]=name')).data.map(f => [f.id, f.attributes.name.replace(/\s*\[.*?\]/, '')]));
const fr = await kg('flow-values-reports', { method: 'POST', body: JSON.stringify({ data: { type: 'flow-values-report', attributes: { statistics: ['recipients', 'conversions', 'conversion_value'], timeframe: tf, conversion_metric_id: po } } }) });
const agg = {}; for (const x of fr.data?.attributes?.results || []) { const n = fl[x.groupings.flow_id] || x.groupings.flow_id; const a = agg[n] ||= { nazwa: n, recipients: 0, conversions: 0, conversion_value: 0 }; a.recipients += x.statistics.recipients; a.conversions += x.statistics.conversions; a.conversion_value += x.statistics.conversion_value; }
out.klaviyo.flowy = Object.values(agg).filter(a => a.recipients > 0).sort((a, b) => b.conversion_value - a.conversion_value);

// Klaviyo: które zamówienie przypisane któremu mailowi / flow (atrybucja Klaviyo)
{ const KH2 = { ...KH, revision: '2025-07-15' }; delete KH2['content-type'];
  const kg2 = async p => { for (let i = 0; i < 5; i++) { const r = await fetch('https://a.klaviyo.com/api/' + p, { headers: KH2 }); if (r.status === 429) { await new Promise(z => setTimeout(z, 3000)); continue; } return r.json(); } };
  const cn = Object.fromEntries((await kg("campaigns?filter=equals(messages.channel,'email')&fields[campaign]=name")).data.map(c => [c.id, c.attributes.name.replace(/\s*\(ZOVU\).*$/, '')]));
  let u = `events?filter=and(equals(metric_id,"${po}"),greater-or-equal(datetime,${START}T00:00:00Z))&include=attributions&fields[event]=event_properties`;
  while (u) { const r = await kg2(u); const inc = Object.fromEntries((r.included || []).map(a => [a.id, a]));
    for (const e of r.data || []) { const p = e.attributes.event_properties || {}; const oid = String(p.$event_id || ''); const z = out.zamowienia.find(x => x.id === oid); if (!z) continue;
      for (const a of e.relationships?.attributions?.data || []) { const at = inc[a.id]; if (!at) continue; const R = at.relationships || {};
        if (R.campaign?.data) z.klaviyo = 'Mail: ' + (cn[R.campaign.data.id] || 'kampania'); else if (R.flow?.data) { const fn = fl[R.flow.data.id] || ''; z.klaviyo = /Abandoned Cart/i.test(fn) ? 'Mail: porzucony koszyk' : /Checkout/i.test(fn) ? 'Mail: porzucona kasa' : /Welcome/i.test(fn) ? 'Mail powitalny' : /Winback/i.test(fn) ? 'Mail: powrót klienta' : 'Mail automatyczny: ' + fn; } } }
    u = r.links?.next ? r.links.next.replace('https://a.klaviyo.com/api/', '') : null; } }
{ const KH3 = { ...KH, revision: '2025-07-15' }; delete KH3['content-type'];
  const kg3 = async p => { for (let i = 0; i < 5; i++) { const r = await fetch('https://a.klaviyo.com/api/' + p, { headers: KH3 }); if (r.status === 429) { await new Promise(z => setTimeout(z, 3000)); continue; } return r.json(); } };
  const lyS = (+START.slice(0, 4) - 1) + START.slice(4), lyE = (+dzis.slice(0, 4) - 1) + dzis.slice(4) + 'T23:59:59Z';
  out.klaviyo_ly = []; let u = `events?filter=and(equals(metric_id,"${po}"),greater-or-equal(datetime,${lyS}T00:00:00Z),less-or-equal(datetime,${lyE}))&include=attributions&fields[event]=datetime,event_properties`;
  while (u) { const r = await kg3(u); for (const e of r.data || []) out.klaviyo_ly.push({ data: e.attributes.datetime, kwota: +(e.attributes.event_properties?.$value || 0), mail: (e.relationships?.attributions?.data || []).length > 0 });
    u = r.links?.next ? r.links.next.replace('https://a.klaviyo.com/api/', '') : null; } }
// GA4: wizyty, koszyki, kasa, zakupy, kanały + koszt Google Ads — dla każdego okresu i rok temu
if (process.env.GA_SA) { try {
  const sa = JSON.parse(process.env.GA_SA), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url'), t = Math.floor(Date.now() / 1000);
  const uns = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: sa.token_uri, iat: t, exp: t + 3600 });
  const jwt = uns + '.' + crypto.createSign('RSA-SHA256').update(uns).sign(sa.private_key, 'base64url');
  const at = (await (await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` })).json()).access_token;
  const rep = async body => (await fetch('https://analyticsdata.googleapis.com/v1beta/properties/459047463:runReport', { method: 'POST', headers: { authorization: 'Bearer ' + at, 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const M = ['sessions', 'totalUsers', 'addToCarts', 'checkouts', 'ecommercePurchases', 'purchaseRevenue'];
  const lyD = d => (+d.slice(0, 4) - 1) + d.slice(4);
  const val = (row, i) => Object.fromEntries(M.map((m, k) => [m, +(row?.metricValues?.[k]?.value || 0)]));
  for (const o of out.okresy) {
    const dr = [{ startDate: o.od, endDate: o.do, name: 'teraz' }, { startDate: lyD(o.od), endDate: lyD(o.do), name: 'rok' }];
    const tot = await rep({ dateRanges: dr, metrics: M.map(name => ({ name })) });
    const get = n => val((tot.rows || []).find(r => r.dimensionValues?.[0]?.value === n));
    o.ga4 = { teraz: get('teraz'), rok: get('rok') };
    const ad = await rep({ dateRanges: dr, dimensions: [{ name: 'sessionGoogleAdsCampaignName' }], metrics: [{ name: 'advertiserAdCost' }, { name: 'advertiserAdClicks' }], limit: 100 });
    o.ga4.teraz.googleKoszt = 0; o.ga4.rok.googleKoszt = 0; o.ga4.teraz.googleKlik = 0; o.ga4.rok.googleKlik = 0; for (const r of ad.rows || []) { const n = r.dimensionValues?.[1]?.value || 'teraz'; if (o.ga4[n]) { o.ga4[n].googleKoszt = +(o.ga4[n].googleKoszt + +r.metricValues[0].value).toFixed(2); o.ga4[n].googleKlik += +r.metricValues[1].value; } } if (ad.error && !out.ga4_blad) out.ga4_blad = 'ads: ' + ad.error.message;
    if (tot.error && !out.ga4_blad) out.ga4_blad = tot.error.message;
    const kan = await rep({ dateRanges: dr, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: ['sessions', 'addToCarts', 'ecommercePurchases', 'purchaseRevenue'].map(name => ({ name })), limit: 30 });
    const kk = {}; for (const r of kan.rows || []) { const n = r.dimensionValues[0].value, which = r.dimensionValues[1]?.value || 'teraz'; const v = r.metricValues.map(x => +x.value); (kk[n] ||= { n })[which] = { sesje: v[0], koszyki: v[1], zakupy: v[2], przychod: v[3] }; }
    o.ga4_kanaly = Object.values(kk).sort((a, b) => (b.teraz?.sesje || 0) - (a.teraz?.sesje || 0));
  }
  out.ga4_ok = true;
} catch (e) { out.ga4_blad = String(e.message).slice(0, 200); } }

fs.writeFileSync(new URL('../sprzedaz/dane.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('zamowien', out.zamowienia.length, 'meta dni', out.meta.length, 'kampanii', out.klaviyo.kampanie.length, 'flowow', out.klaviyo.flowy.length);
