# Notices and Attribution

## Reference project: GHL Customizer

- **Source:** https://github.com/dachi-khelashvili/ghl-customizer
- **Revision reviewed:** `ff7c8e49f5e2f2db96cae3db16142642ccc5a6e7` (2025-11-11, "Merge pull request #1 from dachi-khelashvili/feat/readme")
- **License:** The repository contains **no LICENSE file**. Under GitHub's terms and default copyright law, that means all rights are reserved by the author and the code is not licensed for reuse.
- **What was used:** Nothing was copied. The project served as an idea reference only: the concept of one hosted script plus one hosted JSON config, loaded via HighLevel's Custom JavaScript setting and served from jsDelivr.
- **What was rejected:** Its DOM selectors (`.hl-header-logo`, `.hl-header-nav`, `.hl-user-menu`, `.hl-sidebar`) do not match the current HighLevel v2 interface, it has no location awareness, and it fires `alert()` on load.

All code in this repository is original work by Universal Logics (Rob Parker) and contributors.

## Reference material (not dependencies)

- Spark GHL Hub: https://github.com/pedropoleza/spark-ghl-hub (future reference only)
- HighLevel agency settings and custom JS/CSS warning: https://help.gohighlevel.com/support/solutions/articles/48000982604
- Community CSS guides used to identify candidate selectors: GHL Experts customization articles and public gists. Selector names are facts about HighLevel's DOM, not copyrighted expression.

## HighLevel selectors

Selector and route knowledge in `src/ghl-customizer.js` (the `adapter` object) was assembled from public community CSS guides and must be re-verified against the live application after HighLevel UI updates. HighLevel does not support custom JavaScript/CSS and may change its interface without notice.
