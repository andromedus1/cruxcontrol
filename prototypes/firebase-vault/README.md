# Firebase private-vault policy proof

This isolated prototype explores direct Storage Rules and an authenticated
service using synthetic backup bytes. It does not implement scheduled app backup
or full cloud library restore, enable billing, create a bucket or deploy code.
Native account recovery has separately passed on
an independent fresh emulator with the same UID and forced refresh before and
after restart; cloud library recovery remains unimplemented.

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
blocker; a todo is not passing acceptance. The next proof must establish atomic
creation and address bearer URLs. The service candidate below explores that
boundary; no production app or provider has been selected. No billing activation
or deployment approval is requested by this proof.

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
or store `getDownloadURL` results. The production access boundary and live-provider
tests remain unresolved.

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
configured UID. Its only routes are `GET /snapshots`, `GET /snapshots/00`–`31`
and `PUT` to those slots. Uploads must pass the app's whole-library backup codec
and SHA-256 validation within 25 MiB. GCS creation uses `ifGenerationMatch: 0`;
identical retries can recover a receipt, while conflicting bytes are rejected.
The handler verifies exact object readback before returning `verified: true`.
There is no delete, overwrite, automatic pruning or tokenized download URL API.

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

Ten local tests pass: handler tests use real local HTTP with injected identity
verification and storage; a GCS SDK wire fixture checks create preconditions,
generation-pinned reads and absence of destructive requests. These do not prove
live GCS/IAM enforcement, genuine service-side token verification or native
service access. The original direct-SDK race todo remains unresolved.

Preparation requires a new private output directory and successful native
`verifySession` evidence. It packages the built service with the bundled backup
codec, dependency lock, local UID configuration, `firebase.json` and
`resource-plan.json`. The resource plan records proposed restricted IAM, bucket
access controls and a finite snapshot pool; these are plans, not provisioned
resources. Preparation makes no cloud authentication, provenance-verification,
deployment or billing calls. Keep the complete package and evidence outside Git.
Billing is still disabled, and Android compilation/native service acceptance
remain pending.

```bash
node prototypes/firebase-vault/cost-estimate.mjs
```

The script's illustrative proof month totals about **$0.485 before free
allowances**: 730 hours, 32 × 25 MiB snapshots, 1,000 requests, 2,000 billable
instance seconds at 1 CPU/0.5 GiB, 1,000 class-A/5,000 class-B storage operations,
1 GiB North America egress, 1 GiB build artifacts and 30 build minutes with a
100 GiB build disk. This is arithmetic for stated assumptions, not measured
spending, a cap or a readiness claim; taxes, unrelated usage and usage beyond
those assumptions are excluded. Proposed billing alerts are not hard caps.
