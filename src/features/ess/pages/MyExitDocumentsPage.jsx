/**
 * MyExitDocumentsPage — a Worker's exit re-entry visa requests, certificate
 * requests, and a read-only view of their assigned company assets (P3-D).
 * Three sections, one page — same grouping as the staff-side
 * ExitDocumentsPage, plus the read-only assets list the PRD frames as
 * something the employee sees on their own.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  listMyExitReentry,
  submitMyExitReentry,
  cancelMyExitReentry,
  listMyCertificates,
  submitMyCertificate,
  cancelMyCertificate,
  downloadMyCertificatePdf,
  listMyAssets,
} from '../ess.api.js';
import {
  exitReentryFormSchema,
  emptyExitReentryForm,
  certificateFormSchema,
  emptyCertificateForm,
} from '../../exitDocuments/exitDocuments.schema.js';
import { apiMessage, formatDate, collectFormErrorMessages } from '../../../lib/utils.js';
import {
  VISA_TYPES,
  EXIT_REENTRY_STATUS_VARIANT,
  CERTIFICATE_TYPES,
  CERTIFICATE_TYPES_WITH_PDF,
  CERTIFICATE_STATUS_VARIANT,
} from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

function MyExitReentrySection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'exit-reentry'],
    queryFn: () => listMyExitReentry({ limit: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(exitReentryFormSchema), defaultValues: emptyExitReentryForm });

  const submitMutation = useMutation({
    mutationFn: submitMyExitReentry,
    onSuccess: () => {
      toast.success(t('exitDocuments.exitReentry.submittedToast'));
      reset(emptyExitReentryForm);
      queryClient.invalidateQueries({ queryKey: ['me', 'exit-reentry'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelMyExitReentry(id),
    onSuccess: () => {
      toast.success(t('exitDocuments.exitReentry.cancelledToast'));
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me', 'exit-reentry'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToCancel(null);
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[ess] exit re-entry form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('exitDocuments.exitReentry.formInvalid'));
  };

  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('exitDocuments.exitReentry.sectionTitle')}</h2>
        <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
          <Select label={t('exitDocuments.exitReentry.visaType')} error={errors.visaType?.message} {...register('visaType')}>
            <option value="">{t('exitDocuments.exitReentry.choose')}</option>
            {VISA_TYPES.map((v) => (
              <option key={v} value={v}>
                {t(`exitDocuments.exitReentry.visaTypes.${v}`, v)}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={t('exitDocuments.exitReentry.departureDate')} type="date" error={errors.departureDate?.message} {...register('departureDate')} />
            <Input label={t('exitDocuments.exitReentry.expectedReturn')} type="date" error={errors.expectedReturnDate?.message} {...register('expectedReturnDate')} />
          </div>
          <Textarea label={t('exitDocuments.exitReentry.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />
          <div className="flex justify-end">
            <Button type="submit" isLoading={submitMutation.isPending}>
              {t('common.submitRequest')}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('exitDocuments.exitReentry.yourRequests')}</h2>
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <EmptyState title={t('exitDocuments.exitReentry.loadError')} description={t('common.checkConnection')} action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
        ) : data.items.length === 0 ? (
          <EmptyState title={t('exitDocuments.exitReentry.empty')} description={t('exitDocuments.exitReentry.emptyDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {data.items.map((r) => (
              <div key={r._id} className="flex items-start justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{t('exitDocuments.exitReentry.exitLabel', { type: t(`exitDocuments.exitReentry.visaTypes.${r.visaType}`, r.visaType) })}</p>
                  <p className="text-xs text-muted">
                    {t('exitDocuments.exitReentry.departReturn', { departure: formatDate(r.departureDate), returnDate: formatDate(r.expectedReturnDate) })}
                  </p>
                  {r.decisionNote && <p className="mt-1 text-xs italic text-muted">{t('common.note')}: {r.decisionNote}</p>}
                  {r.visaReferenceNumber && <p className="mt-1 text-xs text-muted">{t('exitDocuments.exitReentry.reference', { ref: r.visaReferenceNumber })}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={EXIT_REENTRY_STATUS_VARIANT[r.status]}>{t(`common.status.${r.status}`, r.status)}</Badge>
                  {r.status === 'Pending' && (
                    <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(r)}>
                      {t('leave.cancelButton')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('exitDocuments.exitReentry.cancelDialog.title')}
        message={t('exitDocuments.exitReentry.cancelDialog.message')}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}

function MyCertificatesSection() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [toCancel, setToCancel] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'certificates'],
    queryFn: () => listMyCertificates({ limit: 50 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(certificateFormSchema), defaultValues: emptyCertificateForm });

  const submitMutation = useMutation({
    mutationFn: submitMyCertificate,
    onSuccess: () => {
      toast.success(t('exitDocuments.certificates.submittedToast'));
      reset(emptyCertificateForm);
      queryClient.invalidateQueries({ queryKey: ['me', 'certificates'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => cancelMyCertificate(id),
    onSuccess: () => {
      toast.success(t('exitDocuments.certificates.cancelledToast'));
      setToCancel(null);
      queryClient.invalidateQueries({ queryKey: ['me', 'certificates'] });
    },
    onError: (error) => {
      toast.error(apiMessage(error));
      setToCancel(null);
    },
  });

  async function handleDownload(request) {
    setDownloadingId(request._id);
    try {
      await downloadMyCertificatePdf(request._id, `${request.type}.pdf`);
    } catch (error) {
      toast.error(apiMessage(error, t('exitDocuments.certificates.downloadError')));
    } finally {
      setDownloadingId(null);
    }
  }

  const onInvalid = (formErrors) => {
    console.error('[ess] certificate form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('exitDocuments.certificates.formInvalid'));
  };

  return (
    <>
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{t('exitDocuments.certificates.sectionTitle')}</h2>
        <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
          <Select label={t('exitDocuments.certificates.type')} error={errors.type?.message} {...register('type')}>
            <option value="">{t('exitDocuments.certificates.choose')}</option>
            {CERTIFICATE_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`exitDocuments.certificates.types.${ty}`, ty)}
              </option>
            ))}
          </Select>
          <Textarea label={t('exitDocuments.certificates.purpose')} placeholder={t('exitDocuments.certificates.purposePlaceholder')} error={errors.purpose?.message} {...register('purpose')} />
          <div className="flex justify-end">
            <Button type="submit" isLoading={submitMutation.isPending}>
              {t('common.submitRequest')}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('exitDocuments.certificates.yourRequests')}</h2>
        {isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : isError ? (
          <EmptyState title={t('exitDocuments.certificates.loadError')} description={t('common.checkConnection')} action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
        ) : data.items.length === 0 ? (
          <EmptyState title={t('exitDocuments.certificates.empty')} description={t('exitDocuments.certificates.emptyDescription')} />
        ) : (
          <Card className="divide-y divide-border">
            {data.items.map((c) => {
              const hasPdf = CERTIFICATE_TYPES_WITH_PDF.includes(c.type) && ['Approved', 'Issued'].includes(c.status);
              return (
                <div key={c._id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{t(`exitDocuments.certificates.types.${c.type}`, c.type)}</p>
                    {c.purpose && <p className="text-xs text-muted">{t('exitDocuments.certificates.forPurpose', { purpose: c.purpose })}</p>}
                    {c.decisionNote && <p className="mt-1 text-xs italic text-muted">{t('common.note')}: {c.decisionNote}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Badge variant={CERTIFICATE_STATUS_VARIANT[c.status]}>{t(`common.status.${c.status}`, c.status)}</Badge>
                    {hasPdf && (
                      <Button size="sm" variant="ghost" isLoading={downloadingId === c._id} onClick={() => handleDownload(c)}>
                        {t('common.download')}
                      </Button>
                    )}
                    {c.status === 'Pending' && (
                      <Button size="sm" variant="danger-ghost" onClick={() => setToCancel(c)}>
                        {t('leave.cancelButton')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={t('exitDocuments.certificates.cancelDialog.title')}
        message={toCancel && t('exitDocuments.certificates.cancelDialog.message', { type: t(`exitDocuments.certificates.types.${toCancel.type}`, toCancel.type) })}
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate(toCancel._id)}
        onCancel={() => setToCancel(null)}
      />
    </>
  );
}

function MyAssetsSection() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['me', 'assets'],
    queryFn: () => listMyAssets(),
  });

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('exitDocuments.assets.sectionTitle')}</h2>
      {isPending ? (
        <Skeleton className="h-20 w-full" />
      ) : isError ? (
        <EmptyState title={t('exitDocuments.assets.loadError')} description={t('common.checkConnection')} action={<Button variant="secondary" onClick={() => refetch()}>{t('common.retry')}</Button>} />
      ) : data.length === 0 ? (
        <EmptyState title={t('exitDocuments.assets.empty')} description={t('exitDocuments.assets.emptyDescription')} />
      ) : (
        <Card className="divide-y divide-border">
          {data.map((a, i) => (
            <div key={i} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{a.assetName}</p>
                <p className="text-xs text-muted">{a.assetTag}</p>
              </div>
              <Badge variant={a.status === 'Active' ? 'primary' : 'default'}>
                {a.status === 'Active' ? t('exitDocuments.assets.currentlyWithYou') : t('exitDocuments.assets.returnedOn', { date: formatDate(a.returnedAt) })}
              </Badge>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

export default function MyExitDocumentsPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={t('exitDocuments.title')} description={t('exitDocuments.description')} />
      <MyExitReentrySection />
      <MyCertificatesSection />
      <MyAssetsSection />
    </div>
  );
}
