/* =====================================================================
   PINSPO  -  script.js   (the complete file, in order)

   TABLE OF CONTENTS
    1. Setup ........................ page pieces and settings
    2. Sounds ....................... sounds made in code + mute button
    3. Adding things to the board ... items, images, text
    4. Select / edit / delete ....... clicking, typing, Delete key
    5. Move / resize / rotate / flip  dragging items on the board
    6. Pencil jar ticket ............ font, colors, "Add to board"
    7. Upload ....................... add your own pictures
    8. Save as PNG .................. download your board
    9. Edit board (candle) .......... layers list + clear board
   10. Calendar date box ............ optional date picker
   11. Shelf animations ............. sticky note, polaroid, jar, plant, calendar
   12. Shelf buttons (actions) ...... what each shelf item does
   13. Hover and click on the shelf . only the visible parts react
   14. Intro screen
   15. Automatic saving ............ the board is remembered in this browser
   ===================================================================== */


/* =====================================================================
   1. SETUP
   ===================================================================== */
const stage = document.getElementById('stage');
const board = document.getElementById('board');

let selected = null;            // the item that is currently selected
let currentFont = 'Caveat';     // font for new text
let currentColor = '#3a2c20';   // color for new text
let drag = null;                // what is being dragged right now

const alphaCanvases = new Map(); // remembers which parts of each shelf picture are solid


/* Built-in styles for the save preview and the little message, so they look right
   even if style.css doesn't have them. (Yours in style.css still win if present.) */
const baseStyle = document.createElement('style');
baseStyle.textContent = `
  #toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#3a2c20;color:#fff;
    padding:10px 20px;border-radius:999px;font:600 16px Caveat,sans-serif;z-index:100000;opacity:0;
    transition:opacity .3s;pointer-events:none;white-space:nowrap}
  #saveBox{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(560px,90vw);
    max-height:90vh;box-sizing:border-box;background:#f6efe3;border-radius:14px;padding:16px;
    box-shadow:0 12px 40px rgba(0,0,0,.35);z-index:99999;display:flex;flex-direction:column;gap:12px}
  #saveBox img{display:block;width:100%;height:auto;max-height:62vh;object-fit:contain;border-radius:8px}
  #saveBox div{display:flex;gap:10px;justify-content:center}
  #saveBox a,#saveBox button{font:600 16px Caveat,sans-serif;padding:8px 22px;border-radius:999px;border:0;
    background:#c79a6b;color:#fff;cursor:pointer;text-decoration:none}
  #saveBox button{background:#e8dccb;color:#3a2c20}
  html:not(.ready) #stage{opacity:0}
  #stage{transition:opacity .35s}
`;
document.head.prepend(baseStyle);
// show the page only after everything has loaded (prevents the scattered flash on refresh)
const showPage = () => document.documentElement.classList.add('ready');
window.addEventListener('load', showPage);
setTimeout(showPage, 3000);


/* =====================================================================
   2. SOUNDS  (made in code, no sound files needed)
   To change how loud everything is, change MASTER_VOLUME.
   ===================================================================== */
let soundOn = localStorage.getItem('pinspoSound') !== 'off';
const MASTER_VOLUME = 1.5;
let ac = null;       // the browser's audio engine
let master = null;   // the master volume knob

function audioCtx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ac.destination);
  }
  return ac;
}

// Browsers keep sound off until a person clicks. This wakes it up on the first click.
function unlockAudio() {
  const c = audioCtx();
  if (!c || c.state === 'running') return;
  c.resume();
  const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
}
['pointerdown', 'mousedown', 'touchend', 'keydown', 'click'].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { capture: true }));

// A musical note that slides from one pitch to another
function tone(freq, end, dur, type, vol, delay = 0) {
  const c = audioCtx(), t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(end, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

// A soft whoosh or rustle
function noise(dur, lo, hi, vol, delay = 0) {
  const c = audioCtx(), t = c.currentTime + delay, n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf;
  f.type = 'bandpass'; f.Q.value = 0.9;
  f.frequency.setValueAtTime(lo, t);
  f.frequency.exponentialRampToValueAtTime(hi, t + dur);
  const atk = Math.min(0.012, dur / 3);                 // soft start so it never "pops"
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
}

// ONE sound for everything: the soft paper touch (the same one the pencil jar makes when clicked).
// To change how every sound feels, edit the two noise(...) lines in TOUCH.
// The last number on each line is the volume; the first number is how long it lasts.
const TOUCH = (delay = 0) => {
  noise(0.07, 2600, 1500, 0.20, delay);
  noise(0.04, 3800, 2200, 0.08, delay + 0.012);
};

const SOUNDS = {
  click:   () => TOUCH(),        // clicking a shelf item
  close:   () => TOUCH(),        // closing the ticket / Edit board / date box
  add:     () => TOUCH(0.12),    // something lands on the board (a beat after the click, so they don't stack)
  remove:  () => TOUCH(),        // deleting one item
  clear:   () => TOUCH(),        // clearing the whole board
  save:    () => TOUCH(),        // saving the board
  flip:    () => TOUCH()         // flipping the pin
};

function play(name) {
  if (!soundOn || !SOUNDS[name]) return;
  try {
    const c = audioCtx();
    if (!c) return;
    if (c.state === 'suspended') { c.resume().then(() => SOUNDS[name]()).catch(() => {}); return; }
    SOUNDS[name]();
  } catch (err) { console.warn('Sound problem:', err); }
}

// For testing: type  soundTest()  in the Console after clicking the page once
function soundTest() {
  play('add');
  console.log('Sound is', soundOn ? 'ON' : 'OFF', '- audio engine:', audioCtx() ? audioCtx().state : 'not supported');
}

// Mute button (only works if index.html has <button id="muteBtn">)
const muteBtn = document.getElementById('muteBtn');
if (muteBtn) {
  muteBtn.textContent = soundOn ? '🔊' : '🔇';
  muteBtn.onclick = () => {
    soundOn = !soundOn;
    localStorage.setItem('pinspoSound', soundOn ? 'on' : 'off');
    muteBtn.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) play('add');
  };
}


/* =====================================================================
   3. ADDING THINGS TO THE BOARD
   The number in each call is the size, as a % of the board's width.
   ===================================================================== */
function addItem(content, widthPct, isText) {
  const item = document.createElement('div');
  item.className = 'item';
  item.style.width = widthPct + '%';
  item.style.left = (20 + Math.random() * 35) + '%';
  item.style.top = (15 + Math.random() * 35) + '%';
  item.appendChild(content);
  item.insertAdjacentHTML('beforeend',
    '<span class="handle"></span><span class="del">×</span><span class="rot"></span>');
  if (isText) { item.dataset.text = '1'; sizeText(item); }
  board.appendChild(item);
  play('add');
  select(item);
  return item;
}

function sizeText(item) {   // text grows and shrinks with its box
  item.style.fontSize = (parseFloat(item.style.width) * 0.19) + 'cqw';
}

function addImage(src, widthPct) {
  const img = document.createElement('img');
  img.src = src;
  img.draggable = false;
  return addItem(img, widthPct, false);
}

function addText(words) {
  const t = document.createElement('div');
  t.className = 'text';
  t.textContent = words;
  t.style.fontFamily = currentFont;
  t.style.color = currentColor;
  addItem(t, 30, true);
}


/* =====================================================================
   4. SELECT, EDIT, DELETE
   ===================================================================== */
function select(item) {
  if (selected) selected.classList.remove('selected');
  selected = item;
  if (item) item.classList.add('selected');
  if (layersOpen()) renderLayers();
}

function edit(t) {   // let someone type in a text box
  t.contentEditable = 'true';
  t.focus();
  document.getSelection().selectAllChildren(t);
}

board.addEventListener('dblclick', e => {
  const t = e.target.closest('.text');
  if (t) edit(t);
});

board.addEventListener('focusout', e => {
  if (e.target.classList && e.target.classList.contains('text')) e.target.contentEditable = 'false';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Delete' && selected && !document.querySelector('[contenteditable="true"]')) {
    play('remove');
    selected.remove();
    selected = null;
  }
});


/* =====================================================================
   5. MOVE, RESIZE, ROTATE, FLIP
   ===================================================================== */
board.addEventListener('pointerdown', e => {
  const item = e.target.closest('.item');
  if (!item) { select(null); return; }
  select(item);
  if (e.target.classList.contains('del')) { play('remove'); item.remove(); selected = null; return; }
  if (e.target.closest('[contenteditable="true"]')) return;   // let people type

  const b = board.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  drag = {
    item, b, cx, cy,
    rotate: e.target.classList.contains('rot'),
    resize: e.target.classList.contains('handle'),
    x: e.clientX, y: e.clientY,
    left: parseFloat(item.style.left), top: parseFloat(item.style.top),
    wPx: item.offsetWidth,
    rot: parseFloat(item.style.rotate) || 0,
    a0: Math.atan2(e.clientY - cy, e.clientX - cx)
  };
  e.preventDefault();
});

document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.moved = Math.max(drag.moved || 0, Math.abs(dx) + Math.abs(dy));
  if (drag.rotate) {
    let deg = drag.rot + (Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) - drag.a0) * 180 / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15;   // Shift = snap to 15 degrees
    drag.item.style.rotate = deg + 'deg';
  } else if (drag.resize) {
    const a = drag.rot * Math.PI / 180;
    const along = dx * Math.cos(a) + dy * Math.sin(a);   // follows the item's own direction
    const w = Math.max(4, (drag.wPx + along) / drag.b.width * 100);
    drag.item.style.width = w + '%';
    if (drag.item.dataset.text) sizeText(drag.item);
  } else {
    drag.item.style.left = (drag.left + dx / drag.b.width * 100) + '%';
    drag.item.style.top = (drag.top + dy / drag.b.height * 100) + '%';
  }
});

document.addEventListener('pointerup', () => {
  // a click (not a drag) on a "flippable" item, like the pin, flips it
  if (drag && !drag.rotate && !drag.resize && (drag.moved || 0) < 4 &&
      drag.item.classList.contains('flippable')) {
    drag.item.classList.toggle('flipped');
    play('flip');
  }
  drag = null;
});


/* =====================================================================
   6. PENCIL JAR TICKET  (font, colors, text box, "Add to board")
   ===================================================================== */
const panel = document.getElementById('panel');
document.getElementById('panelClose').onclick = () => { play('close'); panel.style.display = 'none'; };

// Moving the ticket around
let panelDrag = null;
panel.addEventListener('pointerdown', e => {
  if (e.target.closest('select, textarea, button, .sw')) return;   // let the controls work normally
  e.preventDefault();
  getSelection().removeAllRanges();
  panelDrag = { x: e.clientX, y: e.clientY, l: panel.offsetLeft, t: panel.offsetTop };
  panel.setPointerCapture(e.pointerId);
});
panel.addEventListener('pointermove', e => {
  if (!panelDrag) return;
  const maxL = stage.clientWidth - panel.offsetWidth;
  const maxT = stage.clientHeight - panel.offsetHeight;
  panel.style.left = Math.max(0, Math.min(maxL, panelDrag.l + e.clientX - panelDrag.x)) + 'px';
  panel.style.top = Math.max(0, Math.min(maxT, panelDrag.t + e.clientY - panelDrag.y)) + 'px';
});
panel.addEventListener('pointerup', () => { panelDrag = null; });

// The text box on the ticket
const panelText = document.getElementById('panelText');
panelText.style.color = currentColor;
panelText.style.fontFamily = currentFont;

// The color circles on the stub (change the list to change the colors)
['#3a2c20', '#c0392b', '#e67e22', '#d4a017', '#4f8a4b', '#2f7ea1', '#7b4fa0', '#e07aa0', '#ffffff']
  .forEach(c => {
    const s = document.createElement('span');
    s.className = 'sw';
    s.style.background = c;
    s.onclick = () => {
      currentColor = c;
      document.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === s));
      panelText.style.color = c;
      if (selected && selected.dataset.text) selected.querySelector('.text').style.color = c;
    };
    document.getElementById('swatches').appendChild(s);
  });

// The font list
document.getElementById('fontSelect').onchange = e => {
  currentFont = e.target.value;
  panelText.style.fontFamily = currentFont;
  if (selected && selected.dataset.text) selected.querySelector('.text').style.fontFamily = currentFont;
};

// "Add to board" button
document.getElementById('addText').onclick = () => {
  addText(panelText.value.trim() || 'Your text');
  panelText.value = '';
  panel.style.display = 'none';
};


/* =====================================================================
   7. UPLOAD  (add your own pictures)
   ===================================================================== */
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.onchange = e => {
  const f = e.target.files[0];
  fileInput.value = '';
  if (!f) return;
  const url = URL.createObjectURL(f);
  const im = new Image();
  im.onload = () => {   // shrink big photos so the board can be saved automatically
    const keepAlpha = /png|gif|webp/.test(f.type);
    const max = keepAlpha ? 800 : 1000;
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    addImage(c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85), 25);
  };
  im.onerror = () => { addImage(url, 25); };
  im.src = url;
};


/* =====================================================================
   8. SAVE AS PNG
   Needs the small message styles (#toast and #saveBox) in style.css.
   ===================================================================== */
function toast(msg, ms) {   // the little message at the bottom of the page
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.opacity = 1;
  clearTimeout(t._h);
  if (ms) t._h = setTimeout(() => { t.style.opacity = 0; }, ms);
}

function loadImg(path) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = path; });
}

function showSaved(url) {   // the preview with a Download button
  const old = document.getElementById('saveBox');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'saveBox';
  box.innerHTML = '<img src="' + url + '"><div><a download="my-pinspo-board.png" href="' + url +
    '">Download</a><button type="button">Close</button></div>';
  box.querySelector('button').onclick = () => box.remove();
  document.body.appendChild(box);
}

async function savePNG() {
  if (typeof html2canvas === 'undefined') { toast('Saving needs an internet connection.', 3500); return; }
  toast('Saving your board…');
  select(null);
  document.body.classList.add('exporting');
  const items = [...board.querySelectorAll('.item')];
  const keep = items.map(it => ({ it, fs: it.style.fontSize, rot: it.style.rotate, tf: it.style.transform }));
  items.forEach(it => {
    if (it.dataset.text) it.style.fontSize = getComputedStyle(it).fontSize;   // text sizes in px
    if (it.style.rotate) { it.style.transform = 'rotate(' + it.style.rotate + ')'; it.style.rotate = 'none'; }
  });
  try {
    const bgImg = await loadImg('images/background.png');
    const shot = await html2canvas(board, { backgroundColor: null, scale: 2, logging: false });
    const s = stage.getBoundingClientRect(), b = board.getBoundingClientRect();
    const k = bgImg.naturalWidth / s.width;
    const out = document.createElement('canvas');
    out.width = shot.width; out.height = shot.height;
    const g = out.getContext('2d');
    g.drawImage(bgImg, (b.left - s.left) * k, (b.top - s.top) * k, b.width * k, b.height * k, 0, 0, out.width, out.height);
    g.drawImage(shot, 0, 0);
    out.toBlob(blob => { play('save'); toast('Saved!', 1500); showSaved(URL.createObjectURL(blob)); }, 'image/png');
  } catch (err) {
    console.error(err);
    toast('Sorry, saving did not work. Check the Console for details.', 4000);
  } finally {
    document.body.classList.remove('exporting');
    keep.forEach(o => { o.it.style.fontSize = o.fs; o.it.style.rotate = o.rot; o.it.style.transform = o.tf; });
  }
}


/* =====================================================================
   9. EDIT BOARD  (opened by the candle: layers list + clear board)
   ===================================================================== */
const layersBox = document.getElementById('layersBox');
const layerList = document.getElementById('layerList');
const layersOpen = () => layersBox.style.display === 'block';

function itemName(it) {   // what each row in the list is called
  if (it.dataset.text) return '“' + it.querySelector('.text').textContent.trim().slice(0, 16) + '”';
  const img = it.querySelector('img');
  return img ? img.src.split('/').pop().replace(/\.\w+$/, '') : 'Item';
}

function renderLayers() {   // draws the list (front item first)
  const items = [...board.querySelectorAll('.item')];
  layerList.innerHTML = '';
  if (!items.length) { layerList.innerHTML = '<p class="empty">The board is empty.</p>'; return; }
  items.slice().reverse().forEach(it => {
    const row = document.createElement('div');
    row.className = 'lrow' + (it === selected ? ' on' : '');
    row.innerHTML = '<b>' + (items.indexOf(it) + 1) + '</b><span>' + itemName(it) +
      '</span><button data-a="up">▲</button><button data-a="down">▼</button>';
    row.onclick = e => {
      const a = e.target.dataset.a;
      if (a === 'up' && it.nextElementSibling) it.nextElementSibling.after(it);
      if (a === 'down' && it.previousElementSibling) it.previousElementSibling.before(it);
      select(it);
    };
    layerList.appendChild(row);
  });
}

function toggleLayers() {
  layersBox.style.display = layersOpen() ? 'none' : 'block';
  if (layersOpen()) renderLayers();
}

document.getElementById('layersClose').onclick = () => { play('close'); layersBox.style.display = 'none'; };

// Moving the Edit board box around
let layersDrag = null;
layersBox.addEventListener('pointerdown', e => {
  if (e.target.closest('button, .lrow')) return;   // buttons and rows keep working normally
  e.preventDefault();
  getSelection().removeAllRanges();
  layersDrag = { x: e.clientX, y: e.clientY, l: layersBox.offsetLeft, t: layersBox.offsetTop };
  layersBox.setPointerCapture(e.pointerId);
});
layersBox.addEventListener('pointermove', e => {
  if (!layersDrag) return;
  const maxL = stage.clientWidth - layersBox.offsetWidth;
  const maxT = stage.clientHeight - layersBox.offsetHeight;
  layersBox.style.left = Math.max(0, Math.min(maxL, layersDrag.l + e.clientX - layersDrag.x)) + 'px';
  layersBox.style.top = Math.max(0, Math.min(maxT, layersDrag.t + e.clientY - layersDrag.y)) + 'px';
});
layersBox.addEventListener('pointerup', () => { layersDrag = null; });

// Clear entire board
document.getElementById('clearBoard').onclick = () => {
  if (!confirm('Clear the entire board?')) return;
  play('clear');
  board.querySelectorAll('.item').forEach(i => i.remove());
  selected = null;
};

// Keep the list up to date when items are added or removed
new MutationObserver(() => { if (layersOpen()) renderLayers(); }).observe(board, { childList: true });


/* =====================================================================
   10. CALENDAR DATE BOX  (optional)
   Only works if index.html has the #dateBox pieces. If not, clicking the
   calendar just adds a text box that says "Add date".
   ===================================================================== */
const dateBox = document.getElementById('dateBox');
function openDatePicker() {
  if (!dateBox) { addText('Add date'); return; }
  dateBox.style.display = 'block';
  document.getElementById('dateInput').value = new Date().toLocaleDateString('en-CA');
}
if (dateBox) {
  document.getElementById('dateNo').onclick = () => { play('close'); dateBox.style.display = 'none'; };
  document.getElementById('dateOk').onclick = () => {
    dateBox.style.display = 'none';
    const v = document.getElementById('dateInput').value;
    if (!v) return;
    const d = new Date(v + 'T12:00');
    addText(d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
  };
}


/* =====================================================================
   11. SHELF ANIMATIONS
   Each one swaps the picture's frames. Folders:
   images/note, images/jar, images/plant, images/peek
   ===================================================================== */

/* ---- Sticky note: slight scrunch on hover (frame 2), full crumple on click ---- */
const noteEl = document.getElementById('stickynote');
const noteFrames = [1, 2, 3, 4, 5].map(n => 'images/note/note-0' + n + '.png');
noteFrames.forEach(f => { new Image().src = f; });   // preload so there's no flicker
let noteBusy = false;
if (noteEl) {
  new MutationObserver(() => {
    if (noteBusy) return;
    noteEl.src = noteEl.classList.contains('hover') ? noteFrames[1] : noteFrames[0];
  }).observe(noteEl, { attributes: true, attributeFilter: ['class'] });
}
function crumpleNote() {
  if (noteBusy) return;
  noteBusy = true;
  let i = 0;
  const timer = setInterval(() => {          // speed: change 150 (milliseconds per frame)
    noteEl.src = noteFrames[i];
    i++;
    if (i === noteFrames.length) {
      clearInterval(timer);
      setTimeout(() => {                     // pause on the crumpled ball: change 400
        addImage(noteFrames[0], 35);         // size on the board: change 35
        noteEl.src = noteFrames[0];
        noteBusy = false;
      }, 400);
    }
  }, 150);
}

/* ---- Polaroid: sways while the pointer is over it ---- */
const polaEl = document.getElementById('poloroid');
if (polaEl) {
  new MutationObserver(() => {
    if (polaEl.classList.contains('hover') && !polaEl.classList.contains('swing')) polaEl.classList.add('swing');
  }).observe(polaEl, { attributes: true, attributeFilter: ['class'] });
  polaEl.addEventListener('animationiteration', () => {
    if (!polaEl.classList.contains('hover')) polaEl.classList.remove('swing');
  });
}

/* ---- Pencil jar: wiggles while the pointer is over it ---- */
const jarEl = document.getElementById('penciljar');
const jarFrames = Array.from({ length: 39 }, (_, i) => 'images/jar/jar-' + String(i + 1).padStart(2, '0') + '.png');
jarFrames.forEach(f => { new Image().src = f; });
let jarIdx = 0, jarTimer = null;
function jarTick() {
  jarIdx = (jarIdx + 1) % jarFrames.length;
  jarEl.src = jarFrames[jarIdx];
  if (jarIdx === 0 && !jarEl.classList.contains('hover')) { clearInterval(jarTimer); jarTimer = null; }
}
if (jarEl) {
  new MutationObserver(() => {
    if (jarEl.classList.contains('hover') && !jarTimer) jarTimer = setInterval(jarTick, 100);
  }).observe(jarEl, { attributes: true, attributeFilter: ['class'] });
}

/* ---- Plant: sways in a loop while the pointer is over it ---- */
const plantEl = document.getElementById('plant');
const plantFrames = Array.from({ length: 40 }, (_, i) => 'images/plant/plant-' + String(i + 1).padStart(2, '0') + '.png');
plantFrames.forEach(f => { new Image().src = f; });
let plantIdx = 0, plantTimer = null;
function plantTick() {
  plantIdx = (plantIdx + 1) % plantFrames.length;
  plantEl.src = plantFrames[plantIdx];
  alphaCanvases.delete(plantEl);
  if (plantIdx === 0 && !plantEl.classList.contains('hover')) { clearInterval(plantTimer); plantTimer = null; }
}
if (plantEl) {
  new MutationObserver(() => {
    if (plantEl.classList.contains('hover') && !plantTimer) plantTimer = setInterval(plantTick, 80);
  }).observe(plantEl, { attributes: true, attributeFilter: ['class'] });
}

/* ---- Calendar: the page corner lifts on hover, lowers when you leave ---- */
const calEl = document.getElementById('shelfcalendar');
const calFrames = [1, 2, 3, 4, 5].map(n => 'images/peek/peek-0' + n + '.png');
calFrames.forEach(f => { new Image().src = f; });
let calIdx = 0, calTimer = null;
function calGo(target) {
  clearInterval(calTimer);
  calTimer = setInterval(() => {
    if (calIdx === target) { clearInterval(calTimer); return; }
    calIdx += calIdx < target ? 1 : -1;
    calEl.src = calFrames[calIdx];
  }, 70);
}
if (calEl) {
  new MutationObserver(() => calGo(calEl.classList.contains('hover') ? 4 : 0))
    .observe(calEl, { attributes: true, attributeFilter: ['class'] });
}


/* =====================================================================
   12. SHELF BUTTONS
   What happens when you click each shelf item. The number is the size
   on the board (% of the board's width). The vase and plant have no
   click action, so they only react to hover.
   ===================================================================== */
const src = id => document.getElementById(id).src;

const actions = {
  penciljar:     () => { panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; },
  books:         () => addImage('images/paper.png', 29),
  stickynote:    crumpleNote,
  pin:           () => addImage(src('pin'), 20).classList.add('flippable'),
  butterfly:     () => addImage(src('butterfly'), 20),
  flower:        () => addImage(src('flower'), 24),
  shelfcalendar: openDatePicker,
  poloroid:      () => addImage('images/emptypolaroid.png', 30),
  upload:        () => fileInput.click(),
  saveto:        savePNG,
  candel:        toggleLayers
};


/* =====================================================================
   13. HOVER AND CLICK ON THE SHELF
   Only the visible parts of each picture react, not the invisible padding.
   ===================================================================== */
const shelfItems = [...document.querySelectorAll('.shelf')].reverse();   // later items are on top

function isSolid(img, x, y) {
  if (!img.naturalWidth) return false;
  const lift = img.classList.contains('hover') ? 3 : 0;   // the hover lift moves the box up 3px
  const r = img.getBoundingClientRect();
  const top = r.top + lift;
  if (x < r.left || x > r.right || y < top || y > top + r.height) return false;
  let c = alphaCanvases.get(img);
  if (!c) {
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    c = { cx, w: cv.width, h: cv.height };
    alphaCanvases.set(img, c);
  }
  const px = Math.floor((x - r.left) / r.width * c.w);
  const py = Math.floor((y - top) / r.height * c.h);
  return c.cx.getImageData(px, py, 1, 1).data[3] > 20;
}

function shelfItemAt(x, y) {
  return shelfItems.find(img => isSolid(img, x, y));
}

stage.addEventListener('mousemove', e => {
  const hit = shelfItemAt(e.clientX, e.clientY);
  shelfItems.forEach(img => img.classList.toggle('hover', img === hit));
  stage.style.cursor = hit && actions[hit.id] ? 'pointer' : 'default';
});

stage.addEventListener('click', e => {
  if (e.target.closest('#board, #panel, #dateBox, #layersBox')) return;
  const hit = shelfItemAt(e.clientX, e.clientY);
  if (hit) play('click');                          // soft paper touch on every shelf item
  if (hit && actions[hit.id]) actions[hit.id]();
});


/* =====================================================================
   14. INTRO SCREEN  (click to skip, or it fades by itself)
   ===================================================================== */
const intro = document.getElementById('intro');
if (intro) {
  intro.style.pointerEvents = 'auto';
  intro.addEventListener('click', () => intro.remove());
  setTimeout(() => intro.remove(), 5400);
}


/* =====================================================================
   15. AUTOMATIC SAVING
   The board is remembered in this browser (localStorage), on this device.
   It saves a moment after every change and comes back when the page loads.
   ===================================================================== */
const BOARD_KEY = 'pinspoBoard';
const BASE_URL = new URL('.', location.href).href;
let saveWarned = false;

function itemData(it) {
  const o = {
    left: it.style.left, top: it.style.top, width: it.style.width, rotate: it.style.rotate || '',
    flippable: it.classList.contains('flippable'), flipped: it.classList.contains('flipped')
  };
  if (it.dataset.text) {
    const t = it.querySelector('.text');
    o.text = t.textContent;
    o.font = t.style.fontFamily;
    o.color = t.style.color;
  } else {
    const img = it.querySelector('img');
    const full = img ? img.src : '';
    o.img = full.startsWith(BASE_URL) ? full.slice(BASE_URL.length) : full;   // keep paths short
  }
  return o;
}

function saveBoard() {
  try {
    const data = [...board.querySelectorAll('.item')].map(itemData);
    localStorage.setItem(BOARD_KEY, JSON.stringify(data));
  } catch (err) {
    if (!saveWarned) {
      saveWarned = true;
      toast('The board is too full to save automatically. Try removing a big photo.', 5000);
    }
  }
}

function restoreBoard() {
  let data;
  try { data = JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); } catch (err) { return; }
  if (!Array.isArray(data)) return;
  data.forEach(o => {
    if (!o || typeof o !== 'object') return;
    const it = document.createElement('div');
    it.className = 'item' + (o.flippable ? ' flippable' : '') + (o.flipped ? ' flipped' : '');
    it.style.left = o.left; it.style.top = o.top; it.style.width = o.width;
    if (o.rotate) it.style.rotate = o.rotate;
    if (typeof o.text === 'string') {
      const t = document.createElement('div');
      t.className = 'text';
      t.textContent = o.text;
      t.style.fontFamily = o.font || currentFont;
      t.style.color = o.color || currentColor;
      it.appendChild(t);
      it.dataset.text = '1';
    } else if (typeof o.img === 'string') {
      const img = document.createElement('img');
      img.src = o.img;
      img.draggable = false;
      it.appendChild(img);
    } else return;
    it.insertAdjacentHTML('beforeend', '<span class="handle"></span><span class="del">×</span><span class="rot"></span>');
    board.appendChild(it);
    if (it.dataset.text) sizeText(it);
  });
}

restoreBoard();

let saveTimer = null;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveBoard, 400); };
new MutationObserver(saveSoon).observe(board, {
  childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class']
});
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); saveBoard(); });
