/* Test-only differential oracle. Runs verbatim production controller excerpts in a VM.
 * This is deliberately not a second implementation of the Chapter 1 rules, nor a
 * browser/layout certification. Its small DOM supplies CSS-derived rectangles;
 * production app.js performs all movement, collision, proximity, and quest logic.
 * width/height describe the world's OUTER border box, not the browser viewport.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');

function excerpt(source, start, end) {
  const from = source.indexOf(start), to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `Missing production excerpt: ${start}`);
  assert.equal(source.indexOf(start, from + 1), -1, `Ambiguous production excerpt: ${start}`);
  return {code: source.slice(from, to), lineOffset: source.slice(0, from).split('\n').length - 1};
}

function declarations(css, selector) {
  const result = {};
  // Exact selectors used below have no conditional geometry overrides. This is
  // intentionally not a general CSS cascade, and fails closed for missing rules.
  for (const match of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!match[1].trim().split(',').map(s => s.trim()).includes(selector)) continue;
    for (const item of match[2].split(';')) {
      const colon = item.indexOf(':');
      if (colon > 0) result[item.slice(0, colon).trim()] = item.slice(colon + 1).trim().replace(/!important\s*$/, '').trim();
    }
  }
  assert(Object.keys(result).length, `Missing CSS selector: ${selector}`);
  return result;
}

function createController({width = 362, height = 360, random = () => .5} = {}) {
  assert.equal(typeof random, 'function', 'random must be an injected function');
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const experience = fs.readFileSync(path.join(root, 'experience.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const base = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  const chapters = fs.readFileSync(path.join(root, 'chapters-1-4.css'), 'utf8');
  const polish = fs.readFileSync(path.join(root, 'mission-polish.css'), 'utf8');
  assert.equal(declarations(base, '*')['box-sizing'], 'border-box');
  const worldCss = declarations(chapters, '#mission1.mk-l1 #life1World');
  const border = Number(worldCss.border.match(/^([\d.]+)px\b/)?.[1]);
  assert(Number.isFinite(border), 'World geometry requires a pixel border');
  const playerCss = declarations(chapters, '#mission1.mk-l1 #life1Player');
  const translate = playerCss.transform.match(/^translate\(([-\d.]+)%,\s*([-\d.]+)%\)$/);
  assert(translate, 'Player transform must remain an explicit percentage translation');
  const obstacleCss = Object.assign({}, declarations(chapters, '#mission1 .l1-obstacle'), declarations(polish, '#mission1 .l1-obstacle'));
  const energyCss = declarations(chapters, '#mission1.mk-l1 .l1-hotspot.energy');
  const layout = new Map([
    ['life1Player', playerCss],
    ['repairTerminal', declarations(chapters, '#mission1.mk-l1 #repairTerminal')],
    ['antennaHotspot', declarations(chapters, '#mission1.mk-l1 #antennaHotspot')]
  ]);
  for (const name of ['rock-a', 'rock-b', 'crate-a']) {
    layout.set(name, Object.assign({}, declarations(chapters, '#mission1 .' + name), obstacleCss, declarations(polish, '#mission1 .' + name)));
  }
  for (const name of ['e1', 'e2', 'e3']) layout.set(name, Object.assign({}, energyCss, declarations(chapters, '#mission1.mk-l1 .' + name)));
  function dimensions(w, h) {
    assert(Number.isFinite(w) && Number.isFinite(h) && w > border * 2 && h > border * 2, 'World dimensions must exceed its borders');
    width = w; height = h;
  }
  dimensions(width, height);
  const rect = (left, top, w, h) => ({x: left, y: top, left, top, right: left + w, bottom: top + h, width: w, height: h});
  function length(value, parent) {
    assert(/^-?[\d.]+(?:px|%)?$/.test(String(value)), `Unsupported CSS length: ${value}`);
    return parseFloat(value) * (String(value).endsWith('%') ? parent / 100 : 1);
  }
  function rectangle(node) {
    if (node.id === 'life1World') return rect(0, 0, width, height);
    const key = layout.has(node.id) ? node.id : [...layout.keys()].find(k => node.classList.contains(k));
    if (!key) return rect(0, 0, 76, 76);
    const css = {...layout.get(key), ...node.style}, innerW = width - 2 * border, innerH = height - 2 * border;
    const w = length(css.width, innerW);
    const h = css.height === 'auto' ? w / Number(css['aspect-ratio']) : length(css.height, innerH);
    const x = border + (css.left && css.left !== 'auto' ? length(css.left, innerW) : innerW - length(css.right, innerW) - w);
    const y = border + (css.top && css.top !== 'auto' ? length(css.top, innerH) : innerH - length(css.bottom, innerH) - h);
    if (key === 'life1Player') return rect(x + w * Number(translate[1]) / 100, y + h * Number(translate[2]) / 100, w, h);
    // The existing nearby scale has a centered transform origin. It affects bounds,
    // but never the center used by production proximity checks.
    const scale = node.classList.contains('collected') ? .25 : node.classList.contains('nearby') ? 1.08 : 1;
    return rect(x - w * (scale - 1) / 2, y - h * (scale - 1) / 2, w * scale, h * scale);
  }

  const nodes = new Map();
  const eventTarget = object => Object.assign(object, {
    listeners: new Map(),
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(callback);
    },
    dispatchEvent(event) {
      event.target ||= this;
      event.preventDefault ||= () => {};
      event.stopPropagation ||= () => {};
      for (const callback of this.listeners.get(event.type) || []) callback(event);
      this['on' + event.type]?.(event);
      return true;
    }
  });
  function simpleMatches(node, selector) {
    for (const excluded of selector.matchAll(/:not\(([^)]+)\)/g)) if (simpleMatches(node, excluded[1])) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    for (const attr of selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
      if (!node.attributes.has(attr[1]) || (attr[2] != null && node.attributes.get(attr[1]) !== attr[2])) return false;
    }
    selector = selector.replace(/\[[^\]]+\]/g, '');
    const id = selector.match(/#([\w-]+)/)?.[1];
    if (id && node.id !== id) return false;
    for (const name of selector.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(name[1])) return false;
    const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
    return !tag || node.tagName === tag.toUpperCase();
  }
  function matches(node, selector) {
    const parts = selector.trim().split(/\s+/);
    if (!simpleMatches(node, parts.pop())) return false;
    for (let i = parts.length - 1; i >= 0; i--) {
      node = node.parentNode;
      while (node && !simpleMatches(node, parts[i])) node = node.parentNode;
      if (!node) return false;
    }
    return true;
  }
  function descendants(node) { return node.children.flatMap(child => [child, ...descendants(child)]); }
  function createElement(tag = 'div') {
    const classes = new Set();
    const node = eventTarget({tagName: tag.toUpperCase(), attributes: new Map(), dataset: {}, children: [],
      parentNode: null, style: {}, hidden: false, disabled: false, textContent: '', _value: '',
      classList: {
        add: (...values) => values.forEach(v => classes.add(v)),
        remove: (...values) => values.forEach(v => classes.delete(v)),
        contains: value => classes.has(value),
        toggle(value, force) { const enabled = force ?? !classes.has(value); enabled ? classes.add(value) : classes.delete(value); return enabled; }
      },
      append(...children) { for (const child of children) {child.parentNode = this; this.children.push(child);} },
      prepend(...children) { for (const child of children) child.parentNode = this; this.children.unshift(...children); },
      setAttribute(name, value = '') {
        value = String(value); this.attributes.set(name, value);
        if (name === 'class') this.className = value;
        else if (name === 'id') this.id = value;
        else if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
        else if (name === 'hidden' || name === 'disabled') this[name] = true;
        else this[name] = value;
      },
      removeAttribute(name) {this.attributes.delete(name);},
      getAttribute(name) {return this.attributes.get(name) ?? null;},
      querySelectorAll(selector) {return descendants(this).filter(child => matches(child, selector));},
      querySelector(selector) {return this.querySelectorAll(selector)[0] || null;},
      closest(selector) {let node = this; while (node && !matches(node, selector)) node = node.parentNode; return node;},
      getBoundingClientRect() {return rectangle(this);},
      scrollIntoView() {}, setPointerCapture() {}, focus() {}, showModal() {this.open=true;}, close() {this.open=false;},
      replaceChildren(...children) {this.children=[];this.append(...children);},
      click() {if (!this.disabled) this.dispatchEvent({type: 'click'});}
    });
    Object.defineProperties(node, {
      id: {get() {return this._id || '';}, set(value) {this._id = value; nodes.set(value, this);}},
      className: {get() {return [...classes].join(' ');}, set(value) {classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(v => classes.add(v));}},
      value: {get() {return this._value;}, set(value) {
        if (this.tagName === 'INPUT' && this.type === 'range') {
          const min = Number(this.min ?? 0), max = Number(this.max ?? 100), step = Number(this.step ?? 1);
          let number = Number(value);
          if (!Number.isFinite(number) || value === '') number = (min + max) / 2;
          number = Math.max(min, Math.min(max, number));
          this._value = String(Math.max(min, Math.min(max, min + Math.round((number - min) / step) * step)));
        } else this._value = String(value);
      }}
    });
    return node;
  }
  const body = createElement('body'), app = createElement(); app.id = 'app'; body.append(app);
  const home = createElement('section'); home.id = 'home'; home.className = 'screen active'; app.append(home);
  const missionHtml = excerpt(html, '<section id="mission1"', '<section id="life2"').code;
  const stack = [app];
  for (const token of missionHtml.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    if (token[1]) {stack.pop(); continue;}
    const node = createElement(token[2]);
    for (const attr of token[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(attr[1], attr[2] ?? '');
    stack[stack.length - 1].append(node);
    if (!['input', 'br', 'img', 'hr', 'source', 'meta', 'link'].includes(token[2])) stack.push(node);
  }
  const $ = id => {assert(nodes.has(id), 'Unexpected DOM dependency: #' + id); return nodes.get(id);};
  const document = eventTarget({body, hidden: false, createElement, getElementById: $,
    querySelectorAll: selector => body.querySelectorAll(selector), querySelector: selector => body.querySelector(selector)});
  const energies = document.querySelectorAll('.l1-hotspot.energy');
  const cells = document.querySelectorAll('.repair-cells button');
  assert.equal(energies.length, 3); assert.equal(cells.length, 3);

  let now = 0, nextId = 0, memoryCodeShows = 0;
  const timers = new Map(), frames = new Map(), storage = new Map();
  function timer(callback, delay, repeating) {
    const id = ++nextId;
    timers.set(id, {callback, delay: Number(delay), due: now + Number(delay), repeating}); return id;
  }
  const math = Object.create(Math);
  math.random = () => {const value = random(); assert(Number.isFinite(value) && value >= 0 && value < 1, 'random() must return [0,1)'); return value;};
  const context = eventTarget({console, document, Math: math, performance: {now: () => now},
    localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value))},
    setInterval: (callback, delay) => timer(callback, delay, true), setTimeout: (callback, delay) => timer(callback, delay, false),
    clearInterval: id => timers.delete(id), clearTimeout: id => timers.delete(id),
    requestAnimationFrame: callback => {const id = ++nextId; frames.set(id, callback); return id;}, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {observe() {}}, scrollTo() {}, tg: null,
    MKTYExperience: {paused: false, signal() {}, onScreen() {}}, MKTYCampaign: {save() {},onScreen() {}}, getLifeBank: () => 9,
    awardLifePoints: (_chapter, amount) => {storage.set('mkty_points', String(amount)); return amount;},
    stopLife1MemoryCode() {}, showLife1MemoryCode() {memoryCodeShows++;}
  });
  context.window = context;
  vm.createContext(context);
  const run = code => vm.runInContext(code, context, {filename: 'life1-controller-fixture', timeout: 1000});
  run('const $ = id => document.getElementById(id);');
  for (const part of [excerpt(source, 'const missionDelays=new Map();', 'function openMission(){'),
    excerpt(source, 'let life1Stage=0, energyCollected=0', 'const MKTY_MAX_LIVES=')]) {
    vm.runInContext(part.code, context, {filename: 'app.js', lineOffset: part.lineOffset, timeout: 1000});
  }
  const close = excerpt(experience, " for(const id of ['repairPanel','antennaPanel']){", " for(const input of document.querySelectorAll('.fuel-matrix3 input')){");
  vm.runInContext(close.code, context, {filename: 'experience.js', lineOffset: close.lineOffset, timeout: 1000});
  // The real experience guide owns visibility auto-pause and screen-change resume.
  // Build presentation-only dialog nodes, then execute its lifecycle functions and
  // visibility listener verbatim. No model lifecycle code is reused here.
  const guideNode=createElement('dialog');guideNode.id='chapterGuide';guideNode.open=false;
  for(const id of ['guideTitle','guideSteps','guideResume','guideMissions']){const node=createElement(id.startsWith('guideR')||id.startsWith('guideM')?'button':'div');node.id=id;guideNode.append(node);}
  const guideCopy=createElement();guideCopy.className='guide-copy';guideNode.append(guideCopy);app.append(guideNode);
  context.fixtureGuide=guideNode;
  run("const guide=fixtureGuide,flightReview={open:false},bursts=[],media={matches:false}; let light=false; const memoryCodeTick=()=>{},paidCodeHintTick3=()=>{};let nav2Control=0;function releaseDescentControls(){} function frame(){} function closeFlightReview(){}");
  for(const part of [excerpt(experience,' let paused=false,current=0,',' let light='),
    excerpt(experience,' const guides=[[],',' function updateOptions(){'),
    excerpt(experience,' function openGuide(){'," for(const n of [1,2,3,4,7,8,9]){"),
    excerpt(experience,' function onScreen(id){'," window.addEventListener('blur',")]){
    vm.runInContext(part.code,context,{filename:'experience.js',lineOffset:part.lineOffset,timeout:1000});
  }
  run("window.MKTYExperience={onScreen,signal(){},pause:openGuide,resume,get paused(){return paused;}};");
  run("show('mission1'); resetLife1Mission();");
  const copy = value => JSON.parse(JSON.stringify(value));
  function snapshot() {
    const result = copy(run(`({x:l1PX,y:l1PY,direction:l1Direction,walkDistance:l1WalkDistance,walking:l1Walking,
      moveX:l1MoveX,moveY:l1MoveY,lastFrame:l1LastFrame,nearbyAt:l1NearbyAt,stage:life1Stage,
      collected:[...document.querySelectorAll('.l1-hotspot.energy')].flatMap((el,i)=>el.classList.contains('collected')?[i]:[]),
      collectedIds:[...document.querySelectorAll('.l1-hotspot.energy.collected')].map(el=>Number(el.dataset.energy)),
      count:energyCollected,energyCollected,repairCells,repairSequence:[...repairSequence],repairInput:[...repairInput],repairShowing,
      target:targetFrequency,dial:Number($('frequencyDial').value),holdProgress:signalHoldProgress,holdActive:signalHoldTimer!==null,
      repairOpen:!$('repairPanel').hidden,antennaOpen:!$('antennaPanel').hidden,completeVisible:!$('life1Complete').hidden,
      active:$('mission1').classList.contains('active'),paused:!!window.MKTYExperience.paused,hidden:document.hidden,guideOpen:guide.open,
      near:l1Near?(l1Near.dataset.energy||l1Near.id):null,geometry:l1Geometry,
      cellsDisabled:[...document.querySelectorAll('.repair-cells button')].map(el=>el.disabled),
      signalHoldVisible:!$('signalHold').hidden,status:$('missionStatus').textContent})`));
    return {...result, now, memoryCodeShows, panels: {repair: result.repairOpen, antenna: result.antennaOpen, complete: result.completeVisible},
      rectangles: {player: rectangle($('life1Player')), energies: energies.map(rectangle), repair: rectangle($('repairTerminal')), antenna: rectangle($('antennaHotspot'))}};
  }
  function time(value) {assert(Number.isFinite(value) && value >= now, 'Time must be finite and monotonic'); now = value;}
  function invoke(code) {run(code); return snapshot();}
  function click(node) {node.click(); return snapshot();}
  return {
    snapshot,
    setClock(timestamp) {time(timestamp); return snapshot();},
    frame({now: timestamp = now, x, y} = {}) {
      time(timestamp);
      if (x != null) {assert(Number.isFinite(x)); context.fixtureX = x; run('l1MoveX=fixtureX;');}
      if (y != null) {assert(Number.isFinite(y)); context.fixtureY = y; run('l1MoveY=fixtureY;');}
      // One explicitly requested frame, with no implicit timer execution.
      frames.clear(); context.fixtureNow = now; return invoke('life1MoveLoop(fixtureNow);');
    },
    collect(index) {assert(Number.isInteger(index) && index >= 0 && index < energies.length); return click(energies[index]);},
    openRepair: () => click($('repairTerminal')),
    cell(index) {assert(Number.isInteger(index) && index >= 0 && index < cells.length); return click(cells[index]);},
    openAntenna: () => click($('antennaHotspot')),
    dial(value) {$('frequencyDial').value = value; $('frequencyDial').dispatchEvent({type: 'input'}); return snapshot();},
    tune: () => click($('tuneBtn')),
    holdTick(timestamp) {
      if (timestamp != null) time(typeof timestamp === 'object' ? timestamp.now : timestamp);
      const id = run('signalHoldTimer'), task = timers.get(id);
      if (task) {task.due = now + task.delay; task.callback();}
      return snapshot();
    },
    setPaused(value) {return invoke(value?'openGuide();':'resume();');},
    setHidden(value) {document.hidden = !!value; document.dispatchEvent({type: 'visibilitychange'}); return snapshot();},
    closeRepair: () => click($('repairPanel').querySelector('.panel-close')),
    closeAntenna: () => click($('antennaPanel').querySelector('.panel-close')),
    resize(w, h) {dimensions(w, h); return invoke('refreshLife1Geometry();');},
    leave: () => invoke("show('home');"), enter: () => invoke("show('mission1');"),
    reset: () => invoke('resetLife1Mission();'), release: () => invoke('stopLife1Stick(null);'),
    showSequence: () => click($('showRepairSequenceBtn')),
    action: () => click($('life1ActionBtn')),
    delayCallback(timestamp) {
      if (timestamp != null) time(timestamp);
      const handles = run('[...(missionDelays.get(1)||[])]');
      const id = handles.find(handle => timers.has(handle)), task = timers.get(id);
      // One missionTimeout callback only; a newly scheduled sequence step waits
      // for a subsequent explicit call, just as it does in the browser event loop.
      if (task) {task.due = now + task.delay; task.callback();}
      return snapshot();
    },
    delayTick(ms) {
      assert(Number.isFinite(ms) && ms >= 0); const target = now + ms;
      let count = 0;
      while (true) {
        const due = [...timers].filter(([, task]) => Math.max(task.due, now) <= target).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!due) break;
        assert(++count < 100000, 'Timer fixture runaway');
        const [id, task] = due; now = Math.max(now, task.due);
        if (task.repeating) task.due = now + task.delay; else timers.delete(id);
        task.callback();
      }
      now = target; return snapshot();
    }
  };
}

module.exports = {createController};
