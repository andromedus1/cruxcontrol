# Firebase private-vault proof and application transport

This isolated prototype explores direct Storage Rules and an authenticated
service using synthetic backup bytes. Android application scheduling and recovery
UI live in the app coordinator, separate from this storage service. The owner has linked billing, and bounded private
cloud infrastructure and the authenticated function are active. Native snapshot
transfer, operator-assisted recovery and live runtime-permission verification passed.
Native account recovery has separately passed on
an independent fresh emulator with the same UID and forced refresh before and
after restart. Integrated app recovery now also passes separate empty-install
acceptance on synthetic emulators.

Firebase Auth/Credential Manager and this authenticated GCS gateway are selected
for Android dogfood using the existing project resources and account-protected
encryption. Native account/file transport is implemented and the application
service deployed; live transport acceptance passes. Android durable state, the
foreground backup coordinator and account/status/history/recovery UI are implemented.
Synthetic integrated acceptance passes automatic edits/order, offline restart and
reconnection, pending-upload process death and separate empty-install app recovery.
Normal cloud recovery also passes a structured 10,000-climb/1,000-list/100,000-reference
library, cancellation, conflict blocking and relaunch. Physical owner-phone/Fullride parity remain open; real authoring is not yet admitted.
The detailed evidence below covers the separate bounded operator-assisted proof.
Application transport acceptance passes small-copy upload/list/download, exact
retry and sealed-file retention across restart. A 26,188,396-byte structured
library (10,000 climbs, 1,000 playlists and 100,000 ordered memberships) passed
exact readback on an independent installation; an exact 25 MiB fixture also passed
upload and readback. These checks do not establish integrated automatic protection
or recovery, or a worst-case memory ceiling for every possible library.

Use Node 22 and JDK 21, with `JAVA_HOME` set to the JDK. From the repository root:

```bash
npm --prefix prototypes/firebase-vault ci --ignore-scripts
npm --prefix prototypes/firebase-vault test
```

The test command starts only the loopback Storage emulator at `127.0.0.1:9199`
for `demo-cruxcontrol-vault`; the suite requires that exact emulator address.
`synthetic-owner`, `synthetic-other` and an anonymous context exercise access
without real accounts or a live Firebase project. The suite covers owner discovery
and byte readback, cross-account denial, immutable objects, competing creates,
finite slots, size/type/metadata validation and tokenized downloads.

Nine checks passed, but the competing-create check failed with Storage emulator
15.33.0: both concurrent uploads to the same empty slot succeeded despite
`resource == null`. This is emulator evidence, not a claim about live-service
behavior. The direct-SDK prototype is **not accepted for immutable backups**.
The failing assertion remains executable as a test todo linked to the feature
blocker; a todo is not passing acceptance. The authenticated service below
establishes atomic creation and authenticated reads in its separate live proof and is the selected Android dogfood boundary.
The direct-SDK result does not establish that boundary.

The policy admits one UID at `owners/<uid>/snapshots/<slot>`, with 32 names
`00`–`31`. The owner can list and read those snapshots and create a nonempty
`application/json` object up to 25 MiB. Custom metadata requires only `format`
(`cruxcontrol-library-backup-v1`) and `sha256` (64 lowercase hexadecimal digits).
Rules validate these labels, not JSON structure or whether the digest matches
the uploaded bytes; the recovery client must validate both.

Sequential overwrite, metadata update and deletion checks passed. The policy's
create condition includes `resource == null` because uploading over an existing
name also reaches create authorization; it did not prevent the observed race.
The pool eventually fills; this proof provides no retention or rotation mechanism.
Other paths and authenticated accounts are denied by Rules.

Firebase download tokens are a separate bearer capability. The emulator test
records that provider token metadata can produce a tokenized URL readable without
an authenticated Rules context, even when anonymous SDK reads are denied. It does
not establish that all anonymous access is impossible. The app must never expose
or store `getDownloadURL` results. The selected authenticated gateway avoids this
SDK access path; its separate live permission and atomic-create checks pass.

To prepare owner-specific rules from successful private native `verifySession`
evidence, use a new private output directory and the exact proof project:

```bash
node prototypes/firebase-vault/prepare-proof.mjs \
  /outside/git/auth-evidence/session.json \
  /outside/git/vault-proof cruxcontrol-auth-20261010
```

The script requires `ok`, `method: verifySession`, `signedIn` and a valid UID. It
writes `storage.rules` and `firebase.json` with exclusive creation, so existing
files are not overwritten. The generated rules embed the account UID: keep them
and the source evidence outside Git. Preparation makes no cloud calls and does
not independently authenticate the evidence or deploy the files. The explicit
project argument is checked locally; the generated configuration has no project
binding or emulator settings. Deployment, billing and live storage acceptance
remain separate owner-controlled decisions. See the [native Android proof](../ios/README.md#native-android-authentication-feasibility-proof)
for evidence generation.

## Authenticated service candidate

The candidate verifies Firebase ID tokens, including revocation, and admits one
configured UID. Its legacy proof routes are `GET /snapshots`,
`GET /snapshots/00`–`31` and `PUT` to those slots. Uploads must pass the app's
whole-library backup codec and SHA-256 validation within 25 MiB. GCS creation uses `ifGenerationMatch: 0`;
identical retries can recover a receipt, while conflicting bytes are rejected.
Application export time and content counts are validated before immutable creation,
so invalid application metadata cannot consume a retained slot. The handler
verifies exact object readback before returning `verified: true`.
There is no delete, overwrite, automatic pruning or tokenized download URL API.

The deployed application extension adds `/library-v1/snapshots` and
its five-digit slots `00000`–`00511`: 512 retained copies up to 25 MiB each,
separate from the unchanged legacy proof objects. Four bounded
`/acceptance-v1/r001/snapshots`–`/acceptance-v1/r004/snapshots` pools use the same
algorithm for synthetic acceptance outside user history. Capacity exhaustion pauses
uploads without pruning. Native application transfer uses
`noBackupFilesDir` files and bounded bridge chunks. This is not the proof GET cache
file/ADB extraction flow; live application transport acceptance passes.

Uploads supply CRC32C metadata for GCS server validation. SDK post-upload checksum
validation is disabled because its failure path can automatically delete an
object; the gateway instead verifies readback before acknowledging protection,
without deletion. Reads pin the object generation and validate its checksum,
backup structure and digest.

With Node 22, run the candidate's local checks and build from the repository root:

```bash
npm --prefix prototypes/firebase-vault/gateway ci --ignore-scripts
npm --prefix prototypes/firebase-vault/gateway test
npm --prefix prototypes/firebase-vault/gateway run build
node prototypes/firebase-vault/prepare-service.mjs \
  /outside/git/auth-evidence/session.json \
  /outside/git/new-vault-service-proof cruxcontrol-auth-20261010
```

Local handler tests use real local HTTP with injected identity
verification and storage; a GCS SDK wire fixture checks create preconditions,
generation-pinned reads and absence of destructive requests. These do not prove
live GCS/IAM enforcement, genuine service-side token verification or native
service access. The original direct-SDK race todo remains unresolved.

Preparation requires a new private output directory and successful native
`verifySession` evidence. It packages the built service with the bundled backup
codec, dependency lock, local UID configuration, `firebase.json` and
`resource-plan.json`. The resource plan records restricted IAM, bucket access
controls and a finite snapshot pool; preparation alone provisions none of these.
Preparation makes no cloud authentication, provenance-verification,
deployment or billing calls. Keep the complete package and evidence outside Git.
SignedProof18 compiled with the native service bridge. Its in-place update on an
isolated emulator preserved the verified empty whole library, and the same UID's
forced refresh passed. No owner phone was touched.

### Explicit cloud provisioning

`provision-service.mjs` requires the prepared private package, the exact project,
an already signed-in isolated Firebase CLI configuration and owner-linked billing.
It checks bundle/lock hashes before cloud access. Inspect is the default; the
explicit provision mode creates or reconciles the bounded infrastructure:

```bash
XDG_CONFIG_HOME=/outside/git/firebase-cli-config node prototypes/firebase-vault/provision-service.mjs \
  /outside/git/new-vault-service-proof cruxcontrol-auth-20261010 inspect
XDG_CONFIG_HOME=/outside/git/firebase-cli-config node prototypes/firebase-vault/provision-service.mjs \
  /outside/git/new-vault-service-proof cruxcontrol-auth-20261010 provision
```

Provisioning configures a $5 monthly project budget with $1/$2.50/$5 alerts,
a runtime service account with only `firebaseauth.users.get` at project scope,
and Object Creator/Viewer on a private Standard bucket in `us-central1`.
The bucket enforces uniform access and public-access prevention, has seven-day
soft delete and no lifecycle deletion. Policy and configuration readbacks reject
unexpected public access or runtime permissions. Transient API-enablement
`SERVICE_DISABLED` errors receive bounded read retries; writes are not blindly
retried. Private inspection/provision evidence stays with the package.

The owner linked billing and provision readback passed. The function is active
with Node 22, 512 MiB, 1 CPU, concurrency/max-instances 1, a 60-second timeout and
the dedicated runtime identity. Seven-day cleanup applies only to function build
artifacts, never library snapshots. This provisioning command does not link
billing, deploy the function or upload snapshots. Budget alerts are notifications,
not spending caps.

### Live proof and recovery boundary

Native upload of a 7,993-byte synthetic eight-climb/three-playlist backup to slot
`00` returned 201 with verified readback. Native download returned exact bytes;
an identical retry returned 200 with the same receipt/generation and a conflicting
replacement returned 409. An independent empty emulator selected the existing
authorized Google account, signed into the same UID, discovered/downloaded the
snapshot and imported it through Android DocumentsUI. Complete library contents
matched after import and cold restart. This was **operator-assisted cloud download
followed by portable-file restore**, not integrated app cloud restore or automatic
scheduling. An initial native list returned 401 for an unestablished cause;
after a diagnostic redeploy it returned 200, without an auth-validation change.

The live-storage verifier additionally checks runtime IAM, competing GCS creates,
forbidden overwrite/delete and genuine other-account/anonymous denial. It needs
explicit authorization: it temporarily grants the admitted operator token-creator
permission on the dedicated runtime identity, writes to an unused synthetic race
slot, and creates a temporary synthetic Firebase user. Its `finally` cleanup
removes the added operator grant and temporary user; snapshots are retained.

```bash
XDG_CONFIG_HOME=/outside/git/firebase-cli-config node --experimental-strip-types prototypes/firebase-vault/verify-live-storage.mjs \
  /outside/git/auth-evidence/session.json /outside/git/synthetic-library.json \
  /outside/git/firebase/google-services.json /outside/git/new-live-storage-evidence \
  cruxcontrol-auth-20261010 04
```

The output directory must be new, the operator must match the admitted account,
and the optional race slot (default `01`) must be unused; `00`/`02` are forbidden
race slots and `02` must remain empty for the denied-upload check. The script never
resets retained snapshots. The final live run passed: runtime permissions were
exactly create/get/list; competing distinct creates had one winner and one 412;
overwrite/delete returned 403 and the original slot `00` was unchanged. A genuine
different Firebase user's verified token received 403 for discovery/upload;
anonymous/invalid tokens received 401. The temporary operator grant was removed,
and synthetic test identities were cleaned up. Keep all evidence outside Git.

A 25 MiB upload returned 201, but the original native download exhausted memory
while converting the payload for JavaScript. SignedProof19 fixes this by streaming
GET to a private native cache file and returning filename/digest/size metadata.
The emulator driver uses ADB to extract that exact file, checks size, SHA-256 and
the strict backup codec, saves the response in private evidence and removes only
the temporary cache file. The full 26,214,400-byte round trip passed with exact
fixture equality; subsequent forced refresh succeeded with the app alive. The
same-key update preserved the backed-up library without resetting storage. ADB
extraction is proof tooling, not a delivered app restore flow.

```bash
node prototypes/firebase-vault/cost-estimate.mjs
```

The script illustrates full aggregate admitted capacity before free allowances
(about $1.735/month at its rates checked 2026-10-10): 32 proof
slots, 512 application copies and four 512-copy acceptance pools, each capped at
25 MiB, or 2,592 full-sized copies. This is not expected owner usage; fewer or
smaller actual dogfood copies consume less storage. Its other assumptions include 730 hours, 1,000 requests, 2,000 billable
instance seconds at 1 CPU/0.5 GiB, 1,000 class-A/5,000 class-B storage operations,
1 GiB North America egress, 1 GiB build artifacts and 30 build minutes with a
100 GiB build disk. This is arithmetic for stated assumptions, not measured
spending, a cap or a readiness claim; taxes, unrelated usage and usage beyond
those assumptions are excluded. Configured billing alerts are not hard caps.
Application retention uses usage pricing, not a fixed $25/month plan.
