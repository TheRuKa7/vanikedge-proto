// Reads a transcript for the meeting page, the way Fireflies' Notepad and Otter's conversation page lay one out (14 Oct 2026):
// keywords, an outline with times, who spoke how much, a strip of who spoke when, the lines that are questions, promises,
// dates or numbers, and the topics a company tracks. Everything here is counting and word matching over the lines;
// nothing is guessed by a model, so each figure can be traced to its lines. Rules are in prds/PRD-VANIK-SENSE-PARITY.md.
module.exports = function notes() {
  const STOP = new Set(('about above after again against because before being below between could would should there their these those where which while every other really think going still thing things maybe little might never always right okay thanks thank please today tomorrow yesterday people person month months week weeks years first second third great sure yeah hello have with that this from were will what when your they them then than into over also just some more most much many very been does doing done make made need needs want wants like look looks said says tell told know known take taken give given send sends').split(' '));
  const TASK = /\b(i will|i'll|we will|we'll|will (send|share|check|confirm|raise|update|get|come back|follow)|let me|i can (send|share|check)|need(s)? to|please (send|share|check|confirm)|follow up|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|end of))\b/i;
  const DATE = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next (week|month|quarter|year)|this (week|month|quarter)|end of (the )?(week|month|quarter|year)|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}(st|nd|rd|th)\b|\d{1,2}[:.]\d{2}\s?(am|pm)?)\b/i;
  const NUM = /(₹|\brs\.?\s?\d|\$\s?\d|\d\s?%|\b\d[\d,.]*\s?(lakh|lakhs|crore|crores|k|units?|days?|weeks?|months?|percent|rupees|pieces|hours?|minutes?|years?)\b)/i;
  const TRACKERS0 = [{ id: 'tr_price', name: 'Pricing', words: ['price', 'pricing', 'quote', 'discount', 'rate', 'cost', 'budget'] }, { id: 'tr_delivery', name: 'Delivery', words: ['delivery', 'lead time', 'dispatch', 'deadline', 'delay', 'late'] },
    { id: 'tr_rival', name: 'Competition', words: ['competitor', 'other supplier', 'another vendor', 'alternative', 'cheaper'] }, { id: 'tr_risk', name: 'Concerns', words: ['risk', 'concern', 'worried', 'problem', 'issue', 'blocked', 'complaint'] }, { id: 'tr_next', name: 'Next steps', words: ['next step', 'follow up', 'schedule', 'by friday', 'next week'] }];
  const wordsOf = t => String(t).match(/[A-Za-z][A-Za-z'-]+/g) || [];
  const cut = (t, n) => { const s = String(t).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  const clean = t => String(t).replace(/^(so|okay|ok|yes|no|well|right|and|but|sure|thanks|thank you)[,.]?\s+/i, '').replace(/^[a-z]/, c => c.toUpperCase());

  function analyze(m, trackers) {
    const L = m.transcript || [], names = new Set(L.flatMap(l => l.who.toLowerCase().split(/\s+/)));
    const flags = L.map(l => { const low = l.text.toLowerCase(); return { q: l.text.includes('?'), task: TASK.test(l.text), date: DATE.test(l.text), num: NUM.test(l.text), tr: trackers.filter(t => t.words.some(w => low.includes(w))).map(t => t.id) }; });
    // who spoke how much: words are the measure, since the sound is not kept
    const by = new Map();
    L.forEach((l, i) => { const n = wordsOf(l.text).length, s = by.get(l.who) || { who: l.who, words: 0, turns: 0, questions: 0, longest: 0 }; s.words += n; s.turns++; if (flags[i].q) s.questions++; s.longest = Math.max(s.longest, n); by.set(l.who, s); });
    const total = [...by.values()].reduce((a, s) => a + s.words, 0) || 1, talk = [...by.values()].sort((a, b) => b.words - a.words).map(s => ({ ...s, pct: Math.round(100 * s.words / total) }));
    const timeline = []; L.forEach((l, i) => { const n = Math.max(1, wordsOf(l.text).length), last = timeline[timeline.length - 1]; if (last && last.who === l.who) last.w += n; else timeline.push({ who: l.who, w: n, i, t: l.t }); });
    // the words said most, leaving out small words and people's names
    const freq = new Map(); L.forEach(l => wordsOf(l.text).forEach(w => { const k = w.toLowerCase(); if (k.length < 5 || STOP.has(k) || names.has(k)) return; freq.set(k, (freq.get(k) || 0) + 1); }));
    const top = [...freq.entries()].filter(e => e[1] > 1).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 8).map(e => e[0]), keywords = top.map(w => w[0].toUpperCase() + w.slice(1));
    // an outline: the lines in order, cut into a few parts; each part is headed by its weightiest line and lists up to three more
    const weight = (l, i) => top.filter(w => l.text.toLowerCase().includes(w)).length + (flags[i].task ? 2 : 0) + (flags[i].num ? 1 : 0) + (flags[i].date ? 1 : 0) + Math.min(2, wordsOf(l.text).length / 14);
    const parts = Math.min(5, Math.max(1, Math.ceil(L.length / 6))), size = Math.ceil(L.length / parts), outline = [];
    for (let p = 0; p < parts && L.length; p++) { const idx = [...Array(Math.min(size, L.length - p * size)).keys()].map(k => p * size + k); if (!idx.length) break;
      const ranked = [...idx].sort((a, b) => weight(L[b], b) - weight(L[a], a)), head = ranked[0];
      outline.push({ t: L[idx[0]].t, i: idx[0], title: cut(clean(L[head].text.split(/(?<=[.?!])\s/)[0]), 72), bullets: ranked.slice(1, 4).sort((a, b) => a - b).map(i => ({ i, t: L[i].t, text: `${L[i].who.split(' ')[0]}: ${cut(L[i].text, 130)}` })) }); }
    const tracked = trackers.map(t => ({ id: t.id, name: t.name, lines: flags.map((f, i) => (f.tr.includes(t.id) ? i : -1)).filter(i => i >= 0) })).filter(t => t.lines.length).map(t => ({ ...t, count: t.lines.length }));
    return { keywords, outline, talk, timeline, flags, tracked, counts: { questions: flags.filter(f => f.q).length, tasks: flags.filter(f => f.task).length, dates: flags.filter(f => f.date).length, nums: flags.filter(f => f.num).length } };
  }

  // across a person's meetings: how much time, how much of it they talk, and how often each tracked topic comes up
  function analytics(ms, u, trackers) {
    const mine = ms.map(m => ({ m, a: analyze(m, trackers) })), me = mine.map(x => x.a.talk.find(s => s.who === u.name)).filter(Boolean);
    const avg = l => (l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : null), week = d => { const t = new Date(d); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const weeks = [...Array(6)].map((_, k) => week(Date.now() - (5 - k) * 7 * 864e5)), byWeek = weeks.map(w => ({ week: w, meetings: ms.filter(m => week(m.at) === w).length, minutes: ms.filter(m => week(m.at) === w).reduce((a, m) => a + (m.mins || 0), 0) }));
    return { meetings: ms.length, minutes: ms.reduce((a, m) => a + (m.mins || 0), 0), talkShare: avg(me.map(s => s.pct)), questions: avg(me.map(s => s.questions)), longest: me.length ? Math.max(...me.map(s => s.longest)) : null, spoke: me.length, byWeek,
      trackers: trackers.map(t => { const hit = mine.map(x => (x.a.tracked.find(k => k.id === t.id) || { count: 0 }).count); return { id: t.id, name: t.name, words: t.words, meetings: hit.filter(Boolean).length, mentions: hit.reduce((a, b) => a + b, 0) }; }),
      people: (() => { const by = new Map(); mine.forEach(x => x.a.talk.forEach(s => { const p = by.get(s.who) || { who: s.who, meetings: 0, pct: 0 }; p.meetings++; p.pct += s.pct; by.set(s.who, p); })); return [...by.values()].filter(p => p.meetings > 1).map(p => ({ who: p.who, meetings: p.meetings, pct: Math.round(p.pct / p.meetings) })).sort((a, b) => b.meetings - a.meetings).slice(0, 8); })() };
  }
  const cleanTrackers = list => (Array.isArray(list) ? list : []).map((t, i) => ({ id: /^tr_[a-z0-9_]+$/.test(t.id || '') ? t.id : 'tr_' + Date.now().toString(36) + i, name: String(t.name || '').trim().slice(0, 30), words: [...new Set((Array.isArray(t.words) ? t.words : String(t.words || '').split(',')).map(w => String(w).trim().toLowerCase()).filter(w => w.length > 1))].slice(0, 20) })).filter(t => t.name && t.words.length).slice(0, 12);
  return { analyze, analytics, cleanTrackers, TRACKERS0 };
};
