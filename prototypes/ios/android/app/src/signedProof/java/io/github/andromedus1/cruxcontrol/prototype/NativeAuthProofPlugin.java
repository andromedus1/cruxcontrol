package io.github.andromedus1.cruxcontrol.prototype;

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
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.GoogleAuthProvider;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/** Native SDK feasibility only. Never returns or logs a credential or token. */
@CapacitorPlugin(name = "NativeAuthProof")
public class NativeAuthProofPlugin extends Plugin {
    private FirebaseAuth auth;
    private CredentialManager credentials;
    private Executor mainExecutor;
    private String webClientId;
    private final AtomicBoolean busy = new AtomicBoolean(false);

    @Override
    public void load() {
        try (InputStream stream = getContext().getAssets().open("auth-proof-config.json")) {
            JSONObject config = new JSONObject(new String(stream.readAllBytes(), StandardCharsets.UTF_8));
            webClientId = config.getString("webClientId");
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApiKey(config.getString("apiKey"))
                .setApplicationId(config.getString("appId"))
                .setProjectId(config.getString("projectId"))
                .build();
            FirebaseApp app = FirebaseApp.getApps(getContext()).isEmpty()
                ? FirebaseApp.initializeApp(getContext(), options)
                : FirebaseApp.getInstance();
            if (!options.getProjectId().equals(app.getOptions().getProjectId()) ||
                !options.getApplicationId().equals(app.getOptions().getApplicationId())) {
                throw new IllegalStateException("Authentication proof configuration mismatch");
            }
            auth = FirebaseAuth.getInstance(app);
            credentials = CredentialManager.create(getContext());
            mainExecutor = ContextCompat.getMainExecutor(getContext());
        } catch (Exception ignored) {
            auth = null;
        }
    }

    private boolean ready(PluginCall call) {
        if (auth != null) return true;
        call.reject("The native authentication proof has no valid configuration.", "AUTH_NOT_CONFIGURED");
        return false;
    }

    private JSObject describe(FirebaseUser user) {
        JSObject result = new JSObject();
        result.put("signedIn", user != null);
        if (user != null) {
            result.put("uid", user.getUid());
            result.put("email", user.getEmail());
        }
        return result;
    }

    private void fail(PluginCall call, String code, Exception cause) {
        busy.set(false);
        // SDK error identifiers are useful diagnostics; exception text may contain account data.
        String providerCode = cause instanceof FirebaseAuthException
            ? ((FirebaseAuthException) cause).getErrorCode() : null;
        call.reject(providerCode == null ? "Native authentication operation failed." : providerCode, code);
    }

    @PluginMethod
    public void status(PluginCall call) {
        if (ready(call)) call.resolve(describe(auth.getCurrentUser()));
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        if (!ready(call)) return;
        if (!busy.compareAndSet(false, true)) {
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(webClientId).build())
            .build();
        getActivity().runOnUiThread(() -> credentials.getCredentialAsync(
            getActivity(), request, new CancellationSignal(), mainExecutor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    try {
                        Credential credential = response.getCredential();
                        if (!(credential instanceof CustomCredential) ||
                            !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            fail(call, "AUTH_UNEXPECTED_CREDENTIAL", null);
                            return;
                        }
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                        auth.signInWithCredential(GoogleAuthProvider.getCredential(google.getIdToken(), null))
                            .addOnCompleteListener(mainExecutor, task -> {
                                if (!task.isSuccessful()) {
                                    fail(call, "AUTH_SIGN_IN_FAILED", task.getException());
                                    return;
                                }
                                busy.set(false);
                                call.resolve(describe(auth.getCurrentUser()));
                            });
                    } catch (Exception exception) {
                        fail(call, "AUTH_CREDENTIAL_FAILED", exception);
                    }
                }

                @Override
                public void onError(@NonNull GetCredentialException exception) {
                    fail(call, exception instanceof GetCredentialCancellationException
                        ? "AUTH_CANCELED" : "AUTH_PROVIDER_FAILED", exception);
                }
            }
        ));
    }

    @PluginMethod
    public void verifySession(PluginCall call) {
        if (!ready(call)) return;
        FirebaseUser user = auth.getCurrentUser();
        if (user == null) {
            call.reject("Sign in before verifying the session.", "AUTH_REQUIRED");
            return;
        }
        if (!busy.compareAndSet(false, true)) {
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        user.getIdToken(true).addOnCompleteListener(mainExecutor, task -> {
            if (!task.isSuccessful()) {
                fail(call, "AUTH_REFRESH_FAILED", task.getException());
                return;
            }
            FirebaseUser current = auth.getCurrentUser();
            if (current == null || !current.getUid().equals(user.getUid())) {
                busy.set(false);
                call.reject("The account changed during verification.", "AUTH_CHANGED");
                return;
            }
            JSObject result = describe(current);
            result.put("issuedAt", task.getResult().getIssuedAtTimestamp());
            result.put("expiresAt", task.getResult().getExpirationTimestamp());
            result.put("authenticatedAt", task.getResult().getAuthTimestamp());
            busy.set(false);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        if (!ready(call)) return;
        if (!busy.compareAndSet(false, true)) {
            call.reject("An account operation is already running.", "AUTH_BUSY");
            return;
        }
        auth.signOut();
        credentials.clearCredentialStateAsync(new ClearCredentialStateRequest(),
            new CancellationSignal(), mainExecutor,
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    busy.set(false);
                    call.resolve(describe(auth.getCurrentUser()));
                }

                @Override
                public void onError(@NonNull ClearCredentialException exception) {
                    fail(call, "AUTH_PROVIDER_CLEAR_FAILED", exception);
                }
            });
    }
}
