/*!
 * GHL Customizer (admin-theme)
 * Version 0.1.0
 * Original work — nothing copied from the reference project (see NOTICE.md)
 *
 * One hosted vanilla JavaScript IIFE (ES2019, no build step) that reads a public
 * JSON config, resolves the active HighLevel location and contact from the URL,
 * shows the active location's logo in place of the native one, and renders
 * configurable buttons where staff work. Every HighLevel selector, route regex,
 * and DOM reader lives in the single `adapter` object below; when HighLevel's
 * markup changes, that object is the only thing that changes.
 *
 * Config schema (schemaVersion 1)
 *   schemaVersion  number   must be exactly 1
 *   enabled        boolean  false disables the script entirely (native UI untouched)
 *   agency         object   { logoUrl?: string, logoAlt?: string, logoMount?: 'sidebar' | 'header',
 *                              theme?: object, buttons?: object }
 *   locations      object   { [locationId: string]: { name?: string, logoUrl?: string, logoAlt?: string,
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
  var MAX_COOLDOWN_MS = 300000; // 5 minutes; also keeps setTimeout inside int32
  var ACTION_TYPES = Object.freeze(['link', 'webhook', 'handler']);
  var STATES = Object.freeze(['ready', 'submitting', 'queued', 'unavailable', 'failed']);
  // Link buttons may only navigate to these schemes or to a same-origin path (BTN-09).
  var SAFE_LINK_SCHEMES = Object.freeze(['https:', 'mailto:', 'tel:']);
  var SAFE_TARGETS = Object.freeze(['_self', '_blank']);
  // Bounded wait for a mount that appears shortly after navigation: at most
  // MOUNT_WAIT_MAX_MS / MOUNT_WAIT_INTERVAL_MS querySelector passes per route change.
  var MOUNT_WAIT_INTERVAL_MS = 250;
  var MOUNT_WAIT_MAX_MS = 15000;

  // Branding source tiers, in fallback order: the active location's logo, the
  // agency logo, then the native element as HighLevel rendered it. The native
  // tier is never configured; it is captured from the element on first touch.
  var BRANDING_TIERS = Object.freeze(['location', 'agency', 'native']);
  // Where the logo lives; config.agency.logoMount may pick one, the adapter
  // carries the default.
  var LOGO_MOUNTS = Object.freeze(['sidebar', 'header']);

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Approved icon set: name -> stroke paths on a 24x24 grid. This is the only
  // place icon markup is defined; unknown keys render no icon.
  var ICONS = Object.freeze({
    send: ['M21 3L10.5 13.5', 'M21 3L14 21L10.5 13.5L3 10L21 3Z'],
    mail: ['M3 6h18v12H3z', 'M3 7l9 6l9-6'],
    link: ['M9.5 14.5L14.5 9.5', 'M13 7l2-2a3.5 3.5 0 0 1 5 5l-2 2', 'M11 17l-2 2a3.5 3.5 0 0 1-5-5l2-2'],
    external: ['M14 4h6v6', 'M20 4L11 13', 'M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5']
  });

  // Own-property lookup for every config-keyed read (locations, overrides,
  // handlers, icons) so prototype names in config can never resolve.
  function hasOwn(obj, key) {
    return obj !== null && obj !== undefined && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // Selectors for elements this script owns (never HighLevel's).
  var OWN = Object.freeze({
    groupClass: NS + '-group',
    groupSel: '.' + NS + '-group',
    buttonSel: '[data-' + NS + '-button-id]',
    styleLinkSel: 'link[data-' + NS + '-styles]',
    labelSel: '.' + NS + '-btn__label',
    msgSel: '.' + NS + '-btn__msg',
    // Marks on the native logo element while a non-native tier is showing.
    logoClass: NS + '-logo',
    logoAttr: 'data-' + NS + '-logo'
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
  // ones resolve. The sidebar logo mount was verified live on 2026-09-24; the
  // header logo is the config-selectable alternative (agency.logoMount) and is
  // narrowed to the same class so a header avatar can never be branded.
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
      '#record-details-lhs',
      '.hl_contact-details-header',
      '.contact-detail-header',
      '[class*="contact-detail"]'
    ]),
    // Verified live 2026-09-24 (app.gohighlevel.com contact record): the left
    // "Contact Details" panel is #record-details-lhs; its name row holds
    // #delete-contact-trigger; the primary email and phone are stateful
    // inputs inside elements whose ids are literally "contact.email" and
    // "contact.phone" (looked up by id, never by CSS, because of the dot).
    contactToolbarAnchorId: 'delete-contact-trigger',
    contactEmailFieldId: 'contact.email',
    contactPhoneFieldId: 'contact.phone',
    contactEmail: Object.freeze(['a[href^="mailto:"]', 'input[type="email"]']),
    contactPhone: Object.freeze(['a[href^="tel:"]', 'input[type="tel"]']),
    sidebarLogo: '#sidebar-v2 img.agency-logo',
    headerLogo: '.hl_header img.agency-logo'
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

  // The contact toolbar is the name row that contains the delete trigger
  // (verified live); the class-based candidates remain as fallbacks.
  function findContactMount() {
    var anchor = document.getElementById(selectors.contactToolbarAnchorId);
    if (anchor && anchor.parentNode && anchor.parentNode.nodeType === 1) return anchor.parentNode;
    return findFirst(selectors.contactMount, document);
  }
  function contactMountVia() {
    var anchor = document.getElementById(selectors.contactToolbarAnchorId);
    if (anchor && anchor.parentNode && anchor.parentNode.nodeType === 1) return 'toolbar-anchor';
    return findFirst(selectors.contactMount, document) ? 'selector' : null;
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

  // A region with more than one candidate is ambiguous: the value would be
  // used by HighLevel to FIND the contact, so guessing risks the wrong person.
  function countMatches(region, selector) {
    return region ? region.querySelectorAll(selector).length : 0;
  }

  function readHrefValue(region, selector, scheme) {
    if (countMatches(region, selector) > 1) return null;
    var anchor = region.querySelector(selector);
    if (!anchor) return null;
    var href = anchor.getAttribute('href') || '';
    if (href.slice(0, scheme.length).toLowerCase() !== scheme) return null;
    return href.slice(scheme.length);
  }

  function readInputValue(region, selector) {
    if (countMatches(region, selector) > 1) return null;
    var input = region.querySelector(selector);
    if (!input) return null;
    var value = input.value === undefined || input.value === null ? '' : String(input.value);
    value = value.trim();
    return value ? value : null;
  }

  // Stateful field lookup by element id (HighLevel's ids contain a dot):
  // the field must sit inside the region, and its first input carries the value.
  function readFieldValue(region, fieldId) {
    var field = document.getElementById(fieldId);
    if (!field || (region && !region.contains(field))) return null;
    var input = field.querySelector('input');
    var value = input ? String(input.value === undefined || input.value === null ? '' : input.value) : field.textContent;
    value = (value || '').trim();
    return value ? value : null;
  }

  function readContactEmail(region) {
    if (!region) return null;
    var fieldValue = readFieldValue(region, selectors.contactEmailFieldId);
    if (fieldValue !== null && fieldValue.indexOf('@') !== -1) return fieldValue;
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
    var fieldValue = readFieldValue(region, selectors.contactPhoneFieldId);
    if (fieldValue !== null) return fieldValue;
    var raw = readHrefValue(region, selectors.contactPhone[0], 'tel:');
    if (raw !== null) {
      raw = raw.trim();
      if (raw) return raw;
    }
    return readInputValue(region, selectors.contactPhone[1]);
  }

  /**
   * The outermost element HighLevel replaces wholesale when it re-renders an
   * area (.hl_header, the contact region). The mount is either that root or
   * nested inside it; the observers section watches the root and its parent.
   */
  function findRegionRoot(placement, mount) {
    if (placement === 'header') {
      var header = typeof mount.closest === 'function' ? mount.closest(selectors.header) : null;
      return header || mount;
    }
    var region = findContactRegion();
    return region && (region === mount || region.contains(mount)) ? region : mount;
  }

  // The logo element for a named mount (LOGO_MOUNTS), or null. This is the
  // only place the logo img is located; branding never queries on its own.
  function findLogoMount(name) {
    return document.querySelector(name === 'header' ? selectors.headerLogo : selectors.sidebarLogo);
  }

  // The container HighLevel replaces wholesale when it re-renders the area the
  // logo sits in (the sidebar or the header), for the branding observer.
  function findLogoRoot(name, img) {
    var root = typeof img.closest === 'function'
      ? img.closest(name === 'header' ? selectors.header : selectors.sidebar)
      : null;
    return root || img.parentNode || img;
  }

  // Boolean presence of every mount selector, for verify mode (FND-04). No
  // element or value leaves the adapter, only true/false.
  function probe() {
    return {
      sidebar: !!document.querySelector(selectors.sidebar),
      header: !!document.querySelector(selectors.header),
      headerMount: !!findHeaderMount(),
      contactMount: !!findContactMount(),
      contactMountVia: contactMountVia(),
      contactRegion: !!findContactRegion(),
      contactEmailField: !!document.getElementById(selectors.contactEmailFieldId),
      contactPhoneField: !!document.getElementById(selectors.contactPhoneFieldId),
      sidebarLogo: !!document.querySelector(selectors.sidebarLogo),
      headerLogo: !!document.querySelector(selectors.headerLogo),
      locationSwitcher: !!document.querySelector(selectors.locationSwitcher),
      backToAgency: !!document.querySelector(selectors.backToAgency)
    };
  }

  var adapter = Object.freeze({
    countMatches: countMatches,
    routes: routes,
    selectors: selectors,
    events: events,
    parseRoute: parseRoute,
    findFirst: findFirst,
    findHeaderMount: findHeaderMount,
    findContactMount: findContactMount,
    findContactRegion: findContactRegion,
    findRegionRoot: findRegionRoot,
    readContactEmail: readContactEmail,
    readContactPhone: readContactPhone,
    // Default logo mount; config.agency.logoMount may select the other one.
    logoMount: 'sidebar',
    findLogoMount: findLogoMount,
    findLogoRoot: findLogoRoot,
    probe: probe
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

  /**
   * Image sources a config may point the logo at (T-02-01): a string that
   * resolves against the page to https without credentials, or to the page's
   * own origin (so the offline harness can serve relative files). data:,
   * blob:, javascript:, cross-origin http:, credentialed URLs, non-strings,
   * and parse failures are absent, never written. The raw config string is
   * what reaches src; no normalization, so equality is raw-string equality.
   */
  function isSafeImageUrl(value) {
    if (typeof value !== 'string' || !value) return false;
    try {
      var url = new URL(value, location.href);
      if (url.protocol === 'https:' && url.username === '' && url.password === '') return true;
      return url.origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  // config.agency.logoMount when it names a known mount, else the adapter default.
  function resolveLogoMount(config) {
    var agency = config && isPlainObject(config.agency) ? config.agency : null;
    if (agency && LOGO_MOUNTS.indexOf(agency.logoMount) !== -1) return agency.logoMount;
    return adapter.logoMount;
  }

  function firstString(values) {
    for (var i = 0; i < values.length; i++) {
      if (typeof values[i] === 'string') return values[i];
    }
    return null;
  }

  /**
   * Ordered branding candidates for a location (BRD-01, BRD-04): the
   * location's own logo when configured and safe, then the agency logo when
   * configured and safe. The native logo is not a candidate; it is the
   * implicit last tier restored from the per-element capture. A null alt
   * means "keep the captured native alt". Own-property lookups only, so a
   * prototype-named location ID never resolves. Agency-level pages
   * (locationId null) get the agency tier or nothing.
   */
  function resolveBranding(config, locationId) {
    var out = [];
    if (!config) return out;
    var agency = isPlainObject(config.agency) ? config.agency : {};
    var agencyAlt = typeof agency.logoAlt === 'string' ? agency.logoAlt : null;
    if (typeof locationId === 'string' && isPlainObject(config.locations) && hasOwn(config.locations, locationId)) {
      var entry = config.locations[locationId];
      if (isPlainObject(entry) && isSafeImageUrl(entry.logoUrl)) {
        out.push({
          tier: 'location',
          src: entry.logoUrl,
          alt: firstString([entry.logoAlt, entry.name, agencyAlt])
        });
      }
    }
    if (isSafeImageUrl(agency.logoUrl)) {
      out.push({ tier: 'agency', src: agency.logoUrl, alt: agencyAlt });
    }
    return out;
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
        if (isPlainObject(parsed)) {
          // Recorded before validation so verify() can report what was served
          // even when the script goes on to do nothing with it (FND-04/06).
          state.lastSchemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : null;
          state.lastEnabled = parsed.enabled === true;
          if (parsed.schemaVersion !== 1) {
            warn('config-schema-unsupported', { schemaVersion: Number(parsed.schemaVersion) || 0 });
            return null;
          }
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

  // A location override may replace label, icon, and action (whole object);
  // id, placement, and scope are never overridable.
  function applyOverride(button, override) {
    var merged = {};
    Object.keys(button).forEach(function (key) {
      merged[key] = button[key];
    });
    if (typeof override.label === 'string' && override.label.length >= 1 && override.label.length <= 80) {
      merged.label = override.label;
    }
    if (typeof override.icon === 'string') merged.icon = override.icon;
    if (isPlainObject(override.action)) merged.action = override.action;
    return merged;
  }

  /**
   * Buttons visible for a location (BTN-02). Agency-level pages (locationId
   * null) get no buttons; buttons are a location-scoped feature.
   * config.locations[locationId].buttons[buttonId]: false disables, true
   * enables (even out of scope), an object enables and merges label/icon/action.
   * Every lookup is an own-property lookup so prototype-named keys are ignored.
   */
  function resolveButtons(config, locationId) {
    if (!config || !Array.isArray(config.buttons) || !locationId) return [];
    var locations = isPlainObject(config.locations) ? config.locations : {};
    var entry = hasOwn(locations, locationId) ? locations[locationId] : null;
    var overrides = isPlainObject(entry) && isPlainObject(entry.buttons) ? entry.buttons : {};
    var out = [];
    config.buttons.forEach(function (button) {
      var override = hasOwn(overrides, button.id) ? overrides[button.id] : undefined;
      if (override === false) return;
      var inScope = button.scope === 'all' ||
        (Array.isArray(button.scope) && button.scope.indexOf(locationId) !== -1);
      if (override === true) out.push(button);
      else if (isPlainObject(override)) out.push(applyOverride(button, override));
      else if (override === undefined && inScope) out.push(button);
    });
    return out;
  }

// ==== context ====

  // The only place context lives: in memory, per tab (D-09). `generation` is
  // the token every async completion compares against before touching the DOM (D-10).
  var state = {
    config: null,
    generation: 0,
    ctx: { locationId: null, contactId: null, isAgency: true },
    timers: new Map(),
    // BTN-12: cooldown expiry (ms since epoch) keyed by ctxKey() + '|' + buttonId.
    // Lives in state, not on the element, so a native re-render of the region
    // inside the cooldown window recreates the button still disabled.
    cooldowns: Object.create(null),
    ready: null,
    hooksInstalled: false,
    navTimer: null,
    // Observers section: one bounded observer set per placement, or null.
    watch: { header: null, contact: null },
    renderTimers: { header: null, contact: null },
    mountWaits: { header: null, contact: null },
    // D-02: bounded poll for contact fields that populate after the toolbar
    // renders (a programmatic input value change yields no MutationRecord).
    fieldWait: null,
    // What the last served config said, even when it was not adopted (verify).
    lastSchemaVersion: null,
    lastEnabled: null,
    // Branding section. `native` is the logo element as HighLevel rendered it
    // (captured per element before the first write, restored verbatim);
    // `applied` is the tier currently on the mount; `resolving` is the one
    // in-flight detached preload; `loaded` / `failed` remember URLs for the
    // session so a revisit is instant and a broken URL is never retried.
    branding: {
      mountName: null,
      native: null,
      applied: null,
      appliedSrc: null,
      appliedAlt: null,
      resolving: null,
      loaded: Object.create(null),
      failed: Object.create(null),
      timer: null,
      errorBound: null,
      missingGen: null
    }
  };

  function computeContext() {
    return adapter.parseRoute(location.pathname);
  }

  function pruneCooldowns() {
    var now = Date.now();
    Object.keys(state.cooldowns).forEach(function (key) {
      if (state.cooldowns[key] <= now) delete state.cooldowns[key];
    });
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
    // Timers from the previous context die with it (BTN-06): a cooldown for an
    // old element must never flip a new one. Pending re-renders and mount
    // waits belong to the old route too; the new route starts them afresh.
    clearTimers();
    pruneCooldowns();
    PLACEMENTS.forEach(function (placement) {
      cancelScheduledRender(placement);
      cancelMountWait(placement);
    });
    cancelContactFieldsWait();
    // A logo still resolving for the old location must never land on the new
    // one (BRD-03): the preload dies with the generation that started it.
    cancelLogoPreload();
    if (state.branding.timer !== null) {
      clearTimeout(state.branding.timer);
      state.branding.timer = null;
    }
    renderAll();
    log('nav', { reason: reason, generation: state.generation });
    log('context', {
      reason: reason,
      generation: state.generation,
      locationId: next.locationId || 'none',
      contactId: next.contactId || 'none'
    });
  }

  // Several signals fire for one navigation and the router updates the URL
  // before it renders the new view. One zero-delay check after the current
  // task queue drains is enough (LOC-02) and avoids double renders.
  // state.navTimer is deliberately not in state.timers: applyContext clears
  // those, and the pending check must survive the context change it causes.
  function scheduleContextCheck(reason) {
    if (state.navTimer !== null) clearTimeout(state.navTimer);
    state.navTimer = setTimeout(function () {
      state.navTimer = null;
      applyContext(reason);
    }, 0);
  }

  function onNavigationSignal(evt) {
    scheduleContextCheck(evt && evt.type ? evt.type : 'navigation');
  }

  function dispatchNavigate(method) {
    try {
      window.dispatchEvent(new CustomEvent(adapter.events.navigate, { detail: { method: method } }));
    } catch (e) {
      // A dispatch failure must never break HighLevel's router.
    }
  }

  function wrapHistoryMethod(original, method) {
    return function () {
      var result = original.apply(this, arguments);
      dispatchNavigate(method);
      return result;
    };
  }

  /**
   * Installed once. Patches history.pushState/replaceState to announce
   * in-app navigation, and listens to browser back/forward plus HighLevel's
   * own route event. Every signal coalesces into scheduleContextCheck.
   */
  function installNavigationHooks() {
    if (state.hooksInstalled) return;
    state.hooksInstalled = true;
    if (typeof history.pushState === 'function') {
      history.pushState = wrapHistoryMethod(history.pushState, 'pushState');
    }
    if (typeof history.replaceState === 'function') {
      history.replaceState = wrapHistoryMethod(history.replaceState, 'replaceState');
    }
    window.addEventListener('popstate', onNavigationSignal);
    window.addEventListener(adapter.events.routeChange, onNavigationSignal);
    window.addEventListener(adapter.events.navigate, onNavigationSignal);
  }

// ==== buttons ====

  function makeIcon(name) {
    if (typeof name !== 'string' || !hasOwn(ICONS, name)) return null;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    ICONS[name].forEach(function (d) {
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    });
    return svg;
  }

  /**
   * Handler registry (BTN-09). Config may name a handler by string; the name
   * resolves against this frozen object via own-property lookup only, so
   * prototype names (constructor, __proto__, ...) never resolve. Adding a
   * handler means editing this object; config can never supply code.
   * Signature: (ctx: { locationId, contactId, buttonId }, el)
   *   -> { ok: boolean, message?: string } | Promise<same> | undefined
   */
  var handlers = Object.freeze({
    copyContactId: function (ctx) {
      if (!ctx || !ctx.contactId) return { ok: false, message: 'No contact open' };
      var clipboard = typeof navigator !== 'undefined' && navigator ? navigator.clipboard : null;
      if (!clipboard || typeof clipboard.writeText !== 'function') {
        return { ok: false, message: 'Clipboard unavailable' };
      }
      return clipboard.writeText(ctx.contactId).then(function () {
        return { ok: true, message: 'Contact ID copied' };
      });
    }
  });

  // A single-slash same-origin path, or an absolute URL whose scheme is in
  // SAFE_LINK_SCHEMES (no credentials). Everything else, including any other
  // scheme, protocol-relative URLs, and parse failures, is refused.
  function isSafeLinkHref(href) {
    if (typeof href !== 'string' || !href) return false;
    try {
      // Resolve against the page origin so a path that the URL parser would
      // treat as an authority (e.g. a backslash right after the slash) is
      // caught by an origin comparison rather than a character check.
      var url = new URL(href, location.origin);
      if (href.charAt(0) === '/') return url.origin === location.origin;
      return SAFE_LINK_SCHEMES.indexOf(url.protocol) !== -1 && url.username === '' && url.password === '';
    } catch (e) {
      return false;
    }
  }

  function ctxKey() {
    return (state.ctx.locationId || '') + '|' + (state.ctx.contactId || '');
  }

  function unavailable(message) {
    return { kind: 'unavailable', message: message };
  }

  /**
   * Action allowlist (BTN-09). Only link, webhook, and handler are honored and
   * only the fields named here are ever read from the action object; nothing
   * from config is evaluated or inserted as markup.
   */
  function resolveAction(button) {
    var action = button.action;
    if (!isPlainObject(action) || typeof action.type !== 'string' || ACTION_TYPES.indexOf(action.type) === -1) {
      return unavailable('Action not available');
    }
    if (action.type === 'link') {
      if (!isSafeLinkHref(action.href)) return unavailable('Link not allowed');
      var target = SAFE_TARGETS.indexOf(action.target) !== -1 ? action.target : '_self';
      return { kind: 'link', href: action.href, target: target };
    }
    if (action.type === 'webhook') {
      if (button.placement !== 'contact') return unavailable('Requires an open contact');
      if (!isSafeHttpsUrl(action.url)) return unavailable('Webhook URL must use HTTPS');
      return {
        kind: 'webhook',
        url: action.url,
        extraFields: isPlainObject(action.extraFields) ? action.extraFields : {},
        cooldownMs: typeof action.cooldownMs === 'number' && isFinite(action.cooldownMs) && action.cooldownMs >= 0
          ? Math.min(action.cooldownMs, MAX_COOLDOWN_MS)
          : DEFAULT_COOLDOWN_MS
      };
    }
    if (action.type === 'handler') {
      var name = action.handler;
      if (typeof name === 'string' && hasOwn(handlers, name) && typeof handlers[name] === 'function') {
        return { kind: 'handler', run: handlers[name] };
      }
      return unavailable('Action not available');
    }
    return unavailable('Action not available');
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

  // Every control is a native <a href> or <button> (BTN-08): keyboard
  // activation and focus come from the element itself, never from ARIA
  // role or focus-order attributes bolted onto a generic element.
  function createButtonEl(button) {
    var action = resolveAction(button);
    var el;
    if (action.kind === 'link') {
      el = document.createElement('a');
      el.setAttribute('class', NS + '-btn ' + NS + '-btn--link');
      el.setAttribute('href', action.href);
      el.setAttribute('target', action.target);
      if (action.target === '_blank') el.setAttribute('rel', 'noopener noreferrer');
    } else {
      el = document.createElement('button');
      el.setAttribute('type', 'button');
      el.setAttribute('class', NS + '-btn');
    }
    el.setAttribute('data-' + NS + '-button-id', button.id);
    el.setAttribute('data-' + NS + '-placement', button.placement);
    el.setAttribute('data-' + NS + '-ctx', ctxKey());
    el.setAttribute('data-' + NS + '-generation', String(state.generation));
    el.setAttribute('data-' + NS + '-label', button.label);

    var iconEl = document.createElement('span');
    iconEl.setAttribute('class', NS + '-btn__icon');
    iconEl.setAttribute('aria-hidden', 'true');
    var svg = makeIcon(button.icon);
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

    if (action.kind === 'unavailable') {
      setState(el, 'unavailable', { message: action.message });
    } else if (action.kind === 'link') {
      // Native anchor: no click listener, the browser navigates.
      setState(el, 'ready');
    } else if (action.kind === 'webhook' && button.placement === 'contact' && !contactFieldsReadable()) {
      // D-02: HighLevel may render the toolbar before the email field. Render
      // unavailable now; a later renderPlacement recovers it (recoverNoContactFields).
      markNoContactFields(el);
    } else {
      bindClick(button, el);
      var until = state.cooldowns[ctxKey() + '|' + button.id];
      if (action.kind === 'webhook' && until && until > Date.now()) {
        // Re-rendered inside a cooldown window: stay queued for the remainder.
        setState(el, 'queued', { message: MSG_COOLDOWN_RESTORED });
        startCooldown(action, el, until - Date.now());
      } else {
        setState(el, 'ready');
      }
    }
    return el;
  }

  // The click listener is attached at most once per element (data-ghlc-bound).
  function bindClick(button, el) {
    if (el.getAttribute('data-' + NS + '-bound') === '1') return;
    el.setAttribute('data-' + NS + '-bound', '1');
    el.addEventListener('click', function () {
      onButtonClick(button, el);
    });
  }

  // A survivor rendered unavailable for missing contact fields flips to ready
  // once a field becomes readable. Survivors keep their generation stamp:
  // they exist only when the context did not change, so it is still current.
  function recoverNoContactFields(button, el) {
    if (el.getAttribute('data-' + NS + '-reason') !== 'no-contact-fields') return;
    if (!contactFieldsReadable()) return;
    el.removeAttribute('data-' + NS + '-reason');
    bindClick(button, el);
    setState(el, 'ready');
    cancelContactFieldsWait();
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

  // Idempotent reconcile by button id + ctx. Observers and the bounded mount
  // wait re-enter here; a spurious call costs a few queries and no DOM writes.
  function renderPlacement(placement) {
    var mount = placement === 'header' ? adapter.findHeaderMount() : adapter.findContactMount();
    var desired = resolveButtons(state.config, state.ctx.locationId).filter(function (button) {
      return button.placement === placement;
    });
    if (placement === 'contact' && !state.ctx.contactId) desired = [];
    var expected = placement === 'contact' ? !!state.ctx.contactId : !!state.ctx.locationId;
    if (!mount) {
      // Missing mount: omit the customization, leave native UI untouched, and
      // wait a bounded time for it only when this route should have it.
      unwatchMount(placement);
      removeGroup(placement);
      if (expected && desired.length) waitForMount(placement);
      else cancelMountWait(placement);
      return;
    }
    cancelMountWait(placement);
    if (!desired.length) {
      unwatchMount(placement);
      removeGroup(placement);
      return;
    }
    // Watch before writing: every write below then yields only self-inflicted
    // records, which onMountMutation drops. A no-op while the same mount is
    // still watched; a new mount element swaps the set (never accumulates).
    watchMount(placement, mount);
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
      if (stale) {
        group.removeChild(el);
      } else {
        surviving[id] = true;
        recoverNoContactFields(wanted[id], el);
      }
    });
    desired.forEach(function (button) {
      if (!surviving[button.id]) group.appendChild(createButtonEl(button));
    });
  }

  function renderAll() {
    renderPlacement('header');
    renderPlacement('contact');
    renderBranding('render');
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

  var MSG_HTTP_FAILED_PREFIX = 'Workflow did not accept the request (HTTP ';
  var MSG_HTTP_FAILED_SUFFIX = '). Try again or contact your admin.';
  var MSG_NETWORK = 'Could not reach the workflow. Check your connection and try again.';
  var MSG_UNEXPECTED = 'Something went wrong sending the request. Try again.';
  var MSG_UNCONFIRMED = 'The workflow endpoint did not confirm receipt. Check the workflow execution log before resending.';
  var MSG_NO_CONTACT_FIELDS = 'contact email/phone not found';
  var MSG_COOLDOWN_RESTORED = 'Recently sent — wait before sending again';

  function attemptFetch(url, init) {
    try {
      return Promise.resolve(fetch(url, init));
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * D-11 delivery strategy. Attempt 1 is a normal CORS POST with a JSON body.
   * If that throws a TypeError (network or CORS failure) there is exactly one
   * retry with mode 'no-cors'; its response is opaque, so the best the script
   * can say is 'unconfirmed'. Outcomes:
   *   ok           2xx CORS response
   *   failed       non-2xx CORS response (status carried), or a non-TypeError throw
   *   unconfirmed  the no-cors retry resolved (opaque; status 0 by design)
   *   network      both attempts threw
   * Messages are fixed strings with only the HTTP status interpolated; they
   * never include the URL or the payload.
   */
  function sendWebhook(url, payload) {
    var body = JSON.stringify(payload);
    return attemptFetch(url, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function (res) {
      if (res && res.ok) return { outcome: 'ok', status: res.status };
      var status = res && typeof res.status === 'number' ? res.status : 0;
      return {
        outcome: 'failed',
        status: status,
        message: MSG_HTTP_FAILED_PREFIX + status + MSG_HTTP_FAILED_SUFFIX
      };
    }, function (err) {
      if (!err || err.name !== 'TypeError') {
        return { outcome: 'failed', status: 0, message: MSG_UNEXPECTED };
      }
      // A no-cors request may only carry CORS-safelisted headers; the browser
      // would silently drop a JSON content type, so none is pretended here.
      return attemptFetch(url, {
        method: 'POST',
        mode: 'no-cors',
        credentials: 'omit',
        body: body
      }).then(function () {
        return { outcome: 'unconfirmed', status: 0 };
      }, function () {
        return { outcome: 'network', status: 0, message: MSG_NETWORK };
      });
    });
  }

  function contactFieldsReadable() {
    var region = adapter.findContactRegion();
    if (!region) return false;
    return adapter.readContactEmail(region) !== null || adapter.readContactPhone(region) !== null;
  }

  function markNoContactFields(el) {
    el.setAttribute('data-' + NS + '-reason', 'no-contact-fields');
    setState(el, 'unavailable', { message: MSG_NO_CONTACT_FIELDS });
    waitForContactFields();
  }

  // Verified live: HighLevel mounts the name row before the stateful email
  // field carries a value, and filling it in is not a DOM mutation. Poll on
  // the mount-wait cadence, bounded by MOUNT_WAIT_MAX_MS, until the fields
  // read or the context changes; recovery itself is the normal reconcile.
  function waitForContactFields() {
    if (state.fieldWait) return;
    var wait = { ticks: 0, timer: null };
    state.fieldWait = wait;
    var tickFn = function () {
      wait.ticks += 1;
      if (state.fieldWait !== wait) return;
      if (!state.ctx.contactId || wait.ticks * MOUNT_WAIT_INTERVAL_MS > MOUNT_WAIT_MAX_MS) {
        state.fieldWait = null;
        log('contact-fields-wait-ended', { readable: contactFieldsReadable(), ticks: wait.ticks });
        return;
      }
      if (contactFieldsReadable()) {
        state.fieldWait = null;
        renderPlacement('contact');
        log('contact-fields-recovered', { ticks: wait.ticks });
        return;
      }
      wait.timer = setTimeout(tickFn, MOUNT_WAIT_INTERVAL_MS);
    };
    wait.timer = setTimeout(tickFn, MOUNT_WAIT_INTERVAL_MS);
  }

  function cancelContactFieldsWait() {
    var wait = state.fieldWait;
    if (!wait) return;
    clearTimeout(wait.timer);
    state.fieldWait = null;
  }

  // BTN-12: after a queued outcome the element stays disabled for cooldownMs,
  // then returns to ready only if it is still on screen in the same generation.
  function startCooldown(action, el, remainingMs) {
    var cooldownMs = typeof remainingMs === 'number' ? remainingMs : action.cooldownMs;
    if (typeof remainingMs !== 'number') {
      state.cooldowns[el.getAttribute('data-' + NS + '-ctx') + '|' + el.getAttribute('data-' + NS + '-button-id')] = Date.now() + cooldownMs;
    }
    var existing = state.timers.get(el);
    if (existing !== undefined) clearTimeout(existing);
    var id = setTimeout(function () {
      state.timers.delete(el);
      if (el.isConnected && el.getAttribute('data-' + NS + '-generation') === String(state.generation)) {
        setState(el, 'ready');
      }
    }, cooldownMs);
    state.timers.set(el, id);
    return cooldownMs;
  }

  /**
   * BTN-05 click-time revalidation: the element must still be bound to the
   * contact and location in the URL right now, and to the current generation.
   * Returns true when the click is stale (and has been refused).
   */
  function refuseStaleClick(button, el) {
    var live = adapter.parseRoute(location.pathname);
    var bound = (el.getAttribute('data-' + NS + '-ctx') || '').split('|');
    var boundLocation = bound[0] || '';
    var boundContact = bound[1] || '';
    var boundGeneration = el.getAttribute('data-' + NS + '-generation');
    var stale = (live.locationId || '') !== boundLocation ||
      (live.contactId || '') !== boundContact ||
      boundGeneration !== String(state.generation);
    if (!stale) return false;
    setState(el, 'unavailable', { message: 'Context changed — reopen the contact and try again' });
    log('stale-click', { buttonId: button.id, generation: state.generation });
    // Let the DOM catch up with the URL the click just revealed.
    scheduleContextCheck('stale-click');
    return true;
  }

  function runWebhook(button, action, el) {
    if (refuseStaleClick(button, el)) return Promise.resolve();
    var gen = state.generation;
    var region = adapter.findContactRegion();
    var email = region ? adapter.readContactEmail(region) : null;
    var phone = region ? adapter.readContactPhone(region) : null;
    if (email === null && phone === null) {
      // Fields can disappear after render; a later re-render recovers the element.
      markNoContactFields(el);
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
      var cooldownMs;
      if (result.outcome === 'ok') {
        setState(el, 'queued');
        cooldownMs = startCooldown(action, el);
        log('webhook-queued', { buttonId: button.id, generation: gen, cooldownMs: cooldownMs });
      } else if (result.outcome === 'unconfirmed') {
        setState(el, 'queued', { label: 'Sent (unconfirmed)', message: MSG_UNCONFIRMED });
        cooldownMs = startCooldown(action, el);
        log('webhook-unconfirmed', { buttonId: button.id, generation: gen, cooldownMs: cooldownMs });
      } else if (result.outcome === 'network') {
        setState(el, 'failed', { message: result.message });
        log('webhook-network', { buttonId: button.id, status: 0 });
      } else {
        setState(el, 'failed', { message: result.message });
        log('webhook-failed', { buttonId: button.id, status: result.status || 0 });
      }
    });
  }

  // Runs a registry handler with the same stale-click and generation guards
  // as a webhook; the handler's own result decides ready vs failed.
  function runHandler(button, action, el) {
    if (refuseStaleClick(button, el)) return Promise.resolve();
    var gen = state.generation;
    setState(el, 'submitting');
    return Promise.resolve().then(function () {
      return action.run({
        locationId: state.ctx.locationId,
        contactId: state.ctx.contactId,
        buttonId: button.id
      }, el);
    }).then(null, function () {
      return { ok: false, message: 'Action failed' };
    }).then(function (result) {
      if (gen !== state.generation || !el.isConnected) {
        log('handler-discarded', { buttonId: button.id, generation: gen });
        return;
      }
      var ok = !(result && result.ok === false);
      if (!ok) {
        setState(el, 'failed', { message: result.message || 'Action failed' });
      } else {
        setState(el, 'ready', { message: (result && typeof result.message === 'string') ? result.message : '' });
      }
      log('handler', { buttonId: button.id, ok: ok });
    });
  }

  function onButtonClick(button, el) {
    var current = el.getAttribute('data-state');
    if (current !== 'ready' && current !== 'failed') return;
    var action = resolveAction(button);
    if (action.kind === 'webhook') runWebhook(button, action, el);
    else if (action.kind === 'handler') runHandler(button, action, el);
  }

// ==== branding ====

  /**
   * Location logo switching (BRD-01..04). The native logo element is never
   * cloned, wrapped, moved, or replaced: branding writes src, alt,
   * referrerpolicy, the ghlc-logo class, and data-ghlc-logo on the element
   * HighLevel rendered, removes srcset while branded, and puts every captured
   * value back on native restore. Nothing else is touched, so the element's
   * identity, its anchor, and its click behavior are preserved by
   * construction (A-03, BRD-02).
   *
   * Switch sequence (A-04): every render first shows the interim tier (the
   * agency logo when configured, else native) and starts one detached preload
   * for the location logo; the preload result is applied only when the
   * generation and location it was started for are still current. URLs that
   * loaded once apply instantly for the rest of the session; URLs that errored
   * are excluded for the rest of the session. Fallbacks come only from the
   * current context's candidates plus the native capture, never from the logo
   * that happened to be on the mount before (T-02-03).
   */

  function captureNativeLogo(mount) {
    var branding = state.branding;
    if (branding.native && branding.native.el === mount) return;
    branding.native = {
      el: mount,
      src: mount.getAttribute('src'),
      alt: mount.getAttribute('alt'),
      srcset: mount.getAttribute('srcset')
    };
    branding.applied = null;
    branding.appliedSrc = null;
    branding.appliedAlt = null;
    // The only listener ever bound to the mount, once per element (T-02-07).
    if (branding.errorBound !== mount) {
      if (branding.errorBound) branding.errorBound.removeEventListener('error', onLogoError);
      mount.addEventListener('error', onLogoError);
      branding.errorBound = mount;
    }
  }

  // A-07: the candidate's alt when configured, else the captured native alt.
  function resolveAlt(candidate) {
    if (typeof candidate.alt === 'string') return candidate.alt;
    var native = state.branding.native;
    return native && typeof native.alt === 'string' ? native.alt : '';
  }

  function recordApplied(tier, src, alt) {
    state.branding.applied = tier;
    state.branding.appliedSrc = src;
    state.branding.appliedAlt = alt;
  }

  // Idempotent: a re-render with the same tier already on the mount writes
  // nothing, so observers and mount waits can re-enter freely.
  function applyLogo(mount, candidate) {
    var alt = resolveAlt(candidate);
    if (mount.getAttribute('src') === candidate.src &&
        mount.getAttribute('alt') === alt &&
        mount.getAttribute(OWN.logoAttr) === candidate.tier) {
      recordApplied(candidate.tier, candidate.src, alt);
      return;
    }
    // srcset would let the browser pick a native variant over our src.
    if (mount.hasAttribute('srcset')) mount.removeAttribute('srcset');
    // Policy before src, so the request the src write starts carries it (P-01).
    mount.setAttribute('referrerpolicy', 'no-referrer');
    mount.setAttribute('alt', alt);
    mount.setAttribute('src', candidate.src);
    mount.setAttribute(OWN.logoAttr, candidate.tier);
    mount.classList.add(OWN.logoClass);
    recordApplied(candidate.tier, candidate.src, alt);
    log('logo-applied', {
      tier: candidate.tier,
      generation: state.generation,
      locationId: state.ctx.locationId || 'none'
    });
  }

  function restoreNativeLogo(mount) {
    var native = state.branding.native;
    if (!native) return;
    if (!mount.hasAttribute(OWN.logoAttr)) {
      // Nothing of ours is on the element: it is showing what HighLevel put
      // there. Record that as the native tier and leave the element alone.
      if (state.branding.applied !== 'native') {
        recordApplied('native', native.src, native.alt);
        log('logo-applied', { tier: 'native', generation: state.generation, locationId: state.ctx.locationId || 'none' });
      }
      return;
    }
    mount.removeAttribute('referrerpolicy');
    mount.removeAttribute(OWN.logoAttr);
    mount.classList.remove(OWN.logoClass);
    if (native.alt === null) mount.removeAttribute('alt');
    else mount.setAttribute('alt', native.alt);
    if (native.src === null) mount.removeAttribute('src');
    else mount.setAttribute('src', native.src);
    if (native.srcset !== null) mount.setAttribute('srcset', native.srcset);
    recordApplied('native', native.src, native.alt);
    log('logo-applied', { tier: 'native', generation: state.generation, locationId: state.ctx.locationId || 'none' });
  }

  /**
   * One detached <img> proves a location logo off-screen before it is shown.
   * The result is applied only if this preload is still the pending one and
   * the generation and location it was started for are still current; a
   * cancelled or superseded preload can only record what it learned about
   * the URL (loaded), never write to the DOM (LOC-05, BRD-03).
   */
  function startLogoPreload(candidate) {
    var current = state.branding.resolving;
    if (current && current.src === candidate.src && current.gen === state.generation) return;
    cancelLogoPreload();
    var img = document.createElement('img');
    var pending = {
      gen: state.generation,
      locationId: state.ctx.locationId,
      src: candidate.src,
      tier: candidate.tier,
      img: img,
      cancelled: false
    };
    img.setAttribute('referrerpolicy', 'no-referrer');
    img.addEventListener('load', function () {
      onPreloadLoad(pending);
    });
    img.addEventListener('error', function () {
      onPreloadError(pending);
    });
    state.branding.resolving = pending;
    log('logo-resolving', { generation: pending.gen, locationId: pending.locationId || 'none' });
    img.setAttribute('src', candidate.src);
  }

  function onPreloadLoad(pending) {
    // The bytes are in the browser cache now whichever context asked for them.
    state.branding.loaded[pending.src] = true;
    if (state.branding.resolving !== pending) {
      log('logo-discarded', { generation: pending.gen });
      return;
    }
    state.branding.resolving = null;
    if (pending.gen === state.generation && pending.locationId === state.ctx.locationId) {
      renderBranding('preloaded');
    } else {
      log('logo-discarded', { generation: pending.gen });
    }
  }

  function onPreloadError(pending) {
    // An aborted request is not a broken image: only a live preload may
    // mark its URL failed for the session.
    if (pending.cancelled) {
      log('logo-discarded', { generation: pending.gen });
      return;
    }
    state.branding.failed[pending.src] = true;
    log('logo-failed', { tier: pending.tier, generation: pending.gen });
    if (state.branding.resolving === pending) state.branding.resolving = null;
    if (pending.gen === state.generation) renderBranding('preload-error');
  }

  function cancelLogoPreload() {
    var pending = state.branding.resolving;
    if (!pending) return;
    state.branding.resolving = null;
    pending.cancelled = true;
    // Dropping src aborts the request; the listeners stay bound but check
    // identity, so a late event from this element can no longer act.
    pending.img.removeAttribute('src');
  }

  // The mount's own image failed to load while a non-native tier was showing
  // (BRD-04): exclude that URL and walk the chain from the current context.
  function onLogoError() {
    var branding = state.branding;
    var mount = branding.native ? branding.native.el : null;
    if (!mount || branding.applied === null || branding.applied === 'native') return;
    if (mount.getAttribute('src') !== branding.appliedSrc) return;
    branding.failed[branding.appliedSrc] = true;
    log('logo-failed', { tier: branding.applied, generation: state.generation });
    renderBranding('mount-error');
  }

  /**
   * Reconcile the logo mount with the current context. Safe to call from
   * any path (render, preload result, mount error, re-render): every write
   * is idempotent and the pending preload is reused when it already matches.
   */
  function renderBranding(reason) {
    var branding = state.branding;
    var mountName = resolveLogoMount(state.config);
    var mount = adapter.findLogoMount(mountName);
    branding.mountName = mountName;
    if (!mount) {
      // Missing mount: omit the customization and leave the native UI alone.
      branding.native = null;
      branding.applied = null;
      branding.appliedSrc = null;
      branding.appliedAlt = null;
      if (branding.missingGen !== state.generation) {
        branding.missingGen = state.generation;
        log('logo-mount-missing', { mount: mountName, reason: reason });
      }
      return;
    }
    captureNativeLogo(mount);
    var candidates = resolveBranding(state.config, state.ctx.locationId).filter(function (candidate) {
      return !branding.failed[candidate.src];
    });
    var first = candidates[0] || null;
    if (!first) {
      cancelLogoPreload();
      restoreNativeLogo(mount);
      return;
    }
    if (first.tier === 'agency' || branding.loaded[first.src]) {
      cancelLogoPreload();
      applyLogo(mount, first);
      return;
    }
    // A location logo not yet proven: show the interim tier now, prove the
    // logo off-screen, and swap only once it has loaded (A-04).
    var interim = null;
    for (var i = 1; i < candidates.length; i++) {
      if (candidates[i].tier === 'agency') {
        interim = candidates[i];
        break;
      }
    }
    if (interim) applyLogo(mount, interim);
    else restoreNativeLogo(mount);
    startLogoPreload(first);
  }

// ==== observers ====

  function everyNode(list, predicate) {
    for (var i = 0; i < list.length; i++) {
      if (!predicate(list[i])) return false;
    }
    return true;
  }

  // Elements this script created: buttons, groups, anything inside a group,
  // the stylesheet link, and text nodes whose parent is own.
  function isOwnNode(node) {
    if (!node) return false;
    if (node.nodeType === 3) return isOwnNode(node.parentNode);
    if (node.nodeType !== 1 || typeof node.hasAttribute !== 'function') return false;
    if (node.hasAttribute('data-' + NS + '-button-id')) return true;
    if (node.hasAttribute('data-' + NS + '-styles')) return true;
    if (node.classList && node.classList.contains(OWN.groupClass)) return true;
    return typeof node.closest === 'function' && node.closest(OWN.groupSel) !== null;
  }

  /**
   * A record is self-inflicted when it can only have come from this script:
   *   (a) its target is own (setState swapping label/message text, reconcile
   *       pruning a button) and every added node is own — a removed node was a
   *       child of an own node, so it is own too (a detached text node has no
   *       parentNode to prove it); or
   *   (b) nothing was removed and every added node is own (our group or the
   *       stylesheet link attached to a native parent).
   * Everything else is HighLevel's doing: the mount's children wiped, our
   * group removed by a native parent, the region replaced, a field appearing.
   */
  function isSelfInflicted(record) {
    if (!record || record.type !== 'childList') return false;
    var addedOwn = everyNode(record.addedNodes, isOwnNode);
    if (isOwnNode(record.target)) return addedOwn;
    return record.removedNodes.length === 0 && addedOwn;
  }

  function onMountMutation(placement, records) {
    if (everyNode(records, isSelfInflicted)) return;
    scheduleRender(placement);
  }

  // Coalesces a burst of native mutations into one render on the next tick.
  // The render's own writes yield only self-inflicted records, so a render
  // triggered by a native mutation settles after one pass (T-01-12).
  function scheduleRender(placement) {
    cancelScheduledRender(placement);
    state.renderTimers[placement] = setTimeout(function () {
      state.renderTimers[placement] = null;
      renderPlacement(placement);
      log('rerender', { placement: placement });
    }, 0);
  }

  function cancelScheduledRender(placement) {
    if (state.renderTimers[placement] === null) return;
    clearTimeout(state.renderTimers[placement]);
    state.renderTimers[placement] = null;
  }

  /**
   * One bounded observer set per active placement, always exactly two
   * observers, both scoped to the region:
   *   rootMo   observes the region root with { childList, subtree }: the mount
   *            swapped inside the region, its children wiped, our group
   *            removed, a contact field appearing later.
   *   anchorMo observes the root's parent with { childList } only. A
   *            wholesale replacement of the region (HighLevel swapping the
   *            entire header element or contact header element, exactly what
   *            the harness "Re-render" buttons do) is a childList mutation on
   *            the region's PARENT; no observer on or inside the region can
   *            see the region's own removal. The anchor observer is shallow,
   *            so it wakes only when a direct child of that parent changes.
   *            The script never observes the whole page with subtree.
   * renderPlacement re-watches the replacement mount, so the set follows a
   * re-render instead of accumulating; leaving the route disconnects it.
   */
  function anchorFor(root) {
    var parent = root.parentNode;
    return parent && parent.nodeType === 1 ? parent : document.body;
  }

  function watchMount(placement, mount) {
    var slot = state.watch[placement];
    if (slot && slot.mount === mount && slot.anchor.isConnected && anchorFor(slot.root) === slot.anchor) return;
    unwatchMount(placement);
    var root = adapter.findRegionRoot(placement, mount);
    var anchor = anchorFor(root);
    var deliver = function (records) {
      onMountMutation(placement, records);
    };
    var rootMo = new MutationObserver(deliver);
    var anchorMo = new MutationObserver(deliver);
    rootMo.observe(root, { childList: true, subtree: true });
    anchorMo.observe(anchor, { childList: true, subtree: false });
    state.watch[placement] = { mount: mount, root: root, anchor: anchor, rootMo: rootMo, anchorMo: anchorMo };
    log('observer-attached', { placement: placement });
  }

  function unwatchMount(placement) {
    var slot = state.watch[placement];
    if (!slot) return;
    slot.rootMo.disconnect();
    slot.anchorMo.disconnect();
    state.watch[placement] = null;
    log('observer-detached', { placement: placement });
  }

  /**
   * Bounded, route-scoped retry for a mount that appears shortly after
   * navigation: one querySelector pass every MOUNT_WAIT_INTERVAL_MS for at
   * most MOUNT_WAIT_MAX_MS (60 passes), then give up and leave the native UI
   * alone. Ticks are counted, not clocked, so fake timers work. A context
   * change cancels the wait; the new route starts its own. This is not
   * whole-page polling: it runs only while a route expects a mount it lacks.
   */
  function waitForMount(placement) {
    if (state.mountWaits[placement]) return;
    var wait = { ticks: 0, timer: null };
    state.mountWaits[placement] = wait;
    scheduleMountTick(placement, wait);
  }

  function scheduleMountTick(placement, wait) {
    wait.timer = setTimeout(function () {
      wait.ticks += 1;
      if (wait.ticks * MOUNT_WAIT_INTERVAL_MS > MOUNT_WAIT_MAX_MS) {
        cancelMountWait(placement);
        log('mount-missing', { placement: placement });
        return;
      }
      // Re-arm first so renderPlacement's waitForMount is a no-op; it cancels
      // the wait itself once the mount is found.
      scheduleMountTick(placement, wait);
      renderPlacement(placement);
    }, MOUNT_WAIT_INTERVAL_MS);
  }

  function cancelMountWait(placement) {
    var wait = state.mountWaits[placement];
    if (!wait) return;
    clearTimeout(wait.timer);
    state.mountWaits[placement] = null;
  }

// ==== verify ====

  /**
   * FND-04 verify mode: window.GHLC.verify() or ?ghlc-debug=1. Reports which
   * mount selectors and route patterns resolve on the current page. Only IDs,
   * booleans, and states: contact fields are reported as present/absent, the
   * webhook URL and config URL never appear (DLV-04).
   */
  function verify() {
    var region = adapter.findContactRegion();
    var report = {
      version: VERSION,
      route: computeContext(),
      generation: state.generation,
      hooksInstalled: state.hooksInstalled,
      config: {
        loaded: !!state.config,
        enabled: state.lastEnabled,
        schemaVersion: state.lastSchemaVersion,
        buttonIds: state.config ? state.config.buttons.map(function (b) { return b.id; }) : []
      },
      mounts: adapter.probe(),
      contactFields: {
        email: adapter.readContactEmail(region) !== null,
        phone: adapter.readContactPhone(region) !== null,
        emailCandidates: adapter.countMatches(region, selectors.contactEmail[0]) + adapter.countMatches(region, selectors.contactEmail[1]),
        phoneCandidates: adapter.countMatches(region, selectors.contactPhone[0]) + adapter.countMatches(region, selectors.contactPhone[1])
      },
      buttons: getState().buttons,
      observers: { header: !!state.watch.header, contact: !!state.watch.contact },
      waiting: { header: !!state.mountWaits.header, contact: !!state.mountWaits.contact, contactFields: !!state.fieldWait }
    };
    console.info('[' + NS + '] verify', report);
    return report;
  }

// ==== boot ====

  if (window.GHLC && window.GHLC.version && window.__GHLC_TEST__ !== true) {
    warn('duplicate-instance', { existing: String(window.GHLC.version) });
    return;
  }
  window.GHLC = { version: VERSION, verify: verify, ready: null };

  function getState() {
    return {
      generation: state.generation,
      locationId: state.ctx.locationId,
      contactId: state.ctx.contactId,
      isAgency: state.ctx.isAgency,
      configLoaded: !!state.config,
      hooksInstalled: state.hooksInstalled,
      buttons: Array.prototype.slice.call(document.querySelectorAll(OWN.buttonSel)).map(function (el) {
        return {
          id: el.getAttribute('data-' + NS + '-button-id'),
          placement: el.getAttribute('data-' + NS + '-placement'),
          state: el.getAttribute('data-state')
        };
      })
    };
  }

  // Injects the companion stylesheet once: data-css wins, else the script's own
  // src with .js swapped for .css. OWN.styleLinkSel matches data-ghlc-styles so a
  // pre-existing link (or a second boot) never adds a duplicate.
  function ensureStyles() {
    if (document.querySelector(OWN.styleLinkSel)) return;
    var href = currentScript && typeof currentScript.getAttribute === 'function'
      ? currentScript.getAttribute('data-css')
      : null;
    if (!href) {
      var src = currentScript && currentScript.src ? String(currentScript.src) : '';
      if (!src || !/\.js$/.test(src)) return;
      href = src.slice(0, -3) + '.css';
    }
    if (!isAllowedConfigUrl(href) || !document.head) return;
    var link = document.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('data-' + NS + '-styles', '1');
    link.setAttribute('href', href);
    document.head.appendChild(link);
  }

  // FND-05/06: a disabled, unsupported, or unreachable config installs no
  // hooks, injects no stylesheet or DOM, and creates no observers. Nothing is
  // persisted anywhere, so a reload restores the native UI.
  function boot() {
    state.ready = loadConfig().then(function (cfg) {
      if (!cfg || cfg.enabled !== true) {
        log('disabled', { reason: cfg ? 'enabled-false' : 'no-config' });
        return false;
      }
      state.config = cfg;
      ensureStyles();
      installNavigationHooks();
      applyContext('boot');
      if (DEBUG) verify();
      return true;
    });
    window.GHLC.ready = state.ready;
    return state.ready;
  }

  var testMode = window.__GHLC_TEST__ === true;
  if (testMode) {
    window.GHLC.__test = {
      parseRoute: parseRoute,
      resolveButtons: resolveButtons,
      resolveAction: resolveAction,
      resolveBranding: resolveBranding,
      renderBranding: renderBranding,
      isSafeHttpsUrl: isSafeHttpsUrl,
      isSafeImageUrl: isSafeImageUrl,
      isSafeLinkHref: isSafeLinkHref,
      handlers: handlers,
      verify: verify,
      validateConfig: validateConfig,
      boot: boot,
      getState: getState,
      applyContext: applyContext,
      // Re-render with NO generation bump: the path Plan 03's observers drive.
      renderAll: renderAll,
      adapter: adapter
    };
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
