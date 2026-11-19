import { h } from './dom.js';

export const ARROW = { Up: '↑', Down: '↓', Left: '←', Right: '→' };
export const CONSOLES = [['PS5', 'L1 + R1'], ['Xbox', 'LB + RB']];

export function buildSteps(input, buttons) {
  const [left, right] = buttons.split(' + ');
  return [
    { text: 'Press Up on the D-pad to open your phone', dir: 'Up', held: false },
    { text: 'Hold ' + left + ' and press ' + right, dir: '', held: true },
    ...input.map(dir => ({ text: 'Press ' + dir, dir, held: true })),
  ];
}

const SPEEDS = [['0.25×', 0.25], ['0.5×', 0.5], ['1×', 1], ['2×', 2]];
const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

// Step-by-step animated walkthrough of the button presses.
export function createDemo(c, autoplay = false) {
  const st = { i: -1, playing: false, speed: 0.5, con: 0, pressed: '', held: false, next: 0, rel: 0 };
  const steps = () => buildSteps(c.input, CONSOLES[st.con][1]);
  const dur = () => 1000 / st.speed;

  const pad = {};
  const dpad = h('div', { className: 'dpad' },
    ['Up', 'Left', 'Right', 'Down'].map((d) => (pad[d] = h('span', { className: 'pad ' + d.toLowerCase(), textContent: ARROW[d] }))));
  const sh = [h('span', { className: 'sh' }), h('span', { className: 'sh' })];
  const seq = c.input.map((d) => h('kbd', { textContent: ARROW[d] }));
  const fill = h('div', { className: 'fill' });
  const track = h('div', { className: 'track', role: 'progressbar', ariaLabel: 'Walkthrough progress', ariaValueMin: '0', ariaValueMax: String(steps().length) }, fill);
  const caption = h('p', { className: 'caption' });
  const playBtn = h('button', { className: 'ctl play', onclick: toggle });

  function paint() {
    const list = steps(), s = list[st.i];
    Object.entries(pad).forEach(([d, el]) => el.classList.toggle('on', st.pressed === d));
    CONSOLES[st.con][1].split(' + ').forEach((t, n) => (sh[n].textContent = t));
    sh.forEach((el) => el.classList.toggle('on', st.held));
    seq.forEach((k, n) => {
      k.classList.toggle('cur', st.i - 2 === n);
      k.classList.toggle('done', st.i - 2 > n);
    });
    track.ariaValueNow = String(st.i + 1);
    fill.style.width = `${((st.i + 1) / list.length) * 100}%`;
    caption.textContent = s ? `Step ${st.i + 1} of ${list.length}: ${s.text}` : 'Press play to watch the sequence.';
    playBtn.textContent = st.playing ? 'Pause' : st.i >= list.length - 1 ? 'Replay' : 'Play';
  }
  // Press a step, then release the D-pad shortly after so repeated
  // directions (Up, Up, Up) are visibly separate presses.
  function press(i) {
    clearTimeout(st.rel);
    st.i = i;
    const s = steps()[i];
    st.pressed = s.dir;
    st.held = s.held;
    paint();
    if (s.dir) restart(pad[s.dir], 'hit');
    restart(caption, 'swap');
    st.rel = setTimeout(() => {
      st.pressed = '';
      if (st.i === steps().length - 1) st.held = false;
      paint();
    }, Math.min(dur() * 0.6, 1200));
  }
  function tick() {
    if (st.i >= steps().length - 1) { st.playing = false; paint(); return; }
    press(st.i + 1);
    st.next = setTimeout(tick, dur());
  }
  function toggle() {
    clearTimeout(st.next);
    if (st.playing) { st.playing = false; paint(); return; }
    if (st.i >= steps().length - 1) { st.i = -1; st.pressed = ''; st.held = false; }
    st.playing = true;
    tick();
  }
  function go(delta) {
    clearTimeout(st.next);
    st.playing = false;
    const i = Math.max(-1, Math.min(steps().length - 1, st.i + delta));
    if (i < 0) { clearTimeout(st.rel); st.i = -1; st.pressed = ''; st.held = false; paint(); }
    else press(i);
  }
  const group = (opts, cur, set) => {
    const box = h('div', { className: 'chips small' });
    const draw = () =>
      box.replaceChildren(...opts.map(([label, v]) =>
        h('button', { className: 'chip' + (cur() === v ? ' on' : ''), textContent: label, onclick: () => { set(v); draw(); paint(); } })));
    draw();
    return box;
  };

  const stop = () => {
    clearTimeout(st.next);
    clearTimeout(st.rel);
    st.playing = false;
    st.pressed = '';
    st.held = false;
    paint();
  };
  paint();
  if (autoplay) toggle();
  const view = h('div', { className: 'demo' },
    h('div', { className: 'stage' }, h('div', { className: 'shoulders' }, sh), dpad),
    track,
    caption,
    h('span', { className: 'keys' }, seq),
    h('div', { className: 'ctls' },
      h('button', { className: 'ctl', textContent: '‹', ariaLabel: 'Previous step', onclick: () => go(-1) }),
      playBtn,
      h('button', { className: 'ctl', textContent: '›', ariaLabel: 'Next step', onclick: () => go(1) })),
    h('div', { className: 'opt' }, h('span', { className: 'label', textContent: 'Speed' }), group(SPEEDS, () => st.speed, (v) => (st.speed = v))),
    h('div', { className: 'opt' }, h('span', { className: 'label', textContent: 'Console' }), group(CONSOLES.map(([n], i) => [n, i]), () => st.con, (v) => (st.con = v))));
  return { view, stop };
}
