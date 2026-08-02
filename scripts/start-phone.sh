#!/usr/bin/env bash

set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
preview_port="${CRUXCONTROL_PORT:-4173}"
runtime_dir="${TMPDIR:-/tmp}/cruxcontrol-phone-${UID}"
preview_log="${runtime_dir}/preview.log"
preview_pid="${runtime_dir}/preview.pid"

for command_name in adb npm curl; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
done

if ! adb get-state >/dev/null 2>&1; then
  echo "Connect and unlock the Android phone, then approve USB debugging." >&2
  adb devices >&2
  exit 1
fi

mkdir -p "${runtime_dir}"
cd "${project_dir}"

echo "Building CruxControl..."
npm run build

if [[ -f "${preview_pid}" ]] && kill -0 "$(<"${preview_pid}")" 2>/dev/null; then
  kill "$(<"${preview_pid}")"
  for _ in {1..20}; do
    kill -0 "$(<"${preview_pid}")" 2>/dev/null || break
    sleep 0.1
  done
fi

echo "Starting CruxControl preview server..."
nohup npm run preview -- --host 127.0.0.1 --port "${preview_port}" \
  >"${preview_log}" 2>&1 &
echo "$!" >"${preview_pid}"

for _ in {1..50}; do
  if curl --fail --silent "http://127.0.0.1:${preview_port}/" >/dev/null; then
    break
  fi
  sleep 0.1
done

if ! curl --fail --silent "http://127.0.0.1:${preview_port}/" >/dev/null; then
  echo "Preview server did not start. Log: ${preview_log}" >&2
  exit 1
fi

adb reverse "tcp:${preview_port}" "tcp:${preview_port}" >/dev/null
app_url="http://localhost:${preview_port}/?refresh=$(date +%s)"
adb shell am start -a android.intent.action.VIEW -d "${app_url}" >/dev/null

echo "CruxControl is open on the phone: ${app_url}"
echo "Preview log: ${preview_log}"
