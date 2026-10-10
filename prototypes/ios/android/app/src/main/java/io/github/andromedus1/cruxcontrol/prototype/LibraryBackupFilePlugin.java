package io.github.andromedus1.cruxcontrol.prototype;

import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
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
        try {
            startActivityForResult(call, intent, "saveFileResult");
        } catch (Exception error) {
            clearPendingSave();
            call.reject("Unable to open the Android file picker", "FILE_PICKER_FAILED", error);
        }
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != android.app.Activity.RESULT_OK) {
            clearPendingSave();
            call.reject("Save canceled", "FILE_SAVE_CANCELED");
            return;
        }

        try {
            String text = pendingText;
            Intent data = result.getData();
            Uri uri = data == null ? null : data.getData();
            if (uri == null || !ContentResolver.SCHEME_CONTENT.equals(uri.getScheme()) || text == null) {
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
        } catch (Exception error) {
            call.reject("Unable to write the library backup to the chosen destination", "FILE_SAVE_FAILED", error);
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
