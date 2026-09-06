#!/usr/bin/env bash
#
# Cloud-session setup for enumeratio (Claude Code on the web / `claude --cloud`).
#
# WIRE IT UP (one-time, per cloud environment):
#   At claude.ai/code, open the environment selector, edit the environment, and set the
#   **Setup script** field to:
#
#       bash scripts/cloud-setup.sh
#
#   The repo is cloned before the setup script runs, so it can reference this file. What
#   the script writes to disk (node_modules) is snapshotted into the environment cache,
#   so later sessions start with dependencies already present. See
#   https://code.claude.com/docs/en/cloud-environments#setup-scripts
#
# NETWORK ACCESS (a web-UI setting — it cannot be committed to the repo):
#   Some data/docs tasks reach the live FindStat and OEIS sites (e.g. verifying a
#   statistic's FindStat id, or an OEIS anchor). Those hosts are NOT on the default
#   **Trusted** allowlist, so a session at **Trusted** gets a 403 for them. In the same
#   environment dialog set **Network access** to one of:
#     - **Full**   — any domain. Simplest, and fine for this open-source project.
#     - **Custom** — least-privilege allowlist; add (one per line), and keep the
#                    "include default package managers" box checked:
#                        www.findstat.org
#                        findstat.org
#                        oeis.org
#   A network-level change applies to NEW sessions, not ones already running.
#
# The script also runs cleanly on a normal machine, so `bash scripts/cloud-setup.sh` is
# a fine local bootstrap too.

set -euo pipefail

cd "$(dirname "$0")/.."

# Corepack activates the pnpm version pinned in package.json ("packageManager"); harmless
# if pnpm is already on PATH.
corepack enable || true

# A fresh clone has no node_modules — install the workspace before any run.mts / build
# (warm install is a few seconds; see AGENTS.md).
pnpm install
