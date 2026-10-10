package io.github.andromedus1.cruxcontrol.prototype;

import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "LibraryBackupFile")
public class LibraryBackupFilePlugin extends Plugin {

    private boolean isSaving = false;
    private String pendingText;

    @PluginMethod
    public void save(PluginCall call) {
        if (isSaving) {
            call.reject("A library backup save is already in progress");
            return;
        }

        String filename = call.getString("filename");
        String text = call.getString("text");
        if (!isJsonBasename(filename) || text == null) {
            call.reject("A valid JSON filename and backup text are required");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        isSaving = true;
        pendingText = text;
        // Capacitor persists PluginCall data for activity results. Keep large
        // backup contents only in this plugin's short-lived in-memory buffer.
        call.getData().remove("text");
        try {
            startActivityForResult(call, intent, "saveFileResult");
        } catch (Exception ignored) {
            clearPendingSave();
            call.reject("Unable to open the Android file picker", "FILE_PICKER_FAILED");
        }
    }

    @ActivityCallback
    private void saveFileResult(@Nullable PluginCall call, ActivityResult result) {
        if (call == null) {
            // Capacitor can lack a restored call after process recreation. No
            // callback is available to reject, so discard the buffer safely.
            execute(this::clearPendingSave);
            return;
        }

        int resultCode = result.getResultCode();
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        // On pinned Capacitor Android 8.4.3 / AndroidX Activity 1.11.0,
        // ActivityResult callbacks run on the main thread. Provider I/O belongs
        // on Capacitor's dedicated plugin HandlerThread instead.
        execute(() -> finishSaveFile(call, resultCode, uri));
    }

    private void finishSaveFile(PluginCall call, int resultCode, Uri uri) {
        if (resultCode != android.app.Activity.RESULT_OK) {
            clearPendingSave();
            call.reject("Save canceled", "FILE_SAVE_CANCELED");
            return;
        }

        try {
            String text = pendingText;
            if (text == null) {
                call.reject("Backup contents were lost while the picker was open. No file was written; retry the backup.", "FILE_SAVE_INTERRUPTED");
                return;
            }
            if (uri == null || !ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) {
                call.reject("The Android file picker returned an invalid destination", "FILE_SAVE_FAILED");
                return;
            }

            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("The destination did not provide a writable stream");
                output.write(text.getBytes(StandardCharsets.UTF_8));
                output.flush();
            }

            JSObject response = new JSObject();
            response.put("uri", uri.toString());
            call.resolve(response);
        } catch (Exception ignored) {
            // Provider exceptions may contain user-selected paths or URIs.
            call.reject("Unable to write the library backup to the chosen destination", "FILE_SAVE_FAILED");
        } finally {
            clearPendingSave();
        }
    }

    private boolean isJsonBasename(String filename) {
        return filename != null
            && !filename.isEmpty()
            && !".".equals(filename)
            && !"..".equals(filename)
            && filename.endsWith(".json")
            && filename.indexOf('/') < 0
            && filename.indexOf('\\') < 0;
    }

    private void clearPendingSave() {
        pendingText = null;
        isSaving = false;
    }
}
