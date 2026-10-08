# Phase 4: Actions Menu - Pattern Map

**Mapped:** 2026-10-07
**Files analyzed:** 8 (7 named in CONTEXT.md plus 1 implied: `test/fixtures/config.json`)
**Analogs found:** 8 / 8. Every file is modified in place, so each analog is the file's own existing code. No new files.

All paths below are git-tracked (`git ls-files` verified). Line numbers refer to the v0.1.2 tree at commit `c56f1a5`.

## File Classification

| Modified File | Role | Data Flow | Closest Analog (in-file) | Match Quality |
|---|---|---|---|---|
| `src/ghl-customizer.js` (config section) | config/validation | transform | `validateButton` / `validateConfig` / `resolveButtons` / `applyOverride` (638-775) | exact |
| `src/ghl-customizer.js` (buttons section) | component (DOM renderer + state machine) | event-driven + request-response (webhook) | `createButtonEl` / `setState` / `renderPlacement` / `runWebhook` / `onButtonClick` (955-1518) | exact for items, role-match for trigger/panel/keyboard |
| `src/ghl-customizer.js` (context section) | store/lifecycle | event-driven | `applyContext` cancellation list (865-901) | exact |
| `src/ghl-customizer.js` (observers section) | middleware (mutation filter) | event-driven | `isOwnNode` / `isSelfInflicted` / `watchMount` (2035-2132) | exact (likely no change) |
| `src/ghl-customizer.js` (verify, boot) | utility (diagnostics, test surface) | request-response | `verify` (2356-2413), `getState` (2423-2439), `__test` (2482-2507) | exact |
| `src/ghl-customizer.css` | config (scoped stylesheet) | n/a | `.ghlc-group` / `.ghlc-btn*` rules (9-116) | exact |
| `config/agency-config.json` | config | n/a | `buttons[0]` sendInvite (33-48), `locations.Cp2XxBsRoyKS2CUf1Hwi` (24-31) | exact |
| `test/fixtures/config.json` (implied: harness and suite load it) | config (test fixture) | n/a | `buttons` + `locations.locB.buttons` overrides (32-36, 42-113) | exact |
| `test/run.mjs` | test | batch | static gates (124-241), scenarios (467-1656), sample scenario (3248-3306) | exact |
| `test/dom-shim.mjs` | test utility | event-driven | `Event` (16-34), `Element.focus/blur/click` (530-540), window globals (951-962) | role-match (no KeyboardEvent yet) |
| `test/harness.html` | test utility (manual harness) | event-driven | "Re-render" / "Sidebar logo and theme" control rows (101-116, 363-411) | exact |
| `README.md` | docs | n/a | `## Configuration` table + `### Action types` (66-122) | exact |

---

## Pattern Assignments

### `src/ghl-customizer.js`: constants section (lines 42-162)

**Where new constants go.** Cooldown, state names, and regexes live here, frozen:

Lines 50-53:
```js
  var DEFAULT_COOLDOWN_MS = 10000;
  var MAX_COOLDOWN_MS = 300000; // 5 minutes; also keeps setTimeout inside int32
  var ACTION_TYPES = Object.freeze(['link', 'webhook', 'handler']);
  var STATES = Object.freeze(['ready', 'submitting', 'queued', 'unavailable', 'failed']);
```
- D-10's 60 s goes in config (`cooldownMs: 60000`), which is already inside `MAX_COOLDOWN_MS`. Do not change `DEFAULT_COOLDOWN_MS`, because that would break D-03 byte-for-byte.
- Put the D-16 synthetic-email regex (`/\+\d+@/`) next to `HEX_COLOR_RE` (line 76), e.g. `var SYNTHETIC_EMAIL_RE = /\+\d+@/;`.

**Icons** (lines 92-97): there is one frozen registry, and unknown names render no icon. A trigger icon (e.g. `menu` or `chevron-down`) is added here as stroke paths only:
```js
  var ICONS = Object.freeze({
    send: ['M21 3L10.5 13.5', 'M21 3L14 21L10.5 13.5L3 10L21 3Z'],
    ...
  });
```

**Own selectors** (lines 106-120): every selector for nodes the script owns lives in `OWN`. Add menu selectors here, e.g. `menuTriggerSel`, `menuPanelSel`, `menuItemSel`, built from `NS`:
```js
  var OWN = Object.freeze({
    groupClass: NS + '-group',
    groupSel: '.' + NS + '-group',
    buttonSel: '[data-' + NS + '-button-id]',
    ...
    labelSel: '.' + NS + '-btn__label',
    msgSel: '.' + NS + '-btn__msg',
```
**Static gate:** `querySelector('...literal')` is forbidden outside the adapter (run.mjs 76-87, `/querySelector(?:All)?\(\s*['"`]/`). Every own-node query must go through an `OWN.*` variable, never a string literal.

**Logging** (lines 136-158): this is the only console path. Event names are kebab-case IDs. Fields are booleans, numbers, or `SAFE_VALUE_RE` strings (`/^[A-Za-z0-9_:.|-]+$/`, at most 64 characters):
```js
  function log(event, fields) {
    if (DEBUG) console.info('[' + NS + ']', event, safe(fields));
  }
```
Use it like `log('menu-open', { menuId: menu.id, items: n })` or `log('menu-close', { menuId: menu.id, reason: 'escape' })`. Item ids such as `send-individual-consent` pass `SAFE_VALUE_RE`.

---

### `src/ghl-customizer.js`: adapter section (lines 164-434)

**No new HighLevel selectors are needed.** The menu mounts through the existing `adapter.findContactMount()` (257-261, the parent of `#delete-contact-trigger`). The D-16 pre-check reads email through the existing `adapter.readContactEmail(region)` (315-332) and `adapter.findContactRegion()` (268-278). Keep the regex test outside the adapter; the adapter only returns the raw value.

Contact-field reader pattern (lines 315-318):
```js
  function readContactEmail(region) {
    if (!region) return null;
    var fieldValue = readFieldValue(region, selectors.contactEmailFieldId);
    if (fieldValue !== null && fieldValue.indexOf('@') !== -1) return fieldValue;
```

---

### `src/ghl-customizer.js`: config section (lines 436-775). MENU-01, MENU-02, D-01, D-02, D-03

**Analog: `validateButton`** (lines 641-669). Reuse it for each menu item, but `where` is hard-coded to `'buttons[' + index + ']'` and `placement` is required. Options: parameterize `where` (e.g. `'menus[0].items[2]'`), or validate items on a normalized copy that already carries the menu's `placement`. The shared `seen` Set gives the D-01 "unique across both arrays" check for free:
```js
  function validateButton(button, index, seen, errors) {
    var where = 'buttons[' + index + ']';
    if (!isPlainObject(button)) { errors.push(where + ' must be an object'); return; }
    if (typeof button.id !== 'string' || !BUTTON_ID_RE.test(button.id)) {
      errors.push(where + '.id must match ' + String(BUTTON_ID_RE));
    } else if (seen.has(button.id)) {
      errors.push(where + '.id is duplicated');
    } else {
      seen.add(button.id);
    }
    ...
    if (PLACEMENTS.indexOf(button.placement) === -1) { errors.push(where + '.placement must be header or contact'); }
    var scopeOk = button.scope === 'all' ||
      (Array.isArray(button.scope) && button.scope.every(function (s) { return typeof s === 'string'; }));
```
`BUTTON_ID_RE` (638) is `/^[A-Za-z0-9_-]{1,64}$/`, so `send-individual-consent` and `resend-consent-hub` are valid.

**Analog: `validateConfig`** (lines 672-688). `menus` must be optional: a missing `menus` is valid, which is required for D-03. Validate after `buttons` and pass in the same `seen`:
```js
    if (!Array.isArray(obj.buttons)) {
      errors.push('buttons must be an array');
    } else {
      var seen = new Set();
      obj.buttons.forEach(function (button, index) {
        validateButton(button, index, seen, errors);
      });
    }
    return { ok: errors.length === 0, errors: errors };
```
Unknown action types are not errors (comment at 671). Keep that rule for items too.

**Analog: `resolveButtons` + `applyOverride`** (lines 740-775). This is the per-item visibility rule for MENU-02. Copy the override semantics exactly: `false` hides, `true` forces, an object merges label/icon/action, and only own-property lookups are used:
```js
  function resolveButtons(config, locationId) {
    if (!config || !Array.isArray(config.buttons) || !locationId) return [];
    var entry = locationEntry(config, locationId);
    var overrides = entry && isPlainObject(entry.buttons) ? entry.buttons : {};
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
```
Recommended shape (Claude's discretion, preferred in CONTEXT): add a sibling `resolveMenus(config, locationId)` that first applies the menu's `scope`. Then, per item, apply the item `scope` (defaulting to the menu's) and the same override rule, and normalize each item into a button record `{ id, label, icon, action, placement: menu.placement, scope, menuId }` so `resolveAction` / `createButtonEl` / `runWebhook` see the shape they already expect. A menu whose visible list is empty is dropped (D-02). Leave `resolveButtons` untouched so a buttons-only config is byte-identical (D-03). Export `resolveMenus` on `__test` (see boot).

`applyOverride` (740-751) never lets `id`, `placement`, or `scope` be overridden. Keep that true for items.

**Optional `requires` rule (D-16).** Read it like other optional action fields: allowlisted keys only. Accept `requires: { email: 'real' }` and ignore everything else. Do not add it as a validation error, consistent with "unknown is unavailable, not invalid".

---

### `src/ghl-customizer.js`: context section (lines 777-953). D-06 close on SPA navigation and contact change

**Analog: `state` object** (lines 781-845). Add one slot for the open menu (e.g. `menu: null`, holding `{ menuId, trigger, panel, onDocPointer }`) next to `fieldWait` (823). Per-item cooldowns already use the right key:
```js
    // BTN-12: cooldown expiry (ms since epoch) keyed by ctxKey() + '|' + buttonId.
    cooldowns: Object.create(null),
```
Item ids share this namespace, so D-09 needs no new store.

**Analog: `applyContext` cancellation list** (lines 872-893). Closing the menu (removing the document listener) belongs in this list, before `renderAll()`:
```js
    state.ctx = next;
    state.generation += 1;
    clearTimers();
    pruneCooldowns();
    PLACEMENTS.forEach(function (placement) {
      cancelScheduledRender(placement);
      cancelMountWait(placement);
    });
    cancelMountWait('branding');
    cancelMountWait('theme');
    cancelContactFieldsWait();
    cancelLogoPreload();
    cancelScheduledBranding();
    cancelScheduledTheme();
    renderAll();
```
A `closeMenu('context')` call placed here covers SPA navigation and contact change through the generation path. `renderPlacement` also removes the stale trigger/panel because their `data-ghlc-ctx` no longer matches (see 1240).

---

### `src/ghl-customizer.js`: buttons section (lines 955-1518). The core of MENU-03..06, ITEM-01..07

**Handler allowlist** (lines 983-994). `copyContactId` already exists, so ITEM-05 needs no new handler:
```js
  var handlers = Object.freeze({
    copyContactId: function (ctx) {
      if (!ctx || !ctx.contactId) return { ok: false, message: 'No contact open' };
      ...
      return clipboard.writeText(ctx.contactId).then(function () {
        return { ok: true, message: 'Contact ID copied' };
      });
    }
  });
```

**Cooldown key** (lines 1013-1015):
```js
  function ctxKey() {
    return (state.ctx.locationId || '') + '|' + (state.ctx.contactId || '');
  }
```

**Analog: `resolveAction`** (lines 1026-1056). This is the D-15 "Not configured" path. Today an empty `url` returns `unavailable('Webhook URL must use HTTPS')` at line 1038. Add an explicit empty or missing URL branch *before* the HTTPS check that returns `unavailable('Not configured')`. Because `kind === 'unavailable'`, `createButtonEl` never binds a click, so nothing can POST:
```js
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
```
The existing test at run.mjs 1051 ("non-https URL renders unavailable") asserts the HTTPS message for a *non-empty* http URL. Keep that message for non-empty URLs.

**Analog: `setState`** (lines 1058-1085). This is the per-element state machine. **Key adaptation for D-05:** it sets the native `disabled` attribute for `submitting|queued|unavailable` (1069-1073). Native `disabled` removes an element from focus, and the shim's `click()` returns early on `disabled` (dom-shim 530-533). Menu items must stay focusable and use `aria-disabled="true"` only. Add an opt-in (e.g. a `data-ghlc-menuitem` marker or an `opts.focusable` flag) that skips the `disabled` write for items while keeping `data-state`, `aria-busy`, `aria-disabled`, label, message, and title identical. Activation is already skipped by state in `onButtonClick` (1513-1514), so aria-disabled items are "skipped on activation, not on navigation":
```js
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
```
Trigger flash (D-11): for the trigger, use `setState(trigger, 'ready', { label: 'Actions · Workflow triggered', message: ... })`, then restore it on a timer stored in `state.timers` (keyed by the trigger element, the same as `startCooldown` 1410-1418) so `clearTimers()` in `applyContext` kills it.

**Analog: `createButtonEl`** (lines 1090-1150). Build the trigger, the panel, and each `role="menuitem"` from this with DOM APIs only. Keep every `data-ghlc-*` stamp, because `startCooldown`, `refuseStaleClick`, and reconcile read them:
```js
      el = document.createElement('button');
      el.setAttribute('type', 'button');
      el.setAttribute('class', NS + '-btn');
    }
    el.setAttribute('data-' + NS + '-button-id', button.id);
    el.setAttribute('data-' + NS + '-placement', button.placement);
    el.setAttribute('data-' + NS + '-ctx', ctxKey());
    el.setAttribute('data-' + NS + '-generation', String(state.generation));
    el.setAttribute('data-' + NS + '-label', button.label);
    ...
    var msgEl = document.createElement('span');
    msgEl.setAttribute('class', NS + '-btn__msg');
    msgEl.setAttribute('role', 'status');
    msgEl.setAttribute('aria-live', 'polite');
```
- **Screen-reader status span** = the per-control `.ghlc-btn__msg` with `role="status" aria-live="polite"` (1120-1123). There is no global status region. For D-11, give the trigger its own `.ghlc-btn__msg` and write the item result into it so it is announced after the panel closes.
- The state branch at 1129-1148 (unavailable / no-contact-fields / bindClick + cooldown restore) is what each menu item needs unchanged. The cooldown restore uses `ctxKey() + '|' + button.id` (1140) and `MSG_COOLDOWN_RESTORED` (1143).
- Menu items: `el.setAttribute('role', 'menuitem')` on the same native `<button>`, plus a distinguishing class (e.g. `ghlc-menu__item`). Trigger: `aria-haspopup="menu"`, `aria-expanded`, `aria-controls` = panel id. Generate the panel id from `NS + '-menu-' + menu.id` (menu ids match `BUTTON_ID_RE`, so they are safe as id characters).

**Analog: `bindClick`** (lines 1153-1159). This is the once-per-element listener guard. Copy it for the trigger's `click` and `keydown`, and for the panel's `keydown`:
```js
  function bindClick(button, el) {
    if (el.getAttribute('data-' + NS + '-bound') === '1') return;
    el.setAttribute('data-' + NS + '-bound', '1');
    el.addEventListener('click', function () {
      onButtonClick(button, el);
    });
  }
```

**Analog: `recoverNoContactFields` + `markNoContactFields` + `waitForContactFields`** (lines 1164-1171, 1363-1401). This is the D-16 "Needs the member's own email" unavailable/recover mechanism. Copy the reason-attribute pattern with a new reason value (e.g. `needs-real-email`):
```js
  function recoverNoContactFields(button, el) {
    if (el.getAttribute('data-' + NS + '-reason') !== 'no-contact-fields') return;
    if (!contactFieldsReadable()) return;
    el.removeAttribute('data-' + NS + '-reason');
    bindClick(button, el);
    setState(el, 'ready');
    cancelContactFieldsWait();
  }
```
```js
  function markNoContactFields(el) {
    el.setAttribute('data-' + NS + '-reason', 'no-contact-fields');
    setState(el, 'unavailable', { message: MSG_NO_CONTACT_FIELDS });
    waitForContactFields();
  }
```
- The poll in `waitForContactFields` (1373-1394) re-enters `renderPlacement('contact')` only while `!contactFieldsReadable()`. The email changing from synthetic to real is an input value change with **no MutationRecord** (comment 1369-1372). So "re-evaluates when the email field changes" needs either (a) the poll condition widened to "any item waiting on a reason", or (b) a re-check at every `renderPlacement` survivor pass (1245) plus a click-time check in `runWebhook`. Use both: survivors call a `recoverRequires(button, el)` alongside `recoverNoContactFields`, and `runWebhook` refuses at click time.
- Add the message constant next to the others (1294-1300): `var MSG_NEEDS_REAL_EMAIL = "Needs the member's own email";`. D-15's `'Not configured'` can live there too.

**Analog: `ensureGroup` / `renderPlacement`** (lines 1185-1251). This is the reconcile loop. **Pitfall:** the survivor loop queries `group.querySelectorAll(OWN.buttonSel)` (a *descendant* query) and then calls `group.removeChild(el)` (1238-1242). If menu items carry `data-ghlc-button-id` and sit inside the panel, `removeChild` throws `NotFoundError`, and plain-button reconcile would also count the items. Filter that loop to direct children (`el.parentNode === group`), or give menus their own reconcile pass keyed by menu id + ctx:
```js
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
```
- Early exit `if (!desired.length) { unwatchMount; removeGroup; return; }` (1222-1226) must consider menus as well: a contact page with zero plain buttons but one visible menu must still get the group and the observer set. The `expected && desired.length` wait condition (1217) needs the same change.
- Watch-before-write ordering (1227-1230) is what keeps panel open/close writes self-inflicted. Keep panel creation after `watchMount`.
- With no `menus` in config, this function must take exactly the v0.1.2 path (D-03). Guard the menu work with `if (menus.length)`.

**Analog: `runWebhook`** (lines 1444-1481). This is the item send path, unchanged in spirit (D-09, D-14). The payload is built by `buildPayload` (1275-1292) with `buttonId = button.id`, so the item id becomes `buttonId` automatically. Insert the D-16 click-time check beside the existing no-identifier check (1450-1455), and send the result to the trigger flash in the `.then` branch (1465-1479):
```js
  function runWebhook(button, action, el) {
    if (refuseStaleClick(button, el)) return Promise.resolve();
    var gen = state.generation;
    var region = adapter.findContactRegion();
    var email = region ? adapter.readContactEmail(region) : null;
    var phone = region ? adapter.readContactPhone(region) : null;
    if (email === null && phone === null) {
      markNoContactFields(el);
      log('webhook-unavailable', { buttonId: button.id });
      return Promise.resolve();
    }
    var payload = buildPayload(button, action, email, phone);
    setState(el, 'submitting');
    ...
    return sendWebhook(action.url, payload).then(function (result) {
      if (gen !== state.generation || !el.isConnected) {
        log('webhook-discarded', { buttonId: button.id, generation: gen });
        return;
      }
      if (result.outcome === 'ok') {
        setState(el, 'queued');
        cooldownMs = startCooldown(action, el);
```
`el.isConnected` (1460) still holds for an item inside a closed panel, as long as the panel stays in the DOM and is hidden rather than removed. **Recommendation:** hide the panel with the `hidden` attribute instead of detaching it, so in-flight results still land on the item and the cooldown timer's `el.isConnected` check (1414) passes.

**Analog: `refuseStaleClick`** (lines 1427-1442). This is the click-time URL recheck (MENU-08). It reads `data-ghlc-ctx` and `data-ghlc-generation` off the element, so items get it for free if they carry the stamps from `createButtonEl`.

**Analog: `startCooldown`** (lines 1405-1420). This is the per-item cooldown keyed by `data-ghlc-ctx + '|' + data-ghlc-button-id`. It works for items unchanged:
```js
      state.cooldowns[el.getAttribute('data-' + NS + '-ctx') + '|' + el.getAttribute('data-' + NS + '-button-id')] = Date.now() + cooldownMs;
```

**Analog: `onButtonClick`** (lines 1512-1518). This is the state gate that makes aria-disabled items inert on activation:
```js
  function onButtonClick(button, el) {
    var current = el.getAttribute('data-state');
    if (current !== 'ready' && current !== 'failed') return;
```
Item activation = `closeMenu('activate')`, return focus to the trigger, then `onButtonClick(button, el)`.

**Keyboard / outside-pointer (no in-repo analog).** Nothing in the script listens for `keydown` or document-level pointer events today. The closest listener lifecycle patterns are:
- `installNavigationHooks` (941-953): a guarded add (`if (state.hooksInstalled) return;`) on `window`.
- `ensureStyles` (2444-2460): an idempotent document-level side effect.
- Copy that guard style: `openMenu` adds exactly one `document.addEventListener('pointerdown', state.menu.onDocPointer, true)` and stores the function reference. `closeMenu` removes the same reference and nulls the slot. D-06 requires one listener while open and zero after close. Tests count it with `shim.listenerCount(shim.document, 'pointerdown')` (dom-shim 1112-1115).

---

### `src/ghl-customizer.js`: observers section (lines 2024-2346). MENU-07, D-08

**Analog: `isOwnNode`** (lines 2035-2043). Anything inside `.ghlc-group` is already own, so a panel inside the group needs **no change**:
```js
  function isOwnNode(node) {
    if (!node) return false;
    if (node.nodeType === 3) return isOwnNode(node.parentNode);
    if (node.nodeType !== 1 || typeof node.hasAttribute !== 'function') return false;
    if (node.hasAttribute('data-' + NS + '-button-id')) return true;
    if (node.hasAttribute('data-' + NS + '-styles')) return true;
    if (node.classList && node.classList.contains(OWN.groupClass)) return true;
    return typeof node.closest === 'function' && node.closest(OWN.groupSel) !== null;
  }
```
`watchMount` (2108-2123) observes only `childList` (no attributes), so `aria-expanded` and `hidden` toggles never wake the placement observer. Observer count stays at 9 (2 placements x 2 + branding 3 + theme 2), which the tests assert at run.mjs 1409, 1517, and 1652.

---

### `src/ghl-customizer.js`: verify + boot (lines 2348-2513)

**Analog: `verify` config block** (lines 2366-2371). Add `menuIds` (and optionally per-menu item ids) beside `buttonIds`. Report only IDs and booleans (DLV-04):
```js
      config: {
        loaded: !!state.config,
        enabled: state.lastEnabled,
        schemaVersion: state.lastSchemaVersion,
        buttonIds: state.config ? state.config.buttons.map(function (b) { return b.id; }) : []
      },
```
`buttons: getState().buttons` (2379) uses `OWN.buttonSel` across the document, so items that carry `data-ghlc-button-id` show up automatically with their `data-state`.

**Analog: `__test` surface** (lines 2484-2507). Export the new pure functions (`resolveMenus`, and any `isSyntheticEmail` / `meetsRequires`) here for unit checks:
```js
    window.GHLC.__test = {
      parseRoute: parseRoute,
      resolveButtons: resolveButtons,
      resolveAction: resolveAction,
      ...
      validateConfig: validateConfig,
```

**Head comment schema** (lines 14-32). Document `menus` in the `Config schema (schemaVersion 1)` block. The static check at run.mjs 178-190 requires that string to appear exactly once, so extend the existing block and do not add a second one.

---

### `src/ghl-customizer.css`. D-07, MENU-05 overflow

**Analog: `.ghlc-group` tokens** (lines 9-20). The panel anchors here. The group currently has **no** `position`, so add `position: relative`. The panel then uses `position: absolute; top: 100%; right: 0 or left: 0; z-index: ...` and the group's tokens:
```css
.ghlc-group {
  --ghlc-primary: #155eef;
  --ghlc-primary-text: #ffffff;
  --ghlc-focus: #155eef;
  --ghlc-danger: #d92d20;
  --ghlc-success: #12b76a;
  --ghlc-muted: #98a2b3;
  display: inline-flex;
  gap: 8px;
  align-items: center;
  margin-left: 8px;
}
```
**Analog: state selectors** (lines 51-76). Item states reuse the `[data-state=...]` attribute hooks. Because items keep `aria-disabled` without `disabled`, the existing `.ghlc-btn[aria-disabled="true"]` rule (52) already covers them. Panel items probably want a flat, full-width variant, e.g. `.ghlc-menu__item`, rather than the pill `.ghlc-btn` background.

**Analog: visually hidden msg** (lines 99-109). `.ghlc-btn__msg` is the screen-reader-only pattern. The trigger reuses it.

**Analog: reduced motion** (lines 111-116): wrap any panel transition in the same `@media (prefers-reduced-motion: no-preference)` block.

Rules enforced by run.mjs 217-241: every comma-separated selector must contain `.ghlc-` or `[data-ghlc-`; there must be zero `!important`; there must be at least 15 preludes. A `[hidden]` rule must be scoped, e.g. `.ghlc-menu__panel[hidden] { display: none; }`. Do not bump the head-comment version (`version 0.1.2`, line 2); that happens in Phase 6, and run.mjs 198-199 checks it against package.json.

---

### `config/agency-config.json`. D-10, D-12, D-13, D-15

**Analog: `buttons[0]` sendInvite** (lines 34-48). Move it verbatim into `menus[0].items[0]` and drop `placement`/`scope` (the menu supplies them). Change `cooldownMs` to `60000`. Keep `url` and `extraFields.source` as they are (D-14):
```json
    {
      "id": "sendInvite",
      "label": "Send Invite",
      "icon": "send",
      "placement": "contact",
      "scope": "all",
      "action": {
        "type": "webhook",
        "url": "https://services.leadconnectorhq.com/hooks/Cp2XxBsRoyKS2CUf1Hwi/webhook-trigger/bde416ab-a074-4946-bf99-7266eb1b0f4e",
        "cooldownMs": 10000,
        "extraFields": {
          "source": "ghl-customizer"
        }
      }
    },
```
The new menu is `{ "id": "xcelsiorActions", "label": "Actions", "icon": ..., "placement": "contact", "scope": ["Cp2XxBsRoyKS2CUf1Hwi"], "items": [sendInvite, send-individual-consent (url "", cooldownMs 60000, requires {email:"real"}), resend-consent-hub (url "", cooldownMs 60000), copyContactId (handler)] }`. `helpCenter` (49-60) stays in `buttons[]` unchanged.

---

### `test/fixtures/config.json` (implied). REL-01 coverage driver

The harness (`data-config="./fixtures/config.json"`, harness.html 418) and most scenarios (`loadFixture()`, run.mjs 22) read this file. **Analog:** the `locB` override map (32-36) and the button list (42-113). Add a `menus` entry scoped to `locA` with items that exercise every path: an ok webhook (`https://services.leadconnectorhq.com/hooks/TEST-MENU`, which the harness stub matches on `/hooks/`), an empty-url item (D-15), a `requires: {email:'real'}` item (D-16), and a `copyContactId` handler. Add a `locB` override that hides one item (`false`) and relabels another (object) for MENU-02.

**Risk:** the observer, header, and sample scenarios hard-code counts. Examples: `buttons.length === 3` in the header group (1138, 1423), `observers().length === 9`, and `contactGroup` contents. Adding a `menus` block that only renders in the contact group should not change header counts. Re-run the full suite after editing the fixture before writing new scenarios. Alternative: keep the fixture buttons-only and build menu configs inline with `bootWithConfig({...loadFixture(), menus: [...]})` (run.mjs 1121-1129). That also proves D-03, because every existing scenario keeps running against a buttons-only config. The harness still needs a menu, so add it to the fixture or document a harness-only toggle.

---

### `test/run.mjs`. REL-01, MENU-08

**Runner primitives** (lines 40-42): use `check` for sync static/unit checks and `scenario` for async shim-driven checks. Both are appended to `items` in declaration order:
```js
const items = [];
function check(name, fn) { items.push({ name, fn, async: false }); }
function scenario(name, fn) { items.push({ name, fn, async: true }); }
```
**Section banner convention** (e.g. 864-867, 1098-1101): a new `// ----` block titled `// Actions menu (Phase 4)`. Place it before `// Run` (3308).

**Static gates that must keep passing (MENU-08):**
- Forbidden tokens (50-60, 128-132): `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function`, `localStorage`, `sessionStorage`, `document.cookie`.
- Ten section markers, exactly once and in order (62-73, 134-143). An 11th section requires editing `SECTION_MARKERS` and the check name deliberately (D-17).
- No selector literals outside the adapter (76-87, 145-154).
- No `?.` / `??` (156-164).
- `console.` only in the constants and verify sections (166-176).
- Version consistency (192-201). **Do not bump** in this phase.
- CSS scoping and no `!important` (217-241).
- README eleven H2s in order (252-282). New docs must be `###` subsections, never a new `##`.
- Harness string list (284-303). Append a Phase 4 block of required strings and `getElementById('hx-…')` wiring checks in the same style as the Phase 3 block (297-300).

**Config check to update** (305-394):
- Line 312-314 iterates `cfg.buttons` for HTTPS webhooks. Extend it to menu items but **exempt `url === ''`** (D-15).
- Lines 319-324 assert `sample.buttons.find(sendInvite)`. Re-point that to `sample.menus[0].items`, assert the four ids in D-12 order, check that the consent items have `url === ''` and `cooldownMs === 60000`, and that the menu `scope` is exactly `['Cp2XxBsRoyKS2CUf1Hwi']`.
- Line 364 (`xcelsior.buttons === undefined`) can stay.

**Unit-check analog** (lines 420-449, `validateConfig` / `resolveButtons`):
```js
check('unit: resolveButtons scopes by location and returns nothing at agency level', () => {
  const api = throwawayApi();
  const cfg = loadFixture();
  assert.deepEqual(plain(api.resolveButtons(cfg, null)), []);
  ...
});
```
Copy this for `validateConfig` (duplicate id across `buttons` and `menus`, bad item, `menus` absent is ok) and for `resolveMenus` (scope, `false` hides, object relabels, empty menu dropped).

**Boot helpers** (lines 458-465, 872-879, 1121-1129). `bootWithConfig(body, extra)` is the right entry for menu configs. Pass `{ pathname: '/v2/location/Cp2XxBsRoyKS2CUf1Hwi/contacts/detail/c1' }` for sample-config scenarios:
```js
async function bootWithConfig(body, extra = {}) {
  const shim = createShim({ pathname: CONTACT_PATH, search: '?ghlc-debug=1', fixture: loadFixture(), ...extra });
  const shell = shim.buildShell({ sidebarMode: 'location', contact: JANE });
  shim.setConfigResponse({ status: 200, body });
  const GHLC = shim.run(src);
  assert.equal(await GHLC.__test.boot(), true);
  await shim.flush();
  return { shim, shell, GHLC };
}
```
For synthetic email (ITEM-07), use `bootWithContact({ email: 'owner+12@example.test' }, ...)` (872-879). Note that it boots the fixture config, so add an `extra`/config parameter or inline a `createShim` + `setConfigResponse`. Then call `shim.setContact({ email: 'real@example.test' })` (dom-shim 1045-1061) for the recover path, as the scenario at 1002-1026 does.

**Scenario analogs to copy per REL-01 item:**

| New coverage | Copy from (run.mjs lines) |
|---|---|
| Item click POSTs once with `buttonId` = item id; payload keys unchanged | tracer 467-534 (fetchLog/bodyJson asserts at 506-522) |
| Per-item cooldown 60 s; other items unaffected | 881-899 (`advanceTimers(cooldown-1)` then `+1`), 912-925 |
| Cooldown survives a same-context re-render | 1529-1548 |
| Failed / unconfirmed outcome on item + trigger flash | 927-972 |
| Empty URL -> unavailable "Not configured", zero fetches | 1051 (non-https), 989-1000 (unavailable + `fetchLog.length === 0`) |
| Synthetic email unavailable then recovers on real email | 989-1026, and 1612-1637 (poll recovery via `advanceTimers(600)`) |
| Stale click / generation discard on an item | 800-840 |
| Contact change closes menu, removes doc listener | nav 697-712, 765-782 |
| No re-render loop when opening and closing | 1639-1656 (`logCount(shim,'rerender') === 0`, `observers().length === 9`) |
| Region re-render keeps one trigger, menu still works | 1504-1527 |
| Scope: no menu at other locations / agency | 593-606, 1186-1195 |
| D-03 buttons-only config unchanged | all existing scenarios (fixture without `menus`) plus an explicit DOM snapshot of the contact group |
| Sample config at Xcelsior shows menu, Dummy Clinic shows none | 3248-3306 (update the `buttonIds` assertion at 3280 and the `sendInvite` asserts at 3266-3270, which move to Xcelsior) |
| Log hygiene | `assertNoLeak(shim.console.lines, LEAK_STRINGS, ...)` (113-118, 91) |

**Overflow test (D-07).** `getBoundingClientRect` in the shim always returns zeros (dom-shim 536-538), so layout cannot be measured headlessly. Write the "overflow test" as a static CSS check: read `src/ghl-customizer.css` as at 218, and assert that `.ghlc-group` has `position: relative`, the panel rule has `position: absolute`, and no `.ghlc-` rule sets `overflow: hidden`. Cover the visual side with the harness control.

**Observer helpers** (1379-1396): `logCount`, `brandingRegs`, and `themeRegs` are reusable for MENU-07.

---

### `test/dom-shim.mjs`. Keyboard and focus support

**Current capabilities:**
- `Event(type, init)` (16-34) supports `bubbles`, `cancelable`, `preventDefault`, and `stopPropagation`. There is **no `KeyboardEvent`** and no `key` field.
- `Element.focus()` sets `document.activeElement` (534). `blur()` resets it to body (535). There is no `focus`/`blur` event dispatch and no tabindex/focusability model.
- `Element.click()` is a **no-op when `disabled`** is present (530-533), and it dispatches a bubbling `click`.
- `getBoundingClientRect()` returns all zeros (536-538). `getComputedStyle` returns empty values (961).
- Bubbling path goes element -> ... -> document -> window target (`_eventParent`, 284, 582). A document-level `pointerdown` listener therefore receives events dispatched on any element.
- `listenerCount(target, type)` (1112-1115) counts listeners on any node or window, which is useful for the D-06 "one document listener while open" check.
- `hidden` is reflected (510-511). `role` is in `REFLECTED` (459).

**Pattern to extend** (lines 36-41, `CustomEvent`). Add a `KeyboardEvent` that carries `key`, `code`, `shiftKey`, and `defaultPrevented`, export it, and expose it on `win` (951-953) and in the returned object (1150-1151):
```js
export class CustomEvent extends Event {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail === undefined ? null : init.detail;
  }
}
```
```js
  win.Event = Event;
  win.CustomEvent = CustomEvent;
  win.PopStateEvent = PopStateEvent;
```
Tests then use `trigger.dispatchEvent(new shim.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))` and assert `shim.document.activeElement === firstItem`. For outside clicks, use `shim.document.body.dispatchEvent(new shim.Event('pointerdown', { bubbles: true }))`. Optional: a `PointerEvent` alias of `Event`.

---

### `test/harness.html`. REL-01, D-07 harness control

**Analog: control rows** (lines 101-116). Add a row (e.g. `<h3>Actions menu</h3>`) with `hx-`-prefixed ids. Wire each one with `document.getElementById('hx-…').addEventListener('click', …)` plus an `hxLog` entry (pattern at 363-366):
```html
          <h3>Sidebar logo and theme</h3>
          <div class="hx-row">
            <button type="button" id="hx-rerender-logo">Re-render sidebar logo</button>
            ...
          </div>
```
```js
      document.getElementById('hx-rerender-logo').addEventListener('click', function () {
        var done = rerenderLogo();
        hxLog({ time: new Date().toISOString(), harness: done ? '...' : '...' });
      });
```
Suggested controls:
- `hx-clip-name-row`: toggles a class that constrains the name row (e.g. `overflow: hidden` / small height on `.hx-name-row`) to demonstrate the panel is not clipped. CSS rules in the `<style>` block must stay `hx-` prefixed (comment at line 12).
- `hx-synthetic-email`: rewrites the email input value to a `+<digits>@` address without a mutation, then back.
- A navigation button to a menu-scoped contact (pattern at 89-95, `data-hx-go`).

**Contacts table** (200-204): add a contact with a synthetic email (e.g. `cS: { email: 'owner+12@example.test' }`) for the D-16 demo. The fetch stub matches `/hooks/` (155), so fixture item URLs must contain `/hooks/` to be stubbed. The banner (52-62) must keep mentioning "theme" (run.mjs 301-302); append a sentence about the Actions menu.

---

### `README.md`. REL-04

**Analog: configuration table rows** (lines 83-90). Add `menus`, `menus[].id`, `menus[].label`, `menus[].icon`, `menus[].placement`, `menus[].scope`, `menus[].items`, and `menus[].items[].requires` in the same `| Field | Type | Required | Meaning |` shape. Extend the `locations[id].buttons` row (83) to say it also keys menu items:
```md
| `locations[id].buttons` | object | no | Per-button overrides keyed by button `id`: `false` disables the button here, `true` enables it here even if it is out of scope, an object enables it and overrides `label`, `icon`, or `action`. `id`, `placement`, and `scope` are never overridable. |
| `buttons` | array | yes | The button definitions; may be empty. |
| `buttons[].id` | string | yes | `[A-Za-z0-9_-]{1,64}`, unique across the array. ...
```
- Line 85 "unique across the array" becomes "unique across `buttons` and every menu's `items`".
- Line 87 icon list must include any new trigger icon.
- Line 97 webhook: `cooldownMs` defaults to `10000`. Add a note that an empty `url` renders unavailable "Not configured" and never sends.
- Line 143 describes the shipped sample's `sendInvite` "webhook button". Update it to the Xcelsior Actions menu.

**Analog: `### Action types` / `### Webhook payload` subsections** (92-122). Add `### Actions menu` as an H3 under `## Configuration`, with a JSON example of the shipped `xcelsiorActions` menu, the consent item ids (`send-individual-consent`, `resend-consent-hub`), the keyboard model, and the `requires` rule. **Never add an H2**: run.mjs 261-262 asserts exactly eleven H2s in order. Do **not** touch the jsDelivr tags (run.mjs 273-280 pin them to `v0.1.2`).

---

## Shared Patterns

### Generation counter + click-time URL recheck (MENU-08, D-06)
**Source:** `src/ghl-customizer.js` 865-901 (`applyContext`), 1427-1442 (`refuseStaleClick`), 1459-1463 (async discard)
**Apply to:** every item click path, the trigger flash timer, and menu close.
```js
    return sendWebhook(action.url, payload).then(function (result) {
      if (gen !== state.generation || !el.isConnected) {
        log('webhook-discarded', { buttonId: button.id, generation: gen });
        return;
      }
```

### Timers die with the context
**Source:** `src/ghl-customizer.js` 858-863 (`clearTimers`), 1410-1418 (`state.timers.set(el, id)`)
**Apply to:** the trigger-flash restore timer and any menu timer. Store them in `state.timers` keyed by element so `applyContext` clears them.

### Own-node DOM construction (no HTML strings)
**Source:** `src/ghl-customizer.js` 1090-1127 (`createButtonEl`), 957-973 (`makeIcon`)
**Apply to:** trigger, panel, items. Use `createElement` + `setAttribute` + `textContent` only, with classes built as `NS + '-…'`.

### Unavailable with a reason, then recover
**Source:** `src/ghl-customizer.js` 1129-1137, 1164-1171, 1363-1401
**Apply to:** D-15 (static unavailable from `resolveAction`, never recovers) and D-16 (reason attribute + recover on re-render, poll, or click).

### Logging hygiene
**Source:** `src/ghl-customizer.js` 130-158 (`safe`, `log`, `warn`); test `assertNoLeak` run.mjs 113-118
**Apply to:** all new `log(...)` calls. Never log email, URL, label text, or payload.

### Observer neutrality
**Source:** `src/ghl-customizer.js` 2035-2061 (`isOwnNode`, `isSelfInflicted`), 1227-1230 (watch before write)
**Apply to:** the panel. Keep it inside `.ghlc-group`, toggle visibility with attributes (`hidden`, `aria-expanded`; placement observers never watch attributes), and never move nodes outside the group.

---

## No Analog Found

| Concern | Role | Data Flow | Reason / Guidance |
|---|---|---|---|
| Menu keyboard model (Enter/Space/ArrowDown open, arrows wrap, Home/End, Esc returns focus, Tab closes) | component behavior | event-driven | The script has no `keydown` handling today. Follow the WAI-ARIA menu-button pattern. Bind once with the `bindClick` guard style (1153-1159). |
| Document-level outside-pointer listener added and removed per open | middleware | event-driven | The only global listeners are the permanent navigation hooks (941-953). Store the handler reference in `state` so `removeEventListener` gets the same function. |
| `KeyboardEvent` in the shim | test utility | event-driven | Extend from `CustomEvent` (dom-shim 36-41). |
| Headless overflow measurement | test | n/a | The shim has no layout (`getBoundingClientRect` returns zeros). Use static CSS assertions plus a harness control. |

## Planner Pitfalls (from reading the analogs)

1. **Reconcile `removeChild` on nested items:** `renderPlacement` 1238-1242 uses a descendant query and then `group.removeChild`. Items with `data-ghlc-button-id` inside the panel will throw `NotFoundError` unless the loop is restricted to direct children.
2. **Native `disabled` vs D-05 focusability:** `setState` 1069-1073 writes `disabled`, which removes focus, and the shim's `click()` ignores disabled elements. Items need an aria-only variant.
3. **Empty-groups exit:** `renderPlacement` 1222-1226 removes the group when `desired` (plain buttons) is empty. On Xcelsior after D-13 the contact group has **zero** plain buttons, so the menu would never render unless this condition counts menus.
4. **Email change is not a mutation** (comment 1369-1372). D-16 re-evaluation needs the poll or a click-time check, not the observer.
5. **Hide, don't detach, the panel:** `runWebhook` 1460 and `startCooldown` 1414 both require `el.isConnected`. A detached item would silently drop its result and cooldown restore.
6. **Sample config tests move:** run.mjs 319-324 and 3266-3280 assume `sendInvite` is in `buttons[]` and renders at Dummy Clinic. After D-13 both must be rewritten deliberately.
7. **`config:` HTTPS check** (run.mjs 312-314) must exempt empty consent URLs.

## Metadata

**Analog search scope:** `src/`, `test/`, `config/`, `README.md` (the entire tracked source tree; no other source exists)
**Files scanned:** 8 (`src/ghl-customizer.js`, `src/ghl-customizer.css`, `config/agency-config.json`, `test/fixtures/config.json`, `test/run.mjs`, `test/dom-shim.mjs`, `test/harness.html`, `README.md`)
**Pattern extraction date:** 2026-10-07
