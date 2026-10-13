// Public Firebase app configuration only. Never accepts CLI credentials or service keys.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const [configFile, expectedProject] = process.argv.slice(2);
assert(configFile && /^cruxcontrol-auth-[a-z0-9-]+$/.test(expectedProject ?? ""),
  "Usage: node prepare-android-auth-proof.mjs GOOGLE_SERVICES_JSON cruxcontrol-auth-PROOF_ID");
const source = JSON.parse(await readFile(configFile, "utf8"));
assert.equal(source.project_info?.project_id, expectedProject, "Wrong Firebase proof project");
const client = source.client?.find(entry =>
  entry.client_info?.android_client_info?.package_name === "io.github.andromedus1.cruxcontrol.prototype");
assert(client, "CruxControl Android registration missing");
const config = {
  projectId: expectedProject,
  appId: client.client_info.mobilesdk_app_id,
  apiKey: client.api_key?.[0]?.current_key,
  webClientId: client.oauth_client?.find(entry => entry.client_type === 3)?.client_id,
};
for (const [name, value] of Object.entries(config)) {
  assert(typeof value === "string" && value.length > 0, `Missing ${name}; finish Google provider setup first`);
}
const directory = new URL("../android/app/src/signedProof/assets/", import.meta.url);
await mkdir(directory, { recursive: true });
const target = new URL("auth-proof-config.json", directory);
await writeFile(target, JSON.stringify(config) + "\n", { mode: 0o600 });
console.log(`Prepared ignored native proof configuration at ${fileURLToPath(target)}`);
