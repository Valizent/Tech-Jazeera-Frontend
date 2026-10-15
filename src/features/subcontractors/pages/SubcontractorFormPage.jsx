/**
 * SubcontractorFormPage - add or edit a subcontractor (2026-10-12). It used to
 * be a modal on the list page; with the full company profile (Arabic name,
 * National Address, Finance person, Owner, coordinators) it became a page,
 * the same shape as the client form.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createSubcontractor, getSubcontractor, updateSubcontractor } from '../subcontractors.api.js';
import {
  subcontractorFormSchema,
  emptySubcontractorForm,
  subcontractorToForm,
  subcontractorToPayload,
} from '../subcontractors.schema.js';
import { SUBCONTRACTOR_STATUSES } from '../../../lib/constants.js';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import CompanyProfileFields from '../../companyProfile/components/CompanyProfileFields.jsx';
import SubcontractorApprovalBanner from '../components/SubcontractorApprovalBanner.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

function Section({ title, description, children }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function SubcontractorForm({ subcontractor, defaultValues, onSubmit, submitting }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(subcontractorFormSchema), defaultValues });

  const onInvalid = (formErrors) => {
    console.error('[subcontractors] form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('staffSubcontractors.form.invalid'));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      {subcontractor && <SubcontractorApprovalBanner subcontractor={subcontractor} resubmitHint />}
      <Section title={t('staffSubcontractors.form.sectionCompany')}>
        <Input label={t('staffSubcontractors.form.name')} error={errors.name?.message} {...register('name')} />
        <Input label={t('staffSubcontractors.form.industry')} placeholder={t('staffSubcontractors.form.industryPlaceholder')} error={errors.industry?.message} {...register('industry')} />
        <Input label={t('staffSubcontractors.form.creditLimitDays')} type="number" min="0" error={errors.creditLimitDays?.message} {...register('creditLimitDays')} />
        <Input label={t('staffSubcontractors.form.contactPerson')} error={errors.contactPerson?.message} {...register('contactPerson')} />
        <Input label={t('companyProfile.contactPosition')} error={errors.contactPosition?.message} {...register('contactPosition')} />
        <Input label={t('staffSubcontractors.form.phone')} placeholder="+966 5x xxx xxxx" error={errors.phone?.message} {...register('phone')} />
        <Input label={t('staffSubcontractors.form.email')} type="email" error={errors.email?.message} {...register('email')} />
        <Select label={t('staffSubcontractors.form.status')} error={errors.status?.message} {...register('status')}>
          {SUBCONTRACTOR_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
      </Section>

      <Section title={t('staffSubcontractors.form.sectionLegal')} description={t('staffSubcontractors.form.legalHint')}>
        <Input label={t('staffSubcontractors.form.vatNumber')} placeholder="3xxxxxxxxxxxxxx3" error={errors.vatNumber?.message} {...register('vatNumber')} />
        <Input label={t('staffSubcontractors.form.crNumber')} placeholder={t('staffSubcontractors.form.crPlaceholder')} error={errors.crNumber?.message} {...register('crNumber')} />
        <Input label={t('staffSubcontractors.form.address')} className="sm:col-span-2" error={errors.address?.message} {...register('address')} />
      </Section>

      <CompanyProfileFields register={register} control={control} errors={errors} />

      <Card>
        <Textarea label={t('staffSubcontractors.form.notes')} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button icon="close" variant="danger-solid" onClick={() => navigate(-1)} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button icon="check" variant="success-solid" type="submit" isLoading={submitting}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

export default function SubcontractorFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: subcontractor, isPending, isError } = useQuery({
    queryKey: ['subcontractor', id],
    queryFn: () => getSubcontractor(id),
    enabled: isEdit,
  });

  const mutation = useMutation({
    mutationFn: (values) => {
      const payload = subcontractorToPayload(values);
      return isEdit ? updateSubcontractor(id, payload) : createSubcontractor(payload);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? t('staffSubcontractors.updatedToast') : t('staffSubcontractors.addedToast'));
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor', saved._id] });
      navigate(`/subcontractors/${saved._id}`, { replace: true });
    },
    onError: (error) => {
      console.error('[subcontractors] save failed', error);
      toast.error(apiMessage(error));
    },
  });

  if (isEdit && isPending) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isEdit && isError) {
    return (
      <EmptyState
        title={t('staffSubcontractors.profile.notFoundTitle')}
        description={t('staffSubcontractors.profile.notFoundDescription')}
        action={<Button variant="secondary" onClick={() => navigate('/subcontractors')}>{t('common.back')}</Button>}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={isEdit ? t('staffSubcontractors.modalEditTitle') : t('staffSubcontractors.modalAddTitle')}
        onBack={() => navigate(-1)}
      />
      <SubcontractorForm
        subcontractor={isEdit ? subcontractor : null}
        defaultValues={isEdit ? subcontractorToForm(subcontractor) : emptySubcontractorForm}
        onSubmit={(values) => mutation.mutate(values)}
        submitting={mutation.isPending}
      />
    </div>
  );
}
