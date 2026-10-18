package io.github.andromedus1.cruxcontrol.prototype;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.google.android.gms.tasks.TaskCompletionSource;
import java.io.IOException;
import java.net.SocketTimeoutException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.Test;

public final class PrivateVaultReviewBoundaryTest {
    @Test
    public void libraryPoolRequiresNonDebuggableReleaseAndAcceptanceIsSignedProofOnly() {
        assertTrue(NativeAccountSession.validScope("library-v1", false, "release", false));
        assertFalse(NativeAccountSession.validScope("library-v1", true, "debug", true));
        assertFalse(NativeAccountSession.validScope("library-v1", true, "signedProof", true));
        assertFalse(NativeAccountSession.validScope("library-v1", false, "release", true));

        for (String run : new String[] {"r001", "r002", "r003", "r004"}) {
            assertTrue(NativeAccountSession.validScope("acceptance-v1/" + run, true, "signedProof", true));
        }
        assertFalse(NativeAccountSession.validScope("acceptance-v1/r005", true, "signedProof", true));
        assertFalse(NativeAccountSession.validScope("acceptance-v1/r001", true, "debug", true));
        assertFalse(NativeAccountSession.validScope("acceptance-v1/r001", false, "release", false));
    }

    @Test(timeout = 1_000)
    public void pendingFirebaseTokenTaskTimesOut() throws Exception {
        TaskCompletionSource<String> pending = new TaskCompletionSource<>();
        long started = System.nanoTime();
        try {
            NativeAccountSession.awaitTokenTask(pending.getTask(), 30);
            fail("expected token wait timeout");
        } catch (TimeoutException expected) {
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            assertTrue("the configured wait must be finite", elapsedMs < 500);
        }
    }

    @Test
    public void localStorageIoDoesNotMapToOfflineButHttpIoDoes() {
        assertEquals("VAULT_UNAVAILABLE", PrivateVaultPlugin.errorCode(new IOException("disk full")));
        assertEquals("NETWORK_UNAVAILABLE",
            PrivateVaultPlugin.errorCode(new PrivateVaultPlugin.NetworkException(new SocketTimeoutException())));
        assertEquals("STAGING_MISSING",
            PrivateVaultPlugin.errorCode(new PrivateVaultFileStore.FileStoreException("STAGING_MISSING")));
    }
}
