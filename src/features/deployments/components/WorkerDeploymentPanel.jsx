/**
 * WorkerDeploymentPanel — the deployment summary shown on an employee
 * profile. Read-only: a Deployment is born automatically once its source
 * Mobilisation is Approved, and every action on it (monthly hours, Release)
 * lives on its own detail page — this panel just links there.
 *
 * States:
 *  - active deployment  → current-placement summary + link to its detail page
 *  - no active + not Exited → "not deployed" note (deploy via Mobilisation)
 *  - Exited employee    → a note (exited workers aren't deployed)
 * Below that, the worker's ended deployments render as history, each linking
 * to its own detail page too.
 */
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listDeployments } from '../deployments.api.js';
import { formatDate } from '../../../lib/utils.js';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function WorkerDeploymentPanel({ employee }) {
  const { t } = useTranslation();
  const workerId = employee._id;

  const { data, isPending } = useQuery({
    queryKey: ['deployments', { worker: workerId }],
    queryFn: () => listDeployments({ worker: workerId, limit: 100 }),
  });

  if (isPending) return <Skeleton className="h-40 w-full" />;

  const items = data?.items ?? [];
  const active = items.find((d) => d.status === 'Active') ?? null;
  const history = items.filter((d) => d.status !== 'Active');

  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffDeployments.panel.title')}</h2>

        {active ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="success">{t('common.status.Active')}</Badge>
                <Link to={`/clients/${active.client}`} className="font-medium hover:text-primary">
                  {active.clientName}
                </Link>
              </div>
              <p className="text-sm text-muted">
                {t('staffDeployments.panel.activeSince', { client: active.clientName, date: formatDate(active.startDate) })}
              </p>
            </div>
            <Link to={`/deployments/${active._id}`}>
              <Button size="sm" variant="secondary">
                {t('staffDeployments.panel.viewDeployment')}
              </Button>
            </Link>
          </div>
        ) : employee.status === 'Exited' ? (
          <p className="text-sm text-muted">{t('staffDeployments.panel.exitedNote')}</p>
        ) : (
          <p className="text-sm text-muted">{t('staffDeployments.panel.notDeployed')}</p>
        )}
      </Card>

      {history.length > 0 && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('staffDeployments.panel.historyTitle')}
          </h2>
          <div className="divide-y divide-border">
            {history.map((d) => (
              <Link
                key={d._id}
                to={`/deployments/${d._id}`}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0 hover:text-primary"
              >
                <div>
                  <p className="font-medium">
                    {d.clientName}
                    {d.site && ` · ${d.site}`}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(d.startDate)} → {formatDate(d.endDate)}
                  </p>
                </div>
                <Badge>{d.endReason ?? t('common.status.Ended')}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
