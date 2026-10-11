// Illustrative proof-month arithmetic, not measured usage or a spending cap.
const components = {
  snapshotStorage: (32 * 25 / 1024) * 730 * 0.000027397,
  functionCpu: 2000 * 0.000024,
  functionMemory: 2000 * 0.5 * 0.0000025,
  functionRequests: 1000 / 1_000_000 * 0.40,
  storageClassA: 1000 / 1000 * 0.005,
  storageClassB: 5000 / 1000 * 0.0004,
  northAmericaEgress: 1 * 0.12,
  buildArtifacts: 1 * 730 * 0.000136986,
  buildCpu: 30 * 0.006,
  buildDisk: 100 * 0.5 * 0.000232877,
};
console.log(JSON.stringify({
  currency: 'USD', checked: '2026-10-10', kind: 'illustrative-before-free-allowances', components,
  total: Object.values(components).reduce((sum, value) => sum + value, 0),
  assumptions: { monthHours: 730, snapshots: 32, maxSnapshotMiB: 25, requests: 1000,
    totalBillableInstanceSeconds: 2000, functionCpu: 1, functionGiB: 0.5, classA: 1000, classB: 5000,
    northAmericaOutboundGiB: 1, retainedArtifactGiB: 1, buildMinutes: 30,
    buildMachine: 'e2-standard-2', buildDiskGiB: 100 },
  excluded: ['taxes', 'other project/account usage', 'usage beyond these assumptions',
    'billable logging beyond free allowance', 'optional scanning or paid add-ons'],
  hardCap: false,
  sources: ['https://cloud.google.com/run/pricing', 'https://cloud.google.com/storage/pricing',
    'https://cloud.google.com/vpc/network-pricing', 'https://cloud.google.com/artifact-registry/pricing',
    'https://cloud.google.com/build/pricing'],
}, null, 2));
