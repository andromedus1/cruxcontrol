#!/bin/bash
# Native startup check; use only an isolated simulator with synthetic data.
set -euo pipefail
if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo 'Usage: smoke-simulator.sh <simulator-id> [artifact-directory]' >&2
  exit 2
fi
crux_simulator=$1
crux_artifacts=${2:-$(mktemp -d /tmp/cruxcontrol-ios-smoke.XXXXXX)}
crux_prototype=$(cd "$(dirname "$0")/.." && pwd)
export DEVELOPER_DIR=${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}
mkdir -p "$crux_artifacts"
if [ ! -f "$crux_prototype/ios/App/App/public/index.html" ]; then
  echo 'Run npm --prefix prototypes/ios run sync before the native smoke check.' >&2
  exit 1
fi
xcrun simctl bootstatus "$crux_simulator" -b > "$crux_artifacts/boot.log" 2>&1
xcodebuild -project "$crux_prototype/ios/App/App.xcodeproj" -scheme App \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$crux_artifacts/DerivedData" CODE_SIGNING_ALLOWED=NO build \
  > "$crux_artifacts/build.log" 2>&1
xcrun simctl install "$crux_simulator" "$crux_artifacts/DerivedData/Build/Products/Debug-iphonesimulator/App.app"
crux_launch=$(xcrun simctl launch --terminate-running-process "$crux_simulator" io.github.andromedus1.cruxcontrol.prototype)
crux_pid=${crux_launch##*: }
# A successful simctl launch can precede a UIKit rejection; require survival.
sleep 5
if ! kill -0 "$crux_pid" 2>/dev/null; then
  echo "FAIL: prototype exited during startup. Build evidence: $crux_artifacts" >&2
  exit 1
fi
xcrun simctl io "$crux_simulator" screenshot "$crux_artifacts/startup.png"
echo "PASS: native process survived startup. Inspect $crux_artifacts/startup.png for the workspace."
echo 'This check does not validate native library operations or physical Bluetooth.'
