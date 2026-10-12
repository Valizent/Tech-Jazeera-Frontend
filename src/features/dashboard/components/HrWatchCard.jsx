/**
 * HrWatchCard: the people-side look-ahead. Identity documents about to lapse
 * (by type and how soon), contracts ending within 30 days (the people who
 * become eligible for annual vacation), and who is away today / back this
 * week. A Coordinator's version covers their own team only (the server scopes it).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatDate, cn } from '../../../lib/utils.js';

const COLUMNS = ['expired', 'd30', 'd60', 'd90'];

function Section({ title, children }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </div>
  );
}

function PeopleList({ people, dateKey, dateLabelKey, emptyLabel }) {
  const { t } = useTranslation();
  return (
    <ul className="space-y-1 text-sm">
      {people.length === 0 && <li className="text-muted">{emptyLabel}</li>}
      {people.map((p) => (
        <li key={p._id} className="flex justify-between gap-2">
          <span className="truncate">{p.name}</span>
          <span className="shrink-0 text-xs text-muted">{t(dateLabelKey, { date: formatDate(p[dateKey]) })}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HrWatchCard({ expiring, contracts, leavePicture }) {
  const { t } = useTranslation();
  const hasExpiring = expiring?.length > 0;
  const hasContracts = contracts?.count > 0;
  const hasLeave = leavePicture && (leavePicture.onLeaveCount > 0 || leavePicture.returningCount > 0);
  if (!hasExpiring && !hasContracts && !hasLeave) return null;

  const k = (key) => t(`staffDashboard.insights.hr.${key}`);
  return (
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{k('title')}</h2>
      <div className="space-y-5">
        {hasExpiring && (
          <Section title={k('lapsing')}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="py-1 text-start font-medium" />
                  {COLUMNS.map((c) => (
                    <th key={c} className="py-1 text-center font-medium">{k(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expiring.map((row) => (
                  <tr key={row.type}>
                    <td className="py-1.5 font-medium">{row.label}</td>
                    {COLUMNS.map((c) => (
                      <td
                        key={c}
                        className={cn('py-1.5 text-center tabular-nums', row[c] > 0 && (c === 'expired' || c === 'd30') ? 'font-semibold text-danger' : 'text-muted')}
                      >
                        {row[c]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
        {hasContracts && (
          <Section title={`${k('contracts')} · ${contracts.count}`}>
            <ul className="divide-y divide-border">
              {contracts.items.map((e) => (
                <li key={e._id}>
                  <Link to={`/employees/${e._id}`} className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-primary">
                    <span className="truncate">{e.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {formatDate(e.endDate)} · {t('staffDashboard.insights.hr.daysLeft', { days: e.daysLeft })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {hasLeave && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Section title={`${k('onLeave')} · ${leavePicture.onLeaveCount}`}>
              <PeopleList people={leavePicture.onLeave} dateKey="until" dateLabelKey="staffDashboard.insights.hr.until" emptyLabel={k('nobody')} />
            </Section>
            <Section title={`${k('returning')} · ${leavePicture.returningCount}`}>
              <PeopleList people={leavePicture.returning} dateKey="returnsOn" dateLabelKey="staffDashboard.insights.hr.backOn" emptyLabel={k('nobody')} />
            </Section>
          </div>
        )}
      </div>
    </Card>
  );
}
