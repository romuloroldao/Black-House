#!/usr/bin/env bash
# Wrapper: drena backlog de poses e restaura o job da API no fim.
set -euo pipefail
cd /root
LOG=/tmp/pose-drain.log
export POSE_DRAIN_IDLE_MS="${POSE_DRAIN_IDLE_MS:-4000}"
echo "[wrapper] start $(date -Is) idle=${POSE_DRAIN_IDLE_MS}" | tee -a "$LOG"
set +e
npm run pose:drain 2>&1 | tee -a "$LOG"
code=${PIPESTATUS[0]}
set -e
echo "[wrapper] drain exit=$code $(date -Is)" | tee -a "$LOG"

# Restaura limite do job para fotos novas
sed -i 's/^POSE_DAILY_CLASSIFY_LIMIT=.*/POSE_DAILY_CLASSIFY_LIMIT=200/' /root/server/.env
pm2 restart blackhouse-api --update-env
echo "[wrapper] restored POSE_DAILY_CLASSIFY_LIMIT=200 and restarted API" | tee -a "$LOG"
exit "$code"
