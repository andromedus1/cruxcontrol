package io.github.andromedus1.cruxcontrol.prototype;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public final class VaultTransferDeadlineTest {
    @Test(timeout = 3_000)
    public void expiryCancelsBlockedWriteAndClearsWorkerInterruptBeforeReuse() throws Exception {
        ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();
        ExecutorService transfers = Executors.newSingleThreadExecutor();
        CountDownLatch writeBlocked = new CountDownLatch(1);
        CountDownLatch disconnected = new CountDownLatch(1);
        AtomicReference<Throwable> observed = new AtomicReference<>();
        try {
            Future<Boolean> first = transfers.submit(() -> {
                VaultTransferDeadline deadline = new VaultTransferDeadline(watchdog, 40, TimeUnit.MILLISECONDS);
                try {
                    // This callback models HttpsURLConnection.disconnect() releasing a socket write.
                    deadline.attach(disconnected::countDown);
                    writeBlocked.countDown();
                    disconnected.await();
                    deadline.check();
                } catch (VaultTransferDeadline.DeadlineExceededException expected) {
                    observed.set(expected);
                } catch (InterruptedException interrupted) {
                    try { deadline.check(); }
                    catch (VaultTransferDeadline.DeadlineExceededException expected) { observed.set(expected); }
                } finally {
                    deadline.close();
                }
                return Thread.currentThread().isInterrupted();
            });

            assertTrue(writeBlocked.await(1, TimeUnit.SECONDS));
            assertFalse("the active transfer must be released by connection cancellation", first.get(2, TimeUnit.SECONDS));
            assertTrue(disconnected.await(1, TimeUnit.SECONDS));
            assertNotNull(observed.get());

            Future<Boolean> next = transfers.submit(() -> Thread.currentThread().isInterrupted());
            assertFalse("an expired watchdog must not poison the next queued transfer", next.get(1, TimeUnit.SECONDS));
        } finally {
            transfers.shutdownNow();
            watchdog.shutdownNow();
        }
    }

    @Test(timeout = 2_000)
    public void closingSuccessfulTransferDisarmsLateWatchdog() throws Exception {
        ScheduledExecutorService watchdog = Executors.newSingleThreadScheduledExecutor();
        ExecutorService transfers = Executors.newSingleThreadExecutor();
        try {
            Future<Boolean> first = transfers.submit(() -> {
                try (VaultTransferDeadline ignored = new VaultTransferDeadline(watchdog, 40, TimeUnit.MILLISECONDS)) {
                    // Successful response completes before the deadline.
                }
                Thread.sleep(90);
                return Thread.currentThread().isInterrupted();
            });
            assertFalse("closed deadlines must not interrupt completed work", first.get(1, TimeUnit.SECONDS));
            assertFalse(transfers.submit(() -> Thread.currentThread().isInterrupted()).get(1, TimeUnit.SECONDS));
        } finally {
            transfers.shutdownNow();
            watchdog.shutdownNow();
        }
    }
}
