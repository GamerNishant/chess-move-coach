/* ui.js — the floating coach panel. Lives in a closed shadow root so chess.com's
 * CSS can't touch it (and ours can't touch chess.com). All text goes through
 * textContent; nothing from the page is ever parsed as HTML. */

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
button { box-sizing: border-box !important; }
.wrap {
  --bg: #262522; --bg2: #302e2b; --bg3: #3c3a37; --fg: #f1efe9; --muted: #a8a49c;
  --line: rgba(255,255,255,.08); --accent: #81b64c; --focus: #9ecbff;
  --best: #81b64c; --good: #96bc4b; --neutral: #9c9a96; --inacc: #e8b43a; --mistake: #f08a3c; --blunder: #e5533d;
  position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; width: 340px; max-width: calc(100vw - 32px);
  font: 13.5px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg);
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3); overflow: hidden;
}
@media (prefers-color-scheme: light) {
  .wrap.auto { --bg: #ffffff; --bg2: #f5f3ef; --bg3: #e8e5df; --fg: #1d1c1a; --muted: #67635c; --line: rgba(0,0,0,.09); --focus: #1a66d2;
    box-shadow: 0 12px 32px rgba(0,0,0,.16), 0 2px 6px rgba(0,0,0,.08); }
}
.head { display: flex; align-items: center; gap: 8px; padding: 9px 10px 9px 14px; cursor: grab; user-select: none;
  background: var(--bg2); border-bottom: 1px solid var(--line); touch-action: none; }
.head:active { cursor: grabbing; }
.logo { width: 18px; height: 18px; border-radius: 5px; background: var(--accent); display: grid; place-items: center;
  color: #1b2a10; font-weight: 800; font-size: 12px; flex: none; }
.title { font-weight: 650; font-size: 13px; letter-spacing: .1px; }
.mode { font-size: 11px; color: var(--muted); background: var(--bg3); padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.sp { flex: 1; }
.icon-btn { all: unset; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); cursor: pointer; font-size: 15px; }
.icon-btn:hover { background: var(--bg3); color: var(--fg); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.body { padding: 12px 14px 14px; max-height: min(70vh, 560px); overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
.row { display: flex; align-items: center; gap: 10px; }
.san { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.who { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
.badge { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: 999px;
  font-size: 12px; font-weight: 650; color: #fff; background: var(--tone); white-space: nowrap; }
.badge b { font-size: 12px; min-width: 14px; text-align: center; }
.badge.checking { opacity: .55; }
.verify { font-size: 11px; color: var(--muted); text-align: right; margin-top: 3px; }
.verify::before { content: ''; display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 5px; background: var(--inacc); animation: pulse 1s ease-in-out infinite alternate; }
@keyframes pulse { to { opacity: .25; } }
.evalrow { display: flex; align-items: center; gap: 8px; margin: 8px 0 10px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.bar { flex: 1; height: 6px; border-radius: 999px; background: #1a1917; overflow: hidden; border: 1px solid var(--line); }
.bar i { display: block; height: 100%; background: #eeeae2; transition: width .35s ease; }
.headline { font-size: 14.5px; font-weight: 600; margin: 0 0 4px; }
.next { color: var(--muted); margin: 0; }
.better { display: flex; gap: 6px; align-items: baseline; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--best) 14%, transparent); border: 1px solid color-mix(in srgb, var(--best) 35%, transparent); }
.better strong { color: var(--best); white-space: nowrap; }
.deep-btn { all: unset; display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 12px; padding: 8px 10px;
  border-radius: 10px; background: var(--bg2); cursor: pointer; font-weight: 600; font-size: 13px; }
.deep-btn:hover { background: var(--bg3); }
.deep-btn .chev { transition: transform .2s ease; display: inline-block; }
.deep-btn[aria-expanded="true"] .chev { transform: rotate(90deg); }
.kbd { margin-left: auto; font: 11px ui-monospace, monospace; color: var(--muted); border: 1px solid var(--line); padding: 1px 5px; border-radius: 5px; }
.deep { padding: 4px 2px 0; }
.sec { margin-top: 12px; }
.sec h4 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .7px; color: var(--muted); font-weight: 650; }
.sec p { margin: 0 0 5px; }
.sec ul { margin: 0; padding-left: 17px; }
.sec li { margin: 3px 0; }
.sec li::marker { color: var(--muted); }
.summary { font-weight: 600; }
.line { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.line span { font: 12px ui-monospace, "SFMono-Regular", Consolas, monospace; background: var(--bg3); padding: 2px 6px; border-radius: 6px; }
.state { display: flex; gap: 10px; align-items: flex-start; color: var(--muted); }
.state .big { font-size: 20px; line-height: 1; }
.state strong { color: var(--fg); display: block; margin-bottom: 2px; }
.btn { all: unset; cursor: pointer; padding: 6px 11px; border-radius: 8px; background: var(--bg3); color: var(--fg); font-weight: 600; font-size: 12.5px; margin: 8px 6px 0 0; display: inline-block; }
.btn:hover { filter: brightness(1.15); }
.btn.primary { background: var(--accent); color: #17230c; }
.sk { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--bg2), var(--bg3), var(--bg2)); background-size: 200% 100%; animation: sh 1.1s linear infinite; margin: 8px 0; }
@keyframes sh { to { background-position: -200% 0; } }
.foot { padding: 7px 14px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--line); display: flex; gap: 6px; }
/* settings */
.set { display: grid; gap: 14px; }
.set label.tg { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.set label.tg span { flex: 1; }
.set label.tg small { display: block; color: var(--muted); font-size: 11.5px; }
.set input[type=checkbox] { appearance: none; width: 34px; height: 20px; border-radius: 999px; background: var(--bg3); position: relative; cursor: pointer; flex: none; margin: 0; }
.set input[type=checkbox]::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; }
.set input[type=checkbox]:checked { background: var(--accent); }
.set input[type=checkbox]:checked::after { left: 17px; }
.seg { display: flex; background: var(--bg3); border-radius: 9px; padding: 3px; gap: 3px; margin-top: 6px; }
.seg button { all: unset; flex: 1; text-align: center; padding: 5px 0; border-radius: 7px; cursor: pointer; font-size: 12.5px; color: var(--muted); }
.seg button[aria-pressed="true"] { background: var(--bg); color: var(--fg); font-weight: 650; }
.set .lbl { font-weight: 600; }
.set .lbl small { font-weight: 400; color: var(--muted); }
.hint { font-size: 11.5px; color: var(--muted); }
/* collapsed pill */
.pill { all: unset; position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 7px;
  padding: 8px 12px 8px 9px; border-radius: 999px; background: #262522; color: #f1efe9; cursor: pointer;
  font: 600 13px system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 8px 22px rgba(0,0,0,.4); }
.pill .dot { width: 18px; height: 18px; border-radius: 50%; background: var(--tone, #81b64c); color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 800; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const p in v) p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]);
    }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

const TONE = (t) => `var(--${t})`;
const TONE_HEX = { best: '#81b64c', good: '#96bc4b', neutral: '#9c9a96', inacc: '#e8b43a', mistake: '#f08a3c', blunder: '#e5533d' };

function createPanel(opts) {
  const { store, onChange, onRetry, onUseOnline, canUseOnline } = opts;
  const host = h('div', { id: 'cmc-move-coach' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', {}, CSS));
  document.documentElement.append(host);

  let settings = opts.settings;
  let view = 'main';           // 'main' | 'settings'
  let collapsed = !!settings.collapsed;
  let deepOpen = !!settings.autoDeep;
  let lastState = { kind: 'idle', text: 'Starting…' };
  let lastKey = null;

  const wrap = h('section', { class: 'wrap auto', role: 'complementary', 'aria-label': 'Move Coach' });
  const pill = h('button', { class: 'pill', 'aria-label': 'Open Move Coach (Alt+M)' });
  root.append(wrap, pill);

  function applyPos() {
    const p = settings.pos;
    for (const el of [wrap, pill]) {
      el.style.right = (p ? p.right : 20) + 'px';
      el.style.bottom = (p ? p.bottom : 20) + 'px';
    }
  }

  function save(patch) {
    settings = { ...settings, ...patch };
    store.set(settings);
    onChange && onChange(settings, patch);
  }

  function toggleCollapsed(v) {
    collapsed = v == null ? !collapsed : v;
    save({ collapsed });
    draw();
    if (!collapsed) wrap.querySelector('.icon-btn') && wrap.querySelector('.icon-btn').focus({ preventScroll: true });
  }

  // ---- dragging (header) ----
  let drag = null;
  function onDown(e) {
    if (e.target.closest('button')) return;
    const r = wrap.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, right: innerWidth - r.right, bottom: innerHeight - r.bottom };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    const right = Math.min(Math.max(drag.right - (e.clientX - drag.x), 0), innerWidth - 120);
    const bottom = Math.min(Math.max(drag.bottom - (e.clientY - drag.y), 0), innerHeight - 60);
    settings.pos = { right, bottom };
    applyPos();
  }
  function onUp() { if (drag) { drag = null; save({ pos: settings.pos }); } }

  // ---- rendering ----
  function header() {
    const g = lastState.gate;
    return h('div', { class: 'head', onpointerdown: onDown, onpointermove: onMove, onpointerup: onUp },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, '!'),
      h('div', { class: 'title' }, 'Move Coach'),
      g && g.mode ? h('span', { class: 'mode' }, g.mode) : null,
      h('div', { class: 'sp' }),
      h('button', { class: 'icon-btn', title: view === 'settings' ? 'Back' : 'Settings', 'aria-label': view === 'settings' ? 'Back to feedback' : 'Settings',
        onclick: () => { view = view === 'settings' ? 'main' : 'settings'; draw(); } }, view === 'settings' ? '←' : '⚙'),
      h('button', { class: 'icon-btn', title: 'Minimize (Alt+M)', 'aria-label': 'Minimize', onclick: () => toggleCollapsed(true) }, '—'),
    );
  }

  function stateView(icon, title, text, ...actions) {
    return h('div', {},
      h('div', { class: 'state' }, h('span', { class: 'big', 'aria-hidden': 'true' }, icon), h('div', {}, h('strong', {}, title), text)),
      actions.length ? h('div', {}, actions) : null);
  }

  function section(title, ...kids) { return h('div', { class: 'sec' }, h('h4', {}, title), kids); }
  const bullets = (arr) => (arr && arr.length ? h('ul', {}, arr.map((b) => h('li', {}, b))) : null);
  const line = (arr) => (arr && arr.length ? h('div', { class: 'line', 'aria-label': 'Engine line' }, arr.map((s) => h('span', {}, s))) : null);

  function feedbackView(fb, verifying) {
    const tone = fb.cls.tone;
    const whitePct = Math.max(2, Math.min(98, Coach.winPct(fb.whiteCp)));
    const deep = h('div', { class: 'deep', id: 'cmc-deep', hidden: !deepOpen },
      section(fb.isUser ? 'What your move did' : 'What their move did', bullets(fb.deep.did)),
      fb.deep.plan.summary ? section(fb.deep.plan.title,
        h('p', { class: 'summary' }, fb.deep.plan.summary), bullets(fb.deep.plan.bullets), line(fb.deep.plan.line)) : null,
      fb.deep.yours.bullets.length ? section(fb.deep.yours.title, bullets(fb.deep.yours.bullets), line(fb.deep.yours.line)) : null,
    );
    const deepBtn = h('button', { class: 'deep-btn', 'aria-expanded': String(deepOpen), 'aria-controls': 'cmc-deep',
      onclick: () => setDeep(!deepOpen) },
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '▸'), 'Deep dive: plans & threats', h('span', { class: 'kbd' }, 'Alt+D'));
    return h('div', {},
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'who' }, fb.isUser ? 'Your move' : 'Their move'), h('div', { class: 'san' }, fb.moveLabel)),
        h('div', { style: { marginLeft: 'auto' } },
          h('span', { class: 'badge' + (verifying ? ' checking' : ''), style: { '--tone': TONE(tone) }, title: fb.cls.label },
            h('b', { 'aria-hidden': 'true' }, fb.cls.symbol), fb.cls.label),
          verifying ? h('div', { class: 'verify', role: 'status' }, 'Double-checking deeper…') : null)),
      h('div', { class: 'evalrow', title: 'White’s winning chances after the move' },
        h('span', {}, fb.evalBefore + ' → ' + fb.evalAfter),
        h('div', { class: 'bar', role: 'img', 'aria-label': `White ${Math.round(whitePct)} percent` }, h('i', { style: { width: whitePct + '%' } }))),
      h('div', { 'aria-live': 'polite' },
        h('p', { class: 'headline' }, fb.quick.headline),
        fb.quick.next ? h('p', { class: 'next' }, fb.quick.next) : null),
      fb.quick.better ? h('div', { class: 'better' }, h('strong', {}, 'Better: ' + fb.quick.better.label), h('span', {}, fb.quick.better.why)) : null,
      deepBtn, deep);
  }

  function setDeep(v) {
    deepOpen = v;
    const btn = wrap.querySelector('.deep-btn');
    const d = wrap.querySelector('#cmc-deep');
    if (btn) btn.setAttribute('aria-expanded', String(v));
    if (d) d.hidden = !v;
  }

  function settingsView() {
    const strength = [['fast', 'Fast'], ['balanced', 'Balanced'], ['deep', 'Deep']];
    const toggle = (key, label, hint) => h('label', { class: 'tg' },
      h('span', {}, label, hint ? h('small', {}, hint) : null),
      h('input', { type: 'checkbox', checked: !!settings[key], onchange: (e) => save({ [key]: e.target.checked }) }));
    return h('div', { class: 'set' },
      h('div', {}, h('div', { class: 'lbl' }, 'Engine strength ', h('small', {}, '(Fast ≈ depth 12 · Balanced 18 · Deep 22)')),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Engine strength' },
          strength.map(([k, l]) => h('button', { 'aria-pressed': String(settings.strength === k), onclick: () => { save({ strength: k }); draw(); } }, l)))),
      toggle('autoDeep', 'Open the deep dive automatically', 'Otherwise it stays one click (or Alt+D) away.'),
      toggle('verify', 'Double-check mistakes and blunders', 'Re-runs the engine 4 moves deeper before a bad verdict is final.'),
      toggle('explainOpponent', 'Explain opponent moves too', 'Shows what their move threatens and your best reply.'),
      canUseOnline ? toggle('online', 'Online engine fallback', 'If the local engine can’t start, send positions (FEN only) to chess-api.com.') : null,
      h('div', { class: 'hint' }, 'Shortcuts: Alt+M show/hide · Alt+D deep dive. Drag the header to move the panel.'),
      h('div', {}, h('button', { class: 'btn', onclick: () => { save({ pos: null }); applyPos(); } }, 'Reset position')),
    );
  }

  function mainView() {
    const s = lastState;
    switch (s.kind) {
      case 'paused': return stateView('⏸', s.title || 'Paused', s.text);
      case 'idle': return stateView('♟', 'Ready', s.text);
      case 'loading':
        return h('div', { 'aria-busy': 'true' },
          s.label ? h('div', { class: 'row' }, h('div', { class: 'san' }, s.label), h('span', { class: 'who', style: { marginLeft: 'auto' } }, 'Thinking…')) : null,
          h('div', { class: 'sk', style: { width: '92%' } }), h('div', { class: 'sk', style: { width: '70%' } }), h('div', { class: 'sk', style: { width: '80%' } }));
      case 'error':
        return stateView('⚠', 'Couldn’t analyze', s.text,
          h('button', { class: 'btn', onclick: () => onRetry && onRetry() }, 'Retry'),
          canUseOnline && s.offerOnline ? h('button', { class: 'btn primary', onclick: () => { save({ online: true }); onUseOnline && onUseOnline(); } }, 'Use online engine') : null);
      case 'feedback': return feedbackView(s.fb, s.verifying);
      default: return null;
    }
  }

  function draw() {
    applyPos();
    wrap.hidden = collapsed;
    pill.hidden = !collapsed;
    if (collapsed) {
      const fb = lastState.kind === 'feedback' ? lastState.fb : null;
      pill.replaceChildren(
        h('span', { class: 'dot', style: { '--tone': fb ? TONE_HEX[fb.cls.tone] : '#81b64c' } }, fb ? fb.cls.symbol : '♞'),
        fb ? `${fb.san} · ${fb.cls.label}` : 'Move Coach');
      return;
    }
    wrap.replaceChildren(...[
      header(),
      h('div', { class: 'body' }, view === 'settings' ? settingsView() : mainView()),
      view === 'main' && lastState.engine ? h('div', { class: 'foot' }, lastState.engine) : null,
    ].filter(Boolean));
  }

  pill.addEventListener('click', () => toggleCollapsed(false));
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'm' || e.code === 'KeyM') { e.preventDefault(); toggleCollapsed(); }
    else if ((k === 'd' || e.code === 'KeyD') && !collapsed && lastState.kind === 'feedback') { e.preventDefault(); setDeep(!deepOpen); }
  }, true);

  draw();
  return {
    render(state) {
      // New move → reset the deep dive to the user's preference.
      const key = state.kind === 'feedback' ? state.fb.fenBefore + state.fb.uci : null;
      if (key && key !== lastKey) { deepOpen = !!settings.autoDeep; lastKey = key; }
      lastState = state;
      if (view === 'main') draw();
      else if (collapsed) draw();
    },
    get settings() { return settings; },
  };
}

const UI = { createPanel };
