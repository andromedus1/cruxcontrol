# Firebase private-vault policy proof

This isolated prototype tests Storage Rules against synthetic identities and
backup bytes. It does not implement app backup or library restore, enable billing,
create a bucket or deploy rules. Native account recovery has separately passed on
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
blocker; a todo is not passing acceptance. The next design must enforce atomic
object-create preconditions at a trusted boundary and address bearer URLs. No
billing activation or deployment approval is requested by this proof.

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
