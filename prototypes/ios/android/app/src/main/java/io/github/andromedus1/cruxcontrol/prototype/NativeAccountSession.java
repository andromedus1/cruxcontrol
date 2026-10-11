package io.github.andromedus1.cruxcontrol.prototype;

import android.app.Activity;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GetTokenResult;
import com.google.firebase.auth.GoogleAuthProvider;
import com.google.android.gms.tasks.Task;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

/** One Firebase account/session boundary shared by the application vault and legacy proof. */
public final class NativeAccountSession {
    static final long TOKEN_ACQUISITION_TIMEOUT_MS = 30_000;
    public static final String PROJECT_ID = "cruxcontrol-auth-20261010";
    public static final String APP_ID = "1:839726977905:android:d266860e8e4d6b67a45cd0";
    public static final String VAULT_ENDPOINT =
        "https://us-central1-cruxcontrol-auth-20261010.cloudfunctions.net/privateVaultProof";

    private static volatile NativeAccountSession shared;

    public static NativeAccountSession get(Context context) {
        NativeAccountSession current = shared;
        if (current != null) return current;
        synchronized (NativeAccountSession.class) {
            if (shared == null) shared = new NativeAccountSession(context.getApplicationContext());
            return shared;
        }
    }

    private final Context context;
    private final Executor mainExecutor;
    private final AtomicBoolean accountBusy = new AtomicBoolean(false);
    private final AtomicInteger signOutsPending = new AtomicInteger(0);
    private FirebaseAuth auth;
    private CredentialManager credentials;
    private String webClientId;
    private String scope = "library-v1";
    private boolean configured;
    private long epoch;
    private long operationGeneration;
    private String observedUid;

    private NativeAccountSession(Context context) {
        this.context = context;
        this.mainExecutor = ContextCompat.getMainExecutor(context);
        initialize();
    }

    private void initialize() {
        try {
            JSONObject config;
            try (InputStream stream = context.getAssets().open("vault-config.json")) {
                config = new JSONObject(readBounded(stream, 16 * 1024));
            } catch (Exception missingVaultConfig) {
                // Keep the isolated legacy feasibility activity usable with its previous asset.
                try (InputStream stream = context.getAssets().open("auth-proof-config.json")) {
                    config = new JSONObject(readBounded(stream, 16 * 1024));
                    config.put("scope", "acceptance-v1/r001");
                }
            }
            String projectId = config.getString("projectId");
            String appId = config.getString("appId");
            String apiKey = config.getString("apiKey");
            webClientId = config.getString("webClientId");
            String configuredScope = config.optString("scope", "");
            if (!PROJECT_ID.equals(projectId)
                || !APP_ID.equals(appId)
                || !apiKey.matches("AIza[0-9A-Za-z_-]{35}")
                || !webClientId.matches("839726977905-[A-Za-z0-9]+\\.apps\\.googleusercontent\\.com")
                || !validScope(configuredScope,
                    BuildConfig.DEBUG,
                    BuildConfig.BUILD_TYPE,
                    (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0)) return;

            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApiKey(apiKey)
                .setApplicationId(appId)
                .setProjectId(projectId)
                .build();
            FirebaseApp app = FirebaseApp.getApps(context).isEmpty()
                ? FirebaseApp.initializeApp(context, options)
                : FirebaseApp.getInstance();
            if (!projectId.equals(app.getOptions().getProjectId())
                || !appId.equals(app.getOptions().getApplicationId())) return;
            auth = FirebaseAuth.getInstance(app);
            credentials = CredentialManager.create(context);
            scope = configuredScope;
            observedUid = auth.getCurrentUser() == null ? null : auth.getCurrentUser().getUid();
            auth.addAuthStateListener(firebaseAuth -> observeUser(firebaseAuth.getCurrentUser()));
            configured = true;
        } catch (Exception ignored) {
            // A missing or invalid public asset leaves native auth unavailable, not app startup.
            auth = null;
            credentials = null;
            configured = false;
        }
    }

    static boolean validScope(String value, boolean buildDebug, String buildType, boolean manifestDebuggable) {
        if ("library-v1".equals(value)) {
            return !buildDebug && "release".equals(buildType) && !manifestDebuggable;
        }
        return value != null && value.matches("acceptance-v1/r00[1-4]")
            && buildDebug && "signedProof".equals(buildType) && manifestDebuggable;
    }

    private static String readBounded(InputStream stream, int maximum) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int count;
        while ((count = stream.read(buffer)) != -1) {
            if (bytes.size() + count > maximum) throw new IllegalStateException("Configuration too large");
            bytes.write(buffer, 0, count);
        }
        return bytes.toString(StandardCharsets.UTF_8);
    }

    public boolean isConfigured() { return configured; }

    public String scope() { return scope; }

    public FirebaseAuth auth() { return auth; }

    public Executor mainExecutor() { return mainExecutor; }

    public boolean requireConfigured(PluginCall call) {
        if (configured && auth != null && credentials != null) return true;
        call.reject("Native account configuration is unavailable.", "AUTH_NOT_CONFIGURED");
        return false;
    }

    public synchronized long epoch() {
        synchronizeUser();
        return epoch;
    }

    private synchronized void synchronizeUser() {
        if (auth == null) return;
        FirebaseUser user = auth.getCurrentUser();
        observeUserLocked(user == null ? null : user.getUid());
    }

    private void observeUser(FirebaseUser user) {
        synchronized (this) {
            observeUserLocked(user == null ? null : user.getUid());
        }
    }

    private void observeUserLocked(String uid) {
        if (observedUid == null ? uid != null : !observedUid.equals(uid)) {
            observedUid = uid;
            epoch += 1;
        }
    }

    public synchronized boolean isCurrent(String expectedUid, long expectedEpoch) {
        synchronizeUser();
        FirebaseUser user = auth == null ? null : auth.getCurrentUser();
        return configured && expectedEpoch == epoch && user != null && user.getUid().equals(expectedUid);
    }

    private synchronized long invalidateForAccountOperation() {
        operationGeneration += 1;
        epoch += 1;
        if (auth != null) {
            FirebaseUser user = auth.getCurrentUser();
            observedUid = user == null ? null : user.getUid();
        }
        return operationGeneration;
    }

    private synchronized boolean ticketCurrent(long ticket) {
        synchronizeUser();
        return operationGeneration == ticket;
    }

    private synchronized void recordSuccessfulSignIn(FirebaseUser user) {
        observeUserLocked(user == null ? null : user.getUid());
    }

    public JSObject accountStatus() {
        synchronizeUser();
        JSObject result = new JSObject();
        result.put("configured", configured);
        FirebaseUser user = auth == null ? null : auth.getCurrentUser();
        result.put("account", accountObject(user));
        result.put("epoch", epoch);
        return result;
    }

    public JSObject proofStatus() {
        synchronizeUser();
        FirebaseUser user = auth == null ? null : auth.getCurrentUser();
        JSObject result = new JSObject();
        result.put("signedIn", user != null);
        if (user != null) {
            result.put("uid", user.getUid());
            result.put("email", user.getEmail());
        }
        return result;
    }

    public JSObject vaultStatus(String installationId) {
        JSObject result = new JSObject();
        result.put("configured", configured);
        result.put("installationId", installationId);
        result.put("scope", scope);
        result.put("account", accountObject(auth == null ? null : auth.getCurrentUser()));
        result.put("epoch", epoch());
        return result;
    }

    private static Object accountObject(FirebaseUser user) {
        if (user == null) return JSONObject.NULL;
        JSObject account = new JSObject();
        account.put("uid", user.getUid());
        account.put("email", user.getEmail());
        return account;
    }

    public void signIn(PluginCall call, Activity activity, boolean proofResponse) {
        if (!requireConfigured(call)) return;
        if (signOutsPending.get() > 0 || !accountBusy.compareAndSet(false, true)) {
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        if (signOutsPending.get() > 0) {
            accountBusy.set(false);
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        long ticket = invalidateForAccountOperation();
        String selectedWebClient = webClientId;
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(selectedWebClient).build())
            .build();
        if (activity == null) {
            accountBusy.set(false);
            call.reject("Authentication activity is unavailable.", "AUTH_PROVIDER_FAILED");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                credentials.getCredentialAsync(activity, request, new CancellationSignal(), mainExecutor,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    try {
                        if (!ticketCurrent(ticket)) {
                            accountBusy.set(false);
                            auth.signOut();
                            call.reject("The account operation was superseded.", "AUTH_CHANGED");
                            return;
                        }
                        Credential credential = response.getCredential();
                        if (!(credential instanceof CustomCredential)
                            || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            accountBusy.set(false);
                            call.reject("The identity provider returned an unexpected credential.", "AUTH_UNEXPECTED_CREDENTIAL");
                            return;
                        }
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                        auth.signInWithCredential(GoogleAuthProvider.getCredential(google.getIdToken(), null))
                            .addOnCompleteListener(mainExecutor, task -> {
                                accountBusy.set(false);
                                if (!ticketCurrent(ticket)) {
                                    auth.signOut();
                                    call.reject("The account operation was superseded.", "AUTH_CHANGED");
                                    return;
                                }
                                if (!task.isSuccessful()) {
                                    call.reject("Native sign-in failed.", "AUTH_SIGN_IN_FAILED");
                                    return;
                                }
                                recordSuccessfulSignIn(auth.getCurrentUser());
                                call.resolve(proofResponse ? proofStatus() : accountStatus());
                            });
                    } catch (Exception exception) {
                        accountBusy.set(false);
                        call.reject("The identity provider response could not be used.", ticketCurrent(ticket)
                            ? "AUTH_CREDENTIAL_FAILED" : "AUTH_CHANGED");
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException exception) {
                    accountBusy.set(false);
                    call.reject("Native sign-in did not complete.", !ticketCurrent(ticket) ? "AUTH_CHANGED"
                        : exception instanceof GetCredentialCancellationException ? "AUTH_CANCELED" : "AUTH_PROVIDER_FAILED");
                }
                });
            } catch (Exception exception) {
                accountBusy.set(false);
                call.reject("Native sign-in could not start.", ticketCurrent(ticket) ? "AUTH_PROVIDER_FAILED" : "AUTH_CHANGED");
            }
        });
    }

    public void verifySession(PluginCall call) {
        if (!requireConfigured(call)) return;
        FirebaseUser user = auth.getCurrentUser();
        long expectedEpoch = epoch();
        if (user == null) {
            call.reject("Sign in before verifying the session.", "AUTH_REQUIRED");
            return;
        }
        if (!accountBusy.compareAndSet(false, true)) {
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        String uid = user.getUid();
        user.getIdToken(true).addOnCompleteListener(mainExecutor, task -> {
            accountBusy.set(false);
            if (!isCurrent(uid, expectedEpoch)) {
                call.reject("The account changed during verification.", "AUTH_CHANGED");
                return;
            }
            if (!task.isSuccessful()) {
                call.reject("Native session refresh failed.", "AUTH_REFRESH_FAILED");
                return;
            }
            GetTokenResult token = task.getResult();
            JSObject result = proofStatus();
            result.put("issuedAt", token.getIssuedAtTimestamp());
            result.put("expiresAt", token.getExpirationTimestamp());
            result.put("authenticatedAt", token.getAuthTimestamp());
            call.resolve(result);
        });
    }

    public void signOut(PluginCall call, boolean proofResponse) {
        if (!requireConfigured(call)) return;
        signOutsPending.incrementAndGet();
        invalidateForAccountOperation();
        auth.signOut();
        credentials.clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(), mainExecutor,
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void ignored) {
                    signOutsPending.decrementAndGet();
                    call.resolve(proofResponse ? proofStatus() : accountStatus());
                }

                @Override
                public void onError(@NonNull ClearCredentialException exception) {
                    signOutsPending.decrementAndGet();
                    call.reject("Provider account selection could not be cleared.", "AUTH_PROVIDER_CLEAR_FAILED");
                }
            });
    }

    /** Called only from the dedicated private-vault transfer worker, never the UI thread. */
    public String tokenFor(String uid, long expectedEpoch, boolean forceRefresh) throws Exception {
        if (!isCurrent(uid, expectedEpoch)) throw new SessionException("AUTH_CHANGED");
        FirebaseUser user = auth.getCurrentUser();
        GetTokenResult result;
        try { result = awaitTokenTask(user.getIdToken(forceRefresh)); }
        catch (Exception error) {
            if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            if (!isCurrent(uid, expectedEpoch)) throw new SessionException("AUTH_CHANGED");
            throw new SessionException("AUTH_REFRESH_FAILED");
        }
        if (!isCurrent(uid, expectedEpoch)) throw new SessionException("AUTH_CHANGED");
        return result.getToken();
    }

    static <T> T awaitTokenTask(Task<T> task) throws Exception {
        return awaitTokenTask(task, TOKEN_ACQUISITION_TIMEOUT_MS);
    }

    static <T> T awaitTokenTask(Task<T> task, long timeoutMs) throws Exception {
        CountDownLatch completed = new CountDownLatch(1);
        AtomicReference<Task<T>> result = new AtomicReference<>();
        task.addOnCompleteListener(Runnable::run, completedTask -> {
            result.set(completedTask);
            completed.countDown();
        });
        if (!completed.await(timeoutMs, TimeUnit.MILLISECONDS)) throw new TimeoutException("Native token request timed out");
        Task<T> finished = result.get();
        if (finished.isSuccessful()) return finished.getResult();
        Exception failure = finished.getException();
        if (failure != null) throw failure;
        throw new java.util.concurrent.CancellationException("Native token request was cancelled");
    }

    static final class SessionException extends Exception {
        final String code;
        SessionException(String code) { super(code); this.code = code; }
    }
}
