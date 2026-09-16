/**
 * QuotationForm — shared by create & edit. The centrepiece is the dynamic
 * line-item list (react-hook-form useFieldArray) with a LIVE totals preview
 * that recomputes as you type. The preview mirrors the server math, but the
 * server always recomputes on save — the preview is never trusted.
 */
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { quotationFormSchema, emptyLineItem, computeTotals } from '../quotations.schema.js';
import { listClients } from '../../clients/clients.api.js';
import { QUOTATION_STATUSES, QUOTATION_LINE_TYPES } from '../../../lib/constants.js';
import { formatMoney } from '../../../lib/utils.js';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

/** Live totals row — reads the current lineItems via useWatch. */
function TotalsPreview({ control }) {
  const { t } = useTranslation();
  const lineItems = useWatch({ control, name: 'lineItems' }) ?? [];
  const totals = computeTotals(lineItems);
  return (
    <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
      <div className="flex justify-between text-muted">
        <span>{t('staffQuotations.totals.subtotal')}</span>
        <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>{t('staffQuotations.totals.discount')}</span>
        <span className="tabular-nums">−{formatMoney(totals.discountTotal)}</span>
      </div>
      <div className="flex justify-between text-muted">
        <span>{t('staffQuotations.totals.vatTax')}</span>
        <span className="tabular-nums">{formatMoney(totals.taxTotal)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
        <span>{t('staffQuotations.totals.grandTotal')}</span>
        <span className="tabular-nums">{formatMoney(totals.grandTotal)}</span>
      </div>
    </div>
  );
}

export default function QuotationForm({ defaultValues, onSubmit, submitLabel, submitting }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(quotationFormSchema), defaultValues });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const { data: clientData, isError: clientsError } = useQuery({
    queryKey: ['clients', 'all-for-quote'],
    // approvalStatus: 'Approved' — a Coordinator-submitted client not yet
    // approved shouldn't be quotable (see docs/PHASE2-PLAN.md). Status
    // (Active/Inactive) is deliberately unfiltered — you can still quote a
    // dormant client to re-engage them.
    queryFn: () => listClients({ approvalStatus: 'Approved', limit: 100, sortBy: 'companyName', sortOrder: 'asc' }),
  });
  const clients = clientData?.items ?? [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <PickerLoadWarning failed={[{ label: 'clients', isError: clientsError }]} />
      <Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Select label={t('staffQuotations.form.clientLabel')} error={errors.client?.message} {...register('client')}>
              <option value="">{t('staffQuotations.form.selectClient')}</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
            {clientData && clients.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                {t('staffQuotations.form.noApprovedClients')}{' '}
                <Link to="/clients/new" className="text-primary hover:underline">
                  {t('staffQuotations.form.addOneFirst')}
                </Link>
                .
              </p>
            )}
          </div>
          <Select label={t('staffQuotations.form.status')} error={errors.status?.message} {...register('status')}>
            {QUOTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`common.status.${s}`, s)}
              </option>
            ))}
          </Select>
          <Input label={t('staffQuotations.form.date')} type="date" error={errors.date?.message} {...register('date')} />
          <Input label={t('staffQuotations.form.validUntil')} type="date" error={errors.validUntil?.message} {...register('validUntil')} />
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffQuotations.form.lineItemsTitle')}</h2>
          <Button size="sm" variant="secondary" onClick={() => append({ ...emptyLineItem })}>
            {t('staffQuotations.form.addLine')}
          </Button>
        </div>

        {typeof errors.lineItems?.message === 'string' && (
          <p className="mb-3 text-sm text-danger">{errors.lineItems.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, i) => (
            <div key={field.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 lg:grid-cols-12">
              <Select className="lg:col-span-2" aria-label={t('staffQuotations.form.typeAriaLabel')} error={errors.lineItems?.[i]?.type?.message} {...register(`lineItems.${i}.type`)}>
                {QUOTATION_LINE_TYPES.map((lt) => (
                  <option key={lt} value={lt}>
                    {t(`staffQuotations.lineTypeLabels.${lt}`, lt)}
                  </option>
                ))}
              </Select>
              <Input className="col-span-2 lg:col-span-4" placeholder={t('staffQuotations.form.descriptionPlaceholder')} error={errors.lineItems?.[i]?.description?.message} {...register(`lineItems.${i}.description`)} />
              <Input type="number" min="0" step="1" placeholder={t('staffQuotations.form.qtyPlaceholder')} aria-label={t('staffQuotations.form.quantityAriaLabel')} error={errors.lineItems?.[i]?.quantity?.message} {...register(`lineItems.${i}.quantity`)} />
              <Input type="number" min="0" step="0.01" placeholder={t('staffQuotations.form.unitPricePlaceholder')} aria-label={t('staffQuotations.form.unitPriceAriaLabel')} error={errors.lineItems?.[i]?.unitPrice?.message} {...register(`lineItems.${i}.unitPrice`)} />
              <Input type="number" min="0" max="100" step="1" placeholder={t('staffQuotations.form.discPlaceholder')} aria-label={t('staffQuotations.form.discountAriaLabel')} error={errors.lineItems?.[i]?.discount?.message} {...register(`lineItems.${i}.discount`)} />
              <Input type="number" min="0" max="100" step="1" placeholder={t('staffQuotations.form.taxPlaceholder')} aria-label={t('staffQuotations.form.taxAriaLabel')} error={errors.lineItems?.[i]?.taxRate?.message} {...register(`lineItems.${i}.taxRate`)} />
              <div className="flex items-center justify-end lg:col-span-1">
                <Button
                  size="sm"
                  variant="danger-ghost"
                  disabled={fields.length === 1}
                  onClick={() => remove(i)}
                  aria-label={t('staffQuotations.form.removeLineAriaLabel', { index: i + 1 })}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex">
          <TotalsPreview control={control} />
        </div>
      </Card>

      <Card>
        <Textarea label={t('staffQuotations.form.notes')} placeholder={t('staffQuotations.form.notesPlaceholder')} error={errors.notes?.message} {...register('notes')} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
