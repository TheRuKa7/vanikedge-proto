// Vanik Sense after the MVP: what a call was read for (by its kind), the roll-up of many calls, the library that makes
// the next call better, and the connections. Server side: sense_insight.js and sense.js. Drawn by sense.js.
import { $, esc, icon, info, chip, go, api, rerender, acts, ins, toast, modal, confirmBox } from './core.js';
import { get, P } from './suite.js';

const loading = '<p class="muted">Loading…</p>';
const IS = { type: '', kind: '', ltype: '', q: '', scope: 'me' };
const initials = n => esc(n.split(' ').map(w => w[0]).join('').slice(0, 2));
const day = iso => new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fresh = (...s) => s.forEach(k => { P[k + 'Key'] = ''; });
export const typeTag = t => `<span class="tag in-type">${esc(t)}</span>`;

// ---------- one block of a reading: a score, quotes, a list, people, or a text to copy
const quote = x => `<div class="set-row" style="align-items:flex-start"><div class="grow"><div>${esc(x.text)}</div><div class="small muted">${esc(x.who)}${x.t ? ' · ' + x.t : ''}</div></div></div>`;
const person = p => `<div class="set-row" style="align-items:flex-start"><span class="avatar">${initials(p.name)}</span><div class="grow"><div class="lbl">${esc(p.name)} ${chip(p.persona, p.persona === 'Decision maker' ? 'ok' : '', false)}</div>
  <div class="small muted">${esc([p.title, p.company].filter(Boolean).join(', ') || (p.outside ? 'From outside' : 'Your company'))} · spoke ${p.share}% of the time</div>
  ${p.topics.length ? `<div class="row wrap" style="gap:6px;margin-top:6px">${p.topics.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}${p.questions.length ? `<div class="small" style="margin-top:6px">Asked: ${esc(p.questions[0])}</div>` : ''}</div></div>`;
function block(b, mid) {
  const none = `<p class="muted">${esc(b.none || 'Nothing here.')}</p>`, text = b.kind === 'text' ? b.text : (b.items || []).map(x => (typeof x === 'string' ? x : x.text)).join('\n');
  const save = b.save ? `<button class="btn text" data-act="in-save" data-kind="${esc(b.save.kind)}" data-title="${esc(b.save.title)}" data-text="${esc(text)}" data-m="${mid || ''}">${icon('bookmark_add')}Save to library</button>` : '';
  const body = b.kind === 'score' ? `<div class="row" style="gap:14px;margin-bottom:10px"><div class="in-score ${b.band.toLowerCase()}">${b.score}</div><div><b>${b.band}</b><div class="small muted">out of 100</div></div></div>${b.why.map(w => `<div class="set-row" style="align-items:flex-start"><span class="chip ${w.n > 0 ? 'ok' : 'err'}" style="min-width:44px;justify-content:center">${w.n > 0 ? '+' : ''}${w.n}</span><div class="grow"><div>${esc(w.text)}</div>${w.quote ? `<div class="small muted">"${esc(w.quote)}" ${esc(w.who)}${w.t ? ' · ' + w.t : ''}</div>` : ''}</div></div>`).join('')}`
    : b.kind === 'quotes' ? (b.items.length ? b.items.map(quote).join('') : none)
      : b.kind === 'people' ? (b.items.length ? b.items.map(person).join('') : none)
        : b.kind === 'text' ? `<pre class="in-pre">${esc(b.text)}</pre><button class="btn ghost" style="margin-top:10px" data-act="in-copy" data-text="${esc(b.text)}">${icon('content_copy')}Copy</button>`
          : (b.items.length ? b.items.map(x => `<div class="row small" style="margin-bottom:8px;align-items:flex-start">${icon('chevron_right')}<span>${esc(x)}</span></div>`).join('') : none);
  return `<div class="card"><div class="card-head"><h3>${esc(b.title)}</h3>${b.tip ? info(b.tip) : ''}<span class="grow"></span>${save}</div>${body}</div>`;
}
export const blocks = (list, mid) => list.map(b => block(b, mid)).join('');
// what every kind of call gets: who spoke, and what was talked about
export const spoken = i => `<div class="card"><div class="card-head"><h3>Who spoke, and about what</h3><span class="grow"></span><span class="small muted">${i.questions} questions asked</span></div>
  ${i.people.map(p => `<div class="in-bar"><span class="small ellipsis">${esc(p.name)}</span><i><b style="width:${p.share}%"></b></i><span class="small mono">${p.share}%</span></div>`).join('')}
  <div class="row wrap" style="gap:6px;margin-top:12px">${i.topics.map(t => `<span class="tag" data-tip="Raised by ${esc(t.by.join(', '))}">${esc(t.topic)} <span class="mono">${t.count}</span></span>`).join('') || '<span class="small muted">No topic from the list came up.</span>'}</div></div>`;
acts['in-copy'] = async el => { await navigator.clipboard.writeText(el.dataset.text).catch(() => {}); toast('Copied.'); };
acts['in-save'] = async el => { try { await api('POST', '/api/sense/library', { kind: el.dataset.kind, title: el.dataset.title, text: el.dataset.text, meetingId: el.dataset.m }); fresh('snLib'); toast('Saved to your library.'); } catch (e) { toast(e.message, 'err'); } };

// ---------- Insights: one dashboard for each kind of call
acts['in-type'] = el => { IS.type = el.dataset.v; fresh('snIns'); rerender(); };
acts['in-scope'] = el => { IS.scope = el.dataset.v; fresh('snIns'); rerender(); };
export function insightsPage() {
  const R = get('snIns', IS.type + IS.scope, '/api/sense/insights?type=' + encodeURIComponent(IS.type) + '&scope=' + IS.scope); if (!R) return loading;
  const st = P.snSetup, want = st && { Sales: 'Customer sales call', 'Customer support': 'Customer sales call', Procurement: 'Vendor or supplier call', 'HR and people': 'Hiring interview', Leadership: 'Leadership review' }[st.dept];
  if (!IS.init && st && R.types.length) { IS.init = true; if (want && !IS.type && R.types.some(t => t.type === want)) { IS.type = want; fresh('snIns'); return insightsPage(); } } // opens on the kind of call that fits the person's work
  if (!R.types.length) return `<div class="card ss-empty"><h3>Insights appear after your first meeting</h3><p class="muted">Each meeting is read for what its kind of call is for: what a customer asked for, the numbers said in a review, the minutes of an update.</p><div class="row" style="justify-content:center;margin-top:14px"><a class="btn" href="#/app/sense/meetings">Go to Meetings</a></div></div>`;
  const table = t => `<div class="card" style="padding:0;overflow:auto;margin-bottom:16px"><div class="card-head" style="padding:16px 18px 0"><h3>${esc(t.title)}</h3></div>${t.rows.length ? `<table class="list"><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${t.rows.map(r => `<tr>${r.map((c, n) => `<td class="${n ? 'small' : ''}">${n ? esc(String(c)) : `<b>${esc(String(c))}</b>`}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="muted" style="padding:0 18px 16px">Nothing yet.</p>'}</div>`;
  const list = l => `<div class="card"><div class="card-head"><h3>${esc(l.title)}</h3></div>${l.items.length ? l.items.map(x => `<div class="set-row"><div class="grow">${esc(x.text)}</div>${x.n ? `<span class="mono">${x.n}</span>` : ''}</div>`).join('') : '<p class="muted">Nothing yet.</p>'}</div>`;
  return `${R.hasTeam ? `<div class="seg" style="margin-bottom:14px"><button class="${R.scope === 'me' ? 'on' : ''}" data-act="in-scope" data-v="me">My calls</button><button class="${R.scope === 'team' ? 'on' : ''}" data-act="in-scope" data-v="team">My team</button></div>` : ''}${R.limited ? `<div class="banner" style="margin-bottom:14px">${icon('info')}Your company opens only the actions of your team's meetings to you, so this shows counts and promises.</div>` : ''}<div class="row wrap" style="gap:8px;margin-bottom:16px"><span class="cap">Kind of call</span><button class="toggle ${IS.type ? '' : 'on'}" data-act="in-type" data-v="">All calls</button>${R.types.map(t => `<button class="toggle ${IS.type === t.type ? 'on' : ''}" data-act="in-type" data-v="${esc(t.type)}">${esc(t.type)} <span class="mono">${t.n}</span></button>`).join('')}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:16px">${R.cards.map(c => `<div class="card stat"><span class="small muted">${esc(c.label)}</span><b>${c.value}</b></div>`).join('')}</div>
    ${R.tables.map(table).join('')}<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">${R.lists.map(list).join('')}</div>
    <p class="small muted" style="margin-top:14px">${icon('lock')} ${R.scope === 'team' ? 'Built from the calls you were in and the calls your company opens to you as a manager.' : 'Built only from the calls you were in.'}</p>`;
}

// ---------- Library: what makes the next call better, and a brief before it
ins['in-lq'] = el => { IS.q = el.value; fresh('snLib'); rerender(); };
ins['in-lf'] = el => { IS[el.dataset.k] = el.value; fresh('snLib'); rerender(); };
ins['in-prep'] = el => { if (el.value) go('#/app/sense/library/' + encodeURIComponent(el.value)); };
acts['in-share'] = async el => { await api('PUT', '/api/sense/library/' + el.dataset.id, { shared: !el.dataset.on }); fresh('snLib'); rerender(); };
acts['in-del'] = el => confirmBox('Remove this from the library?', 'It is removed for everyone it was shared with.', 'Remove', async () => { await api('DELETE', '/api/sense/library/' + el.dataset.id); fresh('snLib'); rerender(); }, true);
acts['in-new'] = () => { const R = P.snLib; modal({ title: 'Add to the library', body: `<div class="stack" style="gap:10px"><select class="input" id="il-k">${R.kinds.map(k => `<option>${esc(k)}</option>`).join('')}</select><select class="input" id="il-t"><option value="">Any kind of call</option>${R.types.map(t => `<option>${esc(t)}</option>`).join('')}</select><input class="input" id="il-n" placeholder="Name"><textarea class="input" id="il-x" rows="5" placeholder="The words to reuse"></textarea></div>`,
  actions: [{ label: 'Add', run: async o => { await api('POST', '/api/sense/library', { kind: $('#il-k', o).value, type: $('#il-t', o).value, title: $('#il-n', o).value, text: $('#il-x', o).value }); fresh('snLib'); rerender(); } }] }); };
export function libraryPage(name) {
  if (name) { const B = get('snPrep', name, '/api/sense/prep?account=' + encodeURIComponent(name));
    return `<a class="back" href="#/app/sense/library">${icon('arrow_back')}Library</a>${!B ? loading : `<div class="page-head"><div class="grow"><h1>Before your next call with ${esc(B.account)}</h1><p class="sub">${B.calls} ${B.calls === 1 ? 'call' : 'calls'} so far. Last: <a href="#/app/sense/meetings/${B.last.id}" style="text-decoration:underline">${esc(B.last.title)}</a>, ${day(B.last.at)}.</p></div>${typeTag(B.last.type)}</div><div class="in-cols">${blocks(B.blocks)}</div>`}`; }
  const qs = new URLSearchParams({ q: IS.q, kind: IS.kind, type: IS.ltype }).toString(), R = get('snLib', qs, '/api/sense/library?' + qs); if (!R) return loading;
  return `<div class="card" style="margin-bottom:16px"><div class="row wrap" style="gap:12px"><div class="grow"><h3>Get ready for a call</h3><p class="small muted">Where things stand, what each side still owes, what they asked for, and a pitch.</p></div>${R.accounts.length ? `<select class="input" style="width:auto" data-change="in-prep" aria-label="Who is the call with"><option value="">Who is it with?</option>${R.accounts.map(a => `<option>${esc(a)}</option>`).join('')}</select>` : '<span class="small muted">Shown after your first call with a customer or a supplier.</span>'}</div></div>
    <div class="row wrap" style="gap:8px;margin-bottom:16px"><input class="input grow" style="min-width:200px" placeholder="Search the library" value="${esc(IS.q)}" data-change="in-lq"><select class="input" style="width:auto" data-change="in-lf" data-k="kind"><option value="">Everything</option>${R.kinds.map(k => `<option ${IS.kind === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select><select class="input" style="width:auto" data-change="in-lf" data-k="ltype"><option value="">Any kind of call</option>${R.types.map(t => `<option ${IS.ltype === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><button class="btn" data-act="in-new">${icon('add')}Add</button></div>
    ${R.list.length ? `<div class="in-cols">${R.list.map(r => `<div class="card"><div class="card-head"><h3>${esc(r.title)}</h3><span class="grow"></span>${chip(r.kind, '', false)}</div><div style="white-space:pre-wrap">${esc(r.text)}</div>
      <div class="row wrap small muted" style="gap:8px;margin-top:12px">${r.type ? typeTag(r.type) : ''}<span>${esc(r.mine ? 'You' : r.by)}${r.meetingId ? ` · from <a href="#/app/sense/meetings/${r.meetingId}" style="text-decoration:underline">${esc(r.meeting)}</a>` : ''}${r.shared ? ' · shared with everyone' : ' · only you'}</span><span class="grow"></span><button class="btn text" data-act="in-copy" data-text="${esc(r.text)}">Copy</button>${r.mine ? `<button class="btn text" data-act="in-share" data-id="${r.id}" ${r.shared ? 'data-on="1"' : ''}>${r.shared ? 'Keep to myself' : 'Share'}</button><button class="btn text" data-act="in-del" data-id="${r.id}">Remove</button>` : ''}</div></div>`).join('')}</div>`
    : `<div class="empty">${icon('bookmarks')}Nothing here yet. Save a pitch, a question list or minutes from any meeting, or add your own.</div>`}`;
}

// ---------- Settings: connections
acts['in-conn'] = async el => { try { await api('PUT', '/api/sense/connections/' + el.dataset.k, { on: !el.dataset.on }); } catch (e) { toast(e.message, 'err'); } fresh('snSet', 'snHome', 'snMeet'); rerender(); };
ins['in-chan'] = async el => { await api('PUT', '/api/sense/connections/slack', { channel: el.value }); fresh('snSet', 'snMeet'); toast('Saved.'); };
export const connections = s => `<div class="card"><div class="card-head"><h3>Connections</h3>${info('What Vanik Sense reads from and sends to. Each person connects their own.')}</div>${s.connections.map(c => `<div class="set-row"><div class="grow"><div class="lbl">${esc(c.name)}</div><div class="small muted" style="white-space:normal">${esc(c.what)}</div>${c.key === 'slack' && c.on ? `<input class="input" style="margin-top:8px;max-width:260px" placeholder="#channel for minutes" value="${esc(c.channel)}" data-change="in-chan" aria-label="Slack channel">` : ''}</div>
  <button class="switch ${c.on ? 'on' : ''}" role="switch" aria-checked="${c.on}" aria-label="${esc(c.name)}" data-act="in-conn" data-k="${c.key}" ${c.on ? 'data-on="1"' : ''}></button></div>`).join('')}</div>`;
