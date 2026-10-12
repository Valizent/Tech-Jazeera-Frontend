/**
 * PortalTodayCard: the top of the portal home. One call (GET /me/overview)
 * answers what a Worker/Staff login wants to know on opening the app: am I
 * signed in, how much leave is left, where my requests stand, which of my
 * documents are about to lapse, and whether annual vacation is open to me.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getMyOverview } from '../ess.api.js';
import Badge from '../../../components/ui/Badge.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatDate, formatTime } from '../../../lib/utils.js';

function Tile({ title, children, to }) {
  const body = (
    <div className="h-full rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
  return to ? (
    <Link to={to} className="block transition-opacity hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export default function PortalTodayCard() {
  const { t } = useTranslation();
  const { data, isPending, isError } = useQuery({ queryKey: ['me', 'overview'], queryFn: getMyOverview, staleTime: 60_000 });
  const k = (key, opts) => t(`portalHome.${key}`, opts);

  if (isPending) return <Skeleton className="h-28 w-full" />;
  if (isError || !data) return null;

  const { today, leaveBalances, nextHoliday, requests, documentWarnings, contract } = data;
  const attendanceText = today.signedOut
    ? k('signedOutAt', { time: formatTime(today.checkOutTime) })
    : today.signedIn
      ? k('signedInAt', { time: formatTime(today.checkInTime) })
      : k('notSignedIn');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Tile title={k('title')} to="/me/attendance">
        <Badge variant={today.signedIn ? 'success' : 'warning'}>{attendanceText}</Badge>
        {nextHoliday && (
          <p className="mt-3 text-muted">
            {k('nextHoliday')}: <span className="font-medium text-text">{nextHoliday.name}</span> · {formatDate(nextHoliday.startDate)}
          </p>
        )}
      </Tile>

      <Tile title={k('leaveBalance')} to="/me/leave">
        {leaveBalances.length === 0 ? (
          <p className="text-muted">-</p>
        ) : (
          <ul className="space-y-1">
            {leaveBalances.map((b) => (
              <li key={b.leaveType} className="flex justify-between gap-2">
                <span>{b.leaveType}</span>
                <span className="text-muted">{k('daysLeft', { remaining: b.remainingDays, total: b.entitlementDays })}</span>
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <Tile title={k('myRequests')} to="/me/requests">
        <div className="flex gap-2">
          <Badge variant="warning">{k('pending')} · {requests.pending}</Badge>
          <Badge variant="success">{k('approved')} · {requests.approved}</Badge>
          <Badge variant="danger">{k('rejected')} · {requests.rejected}</Badge>
        </div>
      </Tile>

      {documentWarnings.length > 0 && (
        <Tile title={k('documents')}>
          <ul className="space-y-1">
            {documentWarnings.map((d) => (
              <li key={d.type} className="flex justify-between gap-2">
                <span>{d.label}</span>
                <Badge variant={d.daysLeft < 0 ? 'danger' : 'warning'}>{d.daysLeft < 0 ? k('expiredDoc') : k('daysShort', { days: d.daysLeft })}</Badge>
              </li>
            ))}
          </ul>
        </Tile>
      )}

      <Tile title={k('contract')} to="/me/annual-vacation">
        {contract.endDate ? (
          <p>{contract.daysLeft >= 0 ? k('contractEnds', { date: formatDate(contract.endDate), days: contract.daysLeft }) : k('contractEnded', { date: formatDate(contract.endDate) })}</p>
        ) : (
          <p className="text-muted">{k('contractNotSet')}</p>
        )}
        {contract.vacationEligible && <p className="mt-2 font-medium text-success">{k('vacationReady')}</p>}
      </Tile>
    </div>
  );
}
