/*!
 * GHL Customizer (admin-theme)
 * Version 0.1.0
 * Original work — nothing copied from the reference project (see NOTICE.md)
 *
 * One hosted vanilla JavaScript IIFE (ES2019, no build step) that reads a public
 * JSON config, resolves the active HighLevel location and contact from the URL,
 * and renders configurable buttons where staff work. Every HighLevel selector,
 * route regex, and DOM reader lives in the single `adapter` object below; when
 * HighLevel's markup changes, that object is the only thing that changes.
 *
 * Config schema (schemaVersion 1)
 *   schemaVersion  number   must be exactly 1
 *   enabled        boolean  false disables the script entirely (native UI untouched)
 *   agency         object   { logoUrl?: string, logoAlt?: string, theme?: object, buttons?: object }
 *   locations      object   { [locationId: string]: { name?: string, logoUrl?: string,
 *                              theme?: object, buttons?: { [buttonId: string]: boolean | object } } }
 *   buttons        array    Array<{ id: string, label: string, icon?: string,
 *                              placement: 'header' | 'contact',
 *                              scope: 'all' | string[], action: Action }>
 *   Action         object   { type: 'link', href: string, target?: string }
 *                         | { type: 'webhook', url: string, extraFields?: object, cooldownMs?: number }
 *                         | { type: 'handler', handler: string }
 *
 * The config is public to staff: never put tokens, secrets, or contact data in it.
 * Config never becomes code: action types are allowlisted, handlers resolve
 * against an in-script registry, and every config string reaches the DOM only
 * through textContent or setAttribute on elements this script creates itself.
 */
(function () {
  'use strict';
  var currentScript = document.currentScript;

// ==== constants ====

  var VERSION = '0.1.0';
  var NS = 'ghlc';
  // Provisional slug: the repo has no GitHub remote yet. Phase 3 pins the final
  // jsDelivr tag; the data-config attribute on the script tag always wins.
  var DEFAULT_CONFIG_URL = 'https://cdn.jsdelivr.net/gh/robhparker/admin-theme@v0.1.0/config/agency-config.json';
  var DEFAULT_COOLDOWN_MS = 10000;
  var ACTION_TYPES = Object.freeze(['link', 'webhook', 'handler']);
  var STATES = Object.freeze(['ready', 'submitting', 'queued', 'unavailable', 'failed']);

  // Selectors for elements this script owns (never HighLevel's).
  var OWN = Object.freeze({
    groupClass: NS + '-group',
    groupSel: '.' + NS + '-group',
    buttonSel: '[data-' + NS + '-button-id]',
    styleLinkSel: 'link[data-' + NS + '-styles]',
    labelSel: '.' + NS + '-btn__label',
    msgSel: '.' + NS + '-btn__msg'
  });

  var DEBUG = (function () {
    try {
      return new URLSearchParams(location.search).get(NS + '-debug') === '1';
    } catch (e) {
      return false;
    }
  })();

  var SAFE_VALUE_RE = /^[A-Za-z0-9_:.|-]+$/;

  /**
   * Diagnostics guard (DLV-04): only booleans, numbers, and short ID-shaped
   * strings pass through; URLs, payloads, emails, and phones cannot.
   */
  function safe(fields) {
    var out = {};
    if (!fields || typeof fields !== 'object') return out;
    Object.keys(fields).forEach(function (key) {
      var value = fields[key];
      if (typeof value === 'boolean' || typeof value === 'number') {
        out[key] = value;
      } else if (typeof value === 'string' && value.length <= 64 && SAFE_VALUE_RE.test(value)) {
        out[key] = value;
      } else {
        out[key] = '[redacted]';
      }
    });
    return out;
  }

  function log(event, fields) {
    if (DEBUG) console.info('[' + NS + ']', event, safe(fields));
  }

  function warn(event, fields) {
    console.warn('[' + NS + ']', event, safe(fields));
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

// ==== adapter ====

  // All HighLevel knowledge. Candidate selectors come from community guides and
  // are unverified against the live DOM; verify mode (Plan 03) reports which
  // ones resolve. sidebarLogo / headerLogo are reserved for Phase 2 (D-07).
  var routes = Object.freeze({
    location: /^\/v2\/location\/([^/?#]+)/,
    contactDetail: /^\/v2\/location\/([^/?#]+)\/contacts\/detail\/([^/?#]+)/,
    agency: Object.freeze([/^\/v2\/agency(\/|$)/, /^\/agency_dashboard(\/|$)/])
  });

  var selectors = Object.freeze({
    sidebar: '#sidebar-v2',
    sidebarAgencyClass: 'sidebar-v2-agency',
    sidebarLocationClass: 'sidebar-v2-location',
    locationSwitcher: '#location-switcher-sidbar-v2',
    backToAgency: '#sidebar-v2 #backButtonv2',
    header: '.hl_header',
    headerMount: Object.freeze(['.hl_header .hl_header--controls', '.hl_header']),
    contactMount: Object.freeze([
      '.hl_contact-details-header',
      '.contact-detail-header',
      '[class*="contact-details"] .hl_header--controls'
    ]),
    contactRegion: Object.freeze([
      '.hl_contact-details-header',
      '.contact-detail-header',
      '[class*="contact-details"]',
      '[class*="contact-detail"]'
    ]),
    contactEmail: Object.freeze(['a[href^="mailto:"]', 'input[type="email"]']),
    contactPhone: Object.freeze(['a[href^="tel:"]', 'input[type="tel"]']),
    sidebarLogo: '#sidebar-v2 img',
    headerLogo: '.hl_header img'
  });

  var events = Object.freeze({
    routeChange: 'routeChangeEvent',
    navigate: NS + ':navigate'
  });

  function parseRoute(pathname) {
    var path = typeof pathname === 'string' ? pathname : '';
    var match = routes.contactDetail.exec(path);
    if (match) return { locationId: match[1], contactId: match[2], isAgency: false };
    match = routes.location.exec(path);
    if (match) return { locationId: match[1], contactId: null, isAgency: false };
    // Anything without a location segment is agency-level; the explicit agency
    // regexes exist so verify mode can report which agency route matched.
    return { locationId: null, contactId: null, isAgency: true };
  }

  function findFirst(list, root) {
    var scope = root || document;
    for (var i = 0; i < list.length; i++) {
      var hit = scope.querySelector(list[i]);
      if (hit) return hit;
    }
    return null;
  }

  function findHeaderMount() {
    return findFirst(selectors.headerMount, document);
  }

  function findContactMount() {
    return findFirst(selectors.contactMount, document);
  }

  function findContactRegion() {
    var region = findFirst(selectors.contactRegion, document);
    if (region) return region;
    var node = findContactMount();
    while (node && node.nodeType === 1) {
      var cls = node.getAttribute('class') || '';
      if (/contact/i.test(cls)) return node;
      node = node.parentNode;
    }
    return null;
  }

  function readHrefValue(region, selector, scheme) {
    var anchor = region.querySelector(selector);
    if (!anchor) return null;
    var href = anchor.getAttribute('href') || '';
    if (href.slice(0, scheme.length).toLowerCase() !== scheme) return null;
    return href.slice(scheme.length);
  }

  function readInputValue(region, selector) {
    var input = region.querySelector(selector);
    if (!input) return null;
    var value = input.value === undefined || input.value === null ? '' : String(input.value);
    value = value.trim();
    return value ? value : null;
  }

  function readContactEmail(region) {
    if (!region) return null;
    var raw = readHrefValue(region, selectors.contactEmail[0], 'mailto:');
    if (raw !== null) {
      var q = raw.indexOf('?');
      if (q !== -1) raw = raw.slice(0, q);
      try {
        raw = decodeURIComponent(raw);
      } catch (e) {
        // keep the raw value when it is not valid percent-encoding
      }
      raw = raw.trim();
      if (raw) return raw;
    }
    return readInputValue(region, selectors.contactEmail[1]);
  }

  function readContactPhone(region) {
    if (!region) return null;
    var raw = readHrefValue(region, selectors.contactPhone[0], 'tel:');
    if (raw !== null) {
      raw = raw.trim();
      if (raw) return raw;
    }
    return readInputValue(region, selectors.contactPhone[1]);
  }

  var adapter = Object.freeze({
    routes: routes,
    selectors: selectors,
    events: events,
    parseRoute: parseRoute,
    findFirst: findFirst,
    findHeaderMount: findHeaderMount,
    findContactMount: findContactMount,
    findContactRegion: findContactRegion,
    readContactEmail: readContactEmail,
    readContactPhone: readContactPhone
  });

// ==== config ====

  function configUrl() {
    var attr = currentScript && typeof currentScript.getAttribute === 'function'
      ? currentScript.getAttribute('data-config')
      : null;
    return attr ? attr : DEFAULT_CONFIG_URL;
  }

  // https anywhere, or same-origin (lets the localhost harness load a relative config).
  function isAllowedConfigUrl(raw) {
    try {
      var url = new URL(raw, location.href);
      return url.protocol === 'https:' || url.origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  function isSafeHttpsUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && url.username === '' && url.password === '';
    } catch (e) {
      return false;
    }
  }

  var BUTTON_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  var PLACEMENTS = Object.freeze(['header', 'contact']);

  function validateButton(button, index, seen, errors) {
    var where = 'buttons[' + index + ']';
    if (!isPlainObject(button)) {
      errors.push(where + ' must be an object');
      return;
    }
    if (typeof button.id !== 'string' || !BUTTON_ID_RE.test(button.id)) {
      errors.push(where + '.id must match ' + String(BUTTON_ID_RE));
    } else if (seen.has(button.id)) {
      errors.push(where + '.id is duplicated');
    } else {
      seen.add(button.id);
    }
    if (typeof button.label !== 'string' || button.label.length < 1 || button.label.length > 80) {
      errors.push(where + '.label must be a string of 1..80 characters');
    }
    if (PLACEMENTS.indexOf(button.placement) === -1) {
      errors.push(where + '.placement must be header or contact');
    }
    var scopeOk = button.scope === 'all' ||
      (Array.isArray(button.scope) && button.scope.every(function (s) { return typeof s === 'string'; }));
    if (!scopeOk) errors.push(where + '.scope must be "all" or an array of strings');
    if (!isPlainObject(button.action) || typeof button.action.type !== 'string') {
      errors.push(where + '.action must be an object with a string type');
    }
    if (button.icon !== undefined && typeof button.icon !== 'string') {
      errors.push(where + '.icon must be a string when present');
    }
  }

  // Unknown action types are not validation errors: they render unavailable (BTN-09).
  function validateConfig(obj) {
    var errors = [];
    if (!isPlainObject(obj)) return { ok: false, errors: ['config must be a JSON object'] };
    if (obj.schemaVersion !== 1) errors.push('schemaVersion must be 1');
    if (typeof obj.enabled !== 'boolean') errors.push('enabled must be a boolean');
    if (!isPlainObject(obj.agency)) errors.push('agency must be an object');
    if (!isPlainObject(obj.locations)) errors.push('locations must be an object');
    if (!Array.isArray(obj.buttons)) {
      errors.push('buttons must be an array');
    } else {
      var seen = new Set();
      obj.buttons.forEach(function (button, index) {
        validateButton(button, index, seen, errors);
      });
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function loadConfig() {
    var url = configUrl();
    if (!isAllowedConfigUrl(url)) {
      warn('config-url-rejected', {});
      return Promise.resolve(null);
    }
    var request;
    try {
      request = fetch(url, { credentials: 'omit' });
    } catch (e) {
      request = Promise.reject(e);
    }
    return request.then(function (res) {
      if (!res || !res.ok) {
        warn('config-fetch-failed', { status: res ? res.status : 0 });
        return null;
      }
      return res.text().then(function (text) {
        var parsed;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          warn('config-parse-failed', {});
          return null;
        }
        var result = validateConfig(parsed);
        if (!result.ok) {
          warn('config-invalid', { count: result.errors.length });
          return null;
        }
        return parsed;
      });
    }, function () {
      warn('config-fetch-failed', { status: 0 });
      return null;
    });
  }

  /**
   * Buttons visible for a location. Agency-level pages (locationId null) get
   * no buttons; buttons are a location-scoped feature.
   */
  function resolveButtons(config, locationId) {
    if (!config || !Array.isArray(config.buttons) || !locationId) return [];
    // Plan 03 merges config.locations[locationId].buttons overrides (BTN-02) here.
    return config.buttons.filter(function (button) {
      return button.scope === 'all' ||
        (Array.isArray(button.scope) && button.scope.indexOf(locationId) !== -1);
    });
  }

// ==== context ====

  // The only place context lives: in memory, per tab (D-09). `generation` is
  // the token every async completion compares against before touching the DOM (D-10).
  var state = {
    config: null,
    generation: 0,
    ctx: { locationId: null, contactId: null, isAgency: true },
    timers: new Map(),
    ready: null
  };

  function computeContext() {
    return adapter.parseRoute(location.pathname);
  }

  function clearTimers() {
    state.timers.forEach(function (id) {
      clearTimeout(id);
    });
    state.timers.clear();
  }

  function applyContext(reason) {
    var next = computeContext();
    if (reason !== 'boot' &&
        next.locationId === state.ctx.locationId &&
        next.contactId === state.ctx.contactId) {
      return;
    }
    state.ctx = next;
    state.generation += 1;
    clearTimers();
    renderAll();
    log('context', {
      reason: reason,
      generation: state.generation,
      locationId: next.locationId || 'none',
      contactId: next.contactId || 'none'
    });
  }

// ==== buttons ====

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Approved icon set: name -> stroke paths on a 24x24 grid. Unknown keys render no icon.
  var ICONS = Object.freeze({
    send: ['M21 3L10.5 13.5', 'M21 3L14 21L10.5 13.5L3 10L21 3Z'],
    mail: ['M3 6h18v12H3z', 'M3 7l9 6l9-6'],
    link: ['M9.5 14.5L14.5 9.5', 'M13 7l2-2a3.5 3.5 0 0 1 5 5l-2 2', 'M11 17l-2 2a3.5 3.5 0 0 1-5-5l2-2'],
    external: ['M14 4h6v6', 'M20 4L11 13', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']
  });

  function createIcon(name) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(ICONS, name)) return null;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    ICONS[name].forEach(function (d) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    });
    return svg;
  }

  function ctxKey() {
    return (state.ctx.locationId || '') + '|' + (state.ctx.contactId || '');
  }

  function resolveAction(button) {
    var action = button.action;
    if (!isPlainObject(action) || ACTION_TYPES.indexOf(action.type) === -1) {
      return { kind: 'unavailable', message: 'Action not available' };
    }
    if (action.type === 'webhook') {
      if (!isSafeHttpsUrl(action.url)) {
        return { kind: 'unavailable', message: 'Webhook URL must use HTTPS' };
      }
      return {
        kind: 'webhook',
        url: action.url,
        extraFields: isPlainObject(action.extraFields) ? action.extraFields : {},
        cooldownMs: typeof action.cooldownMs === 'number' && action.cooldownMs >= 0
          ? action.cooldownMs
          : DEFAULT_COOLDOWN_MS
      };
    }
    // Plan 03 resolves link and handler actions here.
    return { kind: 'unavailable', message: 'Action not available' };
  }

  function setState(el, next, opts) {
    opts = opts || {};
    var configLabel = el.getAttribute('data-' + NS + '-label') || '';
    var text = configLabel;
    if (next === 'submitting') text = 'Sending…';
    else if (next === 'queued') text = 'Workflow triggered';
    else if (next === 'failed') text = 'Failed — retry';
    if (typeof opts.label === 'string' && opts.label) text = opts.label;
    var message = typeof opts.message === 'string' ? opts.message : '';

    el.setAttribute('data-state', next);
    if (next === 'submitting' || next === 'queued' || next === 'unavailable') {
      el.setAttribute('disabled', '');
    } else {
      el.removeAttribute('disabled');
    }
    if (next === 'submitting') el.setAttribute('aria-busy', 'true');
    else el.removeAttribute('aria-busy');
    if (next === 'unavailable') el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');

    var labelEl = el.querySelector(OWN.labelSel);
    if (labelEl) labelEl.textContent = text;
    var msgEl = el.querySelector(OWN.msgSel);
    if (msgEl) msgEl.textContent = message;
    if (message) el.setAttribute('title', message);
    else el.removeAttribute('title');
  }

  function createButtonEl(button) {
    var el = document.createElement('button');
    el.setAttribute('type', 'button');
    el.setAttribute('class', NS + '-btn');
    el.setAttribute('data-' + NS + '-button-id', button.id);
    el.setAttribute('data-' + NS + '-placement', button.placement);
    el.setAttribute('data-' + NS + '-ctx', ctxKey());
    el.setAttribute('data-' + NS + '-generation', String(state.generation));
    el.setAttribute('data-' + NS + '-label', button.label);

    var iconEl = document.createElement('span');
    iconEl.setAttribute('class', NS + '-btn__icon');
    iconEl.setAttribute('aria-hidden', 'true');
    var svg = createIcon(button.icon);
    if (svg) iconEl.appendChild(svg);

    var labelEl = document.createElement('span');
    labelEl.setAttribute('class', NS + '-btn__label');
    labelEl.textContent = button.label;

    var msgEl = document.createElement('span');
    msgEl.setAttribute('class', NS + '-btn__msg');
    msgEl.setAttribute('role', 'status');
    msgEl.setAttribute('aria-live', 'polite');

    el.appendChild(iconEl);
    el.appendChild(labelEl);
    el.appendChild(msgEl);

    var action = resolveAction(button);
    if (action.kind === 'unavailable') {
      setState(el, 'unavailable', { message: action.message });
    } else {
      setState(el, 'ready');
      el.addEventListener('click', function () {
        onButtonClick(button, el);
      });
    }
    return el;
  }

  function findGroups(placement) {
    return Array.prototype.slice.call(document.querySelectorAll(OWN.groupSel)).filter(function (group) {
      return group.getAttribute('data-' + NS + '-placement') === placement;
    });
  }

  function removeGroup(placement) {
    findGroups(placement).forEach(function (group) {
      if (group.parentNode) group.parentNode.removeChild(group);
    });
  }

  function ensureGroup(mount, placement) {
    var groups = findGroups(placement);
    var keep = null;
    groups.forEach(function (group) {
      if (!keep && mount.contains(group)) keep = group;
      else if (group.parentNode) group.parentNode.removeChild(group);
    });
    if (keep) return keep;
    var group = document.createElement('div');
    group.setAttribute('class', OWN.groupClass);
    group.setAttribute('data-' + NS + '-placement', placement);
    mount.appendChild(group);
    return group;
  }

  function renderPlacement(placement) {
    var mount = placement === 'contact' ? adapter.findContactMount() : adapter.findHeaderMount();
    if (!mount) {
      // Missing mount: omit the customization, leave native UI untouched.
      removeGroup(placement);
      return;
    }
    var desired = resolveButtons(state.config, state.ctx.locationId).filter(function (button) {
      return button.placement === placement;
    });
    if (placement === 'contact' && !state.ctx.contactId) desired = [];
    if (!desired.length) {
      removeGroup(placement);
      return;
    }
    var group = ensureGroup(mount, placement);
    var key = ctxKey();
    var wanted = Object.create(null);
    desired.forEach(function (button) {
      wanted[button.id] = button;
    });
    var surviving = Object.create(null);
    Array.prototype.slice.call(group.querySelectorAll(OWN.buttonSel)).forEach(function (el) {
      var id = el.getAttribute('data-' + NS + '-button-id');
      var stale = !wanted[id] || el.getAttribute('data-' + NS + '-ctx') !== key || surviving[id];
      if (stale) group.removeChild(el);
      else surviving[id] = true;
    });
    desired.forEach(function (button) {
      if (!surviving[button.id]) group.appendChild(createButtonEl(button));
    });
  }

  function renderAll() {
    renderPlacement('contact');
    // Plan 03 adds renderPlacement('header').
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
    var out = '';
    for (var i = 0; i < template.length; i++) {
      var c = template.charAt(i);
      if (c === 'x') out += Math.floor(Math.random() * 16).toString(16);
      else if (c === 'y') out += (Math.floor(Math.random() * 4) + 8).toString(16);
      else out += c;
    }
    return out;
  }

  function buildPayload(button, action, email, phone) {
    var payload = {};
    Object.keys(action.extraFields).forEach(function (key) {
      var value = action.extraFields[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        payload[key] = value;
      }
    });
    // Core keys are assigned last so extraFields can never override them.
    payload.contactId = state.ctx.contactId;
    payload.locationId = state.ctx.locationId;
    payload.buttonId = button.id;
    payload.requestId = uuid();
    payload.sentAt = new Date().toISOString();
    if (email !== null) payload.email = email;
    if (phone !== null) payload.phone = phone;
    return payload;
  }

  // Messages never include the URL or the payload.
  function sendWebhook(url, payload) {
    var request;
    try {
      request = fetch(url, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      request = Promise.reject(e);
    }
    return request.then(function (res) {
      if (res && res.ok) return { outcome: 'ok' };
      var status = res ? res.status : 0;
      return {
        outcome: 'failed',
        message: 'Workflow did not accept the request (HTTP ' + status + '). Try again or contact your admin.'
      };
    }, function () {
      return {
        outcome: 'failed',
        message: 'Could not reach the workflow. Check your connection and try again.'
      };
    });
  }

  function runWebhook(button, action, el) {
    var gen = state.generation;
    var region = adapter.findContactRegion();
    var email = region ? adapter.readContactEmail(region) : null;
    var phone = region ? adapter.readContactPhone(region) : null;
    if (email === null && phone === null) {
      setState(el, 'unavailable', { message: 'contact email/phone not found' });
      log('webhook-unavailable', { buttonId: button.id });
      return Promise.resolve();
    }
    var payload = buildPayload(button, action, email, phone);
    setState(el, 'submitting');
    log('webhook-start', { buttonId: button.id, generation: gen });
    return sendWebhook(action.url, payload).then(function (result) {
      if (gen !== state.generation || !el.isConnected) {
        log('webhook-discarded', { buttonId: button.id, generation: gen });
        return;
      }
      if (result.outcome === 'ok') setState(el, 'queued');
      else setState(el, 'failed', { message: result.message });
    });
  }

  function onButtonClick(button, el) {
    var current = el.getAttribute('data-state');
    if (current !== 'ready' && current !== 'failed') return;
    var action = resolveAction(button);
    if (action.kind === 'webhook') runWebhook(button, action, el);
  }

// ==== observers ====

  // Plan 03 fills this section with scoped, bounded MutationObservers and navigation listeners.

// ==== verify ====

  function verify() {
    var report = { version: VERSION, route: computeContext(), generation: state.generation };
    console.info('[' + NS + '] verify', report);
    return report;
  }

// ==== boot ====

  window.GHLC = { version: VERSION, verify: verify, ready: null };

  function getState() {
    return {
      generation: state.generation,
      locationId: state.ctx.locationId,
      contactId: state.ctx.contactId,
      isAgency: state.ctx.isAgency,
      configLoaded: !!state.config,
      buttons: Array.prototype.slice.call(document.querySelectorAll(OWN.buttonSel)).map(function (el) {
        return {
          id: el.getAttribute('data-' + NS + '-button-id'),
          placement: el.getAttribute('data-' + NS + '-placement'),
          state: el.getAttribute('data-state')
        };
      })
    };
  }

  function boot() {
    state.ready = loadConfig().then(function (cfg) {
      if (!cfg || cfg.enabled !== true) {
        log('disabled', { reason: cfg ? 'enabled-false' : 'no-config' });
        return false;
      }
      state.config = cfg;
      applyContext('boot');
      if (DEBUG) verify();
      return true;
    });
    window.GHLC.ready = state.ready;
    return state.ready;
  }

  var testMode = typeof globalThis !== 'undefined' && globalThis.__GHLC_TEST__ === true;
  if (testMode) {
    window.GHLC.__test = {
      parseRoute: parseRoute,
      resolveButtons: resolveButtons,
      isSafeHttpsUrl: isSafeHttpsUrl,
      validateConfig: validateConfig,
      boot: boot,
      getState: getState,
      applyContext: applyContext,
      adapter: adapter
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
