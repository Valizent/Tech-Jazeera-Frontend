/**
 * Summary tab — per-worker status counts over a date range, with Excel/PDF
 * export. Defaults to the current month.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getSummary, downloadExport } from '../attendance.api.js';
import { monthRange, todayKey } from '../attendance.dates.js';
import { ATTENDANCE_STATUSES } from '../../../lib/constants.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Table from '../../../components/ui/Table.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function SummaryTab() {
  const toast = useToast();
  const { t } = useTranslation();
  const thisMonth = monthRange(todayKey());
  const [from, setFrom] = useState(thisMonth.from);
  const [to, setTo] = useState(thisMonth.to);
  const [exporting, setExporting] = useState(null); // 'xlsx' | 'pdf' | null

  const { data, isPending, isError } = useQuery({
    queryKey: ['attendance', 'summary', from, to],
    queryFn: () => getSummary({ from, to }),
    enabled: Boolean(from && to && from <= to),
  });

  async function handleExport(format) {
    setExporting(format);
    try {
      await downloadExport({ format, from, to });
    } catch (error) {
      toast.error(apiMessage(error, t('staffAttendance.summary.exportFailed')));
    } finally {
      setExporting(null);
    }
  }

  const columns = [
    {
      key: 'fullName',
      header: t('staffAttendance.summary.worker'),
      render: (r) => (
        <span>
          {r.fullName}
          <span className="block text-xs text-muted">{r.employeeId}</span>
        </span>
      ),
    },
    ...ATTENDANCE_STATUSES.map((s) => ({
      key: s,
      header: t(`common.status.${s}`, s),
      className: 'text-center tabular-nums',
      render: (r) => r[s] || 0,
    })),
    {
      key: 'total',
      header: t('staffAttendance.summary.total'),
      className: 'text-center font-semibold tabular-nums',
      render: (r) => r.total,
    },
  ];

  const rows = data?.rows ?? [];
  const rangeValid = from && to && from <= to;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-3">
          <Input label={t('staffAttendance.signInOut.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="sm:max-w-[170px]" />
          <Input label={t('staffAttendance.signInOut.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} className="sm:max-w-[170px]" />
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => handleExport('xlsx')}
            isLoading={exporting === 'xlsx'}
            disabled={!rangeValid || rows.length === 0}
          >
            {t('staffAttendance.summary.exportExcel')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleExport('pdf')}
            isLoading={exporting === 'pdf'}
            disabled={!rangeValid || rows.length === 0}
          >
            {t('staffAttendance.summary.exportPdf')}
          </Button>
        </div>
      </div>

      {!rangeValid ? (
        <EmptyState title={t('staffAttendance.signInOut.invalidRange')} description={t('staffAttendance.signInOut.invalidRangeDescription')} />
      ) : isError ? (
        <EmptyState title={t('staffAttendance.summary.couldNotLoad')} description={t('staffAttendance.summary.couldNotLoadDescription')} />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.employee}
          loading={isPending}
          emptyState={
            <EmptyState
              title={t('staffAttendance.summary.emptyTitle')}
              description={t('staffAttendance.summary.emptyDescription')}
            />
          }
        />
      )}
    </div>
  );
}
