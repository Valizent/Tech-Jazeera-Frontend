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
function DetailRow({ label, value, valueClass = '', hint }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted" title={hint || undefined}>
        {label}
      </span>
      {/* `text-text` only as a fallback, never alongside valueClass — Tailwind
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
  const isSupplier = row.workerType === 'SupplierEmployee';
  const b = row.breakdown ?? {};
  const subInvoice = b.subContractorInvoiceAmount ?? 0;
  const subCommissionExpense = b.expenseSubCommission ?? 0;
  const supplierDeduction = b.supplierDeductionAmount ?? 0;
  const clientCommissionExpense = b.expenseClientCommission ?? 0;
  const expensesTotal = row.expenses ?? 0;
  const revenue = row.revenue ?? 0;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/70 p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 text-sm">
      {/* Client */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Client</p>
        <div className="space-y-0">
          <DetailRow label="Client Rate / hr" value={row.clientRate != null ? formatMoney(row.clientRate) : '—'} />
          <DetailRow label="Client Commission / hr" value={row.clientCommission != null ? formatMoney(row.clientCommission) : '—'} />
          <DetailRow label="Invoice Amount" value={formatMoney(revenue)} valueClass={revenue > 0 ? 'text-success' : ''} />
          <DetailRow label="Invoice Commission Expense" value={formatMoney(clientCommissionExpense)} valueClass={clientCommissionExpense > 0 ? 'text-danger' : ''} />
        </div>
      </div>

      {/* Subcontractor */}
      {isSupplier && (
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Subcontractor</p>
          <div className="space-y-0">
            <DetailRow label="Sub Rate / hr" value={row.subcontractorRate != null ? formatMoney(row.subcontractorRate) : '—'} />
            <DetailRow label="Sub Commission / hr" value={row.subcontractorCommission != null ? formatMoney(row.subcontractorCommission) : '—'} />
            <DetailRow label="Sub Invoice" value={formatMoney(subInvoice)} valueClass={costColor(subInvoice)} />
            <DetailRow label="Sub Commission Expense" value={formatMoney(subCommissionExpense)} valueClass={subCommissionExpense > 0 ? 'text-danger' : ''} />
            {supplierDeduction > 0 && (
              <DetailRow
                label="Supplier Deduction"
                value={formatMoney(supplierDeduction)}
                valueClass="text-success"
                hint={row.supplierDeductionNote || undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Expenses — every component of row.expenses, itemized */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Expenses</p>
        <div className="space-y-0">
          {(row.fta ?? 0) > 0 && <DetailRow label="FTA" value={formatMoney(row.fta)} />}
          {(row.allowance ?? 0) > 0 && <DetailRow label="Allowance" value={formatMoney(row.allowance)} />}
          {(row.deductionAmount ?? 0) > 0 && <DetailRow label="Client Deduction" value={formatMoney(row.deductionAmount)} />}
          {(row.mobilisationCost ?? 0) > 0 && <DetailRow label="Mob. Cost" value={formatMoney(row.mobilisationCost)} />}
          {(b.otCalculations ?? 0) > 0 && <DetailRow label="OT Cost" value={formatMoney(b.otCalculations)} />}
          {clientCommissionExpense > 0 && <DetailRow label="Client Commission" value={formatMoney(clientCommissionExpense)} valueClass="text-danger" />}
          {isSupplier && subInvoice !== 0 && <DetailRow label="Sub Invoice" value={formatMoney(subInvoice)} valueClass={costColor(subInvoice)} />}
          {isSupplier && subCommissionExpense > 0 && <DetailRow label="Sub Commission" value={formatMoney(subCommissionExpense)} valueClass="text-danger" />}
          <DetailRow label="Total Expenses" value={formatMoney(expensesTotal)} valueClass={costColor(expensesTotal)} />
        </div>
      </div>

      {/* Summary */}
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-muted mb-2">Summary</p>
        <div className="space-y-0">
          <DetailRow label="Actual Hours" value={row.actualHours ?? '—'} />
          {(row.otHours ?? 0) > 0 && <DetailRow label="OT Hours" value={row.otHours} />}
          <DetailRow label="Client Invoice Amount" value={formatMoney(revenue)} valueClass={revenue > 0 ? 'text-success' : ''} />
          <DetailRow label="Expenses" value={formatMoney(expensesTotal)} valueClass={costColor(expensesTotal)} />
          <DetailRow
            label="Net Profit"
            value={formatMoney(row.profit ?? 0)}
            valueClass={(row.profit ?? 0) >= 0 ? 'text-success' : 'text-danger'}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
