package io.github.andromedus1.cruxcontrol.prototype;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/** Authenticated, fixed-origin and chunked native transport for immutable vault objects. */
@CapacitorPlugin(name = "PrivateVault")
public final class PrivateVaultPlugin extends Plugin {
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final int MAX_LISTING_BYTES = 512 * 1024;
    private static final int MAX_RECEIPT_BYTES = 64 * 1024;
    private static final String DIGEST = "[0-9a-f]{64}";
    private static final String UUID_PATTERN = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

    private NativeAccountSession session;
    private PrivateVaultFileStore files;
    private String installationId;
    private ExecutorService transferQueue;

    @Override
    public void load() {
        session = NativeAccountSession.get(getContext());
        transferQueue = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "crux-private-vault-transfer");
            thread.setDaemon(true);
            return thread;
        });
        try {
            installationId = PrivateVaultFileStore.installationId(getContext());
            files = new PrivateVaultFileStore(getContext());
            files.cleanupInterruptedTransfers();
        } catch (Exception ignored) {
            files = null;
            installationId = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (transferQueue != null) transferQueue.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void status(PluginCall call) {
        if (files == null || installationId == null) {
            call.reject("Private vault storage is unavailable.", "VAULT_UNAVAILABLE");
            return;
        }
        call.resolve(session.vaultStatus(installationId));
    }

    @PluginMethod
    public void stageBegin(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        Integer bytes = safeInt(call, "bytes");
        String sha256 = call.getString("sha256", "");
        if (!validAccountRequest(call, uid, epoch) || bytes == null || bytes < 1
            || bytes > PrivateVaultFileStore.MAX_BYTES || !sha256.matches(DIGEST)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            JSObject result = files.begin(uid, session.scope(), bytes, sha256);
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void stageChunk(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        Integer offset = safeInt(call, "offset");
        String base64 = call.getString("base64", "");
        int maximumEncoded = ((PrivateVaultFileStore.MAX_CHUNK + 2) / 3) * 4;
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN) || offset == null || offset < 0
            || base64.isEmpty() || base64.length() > maximumEncoded) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            int next = files.append(uid, session.scope(), id, offset, base64);
            JSObject result = new JSObject();
            result.put("id", id);
            result.put("offset", next);
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void stageSeal(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            PrivateVaultFileStore.SealedFile sealed = files.seal(uid, session.scope(), id);
            JSObject result = new JSObject();
            result.put("id", sealed.id);
            result.put("bytes", sealed.bytes);
            result.put("sha256", sealed.sha256);
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void stageAbort(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            files.abort(uid, session.scope(), id);
            call.resolve(epochResult(epoch));
        });
    }

    @PluginMethod
    public void list(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        if (!validAccountRequest(call, uid, epoch)) { reject(call, "VAULT_INVALID_REQUEST"); return; }
        enqueue(call, uid, epoch, () -> {
            HttpResult response = request(uid, epoch, "GET", route(null), null, null, MAX_LISTING_BYTES);
            JSObject result = new JSObject();
            result.put("responseText", new String(response.body, StandardCharsets.UTF_8));
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void upload(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String slot = call.getString("slot", "");
        String id = call.getString("id", "");
        Integer bytes = safeInt(call, "bytes");
        String sha256 = call.getString("sha256", "");
        if (!validAccountRequest(call, uid, epoch) || !validSlot(slot) || !id.matches(UUID_PATTERN)
            || bytes == null || bytes < 1 || bytes > PrivateVaultFileStore.MAX_BYTES || !sha256.matches(DIGEST)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            PrivateVaultFileStore.SealedFile sealed = files.readSealed(uid, session.scope(), id);
            if (sealed.bytes != bytes || !sealed.sha256.equals(sha256)) throw new PrivateVaultFileStore.FileStoreException("STAGING_CORRUPT");
            HttpResult response = request(uid, epoch, "PUT", route(slot), sealed, sha256, MAX_RECEIPT_BYTES);
            JSObject result = new JSObject();
            result.put("responseText", new String(response.body, StandardCharsets.UTF_8));
            result.put("httpStatus", response.status);
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void download(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String slot = call.getString("slot", "");
        String generation = call.getString("generation", "");
        Integer bytes = safeInt(call, "bytes");
        String sha256 = call.getString("sha256", "");
        if (!validAccountRequest(call, uid, epoch) || !validSlot(slot)
            || !generation.matches("[1-9][0-9]{0,39}") || bytes == null || bytes < 1
            || bytes > PrivateVaultFileStore.MAX_BYTES || !sha256.matches(DIGEST)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            PrivateVaultFileStore.DownloadFile download = files.createDownload(
                uid, session.scope(), epoch, bytes, sha256, generation);
            boolean sealed = false;
            try {
                streamDownload(uid, epoch, slot, download);
                if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
                files.sealDownload(download);
                sealed = true;
                JSObject result = new JSObject();
                result.put("id", download.id);
                result.put("bytes", bytes);
                result.put("sha256", sha256);
                result.put("generation", generation);
                result.put("epoch", epoch);
                call.resolve(result);
            } finally {
                if (!sealed) files.finishDownload(uid, session.scope(), epoch, download.id);
            }
        });
    }

    @PluginMethod
    public void downloadChunk(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        Integer offset = safeInt(call, "offset");
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN) || offset == null || offset < 0) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            JSObject result = files.downloadChunk(uid, session.scope(), epoch, id, offset);
            if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
            result.put("epoch", epoch);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void downloadFinish(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        if (files == null) { call.resolve(epochResult(epoch)); return; }
        // Cleanup remains valid after sign-out; the native UUID map binds this exact file
        // to the original account, scope and epoch, so stale callers cannot choose a path.
        transferQueue.execute(() -> {
            files.finishDownload(uid, session.scope(), epoch, id);
            call.resolve(epochResult(epoch));
        });
    }

    @PluginMethod
    public void discard(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        String id = call.getString("id", "");
        if (!validAccountRequest(call, uid, epoch) || !id.matches(UUID_PATTERN)) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        enqueue(call, uid, epoch, () -> {
            files.discard(uid, session.scope(), id);
            call.resolve(epochResult(epoch));
        });
    }

    @PluginMethod
    public void retainStaged(PluginCall call) {
        String uid = call.getString("uid", "");
        Long epoch = safeLong(call, "epoch");
        JSONArray values = call.getData().optJSONArray("ids");
        if (!validAccountRequest(call, uid, epoch) || values == null || values.length() > 1024) {
            reject(call, "VAULT_INVALID_REQUEST");
            return;
        }
        Set<String> ids = new HashSet<>();
        for (int index = 0; index < values.length(); index++) {
            String id = values.optString(index, "");
            if (!id.matches(UUID_PATTERN) || !ids.add(id)) { reject(call, "VAULT_INVALID_REQUEST"); return; }
        }
        enqueue(call, uid, epoch, () -> {
            files.retain(uid, session.scope(), ids);
            call.resolve(epochResult(epoch));
        });
    }

    private void streamDownload(String uid, long epoch, String slot, PrivateVaultFileStore.DownloadFile download)
        throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            String token = session.tokenFor(uid, epoch, attempt > 0);
            HttpsURLConnection connection = null;
            try {
                connection = connection(route(slot), "GET", token);
                int status = connection.getResponseCode();
                if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
                if (status == 401 && attempt == 0) continue;
                if (status < 200 || status >= 300) throw new HttpException(status);
                if (!download.sha256.equals(connection.getHeaderField("X-Content-SHA256"))
                    || !download.generation.equals(connection.getHeaderField("X-Snapshot-Generation"))) {
                    throw new PrivateVaultFileStore.FileStoreException("DOWNLOAD_INVALID");
                }
                String lengthHeader = connection.getHeaderField("Content-Length");
                if (lengthHeader != null && (!lengthHeader.matches("0|[1-9][0-9]*")
                    || Long.parseLong(lengthHeader) != download.bytes)) {
                    throw new PrivateVaultFileStore.FileStoreException("DOWNLOAD_INVALID");
                }
                MessageDigest checksum = MessageDigest.getInstance("SHA-256");
                int total = 0;
                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(download.file, false)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        total += count;
                        if (total > download.bytes || total > PrivateVaultFileStore.MAX_BYTES) {
                            throw new PrivateVaultFileStore.FileStoreException("DOWNLOAD_INVALID");
                        }
                        output.write(buffer, 0, count);
                        checksum.update(buffer, 0, count);
                    }
                    output.getFD().sync();
                }
                if (total != download.bytes || !hex(checksum.digest()).equals(download.sha256)) {
                    throw new PrivateVaultFileStore.FileStoreException("DOWNLOAD_INVALID");
                }
                return;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        throw new HttpException(401);
    }

    private HttpResult request(String uid, long epoch, String method, String path,
        PrivateVaultFileStore.SealedFile body, String digest, int maximumResponse) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            String token = session.tokenFor(uid, epoch, attempt > 0);
            HttpsURLConnection connection = null;
            try {
                connection = connection(path, method, token);
                if (body != null) {
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    connection.setRequestProperty("X-Content-SHA256", digest);
                    connection.setDoOutput(true);
                    connection.setFixedLengthStreamingMode(body.bytes);
                    try (FileInputStream input = files.payloadStream(body);
                         OutputStream output = connection.getOutputStream()) {
                        copyAndVerify(input, output, body.bytes, digest);
                    }
                }
                int status = connection.getResponseCode();
                if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
                if (status == 401 && attempt == 0) continue;
                if (status < 200 || status >= 300) throw new HttpException(status);
                byte[] bytes = readBounded(connection.getInputStream(), maximumResponse);
                if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
                return new HttpResult(status, bytes);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        throw new HttpException(401);
    }

    private HttpsURLConnection connection(String path, String method, String token) throws Exception {
        URL url = new URL(NativeAccountSession.VAULT_ENDPOINT + path);
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        return connection;
    }

    private String route(String slot) {
        String scope = session.scope();
        String base;
        if ("library-v1".equals(scope)) base = "/library-v1/snapshots";
        else if (scope.matches("acceptance-v1/r00[1-4]")) base = "/" + scope + "/snapshots";
        else throw new IllegalStateException("Invalid private vault scope");
        return slot == null ? base : base + "/" + slot;
    }

    private void enqueue(PluginCall call, String uid, Long epoch, Work work) {
        if (files == null) { call.reject("Private vault storage is unavailable.", "VAULT_UNAVAILABLE"); return; }
        if (!session.isCurrent(uid, epoch)) { reject(call, "AUTH_CHANGED"); return; }
        transferQueue.execute(() -> {
            try {
                if (!session.isCurrent(uid, epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
                work.run();
            } catch (Exception error) {
                String code = errorCode(error);
                reject(call, code);
            }
        });
    }

    private boolean validAccountRequest(PluginCall call, String uid, Long epoch) {
        if (!session.isConfigured()) { call.reject("Native account configuration is unavailable.", "AUTH_NOT_CONFIGURED"); return false; }
        if (uid == null || !uid.matches("[A-Za-z0-9:_-]{1,256}") || epoch == null || epoch < 0) return false;
        return true;
    }

    private static boolean validSlot(String slot) {
        if (slot == null || !slot.matches("[0-9]{5}")) return false;
        try { return Integer.parseInt(slot) <= 511 && String.format(Locale.ROOT, "%05d", Integer.parseInt(slot)).equals(slot); }
        catch (NumberFormatException error) { return false; }
    }

    private static Integer safeInt(PluginCall call, String key) {
        try { return call.getInt(key); } catch (Exception ignored) { return null; }
    }

    private static Long safeLong(PluginCall call, String key) {
        try {
            Object raw = call.getData().get(key);
            if (!(raw instanceof Number)) return null;
            double value = ((Number) raw).doubleValue();
            long result = ((Number) raw).longValue();
            return Double.isFinite(value) && value == result ? result : null;
        } catch (Exception ignored) { return null; }
    }

    private static JSObject epochResult(long epoch) {
        JSObject result = new JSObject();
        result.put("epoch", epoch);
        return result;
    }

    private static void reject(PluginCall call, String code) {
        String message;
        switch (code) {
            case "AUTH_NOT_CONFIGURED": message = "Native account configuration is unavailable."; break;
            case "AUTH_CHANGED": message = "The account changed during the vault operation."; break;
            case "AUTH_REQUIRED": message = "Sign in to use the private vault."; break;
            case "ACCOUNT_NOT_ADMITTED": case "VAULT_HTTP_403": message = "This account is not admitted to the private vault."; break;
            case "VAULT_HTTP_404": message = "The requested vault snapshot was not found."; break;
            case "VAULT_HTTP_409": message = "The vault slot already contains a different snapshot."; break;
            case "STAGING_MISSING": message = "The staged backup is no longer available."; break;
            case "STAGING_CORRUPT": case "DOWNLOAD_INVALID": message = "Native vault file verification failed."; break;
            case "VAULT_INVALID_REQUEST": case "STAGING_INVALID": case "DOWNLOAD_MISSING": message = "The vault request is invalid."; break;
            case "AUTH_REFRESH_FAILED": message = "Native account refresh failed."; break;
            case "NETWORK_UNAVAILABLE": case "OFFLINE": message = "The private vault is unavailable offline."; break;
            default: message = "The private vault is temporarily unavailable."; break;
        }
        call.reject(message, code);
    }

    private static String errorCode(Exception error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause instanceof NativeAccountSession.SessionException) return ((NativeAccountSession.SessionException) cause).code;
            if (cause instanceof PrivateVaultFileStore.FileStoreException) return ((PrivateVaultFileStore.FileStoreException) cause).code;
            if (cause instanceof HttpException) return "VAULT_HTTP_" + ((HttpException) cause).status;
            cause = cause.getCause();
        }
        if (error instanceof UnknownHostException || error instanceof ConnectException || error instanceof SocketTimeoutException) return "NETWORK_UNAVAILABLE";
        if (error instanceof java.io.IOException) return "NETWORK_UNAVAILABLE";
        return "VAULT_UNAVAILABLE";
    }

    private static byte[] readBounded(InputStream input, int maximum) throws Exception {
        try (InputStream source = input) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int count;
            while ((count = source.read(buffer)) != -1) {
                if (output.size() + count > maximum) throw new PrivateVaultFileStore.FileStoreException("VAULT_RESPONSE_INVALID");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static void copyAndVerify(InputStream input, OutputStream output, int size, String expectedDigest) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] buffer = new byte[8192];
        int remaining = size;
        while (remaining > 0) {
            int count = input.read(buffer, 0, Math.min(buffer.length, remaining));
            if (count < 0) throw new PrivateVaultFileStore.FileStoreException("STAGING_CORRUPT");
            output.write(buffer, 0, count);
            digest.update(buffer, 0, count);
            remaining -= count;
        }
        if (input.read() != -1 || !hex(digest.digest()).equals(expectedDigest)) {
            throw new PrivateVaultFileStore.FileStoreException("STAGING_CORRUPT");
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }

    private interface Work { void run() throws Exception; }

    private static final class HttpResult {
        final int status;
        final byte[] body;
        HttpResult(int status, byte[] body) { this.status = status; this.body = body; }
    }

    private static final class HttpException extends Exception {
        final int status;
        HttpException(int status) { super("HTTP " + status); this.status = status; }
    }
}
