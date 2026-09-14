/**
 * PayrollListPage — every payroll run (P2-M5), newest first, with a "Run
 * payroll" action that builds a Draft for a chosen month from real
 * employee salaries and Approved timesheets.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import { listPayrollRuns, createPayrollRun } from '../payroll.api.js';
import { apiMessage, formatMoney } from '../../../lib/utils.js';
import { PAYROLL_STATUS_VARIANT, MONTH_NAMES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Table from '../../../components/ui/Table.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Select from '../../../components/ui/Select.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

const now = new Date();

export default function PayrollListPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // 'payroll' has a real Read/Write split — reaching this page only implies
  // Read (2026-09-14 fix, a real QA-audit-found gap: "Run payroll" was
  // unconditional, relying only on the server to reject a read-only viewer).
  const canWrite = Boolean(user.sectionAccessWrite?.includes('payroll'));

  const [creating, setCreating] = useState(false);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['payroll'],
    queryFn: () => listPayrollRuns({ limit: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: () => createPayrollRun({ periodYear, periodMonth }),
    onSuccess: (run) => {
      toast.success(t('staffPayroll.list.createdToast', { month: t(`common.months.${run.periodMonth}`), year: run.periodYear }));
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      navigate(`/payroll/${run._id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const columns = [
    {
      key: 'period',
      header: t('staffPayroll.list.columns.period'),
      render: (r) => (
        <span className="font-medium text-text">
          {t(`common.months.${r.periodMonth}`)} {r.periodYear}
        </span>
      ),
    },
    { key: 'lines', header: t('staffPayroll.list.columns.employees'), hideOnMobile: true, render: (r) => r.lines?.length ?? '—' },
    { key: 'totalNet', header: t('staffPayroll.list.columns.totalNet'), className: 'text-right', render: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.totalNet)}</span> },
    { key: 'status', header: t('staffPayroll.list.columns.status'), render: (r) => <Badge variant={PAYROLL_STATUS_VARIANT[r.status]}>{t(`common.status.${r.status}`, r.status)}</Badge> },
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('staffPayroll.list.pageTitle')}
        description={t('staffPayroll.list.pageDescription')}
        onBack={() => navigate(-1)}
        actions={!isError && canWrite && <Button onClick={() => setCreating(true)}>{t('staffPayroll.list.runPayroll')}</Button>}
      />

      {isError ? (
        <EmptyState
          title={t('staffPayroll.list.noAccessTitle')}
          description={apiMessage(error) || t('staffPayroll.list.noAccessDefaultDescription')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      ) : (
        <Table
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r._id}
          loading={isPending}
          onRowClick={(r) => navigate(`/payroll/${r._id}`)}
          emptyState={
            <EmptyState
              title={t('staffPayroll.list.emptyTitle')}
              description={t('staffPayroll.list.emptyDescription')}
              action={canWrite && <Button onClick={() => setCreating(true)}>{t('staffPayroll.list.runPayroll')}</Button>}
            />
          }
        />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title={t('staffPayroll.list.modalTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {t('staffPayroll.list.modalDescription')}
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('staffPayroll.list.month')} value={periodMonth} onChange={(e) => setPeriodMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {t(`common.months.${i + 1}`)}
                </option>
              ))}
            </Select>
            <Select label={t('staffPayroll.list.year')} value={periodYear} onChange={(e) => setPeriodYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={createMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button isLoading={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {t('staffPayroll.list.buildDraft')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
