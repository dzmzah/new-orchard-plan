// Dane do strony /sprzedaz/ — uruchamiane co godzinę przez GitHub Actions (sprzedaz.yml). Klucze z sekretów repo, nic nie trafia do kodu.
// Shopify: zamówienia od START (bez danych osobowych), Klaviyo: zamówienia przypisane mailom/flowom, Meta: wydatki i zakupy pikselem po dniach.
import fs from 'fs';
const START = process.env.START || '2026-10-24';
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

// Meta
const MT = env('META_TOKEN'), dzis = new Date().toISOString().slice(0, 10);
const mr = await (await fetch(`https://graph.facebook.com/v21.0/act_1262853788445873/insights?time_range={"since":"${START}","until":"${dzis}"}&time_increment=1&fields=spend,inline_link_clicks,actions,action_values&limit=100&access_token=${MT}`)).json();
const pick = (a, k) => +((a || []).find(x => x.action_type === k)?.value || 0);
for (const d of mr.data || []) out.meta.push({ dzien: d.date_start, wydatek: +(+d.spend).toFixed(2), klikniecia: +(d.inline_link_clicks || 0), koszyki: pick(d.actions, 'offsite_conversion.fb_pixel_add_to_cart'), zakupy: pick(d.actions, 'offsite_conversion.fb_pixel_purchase'), wartosc: pick(d.action_values, 'offsite_conversion.fb_pixel_purchase') });

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
fs.writeFileSync(new URL('../sprzedaz/dane.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('zamowien', out.zamowienia.length, 'meta dni', out.meta.length, 'kampanii', out.klaviyo.kampanie.length, 'flowow', out.klaviyo.flowy.length);
