# GHL Customizer (admin-theme)

## What it does

A small, configuration-driven customization layer for a HighLevel agency workspace. When staff switch locations it shows that location's logo in the sidebar, optionally applies the location's accent colors to the customizer's own buttons and the sidebar, and adds configurable buttons where staff work: link buttons in the global header, and on the individual contact record either plain buttons or an "Actions" menu whose items (Send Invite, for example) trigger a HighLevel workflow through the workflow's Inbound Webhook trigger. It is one hosted vanilla JavaScript file, one scoped stylesheet, and one public JSON config; there is no build step and no framework.

HighLevel does not support custom JavaScript or CSS and can change its interface at any time. The script is written to degrade gracefully: if a mount point it expects is missing, that customization is simply omitted and the native UI stays usable.

## Install in HighLevel

Open **Agency Settings -> Company** (the whitelabel and company settings area) and find the **Custom JavaScript** field. Paste the script tag below and save. The field takes HTML: HighLevel inserts its contents into every page, and a `<script>` tag is what makes the browser load the pinned release from jsDelivr. The `data-config` attribute tells the script where its config lives. The stylesheet is loaded automatically from the same folder as the script (`src/ghl-customizer.css`); a `data-css` attribute on the script element overrides that location.

```html
<script src="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.2.1/src/ghl-customizer.js"
        data-config="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.2.1/config/agency-config.json"
        defer></script>
```

Do not paste raw JavaScript into this field. Verified on 2026-09-25: HighLevel renders raw JavaScript as plain text inside a `div#customJS` container, so it never runs, and the code can show up as stray text on the page. If the script has to be created from JavaScript for some other reason (a tag manager, for example), this is the equivalent loader:

```js
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.2.1/src/ghl-customizer.js';
  s.setAttribute('data-config', 'https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.2.1/config/agency-config.json');
  s.defer = true;
  document.head.appendChild(s);
})();
```

Then save, reload HighLevel, open a location that has an entry in the config, and run `GHLC.verify()` in the browser console (Cmd+Option+J in Chrome on a Mac) to confirm the script loaded its config and found its mount points (see "Verify mode"). For a pilot, keep `locations` limited to the pilot locations: every other location keeps the native logo and colors and only sees the buttons whose `scope` includes it or is `all`.

## Hosting on jsDelivr

jsDelivr serves files straight from a public GitHub repository. Each URL has four parts after the `/gh/` prefix on the `cdn.jsdelivr.net` host: the repository owner, the repository name, an `@` followed by a git tag, and the file path. The install URLs above are that pattern filled in with this repository and the `v0.2.1` tag.

Rules that make this safe:

- The repository must be public. jsDelivr does not serve private repositories.
- Always pin a version tag. Never point the snippet at a branch or any other floating reference: files served at a tag are cached permanently and never change, which is exactly what makes rollback trivial and what stops a later commit from silently changing the code that runs in every staff session.
- These files must exist at the tag: `src/ghl-customizer.js`, `src/ghl-customizer.css`, `config/agency-config.json`, and the `test/fixtures/logos/*.svg` files if the sample config's logo URLs are used as shipped.

## Releasing a new version

1. Edit the source or the config and run `npm test`.
2. Bump the version everywhere it appears so they all agree: `"version"` in `package.json`; in `src/ghl-customizer.js` the `VERSION` constant, the `Version` line in the head comment, and the tag in `DEFAULT_CONFIG_URL`; the version in the head comment of `src/ghl-customizer.css`; the tag in the Dummy Clinic logo URL in `config/agency-config.json` (the Xcelsior Health logo is hosted by HighLevel and carries no tag); and the tag in every jsDelivr URL in this README (the install snippets and the example location entry). `grep -rn 'ghl-admin-theme@v' README.md config src` lists every URL that carries the tag. `npm test` checks all of these against `package.json`, so a missed spot fails the suite instead of shipping a mismatched release.
3. Commit, then create an annotated tag and push it together with the branch:

   ```sh
   git tag -a vX.Y.Z -m "GHL Customizer vX.Y.Z"
   git push origin main --tags
   ```

4. Wait until the script URL at the new tag returns HTTP 200 (the install URL above with its tag replaced by the new one). A new tag can take a few minutes to appear on jsDelivr.
5. Change the tag in both URLs of the HighLevel snippet (the script `src` and `data-config`) and reload.

## Rollback

Change only the tag in the HighLevel snippet back to the previous version, in both URLs, and reload. Nothing else needs to change: jsDelivr keeps every tag forever, so the previous release is still served exactly as it was.

Kill switches, from fastest to slowest:

- **Remove or comment out the snippet** in HighLevel. The script stores nothing in the browser (no cookies, no local storage), so a reload restores the native UI completely with nothing left behind.
- **Set `enabled` to `false` in the config.** This disables the script entirely on the next load. Because the config is served from the same immutable tag as the script, flipping the flag means committing the change, tagging a new version, and updating the tag in the snippet; it is not an instant switch.

## Configuration

The config is a JSON document with `schemaVersion` `1`. Field names below are the ones the script reads; anything else is ignored. The full working sample is `config/agency-config.json`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | number | yes | Must be exactly `1`. Any other value disables the script with one console warning. |
| `enabled` | boolean | yes | `false` disables the script entirely; the native UI is untouched. |
| `agency.logoUrl` | string | no | `https` URL (no embedded credentials) of the agency logo shown for locations without their own logo and on agency-level pages. Empty string means "keep the native logo". |
| `agency.logoAlt` | string | no | Alt text for the agency logo; also the fallback alt for a location whose entry has no `logoAlt` or `name`. |
| `agency.logoMount` | string | no | `sidebar` (default) or `header`: which native logo element is replaced. |
| `agency.theme` | object | no | Agency-level accent colors; see the theme table. |
| `locations` | object | yes | Keyed by HighLevel location ID, the segment after `/v2/location/` in the URL. Each value is a location entry. |
| `locations[id].name` | string | no | Display name; used as the logo alt text when `logoAlt` is absent. |
| `locations[id].logoUrl` | string | no | `https` URL of this location's logo. Shown while this location is active; falls back to the agency logo, then the native logo, if it fails to load. Any `https` image URL works, including the logo HighLevel already hosts for the location's Business Profile (the sample's Xcelsior Health entry); if that logo is re-uploaded in HighLevel, confirm the URL still resolves. |
| `locations[id].logoAlt` | string | no | Alt text for this location's logo. |
| `locations[id].theme` | object | no | Accent colors for this location; each key overrides the agency value for that key only. |
| `locations[id].buttons` | object | no | Per-button overrides keyed by button or menu item `id`: `false` disables the button here, `true` enables it here even if it is out of scope, an object enables it and overrides `label`, `icon`, or `action`. For a menu item, `false` hides only that item and an object may override its `label`, `icon`, or `action`. For a menu item, `true` (or an object) only overrides the item's own scope; the menu's `scope` still decides where the menu appears, so an override at a location outside the menu's scope has no effect. `id`, `placement`, and `scope` are never overridable. |
| `buttons` | array | yes | The button definitions; may be empty. |
| `buttons[].id` | string | yes | `[A-Za-z0-9_-]{1,64}`, unique across `buttons` and every menu's `items`. Used as the `buttonId` in webhook payloads and as the key for location overrides. |
| `buttons[].label` | string | yes | Visible label. |
| `buttons[].icon` | string | no | One of `send`, `mail`, `link`, `external`, `menu`, `copy`. Unknown names render no icon. |
| `buttons[].placement` | string | yes | `header` (global header controls) or `contact` (the contact record's name row). |
| `buttons[].scope` | `all` or array | yes | `all`, or an array of location IDs the button appears in. Buttons never appear on agency-level pages. |
| `buttons[].action` | object | yes | One of the three action types below. |
| `menus` | array | no | Optional menus of actions; see "Actions menu". A config without `menus` renders exactly as one with plain buttons only. |
| `menus[].id` | string | yes | `[A-Za-z0-9_-]{1,64}`, unique among menus. |
| `menus[].label` | string | yes | The trigger's visible label. |
| `menus[].icon` | string | no | Trigger icon; same names as `buttons[].icon`. |
| `menus[].placement` | string | yes | Must be `contact`. |
| `menus[].scope` | `all` or array | yes | The locations the menu appears in. |
| `menus[].items` | array | yes | Button definitions without `placement` (the menu supplies it). An item's `scope` is optional and defaults to the menu's. |
| `menus[].items[].requires` | object | no | `{ "requires": { "email": "real" } }` makes the item `unavailable` ("Needs the member's own email") while the record's email is empty or synthetic (the wf1 dedupe key `+<hint_patient_id>@`, for example `+pat-EXAMPLEa1B2c@`, or the older `+<digits>@`). It must be exactly `{ "email": "real" }` (lowercase, no other keys); any other value fails validation and the whole config is ignored, so a typo never silently removes the guard. |
| `menus[].items[].showWhen` | object | no | Shows the item only when the open contact's tags match; otherwise it is hidden. `{ "tagsAny": [...], "tagsNone": [...], "unknown": "hide" }`: `tagsAny` needs at least one of the tags, `tagsNone` needs none of them, and at least one of the two lists is required. `unknown` is `"hide"` (default) or `"show"` and applies when the tags cannot be read. Also allowed on a `buttons[]` entry with `placement` `contact`. Any other shape fails validation and the whole config is ignored. See "Showing items by contact kind". |

### Action types

Only these three types exist. A button with any other type, or with an unsafe value, renders in the `unavailable` state and does nothing.

- `link`: `{ "type": "link", "href": "...", "target": "_self" | "_blank" }`. `href` must be `https:`, `mailto:`, `tel:`, or a same-origin path starting with `/`. `target` defaults to `_self`; `_blank` links carry `rel="noopener noreferrer"`.
- `webhook`: `{ "type": "webhook", "url": "...", "extraFields": { ... }, "cooldownMs": 10000 }`. `url` must be the `https` Inbound Webhook trigger URL of a HighLevel workflow. `extraFields` is an optional object of strings, numbers, and booleans merged into the payload (it can never override the identity fields). `cooldownMs` defaults to `10000` and is capped at `300000`. Webhook buttons only work with `placement` `contact`. An empty or missing `url` renders the button or menu item `unavailable` ("Not configured") and it never sends.
- `handler`: `{ "type": "handler", "handler": "copyContactId" }`. The name must be in the script's built-in allowlist; today that is `copyContactId`. Config can never supply code.

### Theme tokens

| Token | Applies to |
|---|---|
| `primary` | The customizer's own buttons and their focus ring. The button text color is chosen automatically (white or dark) so it stays readable against `primary`. |
| `sidebarBg` | Background of the sidebar container. |
| `sidebarText` | Text color of the sidebar and its links. Only applied together with `sidebarBg`; a pair whose contrast is below 4.5:1 keeps the background and falls back to white or dark text, whichever reads better. |
| `navActive` | Background of the active sidebar navigation item, and of a hovered item while the sidebar text is themed (a hovered item has no highlight when `navActive` is unset). Only applied together with `sidebarBg` and `sidebarText` (the script cannot check it against a native text color it does not know); dropped when its contrast against the applied sidebar text is below 4.5:1. |

Values must be `#rgb` or `#rrggbb` hex strings; anything else is ignored with a diagnostic naming the scope and token, never the value. Location tokens override agency tokens key by key, so a location may set only `primary` and inherit the rest. An empty string means "not set". Tokens are written only as inline CSS custom properties on the customizer's own elements and on the sidebar container; nothing else in HighLevel is restyled, and native success, warning, and error colors are unchanged.

### Webhook payload

When a staff member presses a `webhook` button on an open contact record, the script POSTs one JSON object to the configured URL:

- `contactId`, `locationId`: read from the current URL at click time.
- `email`, `phone`: read from the contact record on screen (each omitted when the record does not show it).
- `buttonId`: the button's `id`.
- `requestId`: a new UUID for every click, so the workflow can deduplicate.
- `sentAt`: ISO 8601 timestamp.
- Every key from `extraFields` that does not collide with the fields above.

HighLevel's Inbound Webhook trigger matches the contact on `email` or `phone` in the payload, not on `contactId`. For that reason the button renders `unavailable` ("contact email/phone not found") when neither can be read from the record. The button moves through `ready` -> `submitting` -> `queued` ("Workflow triggered") on a 2xx response, or `failed` with a short message on any other response. While `queued` it stays disabled for `cooldownMs`, which blocks accidental resends client-side. If the request fails with a network or CORS error, the script retries once with `no-cors` and reports `queued` as "Sent (unconfirmed)", because an opaque response cannot confirm receipt.

### Actions menu

A `menus` entry renders one "Actions" trigger in the contact record's name row, beside any plain contact buttons; pressing it opens a panel of items below it. Each item is a normal button definition and keeps its own states, its own result, and its own `cooldownMs` (the shipped items use `60000`), so a queued Send Invite never blocks another item. The latest result also shows briefly on the trigger (for example "Actions · Workflow triggered") and in its screen-reader status.

- **Keyboard:** Enter, Space, or ArrowDown on the trigger opens the menu and focuses the first available item (ArrowUp opens on the last). ArrowUp and ArrowDown move between items and wrap; Home and End jump to the first and last item. Esc closes the menu and returns focus to the trigger; Tab closes it and moves on.
- **Closing:** the menu also closes on a click outside it, after an item is activated, on navigation, and when the open contact changes.
- **Unavailable items** ("Not configured", "Needs the member's own email", or an unsafe action) stay focusable so they can be read, but activating them does nothing. The reason shows beside the greyed item's label. A menu whose items are all hidden is not shown.
- **Hidden items** are items a `showWhen` rule rules out for the open contact. Arrow keys, Home, and End skip them.
- **Per-location item overrides** use the same `locations[id].buttons` object as plain buttons, keyed by item `id`: `false` hides only that item at that location, and an object can relabel it or swap its `action`.

The shipped `xcelsiorActions` menu, scoped to Xcelsior Health only:

```json
"menus": [
  {
    "id": "xcelsiorActions",
    "label": "Actions",
    "icon": "menu",
    "placement": "contact",
    "scope": ["Cp2XxBsRoyKS2CUf1Hwi"],
    "items": [
      { "id": "sendInvite", "label": "Send Invite", "icon": "send",
        "action": { "type": "webhook", "url": "https://services.leadconnectorhq.com/hooks/...", "cooldownMs": 60000, "extraFields": { "source": "ghl-customizer" } } },
      { "id": "send-individual-consent", "label": "Email this member their own consent forms", "icon": "mail", "requires": { "email": "real" },
        "showWhen": { "tagsAny": ["family-member"] },
        "action": { "type": "webhook", "url": "https://services.leadconnectorhq.com/hooks/...", "cooldownMs": 60000, "extraFields": { "source": "ghl-customizer" } } },
      { "id": "resend-consent-hub", "label": "Resend Consent Hub link", "icon": "mail",
        "showWhen": { "tagsAny": ["family-member", "hint-complete", "consents-needed", "all-consents-complete"] },
        "action": { "type": "webhook", "url": "https://services.leadconnectorhq.com/hooks/...", "cooldownMs": 60000, "extraFields": { "source": "ghl-customizer" } } },
      { "id": "copyContactId", "label": "Copy contact ID", "icon": "copy",
        "action": { "type": "handler", "handler": "copyContactId" } }
    ]
  }
]
```

Consent item IDs. These are the `buttonId` values the consent Inbound Webhook workflow branches on, so renaming either one needs a matching workflow change:

| Item `id` (`buttonId`) | Label |
|---|---|
| `send-individual-consent` | Email this member their own consent forms |
| `resend-consent-hub` | Resend Consent Hub link |

Both items share one URL, the consent workflow's Inbound Webhook trigger. They post the standard payload above with no new fields; only `buttonId` tells them apart. The shipped config carries that URL in both items. Setting an item's `url` back to `""` makes it "Not configured" again: it never sends, and nothing changes in ClinX.

### Showing items by contact kind

A `showWhen` rule hides an item that cannot work for the kind of contact that is open. It is a convenience for staff only: the workflow's own guards still decide what is sent, and an item's `id` never changes.

The script reads the tags row of the open contact record (the "Tags (N)" header and its chips). It makes no network call and reads no custom field. Tag names are compared trimmed and case-insensitively.

```json
"showWhen": { "tagsAny": ["family-member"] }
"showWhen": { "tagsNone": ["do-not-contact"], "unknown": "show" }
```

With the shipped rules, the `xcelsiorActions` menu shows:

| Contact | Tags it carries | Send Invite | Email this member their own consent forms | Resend Consent Hub link | Copy contact ID |
|---|---|---|---|---|---|
| Lead | none of the tags below | shown | hidden | hidden | shown |
| Owner or solo member | `hint-complete`, `consents-needed`, or `all-consents-complete` | shown | hidden | shown | shown |
| Family member (dependent) | `family-member` | shown | shown (greyed while the email is empty or synthetic) | shown | shown |
| Legacy dependent | none of the tags above | shown | hidden | hidden | shown |
| Tags cannot be read | (unknown) | shown | hidden | hidden | shown |

- **Unknown tags.** If the tags row is missing, or its header count and its chips disagree, the tags are unknown and `unknown` decides (`"hide"` unless the rule says `"show"`). A list that might be partial is never trusted.
- **While the record loads**, the tags are unknown, so a ruled item stays hidden and appears when the tags row mounts. A wrong item is never shown first.
- **When a tag changes while the record is open**, the item follows without a reload. The rule is also re-read every time the menu opens and again at the moment an item is pressed.
- **Hide or grey out.** A wrong-kind item is hidden, because nothing staff do on that record makes it valid. An item that only needs a fix (`requires`) is greyed with its reason.

### Why is an item greyed out or missing?

With the Actions menu open, or its trigger focused, press `?`. With a mouse, Alt-click (Option-click) the Actions trigger. A small "Why?" view opens under the trigger with one line per configured contact action, including the hidden ones and the ones not in scope:

```text
GHL Customizer X.Y.Z - why report
location: Cp2XxBsRoyKS2CUf1Hwi
contact: AbCdEf123
mount: record-panel
tags: readable (2)
email: not found; phone: found
- Send Invite [sendInvite]: Ready
- Email this member their own consent forms [send-individual-consent]: Hidden: this contact has none of the tags family-member
- Resend Consent Hub link [resend-consent-hub]: Greyed: sent recently, ready again in 42 s
- Copy contact ID [copyContactId]: Ready
```

**Copy report** copies those lines so a staff member can paste them to whoever supports the install. `mount` tells which layout the user has: `toolbar-anchor` is the name row with the delete control, `record-panel` is the layout for users without it. Esc, the Close button, or a click elsewhere closes the view.

The report holds IDs, states, counts, and the tag names written in the config rule. It never holds a name, an email, a phone number, a webhook URL, or a tag that is only on the contact. The view is read-only: it changes no item and sends nothing. `GHLC.diagnose()` in the browser console returns the same report as an object.

### Example location entry

```json
"iDPNGKoFsjvf9wUCrk3V": {
  "name": "Dummy Clinic",
  "logoUrl": "https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.2.1/test/fixtures/logos/loc-a.svg",
  "logoAlt": "Dummy Clinic",
  "theme": {
    "primary": "#0f766e",
    "sidebarBg": "#0b3b3a",
    "sidebarText": "#e6fffa",
    "navActive": "#115e59"
  },
  "buttons": {
    "helpCenter": { "label": "Clinic Help" }
  }
}
```

The shipped sample, `config/agency-config.json`, demonstrates agency defaults, two location entries (Dummy Clinic with a full theme and a repository-fixture logo, and Xcelsior Health with the logo HighLevel already hosts for it and a `primary` accent only, which leaves the native sidebar untouched), the `helpCenter` header link, and the Xcelsior Health `xcelsiorActions` menu (Send Invite, Send individual consent, Resend Consent Hub link, Copy contact ID), scoped to Xcelsior Health only. No other location shows a contact action.

## Security notes

- **The config is public.** Anyone with its URL, and anyone browsing the public repository, can read it. Never put tokens, API keys, passwords, patient data, or contact data in it. The test suite rejects keys that look like secrets in both the sample and the fixture.
- **Two Inbound Webhook URLs are in the config by design:** Send Invite's, and the consent workflow's, which both consent items share. This is a staff-only tool and the trade-off was accepted knowingly: anyone holding a URL can enqueue its workflow. If one is abused, regenerate that trigger in its HighLevel workflow, update `config/agency-config.json` (both consent items for the consent URL), tag a new version, and update the tag in the snippet.
- **Config never executes code.** The only action types are `link`, `webhook`, and `handler`; unknown types render unavailable, and handler names resolve against a fixed allowlist inside the script.
- **All URLs are `https`.** The config URL, logo URLs, link hrefs (or `mailto:`, `tel:`, same-origin paths), and webhook URLs are checked before use; credentialed URLs are refused.
- **The script never writes HTML strings.** Every config value reaches the page through text nodes and attributes on elements the script creates itself. Logo image requests carry `referrerpolicy="no-referrer"`.
- **Diagnostics log IDs and states only.** The console never shows the webhook URL, the payload, an email, a phone number, a logo URL, or a color value.

## Verify mode

Append `?ghlc-debug=1` to any HighLevel URL, or run `GHLC.verify()` in the browser console. The report contains:

- `mounts`: a boolean per adapter selector (`sidebar`, `header`, `headerMount`, `contactMount`, `contactRegion`, `contactEmailField`, `contactPhoneField`, `sidebarLogo`, `headerLogo`, `locationSwitcher`, `backToAgency`, `sidebarNavActive`), plus `contactMountVia`: a string naming the contact-mount strategy that resolved (`toolbar-anchor` for the name row that holds the delete control, `record-panel` for `#record-details-lhs` when that control is absent, or `selector` for a class-based candidate), or `null` when none did.
- `branding`: which mount is in use, whether it was found, and which tier (`location`, `agency`, or `native`) is currently applied.
- `theme`: whether the sidebar root was found, which token names are applied, how many nav items are marked, how many tokens were ignored, and whether the text fell back.
- `observers` and `waiting`: which mutation observers are attached and which mounts are being waited for.
- `config`: whether the config loaded, `enabled`, `schemaVersion`, `buttonIds` (the plain button ids), and `menuIds` (the menu ids).
- `why`: the report `GHLC.diagnose()` returns: one entry per configured contact action with its `state`, whether it is `shown`, and a `code` and `text` for the reason (see "Why is an item greyed out or missing?"). `mounts.contactTags` is `true` when the open contact's tags row could be read.

It never contains URLs, payloads, email, phone, or color values. If `mounts.sidebarNavActive` is `false` while a theme sets `navActive`, none of the active-nav candidate selectors matched HighLevel's current markup; add the live class to `selectors.sidebarNavActive` in the adapter (see "Selector maintenance").

## Local development

There are no dependencies. `npm test` runs `node test/run.mjs`, which executes the real script inside a small DOM shim and prints `PASS n/n` on success. `npm run serve` starts a static server; open `http://localhost:5173/test/harness.html?ghlc-debug=1` for an offline imitation of the HighLevel shell with a fake router, location switching, sidebar re-rendering, and webhook stubs. The harness loads `test/fixtures/config.json`, which deliberately exercises fallbacks (a broken logo, an invalid color, a low-contrast sidebar pair); `config/agency-config.json` is the production sample and never does. Location M contacts exercise the Actions menu: a working item, a "Not configured" item, a consent item that turns unavailable for a synthetic email, and controls that flip the email without a DOM mutation and tighten the name row to show the open panel is not clipped. The consent item carries a `showWhen` rule, so "Toggle family-member tag" hides and shows it with the menu open, and `?` or Alt-click on the trigger opens the "Why?" view.

## Selector maintenance

Every HighLevel selector, route regex, and DOM reader lives in the `adapter` object near the top of `src/ghl-customizer.js`. When HighLevel changes its markup, that object is what changes; the rest of the script only asks the adapter for mounts and values. Use verify mode to see which mounts resolve on a live page.

Verified live on 2026-09-24: the sidebar container `#sidebar-v2` and its logo `#sidebar-v2 img.agency-logo`, the header `.hl_header` with its `.hl_header--controls`, the contact panel `#record-details-lhs`, and the email and phone fields with element ids `contact.email` and `contact.phone`. Contact actions mount on the name row (the parent of `#delete-contact-trigger`) when HighLevel renders that control, and on `#record-details-lhs` itself when it does not. Account Users without delete-contact permission never get the control, and the older class-based contact mounts are not in the live DOM. Verified live on 2026-09-25: the active sidebar navigation item is the anchor inside `#sidebar-v2 nav` that HighLevel's router marks with the classes `active` and `exact-active`; `selectors.sidebarNavActive` lists that first, followed by fallbacks for other markup. HighLevel paints the sidebar and its nav labels with rules that outrank a plain attribute selector, so the theme rules in the stylesheet carry two `:not(#ghlc-boost)` pseudo-classes to win on specificity without an importance override.

Verified live on 2026-11-11 (365.clinx.net contact record): the tags row is `div.record-tags` inside `#record-details-lhs`. Its header `<p>` reads `Tags (N)`, or just `Tags` when the contact has none, and each tag is a `span.record-tag-chip` whose id is `tag-` followed by the tag name. `showWhen` reads only this row. If `mounts.contactTags` is `false` on a contact record that visibly has tags, update `contactTags`, `contactTagsHeader`, `contactTagChip`, or `contactTagIdPrefix` in the adapter. Not yet checked live: whether a long tag list collapses behind a "+N" control (the header count check treats that as unknown, so ruled items hide), and whether every user role sees the tags row.

## License and attribution

Original work by Universal Logics (Rob Parker). No LICENSE file is present, so the repository is all rights reserved by default. See `NOTICE.md` for the note on the reference project that inspired the idea and why nothing was copied from it.
