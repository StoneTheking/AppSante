// Coach IA conversationnel.
import * as store from '../store.js';
import * as Diana from '../diana.js';
import * as AI from '../ai.js';
import { personContext } from '../context.js';
import { icon, esc, md, $, $$ } from '../ui.js';

const QUICK = [
  ['utensils', 'Que manger ce soir ?'],
  ['dumbbell', 'Quel sport aujourd’hui et à quelle heure ?'],
  ['trend', 'Analyse ma semaine : 3 priorités'],
  ['moon', 'Comment mieux dormir ?'],
  ['phone', 'Comment réduire mon temps d’écran ?'],
  ['brain', 'Je me sens à plat, que faire ?'],
];

function sourcesHtml(sources = []) {
  if (!sources?.length) return '';
  return `<div class="src" style="border-top:1px solid var(--line);margin-top:8px;padding-top:6px">${icon('book', 12)} Sources consultées :<br>${sources.map((s, i) => `${i + 1}. <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>`).join('<br>')}</div>`;
}

export function render(view, ctx) {
  const st = store.get();
  const chat = st.chat;
  view.innerHTML = `
    ${chat.length ? `<div class="between" style="margin:4px 0 10px"><span class="small muted">${chat.length} message${chat.length > 1 ? 's' : ''}</span><button class="btn sm ghost" id="clear">${icon('trash', 14)} Nouvelle conversation</button></div>` : `
    <div class="coach-empty">
      <div class="coach-diana">${Diana.face('cheer', 84)}</div>
      <h2>Coach Diana</h2>
      <p class="small muted">Elle connaît ton profil, ton sommeil, ton humeur, ton temps d’écran, ton activité et tes repas. Elle s’appuie sur une base de 60+ études et peut consulter PubMed, l’OMS, l’ANSES et les grandes revues médicales.</p>
    </div>`}
    ${!st.settings.apiKey ? `<div class="note warn">${icon('key', 18)}<span>Ajoute une clé IA dans <a href="#" data-profile>Profil</a> pour discuter avec Diana. Une clé Google Gemini est gratuite.</span></div>` : ''}
    <div class="chat" id="chat">${chat.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? md(m.content) + sourcesHtml(m.sources) : esc(m.content)}</div>`).join('')}</div>
    ${!chat.length ? `<div class="stack" style="margin-top:8px">${QUICK.map(([ic, q]) => `<button class="suggest" style="width:100%;border:0;text-align:left" data-q="${esc(q)}"><span class="row" style="flex-wrap:nowrap"><span style="color:var(--primary)">${icon(ic, 18)}</span><span class="ttl">${esc(q)}</span></span>${icon('right', 16)}</button>`).join('')}</div>` : ''}
    <div style="height:90px"></div>
    <div class="composer"><textarea id="ask" rows="1" placeholder="Pose ta question…"></textarea><button class="btn" id="send" aria-label="Envoyer">${icon('send', 18)}</button></div>`;

  const ask = $('#ask', view);
  ask.addEventListener('input', () => { ask.style.height = '44px'; ask.style.height = Math.min(120, ask.scrollHeight) + 'px'; });
  const send = async (text) => {
    text = text.trim();
    if (!text) return;
    store.update((s) => s.chat.push({ role: 'user', content: text }));
    render(view, ctx);
    const box = $('#chat', view);
    const bubble = document.createElement('div');
    bubble.className = 'msg assistant';
    bubble.innerHTML = '<span class="spinner"></span>';
    box.appendChild(bubble);
    bubble.scrollIntoView({ block: 'end', behavior: 'smooth' });
    try {
      const { text: answer, sources } = await AI.coachChat(st.settings, store.get().chat.slice(-20).map(({ role, content }) => ({ role, content })), personContext(), (acc) => { bubble.innerHTML = md(acc); }, { webSearch: st.settings.webSearch });
      store.update((s) => s.chat.push({ role: 'assistant', content: answer, sources }));
      bubble.innerHTML = md(answer) + sourcesHtml(sources);
    } catch (e) {
      store.update((s) => s.chat.pop());
      bubble.innerHTML = `<span style="color:var(--bad)">${icon('alert', 16)} ${esc(AI.friendlyError(e))}</span>`;
    }
  };
  $('#send', view).onclick = () => send(ask.value);
  ask.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 700) { e.preventDefault(); send(ask.value); } });
  $$('[data-q]', view).forEach((b) => (b.onclick = () => send(b.dataset.q)));
  $('#clear', view)?.addEventListener('click', () => { store.update((s) => (s.chat = [])); render(view, ctx); });
  view.querySelector('[data-profile]')?.addEventListener('click', (e) => { e.preventDefault(); ctx.go('profile'); });
  $('#chat', view).lastElementChild?.scrollIntoView({ block: 'end' });
}
