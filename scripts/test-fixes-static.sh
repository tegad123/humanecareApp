#!/usr/bin/env bash
set -euo pipefail

fail=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $name"
  else
    echo "FAIL: $name"
    fail=$((fail + 1))
  fi
}

check "No hardcoded admin email in access requests service" \
  bash -lc "! rg -n 'tegad8@gmail.com|DEFAULT_ADMIN_EMAIL' backend/src/modules/access-requests/access-requests.service.ts"

check "ADMIN_NOTIFICATION_EMAIL is used/documented" \
  rg -n "ADMIN_NOTIFICATION_EMAIL" backend/src/modules/access-requests/access-requests.service.ts .env.example

check "Approve/reject use transaction guard" \
  rg -n '\$transaction\(' backend/src/modules/access-requests/access-requests.service.ts

check "Approve uses pending token gate updateMany" \
  rg -n "updateMany\\(|status: 'pending'|approvalToken: token" backend/src/modules/access-requests/access-requests.service.ts

check "Access request endpoints throttled" \
  rg -n "@UseGuards\\(ThrottlerGuard\\)|@Throttle\\(" backend/src/modules/access-requests/access-requests.controller.ts

check "Invite endpoints throttled" \
  rg -n "invite/:token/validate|invite/:token/accept|@UseGuards\\(ThrottlerGuard\\)|@Throttle\\(" backend/src/modules/clinicians/clinicians.controller.ts

check "Billing resets portal loading in finally" \
  rg -n "setPortalLoading\\(false\\)" "frontend/app/(dashboard)/dashboard/billing/page.tsx"

check "Billing cancel has double-submit guard" \
  rg -n "if \\(cancelLoading\\) return|disabled=\\{cancelLoading\\}" "frontend/app/(dashboard)/dashboard/billing/page.tsx"

check "Billing operations clear error at start" \
  rg -n "setError\\(null\\)" "frontend/app/(dashboard)/dashboard/billing/page.tsx"

check "Tour waits for target readiness" \
  rg -n "waitForTourTarget" frontend/components/tour/tour-provider.tsx

check "Clinician zip uses allSettled and warning message" \
  rg -n "Promise\\.allSettled|could not be downloaded and were excluded" "frontend/app/(dashboard)/dashboard/clinicians/[id]/page.tsx"

check "Templates have error state + retry and no alert" \
  bash -lc "rg -n 'const \\[error, setError\\]|Try Again' 'frontend/app/(dashboard)/dashboard/templates/page.tsx' >/dev/null && ! rg -n 'alert\\(' 'frontend/app/(dashboard)/dashboard/templates/page.tsx' >/dev/null"

if [[ "$fail" -eq 0 ]]; then
  echo "All static checks passed."
  exit 0
fi

echo "$fail static check(s) failed."
exit 1
