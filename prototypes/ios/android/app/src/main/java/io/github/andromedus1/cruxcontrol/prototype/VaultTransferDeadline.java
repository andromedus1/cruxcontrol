package io.github.andromedus1.cruxcontrol.prototype;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/** Cancels the active socket and interrupts its worker when a whole-transfer deadline expires. */
final class VaultTransferDeadline implements AutoCloseable {
    private static final int ACTIVE = 0;
    private static final int EXPIRED = 1;
    private static final int CLOSED = 2;

    private final Object lock = new Object();
    private final Thread worker;
    private final ScheduledFuture<?> timeout;
    private int state = ACTIVE;
    private Runnable cancelActiveConnection;

    VaultTransferDeadline(ScheduledExecutorService scheduler, long duration, TimeUnit unit) {
        if (duration <= 0) throw new IllegalArgumentException("Deadline must be positive");
        worker = Thread.currentThread();
        timeout = scheduler.schedule(this::expire, duration, unit);
    }

    void attach(Runnable cancelConnection) {
        boolean expired;
        synchronized (lock) {
            if (state == CLOSED) throw new IllegalStateException("Transfer deadline is closed");
            cancelActiveConnection = cancelConnection;
            expired = state == EXPIRED;
        }
        if (expired) cancel(cancelConnection);
    }

    void cancel() { expire(); }

    void check() throws DeadlineExceededException {
        synchronized (lock) {
            if (state == EXPIRED) throw new DeadlineExceededException();
            if (state == CLOSED) throw new IllegalStateException("Transfer deadline is closed");
        }
    }

    boolean isExpired() {
        synchronized (lock) { return state == EXPIRED; }
    }

    private void expire() {
        Runnable cancelConnection;
        synchronized (lock) {
            if (state != ACTIVE) return;
            state = EXPIRED;
            cancelConnection = cancelActiveConnection;
        }
        cancel(cancelConnection);
        synchronized (lock) {
            // close() disarms the watchdog before the executor can reuse this worker.
            if (state == EXPIRED) worker.interrupt();
        }
    }

    private static void cancel(Runnable action) {
        if (action == null) return;
        try { action.run(); } catch (RuntimeException ignored) { }
    }

    @Override
    public void close() {
        synchronized (lock) {
            boolean expired = state == EXPIRED;
            state = CLOSED;
            timeout.cancel(false);
            cancelActiveConnection = null;
            if (expired && Thread.currentThread() == worker) Thread.interrupted();
        }
    }

    static final class DeadlineExceededException extends Exception {
        DeadlineExceededException() { super("Vault transfer deadline exceeded"); }
    }
}
