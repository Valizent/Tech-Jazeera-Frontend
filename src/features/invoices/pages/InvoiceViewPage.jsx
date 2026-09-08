/**
 * Invoice detail — line items, totals, payment history, and recording a
 * new payment. Line items/totals are read-only (frozen at creation, unlike
 * a Quotation); only payments and delete (before any payment) are actions.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getInvoice, recordPayment, deleteInvoice } from '../invoices.api.js';
import InvoicePdfButton from '../components/InvoicePdfButton.jsx';
import { paymentFormSchema, emptyPaymentForm } from '../invoices.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import { INVOICE_STATUS_VARIANT, INVOICE_DELETE_ROLES } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Amount a line contributes to the total (net + its tax) — same math as the PDF/server. */
function lineAmount(li) {
  const gross = li.quantity * li.unitPrice;
  const net = gross - gross * ((li.discount ?? 0) / 100);
  return net + net * ((li.taxRate ?? 0) / 100);
}

export default function InvoiceViewPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Reaching this page at all already implies the whole-module 'invoices'
  // Section Access grant (payments included) — no separate write check
  // needed, same "successful load implies full action access" pattern as
  // Payroll/Expenses. Delete stays its own hardcoded, stricter circle.
  const canDelete = INVOICE_DELETE_ROLES.includes(user.role);

  const [recordingPayment, setRecordingPayment] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: inv, isPending, isError } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(paymentFormSchema), defaultValues: emptyPaymentForm });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['invoice', id] });

  const paymentMutation = useMutation({
    mutationFn: (values) => recordPayment(id, values),
    onSuccess: (updated) => {
      toast.success(t('staffInvoices.view.paymentRecordedToast', { status: t(`common.status.${updated.status}`, updated.status) }));
      setRecordingPayment(false);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(id),
    onSuccess: () => {
      toast.success(t('staffInvoices.view.deletedToast', { number: inv.invoiceNumber }));
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate('/invoices', { replace: true });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

  function openRecordPayment() {
    reset(emptyPaymentForm);
    setRecordingPayment(true);
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffInvoices.view.notFoundTitle')}
        description={t('staffInvoices.view.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/invoices')} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={inv.invoiceNumber}
        description={inv.clientName}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant={INVOICE_STATUS_VARIANT[inv.status]} className="mr-1">
              {t(`common.status.${inv.status}`, inv.status)}
            </Badge>
            <InvoicePdfButton id={inv._id} number={inv.invoiceNumber} />
            {inv.status !== 'Paid' && <Button onClick={openRecordPayment}>{t('staffInvoices.view.recordPayment')}</Button>}
            {canDelete && inv.payments.length === 0 && (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </>
        }
      />

      <Card className="space-y-5">
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffInvoices.view.date')}</span>
            {formatDate(inv.date)}
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffInvoices.view.dueDate')}</span>
            {inv.dueDate ? formatDate(inv.dueDate) : '—'}
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffInvoices.view.fromQuotation')}</span>
            <Link to={`/quotations/${inv.quotation}`} className="text-primary hover:underline">
              {inv.quotationNumber}
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2 font-medium">{t('staffInvoices.view.columns.type')}</th>
                <th className="py-2 pr-2 font-medium">{t('staffInvoices.view.columns.description')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffInvoices.view.columns.qty')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffInvoices.view.columns.unit')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffInvoices.view.columns.disc')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffInvoices.view.columns.tax')}</th>
                <th className="py-2 text-right font-medium">{t('staffInvoices.view.columns.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {inv.lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-2 pr-2">{t(`staffQuotations.lineTypeLabels.${li.type}`, li.type)}</td>
                  <td className="py-2 pr-2">{li.description}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{li.quantity}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(li.unitPrice)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{li.discount ?? 0}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{li.taxRate ?? 0}</td>
                  <td className="py-2 text-right tabular-nums">{formatMoney(lineAmount(li))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.subtotal')}</span>
            <span className="tabular-nums">{formatMoney(inv.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.discount')}</span>
            <span className="tabular-nums">−{formatMoney(inv.discountTotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.vatTax')}</span>
            <span className="tabular-nums">{formatMoney(inv.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span>{t('staffQuotations.totals.grandTotal')}</span>
            <span className="tabular-nums">{formatMoney(inv.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('staffInvoices.view.paid')}</span>
            <span className="tabular-nums">{formatMoney(inv.amountPaid)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span>{t('staffInvoices.view.balanceDueLabel')}</span>
            <span className="tabular-nums">{formatMoney(inv.balanceDue)}</span>
          </div>
        </div>

        {inv.notes && (
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffInvoices.view.notes')}</span>
            <p className="mt-1 whitespace-pre-wrap text-sm">{inv.notes}</p>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffInvoices.view.paymentsTitle')}</h2>
        {inv.payments.length === 0 ? (
          <EmptyState title={t('staffInvoices.view.noPaymentsTitle')} description={t('staffInvoices.view.noPaymentsDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {inv.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{formatMoney(p.amount)}</p>
                  <p className="text-xs text-muted">
                    {formatDate(p.date)}
                    {p.method && ` · ${p.method}`}
                    {p.reference && ` · ${p.reference}`}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Modal open={recordingPayment} onClose={() => setRecordingPayment(false)} title={t('staffInvoices.view.recordPaymentModalTitle')}>
        <form onSubmit={handleSubmit((values) => paymentMutation.mutate(values))} noValidate className="space-y-4">
          <p className="text-sm text-muted">
            {t('staffInvoices.view.balanceDueLabel')}: <span className="font-semibold text-text">{formatMoney(inv.balanceDue)}</span>
          </p>
          <Input label={t('staffInvoices.view.amount')} type="number" step="0.01" min="0.01" error={errors.amount?.message} {...register('amount')} />
          <Input label={t('staffInvoices.view.paymentDate')} type="date" error={errors.date?.message} {...register('date')} />
          <Input label={t('staffInvoices.view.method')} placeholder={t('staffInvoices.view.methodPlaceholder')} error={errors.method?.message} {...register('method')} />
          <Input label={t('staffInvoices.view.reference')} placeholder={t('common.optional')} error={errors.reference?.message} {...register('reference')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setRecordingPayment(false)} disabled={paymentMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={paymentMutation.isPending}>
              {t('staffInvoices.view.savePayment')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffInvoices.view.deleteConfirmTitle')}
        message={t('staffInvoices.view.deleteConfirmMessage', { number: inv.invoiceNumber })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
