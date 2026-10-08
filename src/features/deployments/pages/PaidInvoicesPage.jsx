/**
 * PaidInvoicesPage — every payment toward an invoice, one row per payment (an
 * invoice paid in instalments appears once per payment). `side` picks the
 * money flow (see financialSides.js): 'client' is Received invoices,
 * 'subcontractor' is Paid Sub Invoices. Click a row for its breakdown.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FINANCIAL_SIDES } from '../financialSides.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatMoney, formatDate } from '../../../lib/utils.js';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import MonthlyEntryBreakdownPanel from '../components/MonthlyEntryBreakdown.jsx';

function InvoiceRow({ row, side, isOpen, onToggle, t }) {
  const partyName = side.partyName(row);
  return (
    <>
      {/* Main row */}
      <tr
        className="group transition-all duration-200 drop-shadow-sm hover:-translate-y-px cursor-pointer"
        onClick={onToggle}
      >
        {/* Party + Worker */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-s border-border/40 rounded-s-xl group-hover:border-primary/30 transition-colors">
          <div className="font-semibold text-text text-sm">{partyName}</div>
          <div className="text-xs text-muted mt-0.5">{row.workerName}</div>
          {row.subcontractorName && row.subcontractorName !== partyName && (
            <div className="text-xs text-muted/70 mt-0.5">{row.subcontractorName}</div>
          )}
        </td>
        {/* Month */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text font-medium">{row.month}</span>
        </td>
        {/* Contract Hours */}
        <td className="px-4 py-3 align-middle text-end bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text">{row.contractHours ?? ''}</span>
        </td>
        {/* Timesheet Hours (the client's own actual hours for this month) */}
        <td className="px-4 py-3 align-middle text-end bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text">{row.actualHours ?? ''}</span>
        </td>
        {/* Invoice # */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-medium text-text">{row.invoiceNumber || ''}</div>
              {row.invoiceDate && <div className="text-xs text-muted mt-0.5">{formatDate(row.invoiceDate)}</div>}
            </div>
            {row.invoiceFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  side.downloadInvoice(row.deploymentId, row.entryId, row.invoiceFile.originalName);
                }}
                className="rounded-full p-1.5 text-muted hover:bg-border/60 hover:text-primary transition-colors"
                title={t('staffDeployments.detail.downloadInvoiceButton')}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v7.69l2.72-2.72a.75.75 0 111.06 1.06l-4 4a.75.75 0 01-1.06 0l-4-4a.75.75 0 111.06-1.06l2.72 2.72V3.75A.75.75 0 0110 3zm-6 10a.75.75 0 01.75.75v1.5c0 .414.336.75.75.75h9a.75.75 0 00.75-.75v-1.5a.75.75 0 111.5 0v1.5A2.25 2.25 0 0114.5 18h-9A2.25 2.25 0 013 15.75v-1.5A.75.75 0 014 13z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </td>
        {/* Invoice Amount */}
        <td className="px-4 py-3 align-middle text-end bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm font-semibold text-text">{formatMoney(row.revenue)}</span>
        </td>
        {/* Amount Paid: this ONE payment's own amount, not the invoice's
            cumulative total (2026-10-01, the user's own ask: a $3,000-then-
            $2,000 invoice shows as two rows here, not one $5,000 lump). */}
        <td className="px-4 py-3 align-middle text-end bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm font-semibold text-success">{formatMoney(row.amountAllocated)}</span>
          {row.paymentDate && <div className="text-xs text-muted mt-0.5">{formatDate(row.paymentDate)}</div>}
        </td>
        {/* Balance */}
        <td className="px-4 py-3 align-middle text-end bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className={`text-sm font-semibold ${row.fullyPaid ? 'text-muted' : 'text-danger'}`}>
            {formatMoney(row.fullyPaid ? 0 : row.balanceDue)}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-e border-border/40 rounded-e-xl group-hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={row.fullyPaid ? 'success' : 'warning'}>
              {row.fullyPaid ? t(`${side.paidNs}.statusPaid`) : t(`${side.paidNs}.statusPartial`)}
            </Badge>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </td>
      </tr>

      {/* Expandable detail panel */}
      {isOpen && (
        <tr>
          <td colSpan={9} className="px-4 pb-3">
            <MonthlyEntryBreakdownPanel row={row} formatMoney={formatMoney}>
              {/* "Paid" itself lives in the breakdown's first column
                  (2026-10-01); only Balance Due (when still outstanding)
                  stays here. */}
              {!row.fullyPaid && (
                <>
                  <div className="my-2 border-b border-border/40" />
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted">{t('staffFinancial.balanceDue')}</span>
                    <span className="text-xs font-medium text-danger">{formatMoney(row.balanceDue)}</span>
                  </div>
                </>
              )}
            </MonthlyEntryBreakdownPanel>
          </td>
        </tr>
      )}
    </>
  );
}

export default function PaidInvoicesPage({ side: sideName }) {
  const side = FINANCIAL_SIDES[sideName];
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openRowId, setOpenRowId] = useState(null);

  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: side.paidKey,
    queryFn: side.getPaid,
  });

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((r) =>
        side.partyName(r)?.toLowerCase().includes(lower) ||
        r.workerName?.toLowerCase().includes(lower) ||
        r.invoiceNumber?.toLowerCase().includes(lower)
      );
    }
    if (statusFilter === 'paid') result = result.filter((r) => r.fullyPaid);
    if (statusFilter === 'partial') result = result.filter((r) => !r.fullyPaid);
    return result;
  }, [rows, search, statusFilter, side]);

  const toggleRow = (id) => setOpenRowId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(`${side.paidNs}.title`)}
        description={t(`${side.paidNs}.subtitle`)}
        onBack={() => navigate(-1)}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t(side.searchPaidKey)}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-44">
          <option value="">{t('common.allStatuses')}</option>
          <option value="paid">{t(`${side.paidNs}.statusPaid`)}</option>
          <option value="partial">{t(`${side.paidNs}.statusPartial`)}</option>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <EmptyState title={t('staffFinancial.couldNotLoad')} description={t('common.checkConnection')} />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={t(`${side.paidNs}.emptyTitle`)}
          description={t(`${side.paidNs}.emptyDescription`)}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-separate border-spacing-y-[6px] text-sm px-4">
            <thead>
              <tr>
                {[
                  { label: t(side.partyLabelKey) },
                  { label: t('staffFinancial.month') },
                  { label: t('staffFinancial.contractHours'), end: true },
                  { label: t('staffFinancial.timesheetHours'), end: true },
                  { label: t('staffFinancial.invoiceNumber') },
                  { label: t('staffFinancial.invoiceAmount'), end: true },
                  { label: t('staffFinancial.paid'), end: true },
                  { label: t('staffFinancial.balance'), end: true },
                  { label: t('staffFinancial.status') },
                ].map(({ label, end }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-[13px] font-black uppercase tracking-wider text-text bg-border/30 first:rounded-s-xl last:rounded-e-xl whitespace-nowrap ${end ? 'text-end' : 'text-start'}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <InvoiceRow
                  key={row.rowId}
                  row={row}
                  side={side}
                  isOpen={openRowId === row.rowId}
                  onToggle={() => toggleRow(row.rowId)}
                  t={t}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border/40">
            {t(search || statusFilter ? 'staffFinancial.paymentCountFiltered' : 'staffFinancial.paymentCount', { count: filteredRows.length })}
          </div>
        </Card>
      )}
    </div>
  );
}
