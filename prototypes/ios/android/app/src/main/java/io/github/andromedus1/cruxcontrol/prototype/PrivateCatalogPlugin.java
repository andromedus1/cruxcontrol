package io.github.andromedus1.cruxcontrol.prototype;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;

/**
 * Signed-in catalog update transport. The Firebase token stays native: this plugin fetches the
 * private manifest and artifact, verifies them into app-private storage, and the WebView reads
 * them back through same-origin /catalog/private/ paths served by CatalogAssetWebViewClient.
 * Bounded error codes: AUTH_REQUIRED, NOT_ADMITTED, NETWORK, INTEGRITY, UNAVAILABLE.
 */
@CapacitorPlugin(name = "PrivateCatalog")
public final class PrivateCatalogPlugin extends Plugin {
    static final String CATALOG_ENDPOINT =
        "https://us-central1-cruxcontrol-auth-20261010.cloudfunctions.net/privateCatalog";
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 60_000;
    private static final long TRANSFER_TIMEOUT_MS = 180_000;

    private NativeAccountSession session;
    private PrivateCatalogFiles files;
    private ExecutorService transferQueue;
    private ScheduledThreadPoolExecutor deadlineQueue;
    private volatile VaultTransferDeadline activeDeadline;

    static File catalogRoot(android.content.Context context) {
        return new File(context.getNoBackupFilesDir(), "catalog");
    }

    @Override
    public void load() {
        session = NativeAccountSession.get(getContext());
        transferQueue = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "crux-private-catalog-transfer");
            thread.setDaemon(true);
            return thread;
        });
        deadlineQueue = new ScheduledThreadPoolExecutor(1, runnable -> {
            Thread thread = new Thread(runnable, "crux-private-catalog-deadline");
            thread.setDaemon(true);
            return thread;
        });
        deadlineQueue.setRemoveOnCancelPolicy(true);
        try {
            files = PrivateCatalogFiles.shared(catalogRoot(getContext()));
            transferQueue.execute(() -> {
                try { files.cleanupInterrupted(); } catch (RuntimeException ignored) { }
            });
        } catch (RuntimeException ignored) {
            files = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        VaultTransferDeadline deadline = activeDeadline;
        if (deadline != null) deadline.cancel();
        if (transferQueue != null) transferQueue.shutdownNow();
        if (deadlineQueue != null) deadlineQueue.shutdownNow();
        super.handleOnDestroy();
    }

    /** Account state only; never contacts the endpoint. */
    @PluginMethod
    public void status(PluginCall call) {
        if (!enabled()) { call.resolve(status("unconfigured")); return; }
        call.resolve(status(currentAccount() == null ? "signed-out" : "signed-in"));
    }

    @PluginMethod
    public void check(PluginCall call) {
        if (!enabled()) { call.resolve(status("unconfigured")); return; }
        Account account = currentAccount();
        if (account == null) { call.resolve(status("signed-out")); return; }
        enqueue(call, account, () -> {
            HttpResult response = boundedTransfer(deadline -> manifestRequest(account, deadline));
            if (response == null) { call.resolve(status("none")); return; }
            PrivateCatalogFiles.Manifest manifest;
            // Session check and staging happen under the session lock that sign-out takes.
            synchronized (session) {
                requireCurrent(account);
                manifest = files.stageManifest(response.body);
            }
            JSObject result = status("available");
            result.put("version", manifest.version);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        Integer version;
        try { version = call.getInt("version"); } catch (Exception ignored) { version = null; }
        if (version == null || version < 1 || version > PrivateCatalogFiles.MAX_VERSION) {
            call.reject("The catalog request is invalid.", "UNAVAILABLE");
            return;
        }
        if (!enabled()) { reject(call, "UNAVAILABLE"); return; }
        Account account = currentAccount();
        if (account == null) { reject(call, "AUTH_REQUIRED"); return; }
        int requested = version;
        enqueue(call, account, () -> {
            PrivateCatalogFiles.Manifest manifest = files.stagedManifest();
            // Only the version the last check staged (and the web displayed) can be prepared.
            if (manifest == null || manifest.version != requested) {
                throw new PrivateCatalogFiles.CatalogException("UNAVAILABLE");
            }
            if (!files.hasPreparedArtifact(manifest)) {
                File temporary = files.createArtifactTemp();
                try {
                    boundedTransfer(deadline -> {
                        downloadArtifact(account, manifest, temporary, deadline);
                        return null;
                    });
                    // Verification runs first; the final session check and the rename then run under
                    // the session lock that sign-out takes, so an invalidated session never publishes.
                    files.commitArtifact(temporary, manifest, publication -> {
                        synchronized (session) {
                            requireCurrent(account);
                            publication.run();
                        }
                    });
                } finally {
                    if (temporary.exists()) temporary.delete();
                }
            }
            // A reused, already-verified artifact still requires the requesting session.
            synchronized (session) { requireCurrent(account); }
            JSObject result = new JSObject();
            result.put("version", manifest.version);
            call.resolve(result);
        });
    }

    private boolean enabled() {
        return files != null && PrivateCatalogFiles.catalogEnabled(session.isConfigured(), session.scope());
    }

    private Account currentAccount() {
        FirebaseAuth auth = session.auth();
        if (auth == null) return null;
        long epoch = session.epoch();
        FirebaseUser user = auth.getCurrentUser();
        return user == null ? null : new Account(user.getUid(), epoch);
    }

    private void requireCurrent(Account account) throws NativeAccountSession.SessionException {
        if (!session.isCurrent(account.uid, account.epoch)) throw new NativeAccountSession.SessionException("AUTH_CHANGED");
    }

    /** Returns the manifest body, or null when the endpoint has no published catalog (404). */
    private HttpResult manifestRequest(Account account, VaultTransferDeadline deadline) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            deadline.check();
            String token = session.tokenFor(account.uid, account.epoch, attempt > 0);
            HttpsURLConnection connection = null;
            try {
                connection = connection("/catalog-v1/manifest", "application/json", token, deadline);
                int status;
                try { status = connection.getResponseCode(); }
                catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("NETWORK", error); }
                requireCurrent(account);
                if (status == 401 && attempt == 0) continue;
                if (status == 404) return null;
                if (status < 200 || status >= 300) {
                    throw new PrivateCatalogFiles.CatalogException(PrivateCatalogFiles.errorForStatus(status));
                }
                InputStream input;
                try { input = connection.getInputStream(); }
                catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("NETWORK", error); }
                byte[] body = readBounded(input, PrivateCatalogFiles.MAX_MANIFEST_BYTES);
                requireCurrent(account);
                return new HttpResult(body);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        throw new PrivateCatalogFiles.CatalogException("AUTH_REQUIRED");
    }

    private void downloadArtifact(Account account, PrivateCatalogFiles.Manifest manifest, File temporary,
        VaultTransferDeadline deadline) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            deadline.check();
            String token = session.tokenFor(account.uid, account.epoch, attempt > 0);
            HttpsURLConnection connection = null;
            try {
                connection = connection("/catalog-v1/artifacts/" + manifest.file, "application/gzip", token, deadline);
                int status;
                try { status = connection.getResponseCode(); }
                catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("NETWORK", error); }
                requireCurrent(account);
                if (status == 401 && attempt == 0) continue;
                if (status < 200 || status >= 300) {
                    throw new PrivateCatalogFiles.CatalogException(PrivateCatalogFiles.errorForStatus(status));
                }
                PrivateCatalogFiles.checkArtifactHeaders(manifest,
                    connection.getHeaderField("Content-Length"), connection.getHeaderField("X-Catalog-SHA256"));
                InputStream network;
                try { network = connection.getInputStream(); }
                catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("NETWORK", error); }
                try (InputStream input = network) {
                    FileOutputStream fileOutput;
                    try { fileOutput = new FileOutputStream(temporary, false); }
                    catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("UNAVAILABLE", error); }
                    try (FileOutputStream output = fileOutput) {
                        PrivateCatalogFiles.copyVerified(input, output, manifest);
                        output.getFD().sync();
                    } catch (IOException error) {
                        // copyVerified tags its own read/write failures; this is local sync/close.
                        throw new PrivateCatalogFiles.CatalogException("UNAVAILABLE", error);
                    }
                } catch (IOException error) {
                    throw new PrivateCatalogFiles.CatalogException("NETWORK", error);
                }
                return;
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        throw new PrivateCatalogFiles.CatalogException("AUTH_REQUIRED");
    }

    private HttpsURLConnection connection(String path, String accept, String token, VaultTransferDeadline deadline)
        throws Exception {
        URL url = new URL(CATALOG_ENDPOINT + path);
        HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setUseCaches(false);
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setRequestMethod("GET");
        connection.setRequestProperty("Authorization", "Bearer " + token);
        connection.setRequestProperty("Accept", accept);
        // Exact bytes only: no transparent decompression between the hash and the file.
        connection.setRequestProperty("Accept-Encoding", "identity");
        connection.setRequestProperty("Cache-Control", "no-store");
        deadline.attach(connection::disconnect);
        deadline.check();
        return connection;
    }

    private <T> T boundedTransfer(TransferWork<T> work) throws Exception {
        if (deadlineQueue == null || deadlineQueue.isShutdown()) throw new IllegalStateException("Deadline unavailable");
        VaultTransferDeadline deadline = new VaultTransferDeadline(deadlineQueue, TRANSFER_TIMEOUT_MS, TimeUnit.MILLISECONDS);
        activeDeadline = deadline;
        try {
            T value = work.run(deadline);
            deadline.check();
            return value;
        } catch (Exception error) {
            if (deadline.isExpired()) throw new VaultTransferDeadline.DeadlineExceededException();
            throw error;
        } finally {
            deadline.close();
            if (activeDeadline == deadline) activeDeadline = null;
        }
    }

    private void enqueue(PluginCall call, Account account, Work work) {
        if (files == null) { reject(call, "UNAVAILABLE"); return; }
        try {
            transferQueue.execute(() -> {
                try {
                    requireCurrent(account);
                    work.run();
                } catch (Exception error) {
                    reject(call, errorCode(error));
                }
            });
        } catch (RuntimeException rejected) {
            reject(call, "UNAVAILABLE");
        }
    }

    static String errorCode(Exception error) {
        Throwable cause = error;
        while (cause != null) {
            if (cause instanceof PrivateCatalogFiles.CatalogException) return ((PrivateCatalogFiles.CatalogException) cause).code;
            if (cause instanceof NativeAccountSession.SessionException) {
                return "AUTH_CHANGED".equals(((NativeAccountSession.SessionException) cause).code) ? "AUTH_REQUIRED" : "UNAVAILABLE";
            }
            if (cause instanceof VaultTransferDeadline.DeadlineExceededException) return "NETWORK";
            cause = cause.getCause();
        }
        return "UNAVAILABLE";
    }

    private static void reject(PluginCall call, String code) {
        String message;
        switch (code) {
            case "AUTH_REQUIRED": message = "Sign in to get catalog updates."; break;
            case "NOT_ADMITTED": message = "This account cannot receive catalog updates."; break;
            case "NETWORK": message = "The catalog service could not be reached."; break;
            case "INTEGRITY": message = "The downloaded catalog did not match its manifest."; break;
            default: message = "Catalog updates are temporarily unavailable."; break;
        }
        call.reject(message, code);
    }

    private static JSObject status(String value) {
        JSObject result = new JSObject();
        result.put("status", value);
        return result;
    }

    private static byte[] readBounded(InputStream input, int maximum) throws Exception {
        try (InputStream source = input) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while (true) {
                try { count = source.read(buffer); }
                catch (IOException error) { throw new PrivateCatalogFiles.CatalogException("NETWORK", error); }
                if (count == -1) break;
                if (output.size() + count > maximum) throw new PrivateCatalogFiles.CatalogException("INTEGRITY");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private interface Work { void run() throws Exception; }
    private interface TransferWork<T> { T run(VaultTransferDeadline deadline) throws Exception; }

    private static final class Account {
        final String uid;
        final long epoch;
        Account(String uid, long epoch) { this.uid = uid; this.epoch = epoch; }
    }

    private static final class HttpResult {
        final byte[] body;
        HttpResult(byte[] body) { this.body = body; }
    }
}
