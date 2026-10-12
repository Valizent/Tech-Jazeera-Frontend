/**
 * BillingSnapshotCard: the Accounts view. What clients owe (aged by days since
 * the invoice was sent), what falls due this week, what is ready to invoice,
 * what is owed to subcontractors, and this month's spending against last
 * month's. Every figure is the same live allocation the Payments Due pages
 * show; each part is null (hidden) unless the viewer holds its Read.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../../components/ui/Card.jsx';
import { formatMoney, cn } from '../../../lib/utils.js';

const AGING = [
  ['d0to30', 'aging0', 'bg-success'],
  ['d31to60', 'aging31', 'bg-warning'],
  ['d61plus', 'aging61', 'bg-danger'],
];

function Figure({ label, value, hint, to, tone }) {
  const body = (
    <div className="h-full rounded-lg border border-border p-3 transition-colors hover:bg-muted/5">
      <p className={cn('text-lg font-bold tabular-nums', tone === 'danger' ? 'text-danger' : 'text-text')}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function BillingSnapshotCard({ billing }) {
  const { t } = useTranslation();
  if (!billing) return null;
  const { receivables, readyToInvoice, subcontractorOwed, expenses } = billing;
  const k = (key, opts) => t(`staffDashboard.insights.billing.${key}`, opts);

  return (
    <Card className="h-full">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{k('title')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {receivables && (
          <>
            <Figure label={k('outstanding')} value={formatMoney(receivables.total)} to="/financial/payments-due" />
            <Figure
              label={k('dueNext7')}
              value={formatMoney(receivables.dueNext7Days.amount)}
              hint={k('invoices', { count: receivables.dueNext7Days.count })}
              to="/financial/payments-due"
            />
            {receivables.overdue.count > 0 && (
              <Figure
                label={k('overdue')}
                value={formatMoney(receivables.overdue.amount)}
                hint={k('invoices', { count: receivables.overdue.count })}
                tone="danger"
                to="/financial/payments-due"
              />
            )}
          </>
        )}
        {readyToInvoice && (
          <Figure
            label={k('readyToInvoice')}
            value={formatMoney(readyToInvoice.amount)}
            hint={k('invoices', { count: readyToInvoice.count })}
            to="/financial/ready-to-invoice"
          />
        )}
        {subcontractorOwed && <Figure label={k('subOwed')} value={formatMoney(subcontractorOwed.amount)} to="/financial/sub-payments-due" />}
        {expenses && (
          <Figure
            label={k('expenses')}
            value={formatMoney(expenses.thisMonth)}
            hint={k('lastMonth', { amount: formatMoney(expenses.lastMonth) })}
            to="/expenses"
          />
        )}
      </div>

      {receivables && receivables.total > 0 && (
        <div className="mt-5">
          <div className="flex h-2 overflow-hidden rounded-full bg-border">
            {AGING.map(([key, , color]) => (
              <div key={key} className={color} style={{ width: `${(receivables.buckets[key] / receivables.total) * 100}%` }} />
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
            {AGING.map(([key, labelKey]) => (
              <span key={key}>
                {k(labelKey)}
                <br />
                <b className="text-text">{formatMoney(receivables.buckets[key])}</b>
              </span>
            ))}
          </div>
          {receivables.topClients.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{k('topClients')}</h3>
              <ul className="space-y-1 text-sm">
                {receivables.topClients.map((c) => (
                  <li key={String(c.clientId)} className="flex justify-between gap-2">
                    <span className="truncate">{c.clientName}</span>
                    <span className="shrink-0 tabular-nums text-muted">{formatMoney(c.outstanding)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
