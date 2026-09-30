/**
 * ClientForm — shared by create & edit. The notable pattern here is the
 * dynamic **sites** list via react-hook-form's `useFieldArray`: the user adds
 * and removes site rows, and RHF tracks them as an array. This is the M5
 * addition to the form toolkit (M4 had only flat/nested-object fields).
 */
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { clientFormSchema } from '../clients.schema.js';
import { CLIENT_STATUSES } from '../../../lib/constants.js';
import { collectFormErrorMessages } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';

function Section({ title, description, children }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

/**
 * `client` (the raw record, edit only) drives the approval-status banner —
 * a Coordinator resubmitting a Rejected client needs to see exactly what a
 * Manager flagged, and anyone reviewing a Pending one should know it isn't
 * live yet. Absent on create (a brand-new client has no approval history).
 */
export default function ClientForm({ defaultValues, onSubmit, submitLabel, submitting, client }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(clientFormSchema), defaultValues });

  const { fields, append, remove } = useFieldArray({ control, name: 'sites' });

  const onInvalid = (formErrors) => {
    console.error('[clients] client form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('staffClients.form.invalid'));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      {client?.approvalStatus === 'Rejected' && (
        <Card className="border-danger/30 bg-danger/5">
          <div className="flex items-start gap-3">
            <Badge variant="danger">{t('common.status.Rejected')}</Badge>
            <div>
              <p className="text-sm font-medium">{t('staffClients.form.rejectedTitle')}</p>
              {client.decisionNote && <p className="mt-1 text-sm text-muted">{client.decisionNote}</p>}
              <p className="mt-2 text-xs text-muted">{t('staffClients.form.resubmitHint')}</p>
            </div>
          </div>
        </Card>
      )}
      {client?.approvalStatus === 'Pending' && (
        <Card className="border-warning/30 bg-warning/5">
          <div className="flex items-center gap-3">
            <Badge variant="warning">{t('staffClients.form.pendingBadge')}</Badge>
            <p className="text-sm text-muted">
              {t('staffClients.form.pendingHint')}
            </p>
          </div>
        </Card>
      )}

      <Section title={t('staffClients.form.sectionCompany')}>
        <Input label={t('staffClients.form.companyName')} error={errors.companyName?.message} {...register('companyName')} />
        <Input label={t('staffClients.form.industry')} placeholder={t('staffClients.form.industryPlaceholder')} error={errors.industry?.message} {...register('industry')} />
        <Input label={t('staffClients.form.contactPerson')} error={errors.contactPerson?.message} {...register('contactPerson')} />
        <Input label={t('staffClients.form.phone')} placeholder={t('staffClients.form.phonePlaceholder')} error={errors.phone?.message} {...register('phone')} />
        <Input label={t('staffClients.form.email')} type="email" error={errors.email?.message} {...register('email')} />
        <Select label={t('staffClients.form.status')} error={errors.status?.message} {...register('status')}>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </Section>

      <Section title={t('staffClients.form.sectionLegal')} description={t('staffClients.form.sectionLegalDescription')}>
        <Input label={t('staffClients.form.vatNumber')} placeholder={t('staffClients.form.vatPlaceholder')} error={errors.vatNumber?.message} {...register('vatNumber')} />
        <Input label={t('staffClients.form.crNumber')} placeholder={t('staffClients.form.crPlaceholder')} error={errors.crNumber?.message} {...register('crNumber')} />
        <Input label={t('staffClients.form.address')} className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
      </Section>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffClients.form.sitesTitle')}</h2>
            <p className="mt-1 text-sm text-muted">{t('staffClients.form.sitesDescription')}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => append({ name: '', city: '', address: '' })}>
            {t('staffClients.form.addSite')}
          </Button>
        </div>

        {fields.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
            {t('staffClients.form.noSites')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
                <Input placeholder={t('staffClients.form.siteNamePlaceholder')} error={errors.sites?.[index]?.name?.message} {...register(`sites.${index}.name`)} />
                <Input placeholder={t('staffClients.form.cityPlaceholder')} {...register(`sites.${index}.city`)} />
                <Input placeholder={t('staffClients.form.addressPlaceholder')} {...register(`sites.${index}.address`)} />
                <Button
                  size="sm"
                  variant="danger-ghost"
                  onClick={() => remove(index)}
                  aria-label={t('staffClients.form.removeSiteAriaLabel', { index: index + 1 })}
                >
                  {t('staffClients.form.removeSite')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Textarea label={t('staffClients.form.notes')} placeholder={t('staffClients.form.notesPlaceholder')} error={errors.notes?.message} {...register('notes')} />
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
