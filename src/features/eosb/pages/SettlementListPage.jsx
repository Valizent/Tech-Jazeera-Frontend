/**
 * EOSB settlements list — every computed end-of-service settlement (P3-A).
 * The whole module (view/PDF/compute/delete) is Section Access key 'eosb'
 * now — reaching this page at all already implies full access, same
 * "successful load implies full action access" pattern as Payroll/Expenses.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listSettlements } from '../eosb.api.js';
import { formatDate, formatMoney } from '../../../lib/utils.js';
import { EXIT_REASON_LABELS } from '../../../lib/constants.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function SettlementListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isPending, isError } = useQuery({
    queryKey: ['eosb', { page, limit }],
    queryFn: () => listSettlements({ page, limit }),
    placeholderData: keepPreviousData,
  });

  const columns = [
    {
      key: 'employee',
      header: t('staffEosb.list.columns.employee'),
      render: (s) => (
        <span className="font-medium text-text">
          {s.employeeName}
          <span className="block text-xs font-normal text-muted">{s.employeeCode}</span>
        </span>
      ),
    },
    { key: 'exitDate', header: t('staffEosb.list.columns.exitDate'), render: (s) => formatDate(s.exitDate) },
    {
      key: 'exitReason',
      header: t('staffEosb.list.columns.reason'),
      hideOnMobile: true,
      render: (s) => <Badge variant={s.exitReason === 'Resignation' ? 'warning' : 'default'}>{t(`staffEosb.exitReasonLabels.${s.exitReason}`, EXIT_REASON_LABELS[s.exitReason])}</Badge>,
    },
    { key: 'serviceYears', header: t('staffEosb.list.columns.service'), hideOnMobile: true, render: (s) => t('staffEosb.list.serviceYearsSuffix', { years: s.serviceYears }) },
    { key: 'total', header: t('staffEosb.list.columns.total'), className: 'text-right', render: (s) => <span className="font-semibold tabular-nums">{formatMoney(s.totalSettlement)}</span> },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t('staffEosb.list.pageTitle')}
        description={t('staffEosb.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={<Button onClick={() => navigate('/eosb/new')}>{t('staffEosb.list.newSettlement')}</Button>}
      />

      {isError ? (
        <EmptyState title={t('staffEosb.list.couldNotLoad')} description={t('staffEosb.list.couldNotLoadDescription')} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(s) => s._id}
            loading={isPending}
            onRowClick={(s) => navigate(`/eosb/${s._id}`)}
            emptyState={
              <EmptyState
                title={t('staffEosb.list.emptyTitle')}
                description={t('staffEosb.list.emptyDescription')}
                action={<Button onClick={() => navigate('/eosb/new')}>{t('staffEosb.list.newSettlement')}</Button>}
              />
            }
          />

          {data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted">
              <span>
                {t('common.showingRange', { from: (data.page - 1) * limit + 1, to: Math.min(data.page * limit, data.total), total: data.total })}
              </span>
              <span className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t('common.previous')}
                </Button>
                <span className="tabular-nums">
                  {t('common.pageOf', { page: data.page, pages: data.pages })}
                </span>
                <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                  {t('common.next')}
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
