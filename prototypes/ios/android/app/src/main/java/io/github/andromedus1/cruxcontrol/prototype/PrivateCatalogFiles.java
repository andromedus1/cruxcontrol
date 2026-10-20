package io.github.andromedus1.cruxcontrol.prototype;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.json.JSONObject;

/**
 * App-private catalog update files: one staged manifest and at most one verified artifact.
 * Pure Java over a root directory so validation, path selection and cleanup are JVM-testable.
 */
final class PrivateCatalogFiles {
    static final int MAX_MANIFEST_BYTES = 16 * 1024;
    static final long MAX_ARTIFACT_BYTES = 8L * 1024 * 1024;
    static final int MAX_VERSION = 999_999;
    static final String PRIVATE_PREFIX = "/catalog/private/";
    static final String MANIFEST_NAME = "manifest.json";
    private static final Pattern ARTIFACT_NAME = Pattern.compile("kilter-7x10\\.v([1-9][0-9]{0,5})\\.db\\.gz");
    private static final Pattern DIGEST = Pattern.compile("[0-9a-f]{64}");
    private static final String PART_SUFFIX = ".part";
    private static final Map<String, PrivateCatalogFiles> SHARED = new HashMap<>();

    /** The minimal identity the native layer needs; the web installer re-validates the full manifest. */
    static final class Manifest {
        final int version;
        final String file;
        final String sha256;
        final long bytesGzipped;

        Manifest(int version, String file, String sha256, long bytesGzipped) {
            this.version = version;
            this.file = file;
            this.sha256 = sha256;
            this.bytesGzipped = bytesGzipped;
        }
    }

    /** One opened, servable private file. */
    static final class Served {
        final InputStream stream;
        final String contentType;
        final long length;

        Served(InputStream stream, String contentType, long length) {
            this.stream = stream;
            this.contentType = contentType;
            this.length = length;
        }
    }

    static final class CatalogException extends Exception {
        final String code;
        CatalogException(String code) { super(code); this.code = code; }
        CatalogException(String code, Throwable cause) { super(code, cause); this.code = code; }
    }

    private final File root;

    PrivateCatalogFiles(File root) {
        this.root = root;
    }

    /** One instance per directory so the plugin and the WebView client share one lock. */
    static PrivateCatalogFiles shared(File root) {
        String key = root.getAbsolutePath();
        synchronized (SHARED) {
            PrivateCatalogFiles existing = SHARED.get(key);
            if (existing != null) return existing;
            PrivateCatalogFiles created = new PrivateCatalogFiles(root);
            SHARED.put(key, created);
            return created;
        }
    }

    static String artifactName(int version) {
        if (version < 1 || version > MAX_VERSION) throw new IllegalArgumentException("Catalog version out of range");
        return "kilter-7x10.v" + version + ".db.gz";
    }

    static boolean validArtifactName(String name) {
        return name != null && ARTIFACT_NAME.matcher(name).matches();
    }

    static boolean catalogEnabled(boolean authConfigured, String scope) {
        return authConfigured && "library-v1".equals(scope);
    }

    /**
     * Selects a private catalog file from an encoded request path. Returns null when the path is
     * not under the private prefix, "" for any unservable private path, or the exact file name.
     */
    static String privateRequestName(String encodedPath) {
        if (encodedPath == null || !encodedPath.startsWith(PRIVATE_PREFIX)) return null;
        String name = encodedPath.substring(PRIVATE_PREFIX.length());
        if (MANIFEST_NAME.equals(name) || validArtifactName(name)) return name;
        return "";
    }

    /** Validates the gateway's manifest bytes (schema 3, identity, digest and size bounds). */
    static Manifest parseManifest(byte[] bytes) throws CatalogException {
        if (bytes == null || bytes.length == 0 || bytes.length > MAX_MANIFEST_BYTES) throw new CatalogException("INTEGRITY");
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException error) {
            throw new CatalogException("INTEGRITY", error);
        }
        try {
            String trimmed = text.trim();
            if (!trimmed.startsWith("{")) throw new CatalogException("INTEGRITY");
            JSONObject json = new JSONObject(trimmed);
            Long schema = integer(json.opt("schemaVersion"));
            Long version = integer(json.opt("version"));
            Long size = integer(json.opt("bytesGzipped"));
            Object file = json.opt("file");
            Object sha256 = json.opt("sha256");
            if (schema == null || schema != 3
                || !"boardsesh-kilter".equals(json.opt("source"))
                || !"kilter-fullride-7x10".equals(json.opt("board"))
                || !"gzip".equals(json.opt("compression"))
                || version == null || version < 1 || version > MAX_VERSION
                || !(file instanceof String) || !artifactName(version.intValue()).equals(file)
                || !(sha256 instanceof String) || !DIGEST.matcher((String) sha256).matches()
                || size == null || size < 1 || size > MAX_ARTIFACT_BYTES) {
                throw new CatalogException("INTEGRITY");
            }
            return new Manifest(version.intValue(), (String) file, (String) sha256, size);
        } catch (CatalogException error) {
            throw error;
        } catch (Exception error) {
            throw new CatalogException("INTEGRITY", error);
        }
    }

    private static Long integer(Object value) {
        if (value instanceof Integer || value instanceof Long) return ((Number) value).longValue();
        return null;
    }

    /** The artifact response must carry the manifest digest and, when declared, its exact length. */
    static void checkArtifactHeaders(Manifest manifest, String contentLength, String catalogSha256) throws CatalogException {
        if (!manifest.sha256.equals(catalogSha256)) throw new CatalogException("INTEGRITY");
        if (contentLength != null && (!contentLength.matches("0|[1-9][0-9]{0,18}")
            || Long.parseLong(contentLength) != manifest.bytesGzipped)) {
            throw new CatalogException("INTEGRITY");
        }
    }

    /** Bounded error code for a non-success gateway status (after one refreshed 401 retry). */
    static String errorForStatus(int status) {
        if (status == 401) return "AUTH_REQUIRED";
        if (status == 403) return "NOT_ADMITTED";
        return "UNAVAILABLE";
    }

    /**
     * Streams exactly the manifest's bytes while hashing them. Read failures are NETWORK, write
     * failures UNAVAILABLE, and any size or digest disagreement INTEGRITY.
     */
    static void copyVerified(InputStream input, OutputStream output, Manifest manifest) throws CatalogException {
        MessageDigest digest = sha256();
        byte[] buffer = new byte[8192];
        long total = 0;
        while (true) {
            int count;
            try { count = input.read(buffer); }
            catch (IOException error) { throw new CatalogException("NETWORK", error); }
            if (count == -1) break;
            total += count;
            if (total > manifest.bytesGzipped || total > MAX_ARTIFACT_BYTES) throw new CatalogException("INTEGRITY");
            try { output.write(buffer, 0, count); }
            catch (IOException error) { throw new CatalogException("UNAVAILABLE", error); }
            digest.update(buffer, 0, count);
        }
        if (total != manifest.bytesGzipped || !hex(digest.digest()).equals(manifest.sha256)) {
            throw new CatalogException("INTEGRITY");
        }
    }

    synchronized void cleanupInterrupted() {
        ensureRoot();
        File[] entries = root.listFiles();
        if (entries == null) return;
        for (File entry : entries) if (entry.isFile() && entry.getName().endsWith(PART_SUFFIX)) entry.delete();
        Manifest staged = readStagedLocked();
        removeArtifactsExceptLocked(staged == null ? null : staged.file);
    }

    synchronized Manifest stagedManifest() {
        return readStagedLocked();
    }

    /** Atomically replaces the staged manifest; artifacts it does not name become unservable and are removed. */
    synchronized Manifest stageManifest(byte[] bytes) throws CatalogException {
        Manifest manifest = parseManifest(bytes);
        ensureRoot();
        File temporary = new File(root, MANIFEST_NAME + PART_SUFFIX);
        try (FileOutputStream output = new FileOutputStream(temporary, false)) {
            output.write(bytes);
            output.getFD().sync();
        } catch (IOException error) {
            temporary.delete();
            throw new CatalogException("UNAVAILABLE", error);
        }
        if (!temporary.renameTo(new File(root, MANIFEST_NAME))) {
            temporary.delete();
            throw new CatalogException("UNAVAILABLE");
        }
        removeArtifactsExceptLocked(manifest.file);
        return manifest;
    }

    /** True when the staged manifest's artifact is already present with its exact size and digest. */
    synchronized boolean hasPreparedArtifact(Manifest manifest) {
        File artifact = new File(root, manifest.file);
        try {
            return artifact.isFile() && artifact.length() == manifest.bytesGzipped
                && digest(artifact).equals(manifest.sha256);
        } catch (IOException error) {
            return false;
        }
    }

    synchronized File createArtifactTemp() throws CatalogException {
        ensureRoot();
        try { return File.createTempFile("artifact-", PART_SUFFIX, root); }
        catch (IOException error) { throw new CatalogException("UNAVAILABLE", error); }
    }

    /** Runs the final, atomic publication step; callers gate it on their own invariants. */
    interface PublicationGuard {
        void publish(Publication publication) throws Exception;
    }

    interface Publication {
        void run() throws CatalogException;
    }

    /**
     * Re-verifies a fully written temp file against the still-staged manifest, then lets the
     * guard perform the rename and cleanup, so a caller can make publication atomic with its
     * own session check. The temp file never becomes servable otherwise.
     */
    synchronized void commitArtifact(File temporary, Manifest manifest, PublicationGuard guard) throws Exception {
        try {
            Manifest staged = readStagedLocked();
            if (staged == null || staged.version != manifest.version || !staged.sha256.equals(manifest.sha256)) {
                throw new CatalogException("UNAVAILABLE");
            }
            try {
                if (temporary.length() != manifest.bytesGzipped || !digest(temporary).equals(manifest.sha256)) {
                    throw new CatalogException("INTEGRITY");
                }
            } catch (IOException error) {
                throw new CatalogException("UNAVAILABLE", error);
            }
            guard.publish(() -> {
                if (!temporary.renameTo(new File(root, manifest.file))) throw new CatalogException("UNAVAILABLE");
                removeArtifactsExceptLocked(manifest.file);
            });
        } finally {
            if (temporary.exists()) temporary.delete();
        }
    }

    /** Opens the exact private file for same-origin serving, or returns null when it is not servable. */
    synchronized Served openServable(String name) {
        Manifest staged = readStagedLocked();
        if (staged == null || name == null) return null;
        try {
            if (MANIFEST_NAME.equals(name)) {
                File manifest = new File(root, MANIFEST_NAME);
                return new Served(new FileInputStream(manifest), "application/json", manifest.length());
            }
            if (!staged.file.equals(name)) return null;
            File artifact = new File(root, name);
            if (!artifact.isFile() || artifact.length() != staged.bytesGzipped) return null;
            // An open descriptor stays valid if a later stage or commit unlinks the file.
            return new Served(new FileInputStream(artifact), "application/gzip", artifact.length());
        } catch (IOException error) {
            return null;
        }
    }

    private Manifest readStagedLocked() {
        File file = new File(root, MANIFEST_NAME);
        if (!file.isFile() || file.length() > MAX_MANIFEST_BYTES) return null;
        try (InputStream input = new FileInputStream(file)) {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (bytes.size() + count > MAX_MANIFEST_BYTES) return null;
                bytes.write(buffer, 0, count);
            }
            return parseManifest(bytes.toByteArray());
        } catch (IOException | CatalogException error) {
            return null;
        }
    }

    private void removeArtifactsExceptLocked(String keep) {
        File[] entries = root.listFiles();
        if (entries == null) return;
        for (File entry : entries) {
            String name = entry.getName();
            if (entry.isFile() && validArtifactName(name) && !name.equals(keep)) entry.delete();
        }
    }

    private void ensureRoot() {
        if (!root.isDirectory() && !root.mkdirs() && !root.isDirectory()) {
            throw new IllegalStateException("Private catalog storage unavailable");
        }
    }

    static String digest(File file) throws IOException {
        MessageDigest digest = sha256();
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
        }
        return hex(digest.digest());
    }

    private static MessageDigest sha256() {
        try { return MessageDigest.getInstance("SHA-256"); }
        catch (Exception error) { throw new IllegalStateException("SHA-256 unavailable", error); }
    }

    static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }
}
