# GHL Customizer (admin-theme)

## What it does

A small, configuration-driven customization layer for a HighLevel agency workspace. When staff switch locations it shows that location's logo in the sidebar, optionally applies the location's accent colors to the customizer's own buttons and the sidebar, and adds configurable buttons where staff work: link buttons in the global header and a "Send Invite" button on the individual contact record that triggers a HighLevel workflow through the workflow's Inbound Webhook trigger. It is one hosted vanilla JavaScript file, one scoped stylesheet, and one public JSON config; there is no build step and no framework.

HighLevel does not support custom JavaScript or CSS and can change its interface at any time. The script is written to degrade gracefully: if a mount point it expects is missing, that customization is simply omitted and the native UI stays usable.

## Install in HighLevel

Open **Agency Settings -> Company** (the whitelabel and company settings area) and find the **Custom JavaScript** field. Paste the script tag below and save. The field takes HTML: HighLevel inserts its contents into every page, and a `<script>` tag is what makes the browser load the pinned release from jsDelivr. The `data-config` attribute tells the script where its config lives. The stylesheet is loaded automatically from the same folder as the script (`src/ghl-customizer.css`); a `data-css` attribute on the script element overrides that location.

```html
<script src="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/src/ghl-customizer.js"
        data-config="https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/config/agency-config.json"
        defer></script>
```

Do not paste raw JavaScript into this field. Verified on 2026-09-25: HighLevel renders raw JavaScript as plain text inside a `div#customJS` container, so it never runs, and the code can show up as stray text on the page. If the script has to be created from JavaScript for some other reason (a tag manager, for example), this is the equivalent loader:

```js
(function () {
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/src/ghl-customizer.js';
  s.setAttribute('data-config', 'https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/config/agency-config.json');
  s.defer = true;
  document.head.appendChild(s);
})();
```

Then save, reload HighLevel, open a location that has an entry in the config, and run `GHLC.verify()` in the browser console (Cmd+Option+J in Chrome on a Mac) to confirm the script loaded its config and found its mount points (see "Verify mode"). For a pilot, keep `locations` limited to the pilot locations: every other location keeps the native logo and colors and only sees the buttons whose `scope` includes it or is `all`.

## Hosting on jsDelivr

jsDelivr serves files straight from a public GitHub repository. Each URL has four parts after the `/gh/` prefix on the `cdn.jsdelivr.net` host: the repository owner, the repository name, an `@` followed by a git tag, and the file path. The install URLs above are that pattern filled in with this repository and the `v0.1.2` tag.

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
| `locations[id].buttons` | object | no | Per-button overrides keyed by button `id`: `false` disables the button here, `true` enables it here even if it is out of scope, an object enables it and overrides `label`, `icon`, or `action`. `id`, `placement`, and `scope` are never overridable. |
| `buttons` | array | yes | The button definitions; may be empty. |
| `buttons[].id` | string | yes | `[A-Za-z0-9_-]{1,64}`, unique across the array. Used as the `buttonId` in webhook payloads and as the key for location overrides. |
| `buttons[].label` | string | yes | Visible label. |
| `buttons[].icon` | string | no | One of `send`, `mail`, `link`, `external`. Unknown names render no icon. |
| `buttons[].placement` | string | yes | `header` (global header controls) or `contact` (the contact record's name row). |
| `buttons[].scope` | `all` or array | yes | `all`, or an array of location IDs the button appears in. Buttons never appear on agency-level pages. |
| `buttons[].action` | object | yes | One of the three action types below. |

### Action types

Only these three types exist. A button with any other type, or with an unsafe value, renders in the `unavailable` state and does nothing.

- `link`: `{ "type": "link", "href": "...", "target": "_self" | "_blank" }`. `href` must be `https:`, `mailto:`, `tel:`, or a same-origin path starting with `/`. `target` defaults to `_self`; `_blank` links carry `rel="noopener noreferrer"`.
- `webhook`: `{ "type": "webhook", "url": "...", "extraFields": { ... }, "cooldownMs": 10000 }`. `url` must be the `https` Inbound Webhook trigger URL of a HighLevel workflow. `extraFields` is an optional object of strings, numbers, and booleans merged into the payload (it can never override the identity fields). `cooldownMs` defaults to `10000` and is capped at `300000`. Webhook buttons only work with `placement` `contact`.
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

### Example location entry

```json
"iDPNGKoFsjvf9wUCrk3V": {
  "name": "Dummy Clinic",
  "logoUrl": "https://cdn.jsdelivr.net/gh/robhparker/ghl-admin-theme@v0.1.2/test/fixtures/logos/loc-a.svg",
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

The shipped sample, `config/agency-config.json`, demonstrates agency defaults, two location entries (Dummy Clinic with a full theme and a repository-fixture logo, and Xcelsior Health with the logo HighLevel already hosts for it and a `primary` accent only, which leaves the native sidebar untouched), the `helpCenter` header link, and the `sendInvite` webhook button.

## Security notes

- **The config is public.** Anyone with its URL, and anyone browsing the public repository, can read it. Never put tokens, API keys, passwords, patient data, or contact data in it. The test suite rejects keys that look like secrets in both the sample and the fixture.
- **The Inbound Webhook URL is in the config by design.** This is a staff-only tool and the trade-off was accepted knowingly: anyone holding the URL can enqueue the workflow. If it is abused, regenerate the trigger URL in the HighLevel workflow, update `config/agency-config.json`, tag a new version, and update the tag in the snippet.
- **Config never executes code.** The only action types are `link`, `webhook`, and `handler`; unknown types render unavailable, and handler names resolve against a fixed allowlist inside the script.
- **All URLs are `https`.** The config URL, logo URLs, link hrefs (or `mailto:`, `tel:`, same-origin paths), and webhook URLs are checked before use; credentialed URLs are refused.
- **The script never writes HTML strings.** Every config value reaches the page through text nodes and attributes on elements the script creates itself. Logo image requests carry `referrerpolicy="no-referrer"`.
- **Diagnostics log IDs and states only.** The console never shows the webhook URL, the payload, an email, a phone number, a logo URL, or a color value.

## Verify mode

Append `?ghlc-debug=1` to any HighLevel URL, or run `GHLC.verify()` in the browser console. The report contains:

- `mounts`: a boolean per adapter selector (`sidebar`, `header`, `headerMount`, `contactMount`, `contactRegion`, `contactEmailField`, `contactPhoneField`, `sidebarLogo`, `headerLogo`, `locationSwitcher`, `backToAgency`, `sidebarNavActive`), plus `contactMountVia`: a string naming the contact-mount strategy that resolved (`toolbar-anchor` or `selector`), or `null` when neither did.
- `branding`: which mount is in use, whether it was found, and which tier (`location`, `agency`, or `native`) is currently applied.
- `theme`: whether the sidebar root was found, which token names are applied, how many nav items are marked, how many tokens were ignored, and whether the text fell back.
- `observers` and `waiting`: which mutation observers are attached and which mounts are being waited for.

It never contains URLs, payloads, email, phone, or color values. If `mounts.sidebarNavActive` is `false` while a theme sets `navActive`, none of the active-nav candidate selectors matched HighLevel's current markup; add the live class to `selectors.sidebarNavActive` in the adapter (see "Selector maintenance").

## Local development

There are no dependencies. `npm test` runs `node test/run.mjs`, which executes the real script inside a small DOM shim and prints `PASS n/n` on success. `npm run serve` starts a static server; open `http://localhost:5173/test/harness.html?ghlc-debug=1` for an offline imitation of the HighLevel shell with a fake router, location switching, sidebar re-rendering, and webhook stubs. The harness loads `test/fixtures/config.json`, which deliberately exercises fallbacks (a broken logo, an invalid color, a low-contrast sidebar pair); `config/agency-config.json` is the production sample and never does.

## Selector maintenance

Every HighLevel selector, route regex, and DOM reader lives in the `adapter` object near the top of `src/ghl-customizer.js`. When HighLevel changes its markup, that object is what changes; the rest of the script only asks the adapter for mounts and values. Use verify mode to see which mounts resolve on a live page.

Verified live on 2026-09-24: the sidebar container `#sidebar-v2` and its logo `#sidebar-v2 img.agency-logo`, the header `.hl_header` with its `.hl_header--controls`, the contact panel `#record-details-lhs` whose name row (the parent of `#delete-contact-trigger`) is the contact button mount, and the email and phone fields with element ids `contact.email` and `contact.phone`. Verified live on 2026-09-25: the active sidebar navigation item is the anchor inside `#sidebar-v2 nav` that HighLevel's router marks with the classes `active` and `exact-active`; `selectors.sidebarNavActive` lists that first, followed by fallbacks for other markup. HighLevel paints the sidebar and its nav labels with rules that outrank a plain attribute selector, so the theme rules in the stylesheet carry two `:not(#ghlc-boost)` pseudo-classes to win on specificity without an importance override.

## License and attribution

Original work by Universal Logics (Rob Parker). No LICENSE file is present, so the repository is all rights reserved by default. See `NOTICE.md` for the note on the reference project that inspired the idea and why nothing was copied from it.
