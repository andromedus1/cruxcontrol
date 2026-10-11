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
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

/** Legacy isolated storage proof; account/session behavior is shared with the production plugin. */
@CapacitorPlugin(name = "NativeAuthProof")
public final class NativeAuthProofPlugin extends Plugin {
    private NativeAccountSession session;
    private FirebaseAuth auth;
    private Executor mainExecutor;
    private final AtomicBoolean transferBusy = new AtomicBoolean(false);

    @Override
    public void load() {
        session = NativeAccountSession.get(getContext());
        auth = session.auth();
        mainExecutor = session.mainExecutor();
    }

    private boolean ready(PluginCall call) {
        return session != null && session.requireConfigured(call);
    }

    @PluginMethod
    public void status(PluginCall call) {
        if (ready(call)) call.resolve(session.proofStatus());
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        session.signIn(call, getActivity(), true);
    }

    @PluginMethod
    public void verifySession(PluginCall call) {
        session.verifySession(call);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        session.signOut(call, true);
    }

    /** Legacy synthetic storage proof only. Production uses PrivateVaultPlugin and its chunked adapter. */
    @PluginMethod
    public void vaultRequest(PluginCall call) {
        if (!ready(call)) return;
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            call.reject("Sign in before accessing the vault proof.", "AUTH_REQUIRED");
            return;
        }
        String uid = user.getUid();
        long expectedEpoch = session.epoch();
        String operation = call.getString("operation", "");
        String slot = call.getString("slot", "");
        boolean listing = operation.equals("list");
        boolean uploading = operation.equals("put");
        if ((!listing && !uploading && !operation.equals("get"))
            || (!listing && !slot.matches("([0-2][0-9]|3[01])"))) {
            call.reject("Invalid vault proof operation.", "VAULT_INVALID_REQUEST");
            return;
        }
        byte[] payload = uploading ? call.getString("text", "").getBytes(StandardCharsets.UTF_8) : null;
        if (uploading && (payload.length == 0 || payload.length > 25 * 1024 * 1024)) {
            call.reject("Invalid vault proof payload size.", "VAULT_INVALID_REQUEST");
            return;
        }
        if (!transferBusy.compareAndSet(false, true)) {
            call.reject("A vault proof transfer is already running.", "VAULT_BUSY");
            return;
        }
        user.getIdToken(false).addOnCompleteListener(mainExecutor, task -> {
            if (!task.isSuccessful()) { fail(call, "AUTH_REFRESH_FAILED"); return; }
            if (!session.isCurrent(uid, expectedEpoch)) { fail(call, "AUTH_CHANGED"); return; }
            new Thread(() -> performProofRequest(call, uid, expectedEpoch, task.getResult().getToken(),
                listing, uploading, slot, payload), "crux-vault-proof").start();
        });
    }

    private void performProofRequest(PluginCall call, String uid, long expectedEpoch, String token,
        boolean listing, boolean uploading, String slot, byte[] payload) {
        HttpsURLConnection connection = null;
        File download = null;
        boolean returnedDownload = false;
        try {
            if (!session.isCurrent(uid, expectedEpoch)) { fail(call, "AUTH_CHANGED"); return; }
            URL url = new URL(NativeAccountSession.VAULT_ENDPOINT + "/snapshots"
                + (listing ? "" : "/" + slot));
            connection = (HttpsURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(60_000);
            connection.setRequestMethod(uploading ? "PUT" : "GET");
            connection.setRequestProperty("Authorization", "Bearer " + token);
            if (uploading) {
                StringBuilder checksum = new StringBuilder();
                for (byte value : MessageDigest.getInstance("SHA-256").digest(payload)) {
                    checksum.append(String.format(Locale.ROOT, "%02x", value & 0xff));
                }
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("X-Content-SHA256", checksum.toString());
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(payload.length);
                try (java.io.OutputStream output = connection.getOutputStream()) { output.write(payload); }
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) { fail(call, "VAULT_HTTP_" + status); return; }
            JSObject result = new JSObject();
            result.put("httpStatus", status);
            if (!listing && !uploading) {
                // Preserve the legacy proof stream path; it does not handle app-vault files.
                download = File.createTempFile("crux-vault-proof-", ".json", getContext().getCacheDir());
                MessageDigest checksum = MessageDigest.getInstance("SHA-256");
                int size = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(download)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        size += count;
                        if (size > 25 * 1024 * 1024) throw new IllegalStateException("Oversized response");
                        output.write(buffer, 0, count);
                        checksum.update(buffer, 0, count);
                    }
                    output.getFD().sync();
                }
                if (!session.isCurrent(uid, expectedEpoch)) { fail(call, "AUTH_CHANGED"); return; }
                result.put("downloadFile", download.getName());
                result.put("byteLength", size);
                result.put("sha256", hex(checksum.digest()));
                transferBusy.set(false);
                call.resolve(result);
                returnedDownload = true;
                return;
            }
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > 25 * 1024 * 1024) throw new IllegalStateException("Oversized response");
                    bytes.write(buffer, 0, count);
                }
            }
            if (!session.isCurrent(uid, expectedEpoch)) { fail(call, "AUTH_CHANGED"); return; }
            result.put("responseText", bytes.toString(StandardCharsets.UTF_8));
            transferBusy.set(false);
            call.resolve(result);
        } catch (Exception ignored) {
            fail(call, "VAULT_REQUEST_FAILED");
        } finally {
            if (connection != null) connection.disconnect();
            if (download != null && !returnedDownload) download.delete();
        }
    }

    private void fail(PluginCall call, String code) {
        transferBusy.set(false);
        call.reject("Native vault proof operation failed.", code);
    }

    private static String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) value.append(String.format(Locale.ROOT, "%02x", item & 0xff));
        return value.toString();
    }
}
