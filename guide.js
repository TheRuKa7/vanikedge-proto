// The guide inside each product, for a first-time person: what you need (checked live, with the one thing that fixes each),
// the set-up in order for whoever runs the app, and how to do each thing in a few steps with a button that goes there.
// One layout for VanikGPT and Vanik Sense. The words are in prds/PRD-APP-ADMIN-AND-GUIDES.md.
import { S, esc, icon, chip } from './core.js';

const need = (ok, label, sub, fix = '', optional = false) => `<div class="set-row">${icon(ok ? 'check_circle' : optional ? 'radio_button_unchecked' : 'error_outline', ok ? 'gd-ok' : optional ? 'gd-opt' : 'gd-miss')}<div class="grow"><div class="lbl">${label}${optional ? ' ' + chip('Optional', '', false) : ''}</div><div class="small muted" style="white-space:normal">${sub}</div></div>${ok ? '' : fix}</div>`;
const step = (n, done, label, sub, btn) => `<div class="set-row">${done ? icon('check_circle', 'gd-ok') : `<span class="sc-num">${n}</span>`}<div class="grow"><div class="lbl">${label}</div><div class="small muted" style="white-space:normal">${sub}</div></div>${btn}</div>`;
const flow = (ic, title, steps, btn = '') => `<details class="gd-flow"><summary>${icon(ic)}<span class="grow">${title}</span>${icon('expand_more', 'gd-chev')}</summary><ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>${btn ? `<div class="row" style="margin:4px 0 12px 46px">${btn}</div>` : ''}</details>`;
const link = (label, href, main = false) => `<a class="btn ${main ? '' : 'ghost'}" href="${href}">${label}</a>`;
const act = (label, a, main = false) => `<button class="btn ${main ? '' : 'ghost'}" data-act="${a}">${label}</button>`;
const card = (title, sub, body) => `<div class="card"><div class="card-head"><h3>${title}</h3></div>${sub ? `<p class="small muted" style="margin:-4px 0 8px">${sub}</p>` : ''}${body}</div>`;
const askAdmin = names => `<span class="small muted">Ask ${esc(names)}</span>`;

// ================= VanikGPT =================
export function gptGuide() {
  const B = S.boot, cfg = B.app.config, g = B.gptAdmin || { names: [], managed: false }, gs = B.gptSetup || { web: {} }, admin = B.admin;
  const serving = B.models.filter(m => m.kind === 'chat' && m.status === 'serving'), custom = cfg.link && cfg.link.mode === 'custom', kb = B.gptCollectionIds.length;
  const runBy = g.names.length ? g.names.join(', ') : 'the console admins', fix = (label, href) => admin ? link(label, href) : askAdmin(runBy);
  const opts = g.managed ? '#/gpt/manage' : '#/os/apps/vanikgpt/setup';
  return `<div class="stack" style="gap:16px;max-width:820px">
    ${card('What you need', 'Checked for you just now.', `
      ${need(B.app.status === 'running', 'VanikGPT is running', B.app.status === 'running' ? 'On your Vanik Appliance.' : 'It is installed but not started.', fix('Open VanikGPT in the console', '#/os/apps/vanikgpt/overview'))}
      ${need(custom || serving.length > 0, 'A model to answer', custom ? `A custom endpoint: ${esc(cfg.link.model)}.` : serving.length ? `${serving.map(m => esc(m.id)).join(', ')} ${serving.length === 1 ? 'is' : 'are'} serving.` : 'No chat model is serving, so answers are built straight from documents.', fix('Open Model Hub', '#/os/models'))}
      ${need(B.canUseGpt, 'You are allowed to use it', B.canUseGpt ? 'Your account can open VanikGPT.' : 'Your account has not been given VanikGPT.', askAdmin(runBy))}
      ${need(kb > 0, 'A knowledge base to answer from', kb ? `${kb} ${kb === 1 ? 'knowledge base is' : 'knowledge bases are'} open to you. Answers name the documents they used.` : 'None yet. VanikGPT still answers from the model, and from a file you attach to a chat.', fix('Make a knowledge base', '#/os/knowledge'), true)}
      ${need(!!gs.web.on, 'Web search', gs.web.on ? `On. ${gs.web.left} of ${gs.web.credits} browsing credits left this month.` : 'Off for this workspace. Nothing leaves your network.', fix('Open the setting', opts), true)}
      <div class="set-row">${icon('support_agent', 'gd-opt')}<div class="grow"><div class="lbl">Who to ask</div><div class="small muted">VanikGPT is run by ${esc(runBy)}.</div></div></div>`)}
    ${admin || g.can ? card('Set it up, in this order', 'For whoever runs VanikGPT. Each step opens the place to do it.', `
      ${admin ? step(1, g.managed, 'Decide who runs VanikGPT', 'Console admins, or an app admin who then changes web search, guardrails and safety inside VanikGPT.', link('Setup', '#/os/apps/vanikgpt/setup')) : ''}
      ${admin ? step(2, custom || serving.length > 0, 'Serve a chat model', 'Whatever is serving in Model Hub is offered in chat. Nothing is picked a second time.', link('Model Hub', '#/os/models')) : ''}
      ${admin ? step(3, B.collections.some(c => c.state !== 'draft' && c.docCount), 'Make a knowledge base, add documents, publish', 'A draft is seen by admins only. Tick the apps and the people who may use it.', link('Knowledge', '#/os/knowledge')) : ''}
      ${admin ? step(4, B.teams.length > 0, 'Make teams and choose who can use VanikGPT', 'A team gets the app or a knowledge base in one go.', link('People', '#/os/people')) : ''}
      ${admin ? step(5, true, 'Choose where chats are kept', 'A database or files on disk, and the space set aside. Changing it later removes the chats kept so far.', link('Setup', '#/os/apps/vanikgpt/setup')) : ''}
      ${step(admin ? 6 : 1, !!cfg.instructions, 'Web search, guardrails and safety', 'House rules for every chat, what happens to personal data, topics never answered, file uploads.', link(g.managed ? 'VanikGPT admin' : 'Setup', opts))}`) : ''}
    ${card('How to', 'Open one to see the steps.', `
      ${flow('forum', 'Ask a question from your documents', ['Type the question in the box and press Enter.', 'Read the answer. The numbered boxes under it are the documents it used.', 'Press a box to open the exact passage.'], link('Ask one now', '#/gpt', true))}
      ${flow('library_books', 'Choose what it answers from', ['Press + beside the box, then "Answer from".', 'Pick one or more knowledge bases, or "No knowledge" to let the model answer on its own.', 'The choice stays for that chat and shows as a pill in the box.'], link('See your knowledge', '#/gpt/knowledge'))}
      ${flow('attach_file', 'Ask about a file of your own', ['Drop the file on the box, or press + and choose "Add files".', 'Ask your question. The file is searched only in that chat.', 'Nobody else sees the file unless you share it.'])}
      ${flow('group_add', 'Share a file with your team', ['Attach the file to a chat.', 'Press the share icon on the file.', 'Pick a knowledge base you can add to. Everyone with that knowledge base can then ask about it.'])}
      ${gs.web.on ? flow('travel_explore', 'Search the web', ['Ask for something that changes by the day, or ask for a search.', 'VanikGPT says it will switch on web search for that chat and that it may use browsing credits.', 'Choose "Switch on and search", or "Answer without the web". The globe in the box switches it off again.']) : ''}
      ${flow('edit', 'Fix a question or ask again', ['Press the pencil beside your question to change it. Everything after it is replaced.', 'Press the round arrow under an answer to get it again.', 'Use the thumbs to tell your admin what worked.'])}
      ${flow('search', 'Find an earlier chat', ['Type in "Search chats" on the left.', 'Matches come from the titles and from what was said.'])}`)}
  </div>`;
}

// ================= Vanik Sense =================
const WAY = { teams: 'Teams meetings, by themselves', mic: 'Record on this computer', desktop: 'The desktop app', upload: 'Transcripts and notes by hand' };
export function senseGuide(st) {
  const way = st.capture || '', src = st.sources || {}, runBy = st.runBy.length ? st.runBy.join(', ') : 'the console admins', fixAdmin = (label, href) => st.canAdmin ? link(label, href) : askAdmin(runBy);
  const adminHref = st.runBy.length ? '#/app/sense/admin' : '#/os/apps/sense/setup', allowed = [src.teams && 'Teams', src.outlook && 'Outlook calendar', src.gcal && 'Google Calendar', src.slack && 'Slack', src.zoom && 'Zoom', st.byHand && 'Notes and transcripts by hand', src.mic && 'This computer\'s microphone', src.autoMic && 'Starting by itself'].filter(Boolean);
  return `<div class="stack" style="gap:16px;max-width:820px">
    ${card('What you need', 'Checked for you just now.', `
      ${need(true, 'Vanik Sense is given to you', `Your role is ${esc(st.role || 'Member')}.`)}
      ${need(!!way, 'A way for your calls to reach Sense', way ? WAY[way] + '.' : 'Not chosen yet. It takes a minute.', link('Choose', '#/app/sense/welcome', true))}
      ${!way || way === 'teams' ? need(st.calendar, 'Your calendar is connected', st.calendar ? 'Sense knows which meetings you had and who was in them.' : 'Without it Sense cannot find your Teams meetings.', link('Connect', '#/app/sense/settings')) : ''}
      ${!way || way === 'teams' ? need(st.transcribe || st.meetings > 0, 'Transcription is on in your Teams meetings', 'Sense reads the transcript Teams makes. With transcription off there is nothing to read.', act('Show me how', 'ss-guide')) : ''}
      ${way === 'mic' ? need(st.mic, 'This browser may use the microphone', 'Asked once. Sense listens only while you record.', act('Allow', 'ss-mic')) : ''}
      ${need(allowed.length > 0, 'Ways in your company allows', allowed.length ? allowed.join(' · ') : 'None are switched on.', fixAdmin('Open the settings', adminHref))}
      <div class="set-row">${icon('support_agent', 'gd-opt')}<div class="grow"><div class="lbl">Who to ask</div><div class="small muted">Vanik Sense is run by ${esc(runBy)}.</div></div></div>`)}
    ${st.canAdmin ? card('Set it up, in this order', 'For whoever runs Vanik Sense. Each step opens the place to do it.', `
      ${st.tenantAdmin ? step(1, st.runBy.length > 0, 'Decide who runs Vanik Sense', 'Console admins, or an app admin who then changes the settings inside Vanik Sense.', link('Setup', '#/os/apps/sense/setup')) : ''}
      ${step(2, allowed.length > 0, 'Choose the ways in', 'Teams, calendars, Slack, Zoom, notes by hand, this computer\'s microphone, and starting by itself.', link('Open', adminHref))}
      ${step(3, false, 'Allow transcription in Teams for the company', 'In the Teams admin centre, under Meetings, Meeting policies, Recording and transcription. Then people switch it on in each meeting.', act('The steps', 'ss-guide'))}
      ${step(4, st.orgLoaded, 'Load who reports to whom', 'From a sheet or your HR system. Needed only if managers should see their teams.', link('Open', adminHref))}
      ${step(5, st.rule.reach !== 'off', 'Decide what a manager can see', 'Off until you choose. Never for one to ones and interviews unless you say so.', link('Open', adminHref))}
      ${st.tenantAdmin ? step(6, true, 'Choose where meetings are kept', 'A database or files on disk, and the space set aside. Changing it later removes the meetings kept so far.', link('Setup', '#/os/apps/sense/setup')) : ''}`) : ''}
    ${card('How to', 'Open one to see the steps.', `
      ${flow('groups', 'Get a Teams meeting in', ['Before the meeting, open it in Teams and open Meeting options. Under Recording & transcription, set "Record and transcribe automatically" to "Record and transcribe" or "Transcribe only", then press Apply.', 'Hold the meeting. Teams tells everyone it is being recorded and transcribed.', 'A few minutes after it ends, the meeting is on your Home and in Meetings.'], act('Show me in Teams', 'ss-guide'))}
      ${src.mic ? flow('mic', 'Record a call on this computer', ['Open Meetings and press Record.', 'Let the browser use the microphone, and tell everyone that the call is being transcribed.', 'Press Stop. The minutes and actions appear in Meetings.'], act('Record now', 'sn-record')) : ''}
      ${st.byHand ? flow('edit_note', 'Add notes from a call', ['Press "Add notes" on Home or in Meetings.', 'Name the call and type what was decided, one point a line. Start a line with a name and a colon to say who said it.', 'Sense finds the promises, gives each an owner, and files the call under its kind.'], act('Add notes', 'sn-notes', true)) : ''}
      ${flow('event_note', 'Read a meeting', ['Open it from Meetings.', 'Summary first, then actions, then the reading for that kind of call.', 'Press a line in the minutes to see who said it and when.'], link('Meetings', '#/app/sense/meetings'))}
      ${flow('task_alt', 'Work your actions', ['Open Actions. Overdue is first.', 'Tick one when it is done, move its date, or remind its owner.', 'A daily email lists what is overdue and what is due tomorrow.'], link('Actions', '#/app/sense/actions'))}
      ${flow('insights', 'See what a kind of call tells you', ['Open Insights and pick the kind: customer, supplier, interview, update, review, team sync or one to one.', 'Each kind has its own reading. A customer call shows what was asked for and a confidence score with its reasons.', 'Press any figure to see the lines behind it.'], link('Insights', '#/app/sense/insights'))}
      ${flow('bookmarks', 'Get ready for the next call', ['Open Library and keep what worked: a pitch, a question list, a checklist.', 'Before a call with someone you have met, press "Get ready" under Coming up on Home.', 'The brief shows what was promised last time and what is still open.'], link('Library', '#/app/sense/library'))}
      ${flow('forum', 'Ask across your meetings', ['Open Ask and type the question.', 'The answer shows the meeting and the line it came from.'], link('Ask', '#/app/sense/ask'))}
      ${st.team ? flow('supervisor_account', 'See your team\'s calls', ['Open Meetings and choose "My team".', 'You see what your company allows: actions only, minutes, or everything. Never the kinds it has ruled out.', 'Each opening is recorded, and the people in the call can see that you opened it.'], link('My team', '#/app/sense/meetings/team')) : ''}`)}
  </div>`;
}
