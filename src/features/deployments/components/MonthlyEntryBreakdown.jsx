/**
 * MonthlyEntryBreakdownPanel — the expandable Client/Subcontractor/Expenses/
 * Summary financial breakdown for one Approved monthly-hours entry. Shared
 * between PaidInvoicesPage and ReadyToInvoicePage (2026-09-30) — the two
 * pages had carried byte-identical copies of this panel, which is exactly
 * how the redesign below would have drifted between them if left as two
 * copies to hand-edit in lockstep.
 *
 * Every figure here reads straight off `row.revenue`/`row.expenses`/
 * `row.profit`/`row.breakdown` — the same object deployment.service.js's
 * computeMonthlyRevenueAndExpenses returns, never re-derived client-side.
 * The Expenses column is a full itemized list of everything that composes
 * `row.expenses` (2026-09-30, the user's own ask, "so that it is easily
 * understandable") — its rows are not decorative, they sum to the same
 * Total Expenses figure the Summary column also shows.
 *
 * `children` lets each page append its own extra Summary rows (Paid Invoices'
 * Paid/Balance Due lines, Ready to Invoice's "View Deployment Details"
 * button) without this shared panel knowing about either page.
 */
import { useTranslation } from 'react-i18next';

function DetailRow({ label, value, valueClass = '', hint }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted" title={hint || undefined}>
        {label}
      </span>
      {/* `text-text` only as a fallback, never alongside valueClass Tailwind
          gives both utility classes equal specificity, so whichever is
          registered later in the generated stylesheet wins regardless of
          which appears later in this string; mixing them silently dropped
          every text-danger/text-success color below back to the default. */}
      <span className={`text-xs font-medium ${valueClass || 'text-text'}`}>{value}</span>
    </div>
  );
}

/** Red when this figure is a real cost to us, green when it's flipped
 *  favorably negative (e.g. a supplier deduction larger than the raw
 *  invoice), plain at exactly zero. */
function costColor(value) {
  if (value > 0) return 'text-danger';
  if (value < 0) return 'text-success';
  return '';
}

export default function MonthlyEntryBreakdownPanel({ row, formatMoney, children }) {
  const { t } = useTranslation();
  const k = (key) => t(`staffDeployments.breakdown.${key}`);
  const isSupplier = row.workerType === 'SupplierEmployee';
  const b = row.breakdown ?? {};
  const subInvoice = b.subContractorInvoiceAmount ?? 0;
  const subCommissionExpense = b.expenseSubCommission ?? 0;
  const supplierDeduction = b.supplierDeductionAmount ?? 0;
  const clientCommissionExpense = b.expenseClientCommission ?? 0;
  const expensesTotal = row.expenses ?? 0;
  const revenue = row.clientRevenue ?? row.revenue ?? 0;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/70 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
      {/* Client */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">{k('client')}</p>
        <div className="space-y-0">
          <DetailRow label={k('clientRate')} value={row.clientRate != null ? formatMoney(row.clientRate) : ''} />
          <DetailRow label={k('clientCommissionRate')} value={row.clientCommission != null ? formatMoney(row.clientCommission) : ''} />
          <DetailRow label={k('invoiceAmount')} value={formatMoney(revenue)} valueClass={revenue > 0 ? 'text-success' : ''} />
          <DetailRow label={k('invoiceCommissionExpense')} value={formatMoney(clientCommissionExpense)} valueClass={clientCommissionExpense > 0 ? 'text-danger' : ''} />
          {/* Only Paid Invoices' rows carry amountAllocated Ready to
              Invoice's rows are pre-invoice and simply don't have it, so
              this line only ever appears there (2026-10-01, the user's own
              ask to move it here from the Summary column). */}
          {row.amountAllocated != null && (
            <DetailRow label={k('paid')} value={formatMoney(row.amountAllocated)} valueClass="text-success" />
          )}
        </div>
      </div>

      {/* Subcontractor */}
      {isSupplier && (
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">{k('subcontractor')}</p>
          <div className="space-y-0">
            <DetailRow label={k('subRate')} value={row.subcontractorRate != null ? formatMoney(row.subcontractorRate) : ''} />
            <DetailRow label={k('subCommissionRate')} value={row.subcontractorCommission != null ? formatMoney(row.subcontractorCommission) : ''} />
            {/* Subcontractor hours are now a real, optional follow-up step
                (2026-10-01) a plain "Not entered yet" here, same spirit as
                `supplierHours == null` everywhere else in this app, rather
                than a silent 0 that could read as "confirmed zero hours". */}
            <DetailRow
              label={k('subHours')}
              value={row.supplierHours != null ? row.supplierHours : k('notEnteredYet')}
              valueClass={row.supplierHours == null ? 'text-muted' : ''}
            />
            {b.supplierOtHours > 0 && <DetailRow label={k('subOtHours')} value={b.supplierOtHours} />}
            <DetailRow label={k('subInvoice')} value={formatMoney(subInvoice)} valueClass={costColor(subInvoice)} />
            <DetailRow label={k('subCommissionExpense')} value={formatMoney(subCommissionExpense)} valueClass={subCommissionExpense > 0 ? 'text-danger' : ''} />
            {supplierDeduction > 0 && (
              <DetailRow
                label={k('supplierDeduction')}
                value={formatMoney(supplierDeduction)}
                valueClass="text-success"
                hint={row.supplierDeductionNote || undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Expenses every component of row.expenses, itemized */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">{k('expenses')}</p>
        <div className="space-y-0">
          {(row.fta ?? 0) > 0 && <DetailRow label={k('fta')} value={formatMoney(row.fta)} />}
          {(row.allowance ?? 0) > 0 && <DetailRow label={k('allowance')} value={formatMoney(row.allowance)} />}
          {(row.deductionAmount ?? 0) > 0 && <DetailRow label={k('clientDeduction')} value={formatMoney(row.deductionAmount)} />}
          {(row.mobilisationCost ?? 0) > 0 && <DetailRow label={k('mobilisationCost')} value={formatMoney(row.mobilisationCost)} />}
          {(b.otCalculations ?? 0) > 0 && <DetailRow label={k('workerOtPay')} value={formatMoney(b.otCalculations)} hint={isSupplier ? k('workerOtPayHintSupplier') : k('workerOtPayHint')} valueClass="text-danger" />}
          {clientCommissionExpense > 0 && <DetailRow label={k('clientCommission')} value={formatMoney(clientCommissionExpense)} valueClass="text-danger" />}
          {isSupplier && subInvoice !== 0 && <DetailRow label={k('subInvoice')} value={formatMoney(subInvoice)} valueClass={costColor(subInvoice)} />}
          {isSupplier && subCommissionExpense > 0 && <DetailRow label={k('subCommission')} value={formatMoney(subCommissionExpense)} valueClass="text-danger" />}
          {(b.expenseEmployeeSalary ?? 0) > 0 && <DetailRow label={k('employeeSalary')} value={formatMoney(b.expenseEmployeeSalary)} />}
          {(b.expenseEmployeeAdditional ?? 0) > 0 && <DetailRow label={k('additionalAmount')} value={formatMoney(b.expenseEmployeeAdditional)} />}
          <DetailRow label={k('totalExpenses')} value={formatMoney(expensesTotal)} valueClass={costColor(expensesTotal)} />
        </div>
      </div>

      {/* Summary */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">{k('summary')}</p>
        <div className="space-y-0">
          <DetailRow label={k('actualHours')} value={row.actualHours ?? ''} />
          {(row.otHours ?? 0) > 0 && <DetailRow label={k('otHours')} value={row.otHours} />}
          <DetailRow label={k('clientInvoiceAmount')} value={formatMoney(revenue)} valueClass={revenue > 0 ? 'text-success' : ''} />
          <DetailRow label={k('expenses')} value={formatMoney(expensesTotal)} valueClass={costColor(expensesTotal)} />
          <DetailRow
            label={k('netProfit')}
            value={formatMoney(row.profit ?? 0)}
            valueClass={(row.profit ?? 0) >= 0 ? 'text-success' : 'text-danger'}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
