/**
 * CreditNoteFormModal — issue a credit note against an invoice. Line items
 * mirror Invoice's own shape (type/description/quantity/unitPrice/discount/
 * taxRate) so a credit note carries a real VAT breakdown, not just a bare
 * number — see creditNote.model.js's own doc comment for why. The live
 * total shown here is display-only; the server recomputes and is the real
 * gatekeeper against what's still left to credit on the invoice.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCreditNote } from '../creditNotes.api.js';
import { creditNoteFormSchema, emptyCreditNoteForm, emptyCreditNoteLine, formToCreditNotePayload } from '../creditNotes.schema.js';
import { apiMessage, formatMoney, lineAmount } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';

export default function CreditNoteFormModal({ open, invoice, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(creditNoteFormSchema), defaultValues: emptyCreditNoteForm });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'lineItems' });
  const watchedLines = watch('lineItems');

  useEffect(() => {
    if (open) reset(emptyCreditNoteForm);
  }, [open, reset]);

  // Prefills from the ORIGINAL invoice's own line items — the common case
  // ("this exact line was wrong") shouldn't require retyping a description
  // and rate that already exist. Still fully editable afterward (e.g. to
  // correct only the quantity, or remove lines that were actually right).
  function copyFromInvoice() {
    replace(
      invoice.lineItems.map((li) => ({
        type: li.type,
        description: li.description,
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
        discount: String(li.discount ?? 0),
        taxRate: String(li.taxRate ?? 0),
      }))
    );
  }

  const remainingCreditable = invoice ? invoice.grandTotal - invoice.creditedTotal : 0;
  const previewTotal = (watchedLines ?? []).reduce((sum, li) => {
    const qty = Number(li.quantity) || 0;
    const unitPrice = Number(li.unitPrice) || 0;
    if (!qty || !unitPrice) return sum;
    return sum + lineAmount({ quantity: qty, unitPrice, discount: Number(li.discount) || 0, taxRate: Number(li.taxRate) || 0 });
  }, 0);

  const saveMutation = useMutation({
    mutationFn: (values) => createCreditNote(formToCreditNotePayload(values, invoice._id)),
    onSuccess: () => {
      toast.success(t('staffInvoices.creditNotes.issuedToast'));
      queryClient.invalidateQueries({ queryKey: ['invoice', invoice._id] });
      queryClient.invalidateQueries({ queryKey: ['credit-notes', invoice._id] });
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function onInvalid(formErrors) {
    const messages = Object.values(formErrors)
      .flatMap((e) => (Array.isArray(e) ? e.map((x) => Object.values(x ?? {}).map((y) => y?.message)) : [e?.message]))
      .flat(2)
      .filter(Boolean);
    toast.error(messages.length ? messages.join(' · ') : t('staffInvoices.creditNotes.fixHighlighted'));
  }

  if (!invoice) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('staffInvoices.creditNotes.modalTitle', { number: invoice.invoiceNumber })} size="lg">
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        <p className="text-sm text-muted">
          {t('staffInvoices.creditNotes.remainingLine', {
            remaining: formatMoney(remainingCreditable),
            total: formatMoney(invoice.grandTotal),
          })}
        </p>

        <Textarea
          label={t('staffInvoices.creditNotes.reasonLabel')}
          placeholder={t('staffInvoices.creditNotes.reasonPlaceholder')}
          error={errors.reason?.message}
          {...register('reason')}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium">{t('staffInvoices.creditNotes.lineItemsLabel')}</label>
            <span className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={copyFromInvoice}>
                {t('staffInvoices.creditNotes.copyFromInvoice')}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => append(emptyCreditNoteLine())}>
                {t('staffInvoices.creditNotes.addLine')}
              </Button>
            </span>
          </div>
          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
                <Select
                  className="sm:col-span-1"
                  aria-label={t('staffInvoices.creditNotes.typeAriaLabel')}
                  error={errors.lineItems?.[i]?.type?.message}
                  {...register(`lineItems.${i}.type`)}
                >
                  <option value="Labour">{t('staffQuotations.lineTypeLabels.Labour', 'Labour')}</option>
                  <option value="Trading">{t('staffQuotations.lineTypeLabels.Trading', 'Trading')}</option>
                </Select>
                <Input
                  className="sm:col-span-2"
                  placeholder={t('staffInvoices.view.columns.description')}
                  aria-label={t('staffInvoices.creditNotes.descriptionAriaLabel')}
                  error={errors.lineItems?.[i]?.description?.message}
                  {...register(`lineItems.${i}.description`)}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('staffInvoices.view.columns.qty')}
                  aria-label={t('staffInvoices.creditNotes.quantityAriaLabel')}
                  {...register(`lineItems.${i}.quantity`)}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('staffInvoices.view.columns.unit')}
                  aria-label={t('staffInvoices.creditNotes.unitPriceAriaLabel')}
                  {...register(`lineItems.${i}.unitPrice`)}
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder={t('staffInvoices.view.columns.disc')}
                    aria-label={t('staffInvoices.creditNotes.discountAriaLabel')}
                    {...register(`lineItems.${i}.discount`)}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="danger-ghost"
                      onClick={() => remove(i)}
                      aria-label={t('staffInvoices.creditNotes.removeLine')}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-3 text-sm">
          <span className="text-muted">{t('staffInvoices.creditNotes.previewLabel')} </span>
          <span className="ml-1 font-semibold tabular-nums">{formatMoney(previewTotal)}</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending}>
            {t('staffInvoices.creditNotes.saveButton')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
