// Dependency-free fake browser environment for running src/ghl-customizer.js
// under node:vm. Provides just enough window/document/history/fetch/
// MutationObserver/timer behavior for end-to-end scenarios in test/run.mjs.
//
// Original work (see NOTICE.md). Node 18+; imports node: builtins only.

import vm from 'node:vm';
import util from 'node:util';

const HTML_NS = 'http://www.w3.org/1999/xhtml';

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export class Event {
  constructor(type, init = {}) {
    this.type = String(type);
    this.bubbles = !!init.bubbles;
    this.cancelable = !!init.cancelable;
    this.composed = !!init.composed;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.timeStamp = Date.now();
    this._stopped = false;
    this._stopImmediate = false;
    this._path = [];
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
  stopImmediatePropagation() { this._stopped = true; this._stopImmediate = true; }
  composedPath() { return this._path.slice(); }
}

export class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail === undefined ? null : init.detail;
  }
}

export class PopStateEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.state = init.state === undefined ? null : init.state;
  }
}

class EventTargetImpl {
  constructor() {
    this._listeners = new Map();
  }
  get _eventParent() { return null; }
  _reportError(err) {
    const env = this._env();
    if (env) env.reportError(err);
    else throw err;
  }
  _env() { return null; }
  addEventListener(type, fn, opts) {
    if (!fn) return;
    const once = !!(opts && typeof opts === 'object' && opts.once);
    const list = this._listeners.get(type) || [];
    if (list.some((l) => l.fn === fn)) return;
    list.push({ fn, once });
    this._listeners.set(type, list);
  }
  removeEventListener(type, fn) {
    const list = this._listeners.get(type);
    if (!list) return;
    const next = list.filter((l) => l.fn !== fn);
    if (next.length) this._listeners.set(type, next);
    else this._listeners.delete(type);
  }
  _listenerCount(type) {
    const list = this._listeners.get(type);
    return list ? list.length : 0;
  }
  _invoke(event) {
    const list = this._listeners.get(event.type);
    if (!list || !list.length) return;
    event.currentTarget = this;
    for (const l of list.slice()) {
      if (l.once) this.removeEventListener(event.type, l.fn);
      try {
        if (typeof l.fn === 'function') l.fn.call(this, event);
        else if (typeof l.fn.handleEvent === 'function') l.fn.handleEvent(event);
      } catch (err) {
        this._reportError(err);
      }
      if (event._stopImmediate) break;
    }
  }
  dispatchEvent(event) {
    if (!event || typeof event.type !== 'string') throw new TypeError('dispatchEvent requires an Event');
    event.target = this;
    const path = [this];
    let node = this._eventParent;
    while (node) {
      path.push(node);
      node = node._eventParent;
    }
    event._path = path;
    const targets = event.bubbles ? path : [this];
    for (const t of targets) {
      t._invoke(event);
      if (event._stopped) break;
    }
    event.currentTarget = null;
    return !event.defaultPrevented;
  }
}

// ---------------------------------------------------------------------------
// Selector engine: type, #id, .class, [attr], [attr op "v" i], compound,
// descendant (whitespace) and child (>) combinators, comma lists.
// ---------------------------------------------------------------------------

const selectorCache = new Map();

function splitTopLevel(text, isSep) {
  const parts = [];
  let buf = '';
  let depth = 0;
  let quote = null;
  for (const ch of text) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0 && isSep(ch)) {
      parts.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  parts.push(buf);
  return parts;
}

const ATTR_RE = /^\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+))\s*([iIsS])?)?\s*\]/;

function parseCompound(text) {
  const compound = { tag: null, id: null, classes: [], attrs: [] };
  let rest = text;
  let m;
  if ((m = /^\*/.exec(rest))) rest = rest.slice(1);
  else if ((m = /^[a-zA-Z][\w-]*/.exec(rest))) { compound.tag = m[0].toLowerCase(); rest = rest.slice(m[0].length); }
  while (rest.length) {
    if ((m = /^#([\w-]+)/.exec(rest))) { compound.id = m[1]; rest = rest.slice(m[0].length); continue; }
    if ((m = /^\.([\w-]+)/.exec(rest))) { compound.classes.push(m[1]); rest = rest.slice(m[0].length); continue; }
    if ((m = ATTR_RE.exec(rest))) {
      const value = m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5];
      compound.attrs.push({
        name: m[1].toLowerCase(),
        op: m[2] || null,
        value: value === undefined ? null : value,
        ci: !!m[6] && m[6].toLowerCase() === 'i',
      });
      rest = rest.slice(m[0].length);
      continue;
    }
    throw new Error(`dom-shim: unsupported selector fragment "${rest}" in "${text}"`);
  }
  return compound;
}

function parseComplex(text) {
  const parts = [];
  let buf = '';
  let depth = 0;
  let quote = null;
  let pendingComb = 'descendant';
  const flush = () => {
    if (buf.trim()) {
      parts.push({ compound: parseCompound(buf.trim()), comb: pendingComb });
      pendingComb = 'descendant';
    }
    buf = '';
  };
  for (const ch of text) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (depth === 0 && (ch === ' ' || ch === '\t' || ch === '\n' || ch === '>')) {
      flush();
      if (ch === '>') pendingComb = 'child';
      continue;
    }
    buf += ch;
  }
  flush();
  if (!parts.length) throw new Error(`dom-shim: empty selector in "${text}"`);
  return parts;
}

function parseSelectorList(text) {
  const key = String(text);
  let list = selectorCache.get(key);
  if (list) return list;
  list = splitTopLevel(key, (ch) => ch === ',').map((s) => s.trim()).filter(Boolean).map(parseComplex);
  if (!list.length) throw new Error('dom-shim: empty selector list');
  selectorCache.set(key, list);
  return list;
}

function attrMatches(el, attr) {
  const actual = el.getAttribute(attr.name);
  if (actual === null) return false;
  if (!attr.op) return true;
  let a = actual;
  let v = attr.value;
  if (attr.ci) { a = a.toLowerCase(); v = v.toLowerCase(); }
  switch (attr.op) {
    case '=': return a === v;
    case '^=': return v !== '' && a.startsWith(v);
    case '$=': return v !== '' && a.endsWith(v);
    case '*=': return v !== '' && a.includes(v);
    case '~=': return v !== '' && a.split(/\s+/).includes(v);
    case '|=': return a === v || a.startsWith(v + '-');
    default: return false;
  }
}

function matchCompound(el, c) {
  if (c.tag && el.localName.toLowerCase() !== c.tag) return false;
  if (c.id !== null && el.getAttribute('id') !== c.id) return false;
  for (const cls of c.classes) if (!el.classList.contains(cls)) return false;
  for (const attr of c.attrs) if (!attrMatches(el, attr)) return false;
  return true;
}

function matchFrom(el, parts, i) {
  if (!matchCompound(el, parts[i].compound)) return false;
  if (i === 0) return true;
  const comb = parts[i].comb;
  let p = el.parentElement;
  if (comb === 'child') return !!p && matchFrom(p, parts, i - 1);
  while (p) {
    if (matchFrom(p, parts, i - 1)) return true;
    p = p.parentElement;
  }
  return false;
}

function matchesList(el, list) {
  return list.some((parts) => matchFrom(el, parts, parts.length - 1));
}

function* descendants(node) {
  for (const child of node.childNodes) {
    if (child.nodeType === 1) {
      yield child;
      yield* descendants(child);
    }
  }
}

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

class Node extends EventTargetImpl {
  constructor(doc, nodeType) {
    super();
    this.ownerDocument = doc;
    this.nodeType = nodeType;
    this.parentNode = null;
    this.childNodes = [];
  }
  _doc() { return this.nodeType === 9 ? this : this.ownerDocument; }
  _env() { const d = this._doc(); return d ? d._envRef : null; }
  get _eventParent() { return this.parentNode; }
  get parentElement() {
    const p = this.parentNode;
    return p && p.nodeType === 1 ? p : null;
  }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const list = this.parentNode.childNodes;
    return list[list.indexOf(this) + 1] || null;
  }
  get previousSibling() {
    if (!this.parentNode) return null;
    const list = this.parentNode.childNodes;
    const i = list.indexOf(this);
    return i > 0 ? list[i - 1] : null;
  }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  get firstElementChild() { return this.children[0] || null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] || null; }
  get childElementCount() { return this.children.length; }
  get isConnected() {
    let n = this;
    while (n) {
      if (n.nodeType === 9) return true;
      n = n.parentNode;
    }
    return false;
  }
  get textContent() {
    return this.childNodes.map((c) => (c.nodeType === 3 || c.nodeType === 1 ? c.textContent : '')).join('');
  }
  set textContent(value) {
    while (this.childNodes.length) this.removeChild(this.childNodes[0]);
    const text = value === null || value === undefined ? '' : String(value);
    if (text !== '') this.appendChild(this._doc().createTextNode(text));
  }
  hasChildNodes() { return this.childNodes.length > 0; }
  contains(other) {
    let n = other;
    while (n) {
      if (n === this) return true;
      n = n.parentNode;
    }
    return false;
  }
  appendChild(child) { return this.insertBefore(child, null); }
  insertBefore(child, ref) {
    if (!child || typeof child.nodeType !== 'number') throw new TypeError('insertBefore requires a Node');
    if (child === this || child.contains(this)) throw new Error('HierarchyRequestError');
    if (child.parentNode) child.parentNode.removeChild(child);
    let index = this.childNodes.length;
    if (ref) {
      index = this.childNodes.indexOf(ref);
      if (index === -1) throw new Error('NotFoundError: reference node is not a child');
    }
    this.childNodes.splice(index, 0, child);
    child.parentNode = this;
    this._doc()._recordMutation({
      type: 'childList',
      target: this,
      addedNodes: [child],
      removedNodes: [],
      previousSibling: this.childNodes[index - 1] || null,
      nextSibling: this.childNodes[index + 1] || null,
    });
    return child;
  }
  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index === -1) throw new Error('NotFoundError: node is not a child');
    const prev = this.childNodes[index - 1] || null;
    const next = this.childNodes[index + 1] || null;
    this.childNodes.splice(index, 1);
    child.parentNode = null;
    this._doc()._recordMutation({
      type: 'childList',
      target: this,
      addedNodes: [],
      removedNodes: [child],
      previousSibling: prev,
      nextSibling: next,
    });
    return child;
  }
  replaceChild(newChild, oldChild) {
    this.insertBefore(newChild, oldChild);
    return this.removeChild(oldChild);
  }
  _toNode(item) {
    return typeof item === 'string' ? this._doc().createTextNode(item) : item;
  }
  append(...items) { items.forEach((i) => this.appendChild(this._toNode(i))); }
  prepend(...items) {
    const first = this.firstChild;
    items.forEach((i) => this.insertBefore(this._toNode(i), first));
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceWith(...items) {
    const parent = this.parentNode;
    if (!parent) return;
    items.forEach((i) => parent.insertBefore(this._toNode(i), this));
    parent.removeChild(this);
  }
  querySelector(selector) {
    const list = parseSelectorList(selector);
    for (const el of descendants(this)) if (matchesList(el, list)) return el;
    return null;
  }
  querySelectorAll(selector) {
    const list = parseSelectorList(selector);
    const out = [];
    for (const el of descendants(this)) if (matchesList(el, list)) out.push(el);
    return out;
  }
}

class Text extends Node {
  constructor(doc, data) {
    super(doc, 3);
    this.data = String(data);
    this.nodeName = '#text';
  }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get nodeValue() { return this.data; }
  set nodeValue(v) { this.data = String(v); }
}

function camelToKebab(key) { return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); }
function kebabToCamel(key) { return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function createClassList(el) {
  const read = () => (el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  const write = (tokens) => el.setAttribute('class', tokens.join(' '));
  return {
    add(...names) { const t = read(); names.forEach((n) => { if (!t.includes(n)) t.push(n); }); write(t); },
    remove(...names) { write(read().filter((n) => !names.includes(n))); },
    contains(name) { return read().includes(name); },
    toggle(name, force) {
      const has = read().includes(name);
      const want = force === undefined ? !has : !!force;
      if (want && !has) this.add(name);
      if (!want && has) this.remove(name);
      return want;
    },
    get length() { return read().length; },
    item(i) { return read()[i] || null; },
    toString() { return read().join(' '); },
    [Symbol.iterator]() { return read()[Symbol.iterator](); },
  };
}

function createDataset(el) {
  const name = (key) => 'data-' + camelToKebab(String(key));
  return new Proxy({}, {
    get(_, key) {
      if (typeof key !== 'string') return undefined;
      const v = el.getAttribute(name(key));
      return v === null ? undefined : v;
    },
    set(_, key, value) { el.setAttribute(name(key), value); return true; },
    has(_, key) { return typeof key === 'string' && el.hasAttribute(name(key)); },
    deleteProperty(_, key) { el.removeAttribute(name(key)); return true; },
    ownKeys() {
      return el.getAttributeNames().filter((n) => n.startsWith('data-')).map((n) => kebabToCamel(n.slice(5)));
    },
    getOwnPropertyDescriptor(_, key) {
      if (typeof key !== 'string' || !el.hasAttribute(name(key))) return undefined;
      return { value: el.getAttribute(name(key)), enumerable: true, configurable: true, writable: true };
    },
  });
}

const REFLECTED = ['title', 'type', 'href', 'src', 'alt', 'rel', 'target', 'name', 'role', 'lang'];

class Element extends Node {
  constructor(doc, tagName, ns) {
    super(doc, 1);
    this.namespaceURI = ns || HTML_NS;
    const isHtml = this.namespaceURI === HTML_NS;
    this.localName = isHtml ? String(tagName).toLowerCase() : String(tagName);
    this.tagName = isHtml ? this.localName.toUpperCase() : this.localName;
    this.nodeName = this.tagName;
    this._attrs = new Map();
    this._value = undefined;
    this._classList = null;
    this._dataset = null;
    this.style = createStyle();
  }
  _norm(name) { return this.namespaceURI === HTML_NS ? String(name).toLowerCase() : String(name); }
  get id() { return this.getAttribute('id') || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return this.getAttribute('class') || ''; }
  set className(v) { this.setAttribute('class', v); }
  get classList() { return this._classList || (this._classList = createClassList(this)); }
  get dataset() { return this._dataset || (this._dataset = createDataset(this)); }
  get attributes() { return [...this._attrs].map(([name, value]) => ({ name, value })); }
  getAttributeNames() { return [...this._attrs.keys()]; }
  getAttribute(name) {
    const v = this._attrs.get(this._norm(name));
    return v === undefined ? null : v;
  }
  hasAttribute(name) { return this._attrs.has(this._norm(name)); }
  setAttribute(name, value) {
    const key = this._norm(name);
    const old = this._attrs.has(key) ? this._attrs.get(key) : null;
    this._attrs.set(key, String(value));
    this._doc()._recordMutation({ type: 'attributes', target: this, attributeName: key, oldValue: old });
  }
  removeAttribute(name) {
    const key = this._norm(name);
    if (!this._attrs.has(key)) return;
    const old = this._attrs.get(key);
    this._attrs.delete(key);
    this._doc()._recordMutation({ type: 'attributes', target: this, attributeName: key, oldValue: old });
  }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { if (v) this.setAttribute('disabled', ''); else this.removeAttribute('disabled'); }
  get hidden() { return this.hasAttribute('hidden'); }
  set hidden(v) { if (v) this.setAttribute('hidden', ''); else this.removeAttribute('hidden'); }
  get value() {
    if (this._value !== undefined) return this._value;
    const attr = this.getAttribute('value');
    return attr === null ? '' : attr;
  }
  set value(v) { this._value = String(v); }
  get innerText() { return this.textContent; }
  set innerText(v) { this.textContent = v; }
  closest(selector) {
    const list = parseSelectorList(selector);
    let n = this;
    while (n && n.nodeType === 1) {
      if (matchesList(n, list)) return n;
      n = n.parentNode;
    }
    return null;
  }
  matches(selector) { return matchesList(this, parseSelectorList(selector)); }
  click() {
    if (this.hasAttribute('disabled')) return;
    this.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));
  }
  focus() { this._doc().activeElement = this; }
  blur() { const d = this._doc(); if (d.activeElement === this) d.activeElement = d.body; }
  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
  getClientRects() { return []; }
  scrollIntoView() {}
}

for (const prop of REFLECTED) {
  Object.defineProperty(Element.prototype, prop, {
    get() { return this.getAttribute(prop) || ''; },
    set(v) { this.setAttribute(prop, v); },
    configurable: true,
  });
}

function createStyle() {
  const store = new Map();
  const style = {
    setProperty(name, value) { store.set(String(name), String(value)); },
    removeProperty(name) { const v = store.get(String(name)) || ''; store.delete(String(name)); return v; },
    getPropertyValue(name) { return store.get(String(name)) || ''; },
    get cssText() { return [...store].map(([k, v]) => `${k}: ${v};`).join(' '); },
  };
  return new Proxy(style, {
    get(t, key) { return key in t ? t[key] : (store.get(camelToKebab(String(key))) || ''); },
    set(t, key, value) { store.set(camelToKebab(String(key)), String(value)); return true; },
  });
}

class Document extends Node {
  constructor(env) {
    super(null, 9);
    this._envRef = env;
    this.ownerDocument = null;
    this.nodeName = '#document';
    this.readyState = 'complete';
    this.currentScript = null;
    this._mutationRegs = [];
    this.documentElement = this.createElement('html');
    this.head = this.createElement('head');
    this.body = this.createElement('body');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    super.appendChild(this.documentElement);
    this.activeElement = this.body;
  }
  get _eventParent() { return this._envRef.windowTarget; }
  get defaultView() { return this._envRef.window; }
  get location() { return this._envRef.window.location; }
  createElement(tag) { return new Element(this, tag, HTML_NS); }
  createElementNS(ns, tag) { return new Element(this, tag, ns); }
  createTextNode(data) { return new Text(this, data); }
  createEvent() { return new Event(''); }
  getElementById(id) {
    for (const el of descendants(this)) if (el.getAttribute('id') === id) return el;
    return null;
  }
  hasFocus() { return true; }
  _recordMutation(record) {
    for (const reg of this._mutationRegs) {
      if (!reg.active) continue;
      const o = reg.options;
      if (record.type === 'childList' && !o.childList) continue;
      if (record.type === 'attributes') {
        if (!o.attributes) continue;
        if (o.attributeFilter && !o.attributeFilter.includes(record.attributeName)) continue;
      }
      if (reg.target === record.target || (o.subtree && reg.target.contains(record.target))) {
        reg.observer._enqueue(record);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// MutationObserver
// ---------------------------------------------------------------------------

export class MutationObserver {
  constructor(callback) {
    if (typeof callback !== 'function') throw new TypeError('MutationObserver requires a callback');
    this._callback = callback;
    this._queue = [];
    this._regs = [];
    this._scheduled = false;
  }
  observe(target, options = {}) {
    if (!target || typeof target.nodeType !== 'number') throw new TypeError('observe requires a Node');
    const doc = target.nodeType === 9 ? target : target.ownerDocument;
    const normalized = {
      childList: !!options.childList,
      subtree: !!options.subtree,
      attributes: !!options.attributes || Array.isArray(options.attributeFilter),
      attributeFilter: Array.isArray(options.attributeFilter) ? options.attributeFilter.slice() : null,
      characterData: !!options.characterData,
    };
    if (!normalized.childList && !normalized.attributes && !normalized.characterData) {
      throw new TypeError('observe requires childList, attributes, or characterData');
    }
    const existing = this._regs.find((r) => r.target === target);
    if (existing) {
      existing.options = normalized;
      existing.active = true;
      return;
    }
    const reg = { observer: this, target, options: normalized, active: true, doc };
    this._regs.push(reg);
    doc._mutationRegs.push(reg);
  }
  disconnect() {
    for (const reg of this._regs) {
      reg.active = false;
      const i = reg.doc._mutationRegs.indexOf(reg);
      if (i !== -1) reg.doc._mutationRegs.splice(i, 1);
    }
    this._regs = [];
    this._queue = [];
  }
  takeRecords() {
    const q = this._queue;
    this._queue = [];
    return q;
  }
  _enqueue(record) {
    this._queue.push(record);
    if (this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      const records = this.takeRecords();
      if (!records.length) return;
      try {
        this._callback(records, this);
      } catch (err) {
        const doc = this._regs[0] ? this._regs[0].doc : null;
        if (doc && doc._envRef) doc._envRef.reportError(err);
        else throw err;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// createShim
// ---------------------------------------------------------------------------

export function createShim(options = {}) {
  const {
    pathname = '/',
    search = '',
    origin = 'https://app.gohighlevel.com',
    configUrl = 'https://config.test/config.json',
    fixture = { schemaVersion: 1, enabled: true, agency: {}, locations: {}, buttons: [] },
  } = options;

  const errors = [];
  const env = {
    window: null,
    windowTarget: new EventTargetImpl(),
    reportError(err) { errors.push(err); consoleObj.error('[dom-shim] uncaught:', err && err.stack ? err.stack : String(err)); },
  };
  env.windowTarget._env = () => env;

  // ---- console -------------------------------------------------------------
  const lines = [];
  const consoleObj = { lines };
  for (const level of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'table', 'dir']) {
    consoleObj[level] = (...args) => { lines.push(`${level}: ${util.format(...args)}`); };
  }
  for (const noop of ['group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'count', 'assert', 'clear']) {
    consoleObj[noop] = () => {};
  }

  // ---- history / location --------------------------------------------------
  const hist = { entries: [{ url: new URL(pathname + search, origin).href, state: null }], index: 0 };
  const currentUrl = () => new URL(hist.entries[hist.index].url);
  const resolveUrl = (url) => (url === undefined || url === null ? currentUrl().href : new URL(String(url), currentUrl().href).href);

  const location = {};
  for (const key of ['href', 'origin', 'protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash']) {
    Object.defineProperty(location, key, { get: () => currentUrl()[key], enumerable: true });
  }
  const silentPush = (url, state = null) => {
    hist.entries = hist.entries.slice(0, hist.index + 1);
    hist.entries.push({ url: resolveUrl(url), state });
    hist.index = hist.entries.length - 1;
  };
  location.assign = (url) => silentPush(url);
  location.replace = (url) => { hist.entries[hist.index] = { url: resolveUrl(url), state: null }; };
  location.reload = () => {};
  location.toString = () => currentUrl().href;

  const dispatchPopState = () => {
    win.dispatchEvent(new PopStateEvent('popstate', { state: hist.entries[hist.index].state }));
  };
  const history = {
    get length() { return hist.entries.length; },
    get state() { return hist.entries[hist.index].state; },
    scrollRestoration: 'auto',
    pushState(state, _title, url) { silentPush(url, state === undefined ? null : state); },
    replaceState(state, _title, url) {
      hist.entries[hist.index] = { url: resolveUrl(url), state: state === undefined ? null : state };
    },
    go(delta) {
      const next = hist.index + (Number(delta) || 0);
      if (next < 0 || next >= hist.entries.length || next === hist.index) return;
      hist.index = next;
      dispatchPopState();
    },
    back() { this.go(-1); },
    forward() { this.go(1); },
  };

  // ---- timers (virtual clock) ----------------------------------------------
  const timers = new Map();
  let now = 0;
  let nextTimerId = 1;
  const schedule = (fn, delay, args, interval) => {
    const id = nextTimerId++;
    const ms = Math.max(0, Number(delay) || 0);
    timers.set(id, { id, fn, args, due: now + ms, interval: interval ? Math.max(1, ms) : null });
    return id;
  };
  const fakeSetTimeout = (fn, delay, ...args) => schedule(fn, delay, args, false);
  const fakeSetInterval = (fn, delay, ...args) => schedule(fn, delay, args, true);
  const fakeClear = (id) => { timers.delete(id); };
  const nextDue = (limit) => {
    let best = null;
    for (const t of timers.values()) {
      if (t.due <= limit && (!best || t.due < best.due || (t.due === best.due && t.id < best.id))) best = t;
    }
    return best;
  };
  const runDueTimers = () => {
    let ran = 0;
    for (let guard = 0; guard < 10000; guard++) {
      const t = nextDue(now);
      if (!t) break;
      if (t.interval) t.due = now + t.interval;
      else timers.delete(t.id);
      ran++;
      try {
        if (typeof t.fn === 'function') t.fn(...t.args);
      } catch (err) {
        env.reportError(err);
      }
    }
    return ran;
  };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const flush = async () => {
    for (let i = 0; i < 50; i++) {
      await tick();
      if (!runDueTimers()) {
        await tick();
        return;
      }
    }
  };
  const advanceTimers = async (ms) => {
    const target = now + Math.max(0, Number(ms) || 0);
    for (let guard = 0; guard < 1000; guard++) {
      const t = nextDue(target);
      if (!t) break;
      now = Math.max(now, t.due);
      await flush();
    }
    now = target;
    await flush();
  };

  // ---- fetch ---------------------------------------------------------------
  let fetchMode = 'ok';
  let configResponse = null;
  const held = [];
  const fetchLog = [];
  const makeResponse = ({ ok, status, type = 'basic', bodyText = '' }) => ({
    ok,
    status,
    type,
    statusText: '',
    url: '',
    redirected: false,
    headers: { get: () => null, has: () => false },
    text: async () => bodyText,
    json: async () => JSON.parse(bodyText),
    clone() { return makeResponse({ ok, status, type, bodyText }); },
  });
  const configHref = new URL(configUrl, origin).href;
  const fetchImpl = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input && input.url ? String(input.url) : String(input);
    if (url.includes('/hooks/')) {
      const headers = {};
      if (init.headers) {
        const src = init.headers;
        if (typeof src.forEach === 'function' && typeof src.get === 'function') {
          // Headers-like object
          src.forEach((v, k) => { headers[String(k).toLowerCase()] = String(v); });
        } else {
          for (const [k, v] of Object.entries(src)) headers[String(k).toLowerCase()] = String(v);
        }
      }
      const body = init.body === undefined ? null : String(init.body);
      let bodyJson = null;
      try { bodyJson = body === null ? null : JSON.parse(body); } catch { bodyJson = null; }
      fetchLog.push({
        url,
        method: init.method || 'GET',
        mode: init.mode || 'cors',
        credentials: init.credentials || 'same-origin',
        headers,
        body,
        bodyJson,
        time: now,
      });
      switch (fetchMode) {
        case 'ok':
          return Promise.resolve(makeResponse({ ok: true, status: 200, type: 'cors', bodyText: '{"status":"ok"}' }));
        case 'error':
          return Promise.resolve(makeResponse({ ok: false, status: 500, type: 'cors', bodyText: '{"error":"boom"}' }));
        case 'cors':
          if (init.mode !== 'no-cors') return Promise.reject(new TypeError('Failed to fetch'));
          return Promise.resolve(makeResponse({ ok: false, status: 0, type: 'opaque' }));
        case 'offline':
          return Promise.reject(new TypeError('Failed to fetch'));
        case 'hold':
          return new Promise((resolve) => { held.push(resolve); });
        default:
          return Promise.reject(new TypeError(`dom-shim: unknown fetch mode "${fetchMode}"`));
      }
    }
    let resolved;
    try { resolved = new URL(url, currentUrl().href).href; } catch { resolved = url; }
    if (url === configUrl || resolved === configHref) {
      if (configResponse) {
        const bodyText = typeof configResponse.body === 'string' ? configResponse.body : JSON.stringify(configResponse.body);
        const status = configResponse.status === undefined ? 200 : configResponse.status;
        return Promise.resolve(makeResponse({ ok: status >= 200 && status < 300, status, bodyText }));
      }
      return Promise.resolve(makeResponse({ ok: true, status: 200, bodyText: JSON.stringify(fixture) }));
    }
    return Promise.reject(new TypeError('Failed to fetch'));
  };

  // ---- window --------------------------------------------------------------
  const win = {};
  env.window = win;
  const doc = new Document(env);
  const target = env.windowTarget;
  win.window = win;
  win.self = win;
  win.top = win;
  win.parent = win;
  win.document = doc;
  win.location = location;
  win.history = history;
  // Plain object so a scenario can inject navigator.clipboard before shim.run.
  win.navigator = { clipboard: undefined, userAgent: 'ghlc-dom-shim', language: 'en-US' };
  // Any accidental execution of config text (the fixture's "alert(1)") fails loudly.
  win.alert = () => { throw new Error('alert must never be called'); };
  win.console = consoleObj;
  win.fetch = fetchImpl;
  win.crypto = globalThis.crypto;
  win.URL = URL;
  win.URLSearchParams = URLSearchParams;
  win.TextEncoder = globalThis.TextEncoder;
  win.TextDecoder = globalThis.TextDecoder;
  win.setTimeout = fakeSetTimeout;
  win.clearTimeout = fakeClear;
  win.setInterval = fakeSetInterval;
  win.clearInterval = fakeClear;
  win.queueMicrotask = (fn) => queueMicrotask(fn);
  win.requestAnimationFrame = (fn) => fakeSetTimeout(() => fn(now), 16);
  win.cancelAnimationFrame = fakeClear;
  win.performance = { now: () => now };
  win.Event = Event;
  win.CustomEvent = CustomEvent;
  win.PopStateEvent = PopStateEvent;
  win.MutationObserver = MutationObserver;
  win.Node = Node;
  win.Element = Element;
  win.HTMLElement = Element;
  win.addEventListener = (...a) => target.addEventListener(...a);
  win.removeEventListener = (...a) => target.removeEventListener(...a);
  win.dispatchEvent = (e) => target.dispatchEvent(e);
  win.getComputedStyle = () => ({ getPropertyValue: () => '' });
  win.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  win.innerWidth = 1440;
  win.innerHeight = 900;
  win.devicePixelRatio = 1;

  const context = vm.createContext(win);

  // ---- helpers -------------------------------------------------------------
  const el = (tag, attrs = {}, children = []) => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      node.setAttribute(k, v === true ? '' : v);
    }
    for (const child of children || []) node.appendChild(typeof child === 'string' ? doc.createTextNode(child) : child);
    return node;
  };

  // The contact region and the dashboard placeholder are built by one helper so
  // buildShell and setContact always produce the same class names and anchor shapes.
  const buildContactRegion = (contact) => {
    const region = el('div', { class: 'hl_contact-details-header' }, [el('h2', {}, [contact.name || 'Contact'])]);
    if (contact.email) region.appendChild(el('a', { href: `mailto:${contact.email}` }, ['email']));
    if (contact.phone) region.appendChild(el('a', { href: `tel:${contact.phone}` }, ['phone']));
    return region;
  };
  const buildDashboard = () => el('div', { class: 'hx-dashboard' }, ['Dashboard']);

  let shell = null;

  const buildShell = ({ sidebarMode = 'location', contact = null } = {}) => {
    while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild);
    const sidebar = el('aside', { id: 'sidebar-v2', class: `sidebar-v2-${sidebarMode}` }, [
      el('select', { id: 'location-switcher-sidbar-v2' }, [
        el('option', { value: 'locA' }, ['Location A']),
        el('option', { value: 'locB' }, ['Location B']),
      ]),
      el('button', { id: 'backButtonv2', type: 'button' }, ['Back to agency']),
    ]);
    const headerControls = el('div', { class: 'hl_header--controls' });
    const header = el('header', { class: 'hl_header' }, [headerControls]);
    const main = el('main', {});
    let contactRegion = null;
    if (contact) {
      contactRegion = buildContactRegion(contact);
      main.appendChild(contactRegion);
    } else {
      main.appendChild(buildDashboard());
    }
    doc.body.appendChild(sidebar);
    doc.body.appendChild(header);
    doc.body.appendChild(main);
    shell = { sidebar, header, headerControls, main, contactRegion };
    return shell;
  };

  // Replaces the contents of <main>: a fresh contact region (never the old node
  // mutated in place, so isConnected on the previous region turns false) or a
  // dashboard placeholder. Returns the new region, or null.
  const setContact = (contact) => {
    let main = shell ? shell.main : doc.querySelector('main');
    if (!main) {
      main = el('main', {});
      doc.body.appendChild(main);
    }
    while (main.firstChild) main.removeChild(main.firstChild);
    let region = null;
    if (contact) {
      region = buildContactRegion(contact);
      main.appendChild(region);
    } else {
      main.appendChild(buildDashboard());
    }
    if (shell) shell.contactRegion = region;
    return region;
  };

  const setSidebarMode = (mode) => {
    const sidebar = doc.getElementById('sidebar-v2');
    if (!sidebar) return null;
    sidebar.setAttribute('class', `sidebar-v2-${mode}`);
    return sidebar;
  };

  // Simulates a URL change the script did not observe: rewrites the current
  // history entry's URL silently. No new entry, no event.
  const setPath = (path) => {
    hist.entries[hist.index] = { url: resolveUrl(path), state: hist.entries[hist.index].state };
  };

  const run = (src) => {
    win.__GHLC_TEST__ = true;
    const script = doc.createElement('script');
    script.setAttribute('src', 'https://cdn.test/ghl-customizer.js');
    script.setAttribute('data-config', configUrl);
    doc.head.appendChild(script);
    doc.currentScript = script;
    try {
      new vm.Script(src, { filename: 'ghl-customizer.js' }).runInContext(context);
    } finally {
      doc.currentScript = null;
    }
    return win.GHLC;
  };

  const navigate = (path, { via = 'pushState' } = {}) => {
    switch (via) {
      case 'pushState':
        win.history.pushState({}, '', path);
        break;
      case 'replaceState':
        win.history.replaceState({}, '', path);
        break;
      case 'popstate':
        silentPush(path);
        dispatchPopState();
        break;
      case 'routeChangeEvent':
        silentPush(path);
        win.dispatchEvent(new CustomEvent('routeChangeEvent', { detail: { path } }));
        break;
      default:
        throw new Error(`dom-shim: unknown navigate via "${via}"`);
    }
  };

  const listenerCount = (t, type) => {
    const impl = t === win ? target : t;
    return impl && typeof impl._listenerCount === 'function' ? impl._listenerCount(type) : 0;
  };

  const observers = () => doc._mutationRegs.filter((r) => r.active).map((r) => ({ target: r.target, options: { ...r.options } }));

  return {
    window: win,
    document: doc,
    context,
    el,
    buildShell,
    setContact,
    setSidebarMode,
    setPath,
    run,
    fetchLog,
    setFetchMode(mode) { fetchMode = mode; },
    releaseFetch() {
      const pending = held.splice(0, held.length);
      pending.forEach((resolve) => resolve(makeResponse({ ok: true, status: 200, type: 'cors', bodyText: '{"status":"ok"}' })));
    },
    setConfigResponse(response) { configResponse = response || null; },
    navigate,
    back() { win.history.back(); },
    forward() { win.history.forward(); },
    flush,
    advanceTimers,
    get now() { return now; },
    console: consoleObj,
    errors,
    listenerCount,
    observers,
    Event,
    CustomEvent,
  };
}
