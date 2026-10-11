package io.github.andromedus1.cruxcontrol.prototype;

import android.content.Context;
import android.util.Base64;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.json.JSONObject;

/** Opaque account/scope-bound staging and download files stored outside OS backup and cache. */
final class PrivateVaultFileStore {
    static final int MAX_BYTES = 25 * 1024 * 1024;
    static final int MAX_CHUNK = 64 * 1024;
    private static final int MAGIC = 0x43525631;
    private static final int MAX_HEADER = 16 * 1024;

    static final class SealedFile {
        final File file;
        final long payloadOffset;
        final String id;
        final String uid;
        final String scope;
        final int bytes;
        final String sha256;

        SealedFile(File file, long payloadOffset, String id, String uid, String scope, int bytes, String sha256) {
            this.file = file;
            this.payloadOffset = payloadOffset;
            this.id = id;
            this.uid = uid;
            this.scope = scope;
            this.bytes = bytes;
            this.sha256 = sha256;
        }
    }

    static final class DownloadFile {
        final File file;
        final String id;
        final String uid;
        final String scope;
        final long epoch;
        final int bytes;
        final String sha256;
        final String generation;

        DownloadFile(File file, String id, String uid, String scope, long epoch,
            int bytes, String sha256, String generation) {
            this.file = file;
            this.id = id;
            this.uid = uid;
            this.scope = scope;
            this.epoch = epoch;
            this.bytes = bytes;
            this.sha256 = sha256;
            this.generation = generation;
        }
    }

    private static final class ActiveStage {
        final File part;
        final String id;
        final String uid;
        final String scope;
        final int bytes;
        final String sha256;
        int written;

        ActiveStage(File part, String id, String uid, String scope, int bytes, String sha256) {
            this.part = part;
            this.id = id;
            this.uid = uid;
            this.scope = scope;
            this.bytes = bytes;
            this.sha256 = sha256;
        }
    }

    private final File root;
    private final File downloads;
    private final Map<String, ActiveStage> active = new HashMap<>();
    private final Map<String, DownloadFile> openDownloads = new HashMap<>();

    PrivateVaultFileStore(Context context) {
        root = new File(context.getNoBackupFilesDir(), "private-vault");
        downloads = new File(root, "downloads");
        ensureDirectory(root);
        ensureDirectory(downloads);
    }

    static synchronized String installationId(Context context) throws Exception {
        File directory = new File(context.getNoBackupFilesDir(), "private-vault");
        ensureDirectory(directory);
        File file = new File(directory, "installation-id");
        if (file.isFile()) {
            try (FileInputStream input = new FileInputStream(file)) {
                ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                byte[] buffer = new byte[128];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (bytes.size() + count > 128) throw new IllegalStateException("Invalid installation identifier");
                    bytes.write(buffer, 0, count);
                }
                String existing = bytes.toString(StandardCharsets.US_ASCII).trim();
                if (existing.matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}")) return existing;
            }
            throw new IllegalStateException("Invalid installation identifier");
        }
        String id = UUID.randomUUID().toString();
        File temporary = new File(directory, "installation-id.tmp");
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write((id + "\n").getBytes(StandardCharsets.US_ASCII));
            output.getFD().sync();
        }
        if (!temporary.renameTo(file)) {
            temporary.delete();
            if (!file.isFile()) throw new IllegalStateException("Cannot persist installation identifier");
            return installationId(context);
        }
        return id;
    }

    void cleanupInterruptedTransfers() {
        active.clear();
        openDownloads.clear();
        cleanPartialFiles(root);
        File[] temps = downloads.listFiles();
        if (temps != null) for (File file : temps) if (file.isFile()) file.delete();
    }

    JSObject begin(String uid, String scope, int bytes, String sha256) throws Exception {
        String id = UUID.randomUUID().toString();
        File directory = stageDirectory(uid, scope);
        File part = new File(directory, id + ".part");
        try (FileOutputStream output = new FileOutputStream(part, false)) { output.getFD().sync(); }
        ActiveStage stage = new ActiveStage(part, id, uid, scope, bytes, sha256);
        active.put(id, stage);
        JSObject response = new JSObject();
        response.put("id", id);
        return response;
    }

    int append(String uid, String scope, String id, int offset, String base64) throws Exception {
        ActiveStage stage = active.get(id);
        if (stage == null || !stage.uid.equals(uid) || !stage.scope.equals(scope)) throw new FileStoreException("STAGING_MISSING");
        if (offset != stage.written) throw new FileStoreException("STAGING_OFFSET");
        byte[] bytes;
        try { bytes = Base64.decode(base64, Base64.NO_WRAP); }
        catch (IllegalArgumentException error) { throw new FileStoreException("STAGING_INVALID"); }
        if (bytes.length == 0 || bytes.length > MAX_CHUNK || stage.written + bytes.length > stage.bytes
            || !Base64.encodeToString(bytes, Base64.NO_WRAP).equals(base64)) throw new FileStoreException("STAGING_INVALID");
        try (FileOutputStream output = new FileOutputStream(stage.part, true)) { output.write(bytes); }
        stage.written += bytes.length;
        return stage.written;
    }

    SealedFile seal(String uid, String scope, String id) throws Exception {
        ActiveStage stage = active.get(id);
        if (stage == null || !stage.uid.equals(uid) || !stage.scope.equals(scope)) throw new FileStoreException("STAGING_MISSING");
        if (stage.written != stage.bytes || stage.part.length() != stage.bytes) throw new FileStoreException("STAGING_INCOMPLETE");
        if (!digest(stage.part).equals(stage.sha256)) throw new FileStoreException("STAGING_CORRUPT");

        JSONObject metadata = new JSONObject();
        metadata.put("id", stage.id);
        metadata.put("uid", stage.uid);
        metadata.put("scope", stage.scope);
        metadata.put("bytes", stage.bytes);
        metadata.put("sha256", stage.sha256);
        byte[] header = metadata.toString().getBytes(StandardCharsets.UTF_8);
        if (header.length > MAX_HEADER) throw new FileStoreException("STAGING_INVALID");
        File directory = stage.part.getParentFile();
        File sealedTemp = new File(directory, id + ".sealing");
        File sealed = new File(directory, id + ".sealed");
        try (FileOutputStream output = new FileOutputStream(sealedTemp, false);
             DataOutputStream data = new DataOutputStream(output);
             FileInputStream input = new FileInputStream(stage.part)) {
            data.writeInt(MAGIC);
            data.writeInt(header.length);
            data.write(header);
            copy(input, data, stage.bytes);
            data.flush();
            output.getFD().sync();
        }
        if (!sealedTemp.renameTo(sealed)) {
            sealedTemp.delete();
            throw new FileStoreException("STAGING_IO");
        }
        stage.part.delete();
        active.remove(id);
        return readSealed(uid, scope, id);
    }

    void abort(String uid, String scope, String id) {
        ActiveStage stage = active.get(id);
        if (stage != null && stage.uid.equals(uid) && stage.scope.equals(scope)) {
            stage.part.delete();
            new File(stage.part.getParentFile(), id + ".sealing").delete();
            active.remove(id);
        }
        // A sealed file may have crossed the bridge before its response was lost.
        // Keep it durable until caller acknowledgement or retainStaged's authoritative list.
    }

    SealedFile readSealed(String uid, String scope, String id) throws Exception {
        File file = new File(stageDirectory(uid, scope), id + ".sealed");
        if (!file.isFile()) throw new FileStoreException("STAGING_MISSING");
        try (DataInputStream input = new DataInputStream(new FileInputStream(file))) {
            if (input.readInt() != MAGIC) throw new FileStoreException("STAGING_CORRUPT");
            int headerLength = input.readInt();
            if (headerLength <= 0 || headerLength > MAX_HEADER || headerLength > file.length() - 8) {
                throw new FileStoreException("STAGING_CORRUPT");
            }
            byte[] header = new byte[headerLength];
            input.readFully(header);
            JSONObject metadata = new JSONObject(new String(header, StandardCharsets.UTF_8));
            if (metadata.length() != 5 || !metadata.has("id") || !metadata.has("uid")
                || !metadata.has("scope") || !metadata.has("bytes") || !metadata.has("sha256")) {
                throw new FileStoreException("STAGING_CORRUPT");
            }
            String storedId = metadata.getString("id");
            String storedUid = metadata.getString("uid");
            String storedScope = metadata.getString("scope");
            int storedBytes = metadata.getInt("bytes");
            String storedSha = metadata.getString("sha256");
            long payloadOffset = 8L + headerLength;
            if (!storedId.equals(id) || !storedUid.equals(uid) || !storedScope.equals(scope)
                || storedBytes < 1 || storedBytes > MAX_BYTES || !storedSha.matches("[0-9a-f]{64}")
                || file.length() != payloadOffset + storedBytes) throw new FileStoreException("STAGING_CORRUPT");
            SealedFile result = new SealedFile(file, payloadOffset, id, uid, scope, storedBytes, storedSha);
            if (!digestPayload(result).equals(storedSha)) throw new FileStoreException("STAGING_CORRUPT");
            return result;
        } catch (FileStoreException error) {
            throw error;
        } catch (Exception error) {
            throw new FileStoreException("STAGING_CORRUPT");
        }
    }

    void discard(String uid, String scope, String id) throws Exception {
        SealedFile sealed = readSealed(uid, scope, id);
        if (!sealed.file.delete()) throw new FileStoreException("STAGING_IO");
    }

    void retain(String uid, String scope, Set<String> retainedIds) {
        File directory = stageDirectory(uid, scope);
        File[] files = directory.listFiles((parent, name) -> name.endsWith(".sealed"));
        if (files == null) return;
        for (File file : files) {
            String id = file.getName().substring(0, file.getName().length() - ".sealed".length());
            if (retainedIds.contains(id)) continue;
            try {
                SealedFile sealed = readSealed(uid, scope, id);
                if (sealed.file.equals(file)) file.delete();
            } catch (Exception ignored) {
                // Unknown/corrupt files are retained; cleanup only deletes verified owned records.
            }
        }
    }

    DownloadFile createDownload(String uid, String scope, long epoch, int bytes, String sha256, String generation)
        throws Exception {
        String id = UUID.randomUUID().toString();
        File file = new File(downloads, id + ".tmp");
        try (FileOutputStream output = new FileOutputStream(file, false)) { output.getFD().sync(); }
        DownloadFile download = new DownloadFile(file, id, uid, scope, epoch, bytes, sha256, generation);
        openDownloads.put(id, download);
        return download;
    }

    DownloadFile requireDownload(String uid, String scope, long epoch, String id) throws Exception {
        DownloadFile download = openDownloads.get(id);
        if (download == null || !download.uid.equals(uid) || !download.scope.equals(scope) || download.epoch != epoch
            || !download.file.isFile()) throw new FileStoreException("DOWNLOAD_MISSING");
        return download;
    }

    void sealDownload(DownloadFile download) throws Exception {
        if (download.file.length() != download.bytes || !digest(download.file).equals(download.sha256)) {
            throw new FileStoreException("DOWNLOAD_INVALID");
        }
        try (FileOutputStream output = new FileOutputStream(download.file, true)) { output.getFD().sync(); }
    }

    JSObject downloadChunk(String uid, String scope, long epoch, String id, int offset) throws Exception {
        DownloadFile download = requireDownload(uid, scope, epoch, id);
        if (offset < 0 || offset >= download.bytes) throw new FileStoreException("DOWNLOAD_INVALID");
        int length = Math.min(MAX_CHUNK, download.bytes - offset);
        byte[] bytes = new byte[length];
        try (RandomAccessFile input = new RandomAccessFile(download.file, "r")) {
            input.seek(offset);
            input.readFully(bytes);
        }
        JSObject result = new JSObject();
        result.put("id", id);
        result.put("offset", offset);
        result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
        result.put("eof", offset + length == download.bytes);
        return result;
    }

    void finishDownload(String uid, String scope, long epoch, String id) {
        DownloadFile download = openDownloads.get(id);
        if (download == null || !download.uid.equals(uid) || !download.scope.equals(scope) || download.epoch != epoch) return;
        download.file.delete();
        openDownloads.remove(id);
    }

    FileInputStream payloadStream(SealedFile sealed) throws Exception {
        FileInputStream input = new FileInputStream(sealed.file);
        input.getChannel().position(sealed.payloadOffset);
        return input;
    }

    private File stageDirectory(String uid, String scope) {
        if (uid == null || uid.isEmpty() || !validScope(scope)) throw new IllegalArgumentException("Invalid account scope");
        File account = new File(new File(root, "staged"), hashText(uid));
        File directory = new File(account, scope.replace('/', '-'));
        ensureDirectory(directory);
        return directory;
    }

    private static boolean validScope(String scope) {
        return "library-v1".equals(scope) || scope.matches("acceptance-v1/r00[1-4]");
    }

    private static void ensureDirectory(File directory) {
        if (!directory.isDirectory() && !directory.mkdirs() && !directory.isDirectory()) {
            throw new IllegalStateException("Private vault storage unavailable");
        }
    }

    private static void cleanPartialFiles(File directory) {
        File[] entries = directory.listFiles();
        if (entries == null) return;
        for (File entry : entries) {
            if (entry.isDirectory()) cleanPartialFiles(entry);
            else if (entry.getName().endsWith(".part") || entry.getName().endsWith(".sealing")) entry.delete();
        }
    }

    private static void copy(InputStream input, OutputStream output, int size) throws Exception {
        byte[] buffer = new byte[8192];
        int remaining = size;
        while (remaining > 0) {
            int count = input.read(buffer, 0, Math.min(buffer.length, remaining));
            if (count < 0) throw new FileStoreException("STAGING_INCOMPLETE");
            output.write(buffer, 0, count);
            remaining -= count;
        }
        if (input.read() != -1) throw new FileStoreException("STAGING_INVALID");
    }

    private static String digest(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        return hex(digest.digest());
    }

    private static String digestPayload(SealedFile sealed) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream input = new FileInputStream(sealed.file)) {
            input.getChannel().position(sealed.payloadOffset);
            byte[] buffer = new byte[8192];
            int count;
            int remaining = sealed.bytes;
            while (remaining > 0 && (count = input.read(buffer, 0, Math.min(buffer.length, remaining))) != -1) {
                digest.update(buffer, 0, count);
                remaining -= count;
            }
            if (remaining != 0 || input.read() != -1) throw new FileStoreException("STAGING_CORRUPT");
        }
        return hex(digest.digest());
    }

    private static String hashText(String text) {
        try { return hex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception error) { throw new IllegalStateException("Digest unavailable"); }
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }

    static final class FileStoreException extends Exception {
        final String code;
        FileStoreException(String code) { super(code); this.code = code; }
    }
}
