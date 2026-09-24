/**
 * Shared Table columns for invoices, used by the global list and the
 * client-profile panel. `showClient` adds the client column (the panel is
 * already scoped to one client, so it omits it).
 */
import { Link } from 'react-router-dom';
import { formatDate, formatMoney } from '../../../lib/utils.js';
import { INVOICE_STATUS_VARIANT } from '../../../lib/constants.js';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import InvoicePdfButton from './InvoicePdfButton.jsx';

/** Derived purely from data the list already has (dueDate + status) — no
 *  backend flag needed just to color a badge. The real, once-per-invoice
 *  "you're now overdue" notification is a separate concern, handled by
 *  overdueInvoice.job.js server-side. */
function isOverdue(inv) {
  return inv.status !== 'Paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
}

export function buildInvoiceColumns({ showClient = false, t } = {}) {
  return [
    {
      key: 'invoiceNumber',
      header: t('staffInvoices.columns.number'),
      render: (inv) => (
        <Link to={`/invoices/${inv._id}`} className="font-medium text-text hover:text-primary">
          {inv.invoiceNumber}
        </Link>
      ),
    },
    ...(showClient ? [{ key: 'clientName', header: t('staffInvoices.columns.client'), render: (inv) => inv.clientName }] : []),
    { key: 'date', header: t('staffInvoices.columns.date'), hideOnMobile: true, render: (inv) => formatDate(inv.date) },
    {
      key: 'dueDate',
      header: t('staffInvoices.columns.due'),
      hideOnMobile: true,
      render: (inv) => (
        <span className="flex items-center gap-1.5">
          {formatDate(inv.dueDate)}
          {isOverdue(inv) && <Badge variant="danger">{t('staffInvoices.columns.overdue')}</Badge>}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('staffInvoices.columns.status'),
      render: (inv) => <Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{t(`common.status.${inv.status}`, inv.status)}</Badge>,
    },
    {
      key: 'balanceDue',
      header: t('staffInvoices.columns.balanceDue'),
      className: 'text-right tabular-nums',
      render: (inv) => formatMoney(inv.balanceDue),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (inv) => (
        <span className="flex justify-end gap-2">
          <Link to={`/invoices/${inv._id}`}>
            <Button size="sm" variant="secondary">
              {t('common.view')}
            </Button>
          </Link>
          <InvoicePdfButton id={inv._id} number={inv.invoiceNumber} size="sm" variant="ghost" />
        </span>
      ),
    },
  ];
}
