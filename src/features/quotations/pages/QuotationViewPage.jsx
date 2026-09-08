/**
 * Quotation detail — a read view of the quotation with its line items and
 * totals, plus actions: edit, duplicate, download PDF, delete. Status-changing
 * happens via edit.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getQuotation, duplicateQuotation, deleteQuotation } from '../quotations.api.js';
import { STATUS_VARIANT } from '../components/quotationColumns.jsx';
import QuotationPdfButton from '../components/QuotationPdfButton.jsx';
import { listInvoices, createInvoice } from '../../invoices/invoices.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { QUOTATION_DELETE_ROLES } from '../../../lib/constants.js';
import { apiMessage, formatDate, formatMoney } from '../../../lib/utils.js';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Amount a line contributes to the total (net + its tax). */
function lineAmount(li) {
  const gross = li.quantity * li.unitPrice;
  const net = gross - gross * ((li.discount ?? 0) / 100);
  return net + net * ((li.taxRate ?? 0) / 100);
}

export default function QuotationViewPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const canWrite = Boolean(user.sectionAccess?.includes('quotationsManage'));
  const canDelete = QUOTATION_DELETE_ROLES.includes(user.role);
  // Invoices is a whole-module Section Access gate now — converting a
  // quotation to an invoice needs the same 'invoices' grant the Invoices
  // page itself requires (successful page access already implies full
  // read/write there, so this mirrors that exactly).
  const canInvoice = Boolean(user.sectionAccess?.includes('invoices'));

  const { data: q, isPending, isError } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => getQuotation(id),
  });

  // Whether this quotation already has an invoice — governs "Create
  // invoice" vs "View invoice" below. Only relevant once Approved.
  const { data: existingInvoices } = useQuery({
    queryKey: ['invoices', { quotation: id }],
    queryFn: () => listInvoices({ quotation: id, limit: 1 }),
    enabled: !!q && q.status === 'Approved',
  });
  const existingInvoice = existingInvoices?.items?.[0] ?? null;

  const createInvoiceMutation = useMutation({
    mutationFn: () => createInvoice({ quotation: id }),
    onSuccess: (invoice) => {
      toast.success(t('staffQuotations.view.invoiceCreatedToast', { number: invoice.invoiceNumber }));
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${invoice._id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateQuotation(id),
    onSuccess: (copy) => {
      toast.success(t('staffQuotations.view.duplicatedToast', { number: copy.quotationNumber }));
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      navigate(`/quotations/${copy._id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuotation(id),
    onSuccess: () => {
      toast.success(t('staffQuotations.view.deletedToast', { number: q.quotationNumber }));
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      navigate('/quotations', { replace: true });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setConfirmingDelete(false);
    },
  });

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
        title={t('staffQuotations.view.notFoundTitle')}
        description={t('staffQuotations.view.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/quotations')} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={q.quotationNumber}
        description={q.clientName}
        onBack={() => navigate(-1)}
        actions={
          <>
            <Badge variant={STATUS_VARIANT[q.status]} className="mr-1">
              {t(`common.status.${q.status}`, q.status)}
            </Badge>
            <QuotationPdfButton id={q._id} number={q.quotationNumber} />
            {q.status === 'Approved' && canInvoice && existingInvoice && (
              <Link to={`/invoices/${existingInvoice._id}`}>
                <Button variant="secondary">{t('staffQuotations.view.viewInvoice')}</Button>
              </Link>
            )}
            {q.status === 'Approved' && canInvoice && !existingInvoice && (
              <Button isLoading={createInvoiceMutation.isPending} onClick={() => createInvoiceMutation.mutate()}>
                {t('staffQuotations.view.createInvoice')}
              </Button>
            )}
            {canWrite && (
              <>
                <Button variant="secondary" onClick={() => navigate(`/quotations/${id}/edit`)}>
                  {t('common.edit')}
                </Button>
                <Button variant="secondary" onClick={() => duplicateMutation.mutate()} isLoading={duplicateMutation.isPending}>
                  {t('staffQuotations.view.duplicate')}
                </Button>
              </>
            )}
            {canDelete && (
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
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffQuotations.view.date')}</span>
            {formatDate(q.date)}
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffQuotations.view.validUntil')}</span>
            {q.validUntil ? formatDate(q.validUntil) : '—'}
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-2 font-medium">{t('staffQuotations.view.columns.type')}</th>
                <th className="py-2 pr-2 font-medium">{t('staffQuotations.view.columns.description')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffQuotations.view.columns.qty')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffQuotations.view.columns.unit')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffQuotations.view.columns.disc')}</th>
                <th className="py-2 pr-2 text-right font-medium">{t('staffQuotations.view.columns.tax')}</th>
                <th className="py-2 text-right font-medium">{t('staffQuotations.view.columns.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.lineItems.map((li, i) => (
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

        {/* Totals */}
        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.subtotal')}</span>
            <span className="tabular-nums">{formatMoney(q.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.discount')}</span>
            <span className="tabular-nums">−{formatMoney(q.discountTotal)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>{t('staffQuotations.totals.vatTax')}</span>
            <span className="tabular-nums">{formatMoney(q.taxTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
            <span>{t('staffQuotations.totals.grandTotal')}</span>
            <span className="tabular-nums">{formatMoney(q.grandTotal)}</span>
          </div>
        </div>

        {q.notes && (
          <div>
            <span className="block text-xs uppercase tracking-wide text-muted">{t('staffQuotations.view.notes')}</span>
            <p className="mt-1 whitespace-pre-wrap text-sm">{q.notes}</p>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffQuotations.view.deleteConfirmTitle')}
        message={t('staffQuotations.view.deleteConfirmMessage', { number: q.quotationNumber })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
