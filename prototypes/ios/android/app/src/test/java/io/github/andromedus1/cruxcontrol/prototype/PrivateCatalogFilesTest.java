package io.github.andromedus1.cruxcontrol.prototype;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.SocketTimeoutException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public final class PrivateCatalogFilesTest {
    @Rule public final TemporaryFolder temporary = new TemporaryFolder();

    private static final byte[] ARTIFACT = "synthetic gzip bytes for catalog v7".getBytes(StandardCharsets.UTF_8);

    private static String sha256(byte[] bytes) throws Exception {
        return PrivateCatalogFiles.hex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private static String manifestJson(int version, String sha256, long bytes) {
        return "{\"schemaVersion\":3,\"version\":" + version
            + ",\"board\":\"kilter-fullride-7x10\",\"file\":\"kilter-7x10.v" + version + ".db.gz\""
            + ",\"compression\":\"gzip\",\"sha256\":\"" + sha256 + "\",\"bytesGzipped\":" + bytes
            + ",\"bytesRaw\":4096,\"source\":\"boardsesh-kilter\",\"layoutRevision\":\"kilter:7:8:17:f0d70b3db9a6\""
            + ",\"changes\":{\"added\":3,\"removed\":1,\"restored\":0}}";
    }

    private static byte[] manifestBytes(int version, byte[] artifact) throws Exception {
        return manifestJson(version, sha256(artifact), artifact.length).getBytes(StandardCharsets.UTF_8);
    }

    private PrivateCatalogFiles files() throws IOException {
        return new PrivateCatalogFiles(temporary.newFolder("catalog"));
    }

    private static void write(File file, byte[] bytes) throws IOException {
        try (FileOutputStream output = new FileOutputStream(file)) { output.write(bytes); }
    }

    private static byte[] read(InputStream input) throws IOException {
        try (InputStream source = input) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[1024];
            int count;
            while ((count = source.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toByteArray();
        }
    }

    private static void assertCode(String code, ThrowingRunnable action) {
        try {
            action.run();
            fail("expected " + code);
        } catch (PrivateCatalogFiles.CatalogException error) {
            assertEquals(code, error.code);
        } catch (Exception other) {
            throw new AssertionError("unexpected " + other, other);
        }
    }

    private interface ThrowingRunnable { void run() throws Exception; }

    @Test
    public void parsesTheGatewaySchemaThreeManifestIdentity() throws Exception {
        PrivateCatalogFiles.Manifest manifest = PrivateCatalogFiles.parseManifest(manifestBytes(7, ARTIFACT));
        assertEquals(7, manifest.version);
        assertEquals("kilter-7x10.v7.db.gz", manifest.file);
        assertEquals(sha256(ARTIFACT), manifest.sha256);
        assertEquals(ARTIFACT.length, manifest.bytesGzipped);
    }

    @Test
    public void rejectsManifestsOutsideTheContract() throws Exception {
        String sha = sha256(ARTIFACT);
        String valid = manifestJson(7, sha, ARTIFACT.length);
        String[] invalid = {
            valid.replace("\"schemaVersion\":3", "\"schemaVersion\":2"),
            valid.replace("\"schemaVersion\":3", "\"schemaVersion\":\"3\""),
            valid.replace("\"version\":7", "\"version\":7.5"),
            valid.replace("\"version\":7", "\"version\":0"),
            valid.replace("\"version\":7", "\"version\":1000000"),
            valid.replace("kilter-7x10.v7.db.gz", "kilter-7x10.v8.db.gz"),
            valid.replace("kilter-7x10.v7.db.gz", "../kilter-7x10.v7.db.gz"),
            valid.replace(sha, sha.toUpperCase()),
            valid.replace(sha, sha.substring(1)),
            valid.replace("\"bytesGzipped\":" + ARTIFACT.length, "\"bytesGzipped\":0"),
            valid.replace("\"bytesGzipped\":" + ARTIFACT.length, "\"bytesGzipped\":" + (8L * 1024 * 1024 + 1)),
            valid.replace("boardsesh-kilter", "legacy-aurora-kilter"),
            valid.replace("kilter-fullride-7x10", "kilter-original-12x12"),
            valid.replace("\"gzip\"", "\"zstd\""),
            "[" + valid + "]",
            "not json",
        };
        for (String value : invalid) {
            assertCode("INTEGRITY", () -> PrivateCatalogFiles.parseManifest(value.getBytes(StandardCharsets.UTF_8)));
        }
        byte[] oversized = new byte[PrivateCatalogFiles.MAX_MANIFEST_BYTES + 1];
        Arrays.fill(oversized, (byte) ' ');
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.parseManifest(oversized));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.parseManifest(new byte[] {(byte) 0xff, '{', '}'}));
    }

    @Test
    public void selectsOnlyExactPrivatePaths() {
        assertNull(PrivateCatalogFiles.privateRequestName("/catalog/manifest.json"));
        assertNull(PrivateCatalogFiles.privateRequestName("/catalog/kilter-7x10.v1.db.gz"));
        assertNull(PrivateCatalogFiles.privateRequestName(null));
        assertEquals("manifest.json", PrivateCatalogFiles.privateRequestName("/catalog/private/manifest.json"));
        assertEquals("kilter-7x10.v12.db.gz", PrivateCatalogFiles.privateRequestName("/catalog/private/kilter-7x10.v12.db.gz"));
        assertEquals("", PrivateCatalogFiles.privateRequestName("/catalog/private/"));
        assertEquals("", PrivateCatalogFiles.privateRequestName("/catalog/private/kilter-7x10.v0.db.gz"));
        assertEquals("", PrivateCatalogFiles.privateRequestName("/catalog/private/..%2Fmanifest.json"));
        assertEquals("", PrivateCatalogFiles.privateRequestName("/catalog/private/sub/manifest.json"));
        assertEquals("", PrivateCatalogFiles.privateRequestName("/catalog/private/artifact-1.part"));
    }

    @Test
    public void updatesAreEnabledOnlyForConfiguredReleaseAuth() {
        assertTrue(PrivateCatalogFiles.catalogEnabled(true, "library-v1"));
        assertFalse(PrivateCatalogFiles.catalogEnabled(false, "library-v1"));
        assertFalse(PrivateCatalogFiles.catalogEnabled(true, "acceptance-v1/r001"));
    }

    @Test
    public void rejectsArtifactHeaderAndHashMismatches() throws Exception {
        PrivateCatalogFiles.Manifest manifest = PrivateCatalogFiles.parseManifest(manifestBytes(7, ARTIFACT));
        PrivateCatalogFiles.checkArtifactHeaders(manifest, Integer.toString(ARTIFACT.length), manifest.sha256);
        PrivateCatalogFiles.checkArtifactHeaders(manifest, null, manifest.sha256);
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.checkArtifactHeaders(manifest, null, null));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.checkArtifactHeaders(manifest, null, "0000000000000000000000000000000000000000000000000000000000000000"));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.checkArtifactHeaders(manifest, "1", manifest.sha256));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.checkArtifactHeaders(manifest, "-5", manifest.sha256));

        ByteArrayOutputStream ok = new ByteArrayOutputStream();
        PrivateCatalogFiles.copyVerified(new ByteArrayInputStream(ARTIFACT), ok, manifest);
        assertArrayEquals(ARTIFACT, ok.toByteArray());

        byte[] tampered = ARTIFACT.clone();
        tampered[0] ^= 1;
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.copyVerified(
            new ByteArrayInputStream(tampered), new ByteArrayOutputStream(), manifest));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.copyVerified(
            new ByteArrayInputStream(Arrays.copyOf(ARTIFACT, ARTIFACT.length - 1)), new ByteArrayOutputStream(), manifest));
        assertCode("INTEGRITY", () -> PrivateCatalogFiles.copyVerified(
            new ByteArrayInputStream(Arrays.copyOf(ARTIFACT, ARTIFACT.length + 1)), new ByteArrayOutputStream(), manifest));
        assertCode("NETWORK", () -> PrivateCatalogFiles.copyVerified(new InputStream() {
            @Override public int read() throws IOException { throw new SocketTimeoutException(); }
            @Override public int read(byte[] buffer) throws IOException { throw new SocketTimeoutException(); }
        }, new ByteArrayOutputStream(), manifest));
        assertCode("UNAVAILABLE", () -> PrivateCatalogFiles.copyVerified(new ByteArrayInputStream(ARTIFACT),
            new OutputStream() {
                @Override public void write(int value) throws IOException { throw new IOException("disk full"); }
                @Override public void write(byte[] buffer, int offset, int length) throws IOException { throw new IOException("disk full"); }
            }, manifest));
    }

    @Test
    public void mapsGatewayStatusesAndSessionFailuresToBoundedCodes() {
        assertEquals("AUTH_REQUIRED", PrivateCatalogFiles.errorForStatus(401));
        assertEquals("NOT_ADMITTED", PrivateCatalogFiles.errorForStatus(403));
        assertEquals("UNAVAILABLE", PrivateCatalogFiles.errorForStatus(404));
        assertEquals("UNAVAILABLE", PrivateCatalogFiles.errorForStatus(503));
        assertEquals("AUTH_REQUIRED", PrivateCatalogPlugin.errorCode(new NativeAccountSession.SessionException("AUTH_CHANGED")));
        assertEquals("UNAVAILABLE", PrivateCatalogPlugin.errorCode(new NativeAccountSession.SessionException("AUTH_REFRESH_FAILED")));
        assertEquals("NETWORK", PrivateCatalogPlugin.errorCode(new VaultTransferDeadline.DeadlineExceededException()));
        assertEquals("INTEGRITY", PrivateCatalogPlugin.errorCode(new PrivateCatalogFiles.CatalogException("INTEGRITY")));
        assertEquals("UNAVAILABLE", PrivateCatalogPlugin.errorCode(new IOException("disk")));
    }

    @Test
    public void servesOnlyTheStagedManifestAndItsVerifiedArtifact() throws Exception {
        PrivateCatalogFiles files = files();
        assertNull(files.openServable("manifest.json"));
        byte[] manifestBytes = manifestBytes(7, ARTIFACT);
        PrivateCatalogFiles.Manifest manifest = files.stageManifest(manifestBytes);

        PrivateCatalogFiles.Served servedManifest = files.openServable("manifest.json");
        assertNotNull(servedManifest);
        assertEquals("application/json", servedManifest.contentType);
        assertArrayEquals(manifestBytes, read(servedManifest.stream));
        assertNull("an unprepared artifact is not servable", files.openServable(manifest.file));
        assertFalse(files.hasPreparedArtifact(manifest));

        File part = files.createArtifactTemp();
        write(part, ARTIFACT);
        files.commitArtifact(part, manifest);
        assertFalse(part.exists());
        assertTrue(files.hasPreparedArtifact(manifest));
        PrivateCatalogFiles.Served servedArtifact = files.openServable(manifest.file);
        assertNotNull(servedArtifact);
        assertEquals("application/gzip", servedArtifact.contentType);
        assertArrayEquals(ARTIFACT, read(servedArtifact.stream));
        assertNull("only the staged version is servable", files.openServable("kilter-7x10.v6.db.gz"));
        assertNull(files.openServable(""));
    }

    @Test
    public void commitRejectsCorruptOrStaleArtifactsAndRemovesTheTempFile() throws Exception {
        PrivateCatalogFiles files = files();
        PrivateCatalogFiles.Manifest manifest = files.stageManifest(manifestBytes(7, ARTIFACT));

        File corrupt = files.createArtifactTemp();
        byte[] tampered = ARTIFACT.clone();
        tampered[3] ^= 1;
        write(corrupt, tampered);
        assertCode("INTEGRITY", () -> files.commitArtifact(corrupt, manifest));
        assertFalse(corrupt.exists());
        assertNull(files.openServable(manifest.file));

        // A newer check re-staged the manifest while the old artifact downloaded.
        byte[] newer = "synthetic gzip bytes for catalog v8".getBytes(StandardCharsets.UTF_8);
        files.stageManifest(manifestBytes(8, newer));
        File stale = files.createArtifactTemp();
        write(stale, ARTIFACT);
        assertCode("UNAVAILABLE", () -> files.commitArtifact(stale, manifest));
        assertFalse(stale.exists());
        assertNull(files.openServable(manifest.file));
    }

    @Test
    public void stagingAndCommitKeepOnlyTheNewestArtifactAndCleanupDropsPartials() throws Exception {
        File root = temporary.newFolder("catalog-cleanup");
        PrivateCatalogFiles files = new PrivateCatalogFiles(root);
        PrivateCatalogFiles.Manifest v7 = files.stageManifest(manifestBytes(7, ARTIFACT));
        File part = files.createArtifactTemp();
        write(part, ARTIFACT);
        files.commitArtifact(part, v7);
        write(new File(root, "kilter-7x10.v5.db.gz"), ARTIFACT);
        write(new File(root, "artifact-123.part"), ARTIFACT);
        write(new File(root, "unrelated.txt"), ARTIFACT);

        files.cleanupInterrupted();
        assertTrue(new File(root, "kilter-7x10.v7.db.gz").isFile());
        assertFalse(new File(root, "kilter-7x10.v5.db.gz").exists());
        assertFalse(new File(root, "artifact-123.part").exists());
        assertTrue("cleanup only touches catalog-owned names", new File(root, "unrelated.txt").isFile());

        byte[] newer = "synthetic gzip bytes for catalog v8".getBytes(StandardCharsets.UTF_8);
        PrivateCatalogFiles.Manifest v8 = files.stageManifest(manifestBytes(8, newer));
        assertFalse("a newer staged manifest retires the older artifact", new File(root, "kilter-7x10.v7.db.gz").exists());
        File next = files.createArtifactTemp();
        write(next, newer);
        files.commitArtifact(next, v8);
        File[] artifacts = root.listFiles((parent, name) -> PrivateCatalogFiles.validArtifactName(name));
        assertNotNull(artifacts);
        assertEquals(1, artifacts.length);
        assertEquals("kilter-7x10.v8.db.gz", artifacts[0].getName());
        assertEquals(8, files.stagedManifest().version);
    }

    @Test
    public void invalidStagingKeepsThePreviousManifest() throws Exception {
        PrivateCatalogFiles files = files();
        files.stageManifest(manifestBytes(7, ARTIFACT));
        assertCode("INTEGRITY", () -> files.stageManifest("{\"schemaVersion\":2}".getBytes(StandardCharsets.UTF_8)));
        assertEquals(7, files.stagedManifest().version);
    }
}
