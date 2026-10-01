import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getPaidInvoices } from '../deployments.api.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { formatMoney, formatDate } from '../../../lib/utils.js';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import MonthlyEntryBreakdownPanel from '../components/MonthlyEntryBreakdown.jsx';

function InvoiceRow({ row, isOpen, onToggle, t }) {
  return (
    <>
      {/* Main row */}
      <tr
        className="group transition-all duration-200 drop-shadow-sm hover:-translate-y-px cursor-pointer"
        onClick={onToggle}
      >
        {/* Client + Worker */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-l border-border/40 rounded-l-xl group-hover:border-primary/30 transition-colors">
          <div className="font-semibold text-text text-sm">{row.clientName}</div>
          <div className="text-xs text-muted mt-0.5">{row.workerName}</div>
          {row.subcontractorName && (
            <div className="text-xs text-muted/70 mt-0.5">{row.subcontractorName}</div>
          )}
        </td>
        {/* Month */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm text-text font-medium">{row.month}</span>
        </td>
        {/* Invoice # */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <div className="text-sm font-medium text-text">{row.invoiceNumber || '—'}</div>
          {row.invoiceDate && <div className="text-xs text-muted mt-0.5">{formatDate(row.invoiceDate)}</div>}
        </td>
        {/* Invoice Amount */}
        <td className="px-4 py-3 align-middle text-right bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm font-semibold text-text">{formatMoney(row.revenue)}</span>
        </td>
        {/* Amount Paid */}
        <td className="px-4 py-3 align-middle text-right bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className="text-sm font-semibold text-success">{formatMoney(row.amountAllocated)}</span>
        </td>
        {/* Balance */}
        <td className="px-4 py-3 align-middle text-right bg-surface border-y border-border/40 group-hover:border-primary/30 transition-colors">
          <span className={`text-sm font-semibold ${row.fullyPaid ? 'text-muted' : 'text-danger'}`}>
            {formatMoney(row.fullyPaid ? 0 : row.balanceDue)}
          </span>
        </td>
        {/* Status */}
        <td className="px-4 py-3 align-middle bg-surface border-y border-r border-border/40 rounded-r-xl group-hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between gap-2">
            <Badge variant={row.fullyPaid ? 'success' : 'warning'}>
              {row.fullyPaid ? t('staffDeployments.paidInvoices.statusPaid', 'Paid') : t('staffDeployments.paidInvoices.statusPartial', 'Partial')}
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
          <td colSpan={7} className="px-4 pb-3">
            <MonthlyEntryBreakdownPanel row={row} formatMoney={formatMoney}>
              {/* "Paid" itself now lives in the Client column (2026-10-01) —
                  only Balance Due (when still outstanding) stays here. */}
              {!row.fullyPaid && (
                <>
                  <div className="my-2 border-b border-border/40" />
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-muted">Balance Due</span>
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

export default function PaidInvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openRowId, setOpenRowId] = useState(null);

  const { data: rows = [], isPending, isError } = useQuery({
    queryKey: ['deployments', 'paid-invoices'],
    queryFn: getPaidInvoices,
  });

  const filteredRows = useMemo(() => {
    let result = rows;
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter((r) =>
        (r.clientName && r.clientName.toLowerCase().includes(lower)) ||
        (r.workerName && r.workerName.toLowerCase().includes(lower)) ||
        (r.invoiceNumber && r.invoiceNumber.toLowerCase().includes(lower))
      );
    }
    if (statusFilter === 'paid') result = result.filter((r) => r.fullyPaid);
    if (statusFilter === 'partial') result = result.filter((r) => !r.fullyPaid);
    return result;
  }, [rows, search, statusFilter]);

  const toggleRow = (id) => setOpenRowId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staffDeployments.paidInvoices.title', 'Paid Invoices')}
        description={t('staffDeployments.paidInvoices.subtitle', 'Every invoice that has received a payment — in part or in full — across all clients. Click a row to expand financial details.')}
        onBack={() => navigate(-1)}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={t('common.search', 'Search client, worker, invoice...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full sm:w-44">
          <option value="">{t('common.allStatuses', 'All statuses')}</option>
          <option value="paid">{t('staffDeployments.paidInvoices.statusPaid', 'Paid')}</option>
          <option value="partial">{t('staffDeployments.paidInvoices.statusPartial', 'Partial')}</option>
        </Select>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : isError ? (
        <EmptyState title="Could not load" description="Check your connection and try again." />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          title={t('staffDeployments.paidInvoices.emptyTitle', 'No paid invoices found')}
          description={t('staffDeployments.paidInvoices.emptyDescription', 'Once a client pays anything toward an invoice, in part or in full, it will appear here.')}
        />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full border-separate border-spacing-y-[6px] text-sm px-4">
            <thead className="text-left">
              <tr>
                {['Client / Worker', 'Month', 'Invoice #', 'Invoice Amt', 'Paid', 'Balance', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[13px] font-black uppercase tracking-wider text-text bg-border/30 first:rounded-l-xl last:rounded-r-xl whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <InvoiceRow
                  key={String(row.entryId)}
                  row={row}
                  isOpen={openRowId === String(row.entryId)}
                  onToggle={() => toggleRow(String(row.entryId))}
                  t={t}
                  onNavigate={() => navigate(`/deployments/${row.deploymentId}`)}
                />
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 text-xs text-muted border-t border-border/40">
            {filteredRows.length} {filteredRows.length === 1 ? 'invoice' : 'invoices'} {search || statusFilter ? '(filtered)' : ''}
          </div>
        </Card>
      )}
    </div>
  );
}
