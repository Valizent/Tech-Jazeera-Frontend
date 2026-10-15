/**
 * CompanyProfileFields - the company profile sections of the client and
 * subcontractor forms (2026-10-12): Arabic name and CR expiry, Saudi
 * National Address, Finance person, Owner and the company's coordinators.
 * Rendered inside the parent's react-hook-form, so the parent passes
 * `register`, `control` and `errors` straight through. The contact person's
 * position sits with the contact person in the parent's own form.
 *
 * Everything here is optional: save incomplete, and the record is flagged as
 * missing details until it is filled in.
 */
import { useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { emptyCoordinatorRow } from '../companyProfile.schema.js';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';

function Section({ title, description, children }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function PersonFields({ prefix, register, errors }) {
  const { t } = useTranslation();
  const e = errors[prefix] ?? {};
  return (
    <>
      <Input label={t('companyProfile.person.name')} error={e.name?.message} {...register(`${prefix}.name`)} />
      <Input label={t('companyProfile.person.position')} error={e.position?.message} {...register(`${prefix}.position`)} />
      <Input label={t('companyProfile.person.phone')} placeholder="+966 5x xxx xxxx" error={e.phone?.message} {...register(`${prefix}.phone`)} />
      <Input label={t('companyProfile.person.email')} type="email" error={e.email?.message} {...register(`${prefix}.email`)} />
    </>
  );
}

export default function CompanyProfileFields({ register, control, errors }) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: 'coordinators' });
  const a = errors.nationalAddress ?? {};

  return (
    <>
      <Section title={t('companyProfile.sections.identity')}>
        <Input
          label={t('companyProfile.arabicName')}
          dir="rtl"
          lang="ar"
          error={errors.arabicName?.message}
          {...register('arabicName')}
        />
        <Input label={t('companyProfile.crExpiry')} type="date" error={errors.crExpiry?.message} {...register('crExpiry')} />
      </Section>

      <Section title={t('companyProfile.sections.nationalAddress')} description={t('companyProfile.nationalAddressHint')}>
        <Input label={t('companyProfile.nationalAddress.buildingNumber')} placeholder="1234" inputMode="numeric" error={a.buildingNumber?.message} {...register('nationalAddress.buildingNumber')} />
        <Input label={t('companyProfile.nationalAddress.streetName')} error={a.streetName?.message} {...register('nationalAddress.streetName')} />
        <Input label={t('companyProfile.nationalAddress.district')} error={a.district?.message} {...register('nationalAddress.district')} />
        <Input label={t('companyProfile.nationalAddress.city')} error={a.city?.message} {...register('nationalAddress.city')} />
        <Input label={t('companyProfile.nationalAddress.postalCode')} placeholder="12345" inputMode="numeric" error={a.postalCode?.message} {...register('nationalAddress.postalCode')} />
        <Input label={t('companyProfile.nationalAddress.additionalNumber')} placeholder="1234" inputMode="numeric" error={a.additionalNumber?.message} {...register('nationalAddress.additionalNumber')} />
        <Input label={t('companyProfile.nationalAddress.unitNumber')} placeholder={t('common.optional')} inputMode="numeric" error={a.unitNumber?.message} {...register('nationalAddress.unitNumber')} />
        <Input label={t('companyProfile.nationalAddress.shortAddress')} placeholder="RRRD2929" error={a.shortAddress?.message} {...register('nationalAddress.shortAddress')} />
      </Section>

      <Section title={t('companyProfile.sections.finance')}>
        <PersonFields prefix="financePerson" register={register} errors={errors} />
      </Section>

      <Section title={t('companyProfile.sections.owner')} description={t('companyProfile.ownerHint')}>
        <PersonFields prefix="owner" register={register} errors={errors} />
      </Section>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('companyProfile.sections.coordinators')}</h2>
            <p className="mt-1 text-sm text-muted">{t('companyProfile.coordinatorsHint')}</p>
          </div>
          <Button icon="plus" size="sm" variant="secondary" onClick={() => append({ ...emptyCoordinatorRow })}>
            {t('companyProfile.addCoordinator')}
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
            {t('companyProfile.noCoordinators')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => {
              const row = errors.coordinators?.[index] ?? {};
              return (
                <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
                  <Input placeholder={t('companyProfile.person.name')} aria-label={t('companyProfile.person.name')} error={row.name?.message} {...register(`coordinators.${index}.name`)} />
                  <Input placeholder={t('companyProfile.coordinatorDesignation')} aria-label={t('companyProfile.coordinatorDesignation')} error={row.designation?.message} {...register(`coordinators.${index}.designation`)} />
                  <Input placeholder={t('companyProfile.person.phone')} aria-label={t('companyProfile.person.phone')} error={row.phone?.message} {...register(`coordinators.${index}.phone`)} />
                  <Input placeholder={t('companyProfile.person.email')} aria-label={t('companyProfile.person.email')} type="email" error={row.email?.message} {...register(`coordinators.${index}.email`)} />
                  <Button icon="trash" size="sm" variant="danger-solid" onClick={() => remove(index)} aria-label={t('companyProfile.removeCoordinatorAriaLabel', { index: index + 1 })}>
                    {t('common.remove')}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
