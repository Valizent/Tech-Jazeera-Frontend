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

function DetailRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs font-medium text-text ${valueClass}`}>{value}</span>
    </div>
  );
}

function InvoiceRow({ row, isOpen, onToggle, t }) {
  const isSupplier = row.workerType === 'SupplierEmployee';

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
            <div className="rounded-xl border border-border/60 bg-surface/70 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">

              {/* Client Rates */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Client</p>
                <div className="space-y-0">
                  <DetailRow label="Client Rate / hr" value={row.clientRate != null ? formatMoney(row.clientRate) : '—'} />
                  <DetailRow label="Client Commission / hr" value={row.clientCommission != null ? formatMoney(row.clientCommission) : '—'} />
                  <DetailRow label="Invoice Amount" value={formatMoney(row.revenue)} valueClass="text-primary" />
                </div>
              </div>

              {/* Subcontractor Rates (only for SupplierEmployee) */}
              {isSupplier && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Subcontractor</p>
                  <div className="space-y-0">
                    <DetailRow label="Sub Rate / hr" value={row.subcontractorRate != null ? formatMoney(row.subcontractorRate) : '—'} />
                    <DetailRow label="Sub Commission / hr" value={row.subcontractorCommission != null ? formatMoney(row.subcontractorCommission) : '—'} />
                    <DetailRow label="Sub Invoice" value={formatMoney(row.breakdown?.subContractorInvoiceAmount ?? 0)} valueClass="text-danger" />
                  </div>
                </div>
              )}

              {/* Expenses */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Expenses</p>
                <div className="space-y-0">
                  {(row.fta ?? 0) > 0 && <DetailRow label="FTA" value={formatMoney(row.fta)} />}
                  {(row.allowance ?? 0) > 0 && <DetailRow label="Allowance" value={formatMoney(row.allowance)} />}
                  {(row.deductionAmount ?? 0) > 0 && <DetailRow label="Deduction" value={formatMoney(row.deductionAmount)} />}
                  {(row.mobilisationCost ?? 0) > 0 && <DetailRow label="Mob. Cost" value={formatMoney(row.mobilisationCost)} />}
                  {(row.breakdown?.otCalculations ?? 0) > 0 && <DetailRow label="OT Cost" value={formatMoney(row.breakdown.otCalculations)} />}
                  <DetailRow label="Total Expenses" value={formatMoney(row.expenses ?? 0)} valueClass="text-danger" />
                </div>
              </div>

              {/* Hours + Net */}
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Summary</p>
                <div className="space-y-0">
                  <DetailRow label="Actual Hours" value={row.actualHours ?? '—'} />
                  {(row.otHours ?? 0) > 0 && <DetailRow label="OT Hours" value={row.otHours} />}
                  <DetailRow
                    label="Net Profit"
                    value={formatMoney(row.profit ?? 0)}
                    valueClass={(row.profit ?? 0) >= 0 ? 'text-success' : 'text-danger'}
                  />
                  <DetailRow label="Paid" value={formatMoney(row.amountAllocated)} valueClass="text-success" />
                  {!row.fullyPaid && <DetailRow label="Balance Due" value={formatMoney(row.balanceDue)} valueClass="text-danger" />}
                </div>
              </div>
            </div>
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
