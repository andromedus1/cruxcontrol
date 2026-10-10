package io.github.andromedus1.cruxcontrol.prototype;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/** Preserve exact downloadable gzip bytes across AGP's unconditional .gz merge. */
final class CatalogAssetWebViewClient extends BridgeWebViewClient {
    private final Bridge bridge;
    private final String catalogFile;

    CatalogAssetWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
        String file = null;
        try (InputStream input = bridge.getContext().getAssets().open("public/catalog/manifest.json")) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int count;
            while ((count = input.read(buffer)) != -1) {
                bytes.write(buffer, 0, count);
                if (bytes.size() > 16384) throw new IOException("Catalog manifest exceeds its bound");
            }
            JSONObject manifest = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
            String declared = manifest.getString("file");
            if (declared.matches("kilter-7x10\\.v[1-9][0-9]*\\.db\\.gz")) file = declared;
        } catch (Exception ignored) {
            // Explicit compile-only builds have no catalog. Normal requests keep
            // Capacitor's own routing; private build checks reject missing data.
        }
        catalogFile = file;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        Uri local = Uri.parse(bridge.getLocalUrl());
        if (catalogFile == null || !"GET".equals(request.getMethod())
            || bridge.getServerUrl() != null
            || !local.getScheme().equals(url.getScheme())
            || !local.getAuthority().equals(url.getAuthority())
            || !("/catalog/" + catalogFile).equals(url.getEncodedPath())
            || url.getEncodedQuery() != null || url.getEncodedFragment() != null) {
            return super.shouldInterceptRequest(view, request);
        }
        try {
            InputStream input = bridge.getContext().getAssets().open("public/catalog/" + catalogFile + ".bin");
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Type", "application/gzip");
            headers.put("Content-Encoding", "identity");
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse("application/gzip", null, 200, "OK", headers, input);
        } catch (IOException error) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(),
                new ByteArrayInputStream("Bundled catalog is missing".getBytes(StandardCharsets.UTF_8)));
        }
    }
}
