/**
 * MyProfilePage — a Worker's profile page (P2-M2). Same data shape as the
 * admin employee profile, scoped server-side to req.user.employee.
 * Milestone 4 added a real self-edit: mobile/email/accommodation/emergency
 * contact are editable in place; everything else (salary, designation,
 * documents, coordinator, ...) stays read-only — HR/Admin territory, not a
 * worker's own record to change. Reachable at all only because the ESS
 * gate (me.routes.js) already limited this whole page to 'Own'-type
 * employees — no extra client-side type check needed here.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMyProfile, updateMyProfile } from '../ess.api.js';
import { updateMyProfileFormSchema, profileToForm } from '../profile.schema.js';
import { formatDate, formatMoney, apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Input from '../../../components/ui/Input.jsx';
import ExpiryBadge from '../../../components/shared/ExpiryBadge.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Button from '../../../components/ui/Button.jsx';

const STATUS_VARIANT = { Active: 'success', 'On Leave': 'warning', Exited: 'default' };
const DOCUMENTS = ['passport', 'visa', 'iqama', 'medical', 'drivingLicense'];

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

export default function MyProfilePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: employee, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'profile'],
    queryFn: getMyProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(updateMyProfileFormSchema) });

  // Keeps the form in sync whenever the loaded (or just-saved) profile
  // changes — including the very first load, since useForm has no data yet
  // at mount time.
  useEffect(() => {
    if (employee) reset(profileToForm(employee));
  }, [employee, reset]);

  const mutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData(['me', 'profile'], updated);
      toast.success(t('profile.updateSuccess'));
      setIsEditing(false);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function handleCancel() {
    reset(profileToForm(employee));
    setIsEditing(false);
  }

  const onInvalid = (formErrors) => {
    console.error('[ess] profile form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('profile.formInvalid'));
  };

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t('profile.title')} />
        <EmptyState
          title={t('profile.loadError')}
          description={t('common.checkConnection')}
          action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => mutation.mutate(values), onInvalid)}
      noValidate
      className="mx-auto max-w-3xl space-y-6"
    >
      <PageHeader
        title={employee.fullName}
        description={`${employee.employeeId} · ${employee.designation}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[employee.status]}>{t(`profile.employeeStatus.${employee.status}`, employee.status)}</Badge>
            {!isEditing && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                {t('profile.edit')}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.personalDetails')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('profile.nationality')} value={employee.nationality} />
          {isEditing ? (
            <Input label={t('profile.mobile')} error={errors.mobile?.message} {...register('mobile')} />
          ) : (
            <Field label={t('profile.mobile')} value={employee.mobile} />
          )}
          {isEditing ? (
            <Input label={t('profile.email')} type="email" error={errors.email?.message} {...register('email')} />
          ) : (
            <Field label={t('profile.email')} value={employee.email} />
          )}
          <Field label={t('profile.joiningDate')} value={formatDate(employee.joiningDate)} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.employment')}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('profile.designation')} value={employee.designation} />
          <Field label={t('profile.department')} value={employee.department} />
          <Field label={t('profile.monthlySalary')} value={formatMoney(employee.salary)} />
          {isEditing ? (
            <Input label={t('profile.accommodation')} error={errors.accommodation?.message} {...register('accommodation')} />
          ) : (
            <Field label={t('profile.accommodation')} value={employee.accommodation} />
          )}
          <Field
            label={t('profile.currentClient')}
            value={employee.currentClient?.companyName ?? (employee.currentSite ? employee.currentSite : null)}
          />
          <Field label={t('profile.myCoordinator')} value={employee.coordinator ? `${employee.coordinator.name}` : t('common.notAssigned')} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.documentsOnFile')}</h2>
        <div className="divide-y divide-border">
          {DOCUMENTS.map((key) => {
            const doc = employee[key];
            return (
              <div key={key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{t(`profile.documents.${key}`)}</p>
                  <p className="text-xs text-muted">
                    {doc?.number ? t('profile.docNumber', { number: doc.number }) : t('profile.docNoNumber')}
                    {doc?.expiry ? t('profile.docExpires', { date: formatDate(doc.expiry) }) : ''}
                  </p>
                </div>
                <ExpiryBadge date={doc?.expiry} />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Always shown when editing (even with nothing on file yet, so a
          worker can add one for the first time); read-only view keeps the
          old "only show if something's there" behavior. */}
      {(isEditing || employee.emergencyContact?.name) && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('profile.emergencyContact')}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {isEditing ? (
              <>
                <Input label={t('profile.contactName')} error={errors.emergencyContact?.name?.message} {...register('emergencyContact.name')} />
                <Input label={t('profile.contactPhone')} error={errors.emergencyContact?.phone?.message} {...register('emergencyContact.phone')} />
                <Input label={t('profile.contactRelation')} error={errors.emergencyContact?.relation?.message} {...register('emergencyContact.relation')} />
              </>
            ) : (
              <>
                <Field label={t('profile.contactName')} value={employee.emergencyContact.name} />
                <Field label={t('profile.contactPhone')} value={employee.emergencyContact.phone} />
                <Field label={t('profile.contactRelation')} value={employee.emergencyContact.relation} />
              </>
            )}
          </div>
        </Card>
      )}

      {isEditing && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={mutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {t('profile.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
