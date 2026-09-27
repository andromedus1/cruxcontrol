---
source_handle: ios-capacitor-config
fetched: 2026-09-27
source_url: https://capacitorjs.com/docs/config
provenance: source-direct
substrate_confidence: source-direct
---

# Capacitor — Configuration

## Anchored observations (paraphrased)

### Schema / server

The configuration defaults the local hostname to localhost and the iOS scheme to capacitor. The iOS scheme cannot use schemes already handled by WKWebView such as http/https. Android's default scheme is https. Loading an external URL through server.url is documented as a live-reload capability not intended for production.
