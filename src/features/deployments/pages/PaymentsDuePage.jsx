/**
 * PaymentsDuePage (2026-09-27, the user's own ask) — every invoiced-but-not-
 * yet-fully-paid month, soonest-due first. A Coordinator sees only
 * mobilisations they're on; anyone with 'mobilisationsViewer' (this
 * company's real MM already holds it, plus Admin) sees everything — see
 * deployment.service.js's getPaymentsDue for the exact visibility rule.
 * No dedicated Section Access gate on the route itself: the data is already
 * correctly scoped server-side, so an ungranted viewer just sees an empty
 * list, same reasoning MobilisationDetailPage's own worker-history page
 * gives for skipping a Section Access key on a narrowly-scoped page.
 */
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getPaymentsDue } from '../deployments.api.js';
import { formatDate, formatMoney } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function urgencyVariant(daysRemaining) {
  if (daysRemaining == null) return 'default';
  if (daysRemaining < 0) return 'danger';
  if (daysRemaining <= 5) return 'warning';
  return 'default';
}

export default function PaymentsDuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'payments-due'],
    queryFn: getPaymentsDue,
  });

  const columns = [
    {
      key: 'worker',
      header: t('staffDeployments.paymentsDue.columns.worker'),
      render: (row) => (
        <span className="font-medium text-text">
          {row.workerName}
          <span className="block text-xs font-normal text-muted">{row.clientName}</span>
        </span>
      ),
    },
    { key: 'month', header: t('staffDeployments.paymentsDue.columns.month'), render: (row) => row.month },
    {
      key: 'invoice',
      header: t('staffDeployments.paymentsDue.columns.invoice'),
      render: (row) => (
        <span>
          {row.invoiceNumber ?? '—'}
          {row.invoiceDate && <span className="block text-xs text-muted">{formatDate(row.invoiceDate)}</span>}
        </span>
      ),
    },
    {
      key: 'amount',
      header: t('staffDeployments.paymentsDue.columns.amount'),
      render: (row) => (row.amountReceived > 0 ? formatMoney(row.amountReceived) : '—'),
    },
    {
      key: 'status',
      header: t('staffDeployments.paymentsDue.columns.status'),
      render: (row) =>
        row.paymentDecisionStatus === 'Pending' ? (
          <Badge variant="warning">{t('staffDeployments.paymentsDue.statusPending')}</Badge>
        ) : row.paymentDecisionStatus === 'Rejected' ? (
          <Badge variant="danger">{t('staffDeployments.paymentsDue.statusRejected')}</Badge>
        ) : (
          <Badge variant="default">{t('staffDeployments.paymentsDue.statusAwaiting')}</Badge>
        ),
    },
    {
      key: 'due',
      header: t('staffDeployments.paymentsDue.columns.due'),
      render: (row) => (
        <Badge variant={urgencyVariant(row.daysRemaining)}>
          {row.daysRemaining == null
            ? '—'
            : row.daysRemaining < 0
              ? t('staffDeployments.paymentsDue.overdueBy', { days: Math.abs(row.daysRemaining) })
              : t('staffDeployments.paymentsDue.dueInDays', { days: row.daysRemaining })}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={t('staffDeployments.paymentsDue.pageTitle')}
        description={t('staffDeployments.paymentsDue.pageDescription')}
        onBack={() => navigate(-1)}
      />

      {isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <EmptyState title={t('staffDeployments.paymentsDue.couldNotLoad')} description={t('common.checkConnection')} />
      ) : (
        <Card>
          <Table
            columns={columns}
            rows={data}
            rowKey={(row) => `${row.deploymentId}-${row.entryId}`}
            onRowClick={(row) => navigate(`/deployments/${row.deploymentId}`)}
            emptyState={
              <EmptyState
                title={t('staffDeployments.paymentsDue.emptyTitle')}
                description={t('staffDeployments.paymentsDue.emptyDescription')}
              />
            }
          />
        </Card>
      )}
    </div>
  );
}
