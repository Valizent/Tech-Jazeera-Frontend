/**
 * Calendar-month rule for a deployment's monthly hours: how many months may
 * already be entered but have not been. The server re-checks every entry for
 * real (deployment.service.js); this only drives the red count on a placement.
 */
function monthStrOf(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonthsToStr(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number);
  return monthStrOf(new Date(y, m - 1 + n, 1));
}

/** The latest month hours may be entered for: while Active, only a month that
 *  has fully ended; once Ended, every month through the real end date. */
function maxEligibleMonth(deployment) {
  if (deployment.status === 'Ended' && deployment.endDate) return monthStrOf(deployment.endDate);
  return addMonthsToStr(monthStrOf(new Date()), -1);
}

/** Months that may be entered and have not been. `deployment` needs
 *  `startDate`, `status`, `endDate` and `monthlyHours[].month`. */
export function getMissingMonthsCount(deployment) {
  if (!deployment.startDate) return 0;
  const maxEligible = maxEligibleMonth(deployment);
  const entered = new Set((deployment.monthlyHours ?? []).map((m) => m.month));
  let count = 0;
  for (let month = monthStrOf(deployment.startDate); month <= maxEligible; month = addMonthsToStr(month, 1)) {
    if (!entered.has(month)) count++;
  }
  return count;
}
