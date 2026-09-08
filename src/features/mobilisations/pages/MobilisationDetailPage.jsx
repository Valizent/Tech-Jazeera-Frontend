/**
 * MobilisationDetailPage — the workhorse: Section 1 display (fields the API
 * actually returned — commercial fields are simply absent for a stripped
 * Coordinator view, no client-side hiding logic needed), the coordinator
 * confirm/invite/submit flow (M2), the Marketing Manager's Section 2 form +
 * Approve/Reject (M3), and document upload/list/download (M5). Section 1
 * itself is edited on the separate MobilisationEditPage — this page is
 * about the workflow around the record, not the record's own fields.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getMobilisation,
  listCoordinatorCandidates,
  addCoordinator,
  removeCoordinator,
  confirmCoordinator,
  submitMobilisation,
  completeMobilisation,
  deleteMobilisation,
  saveCommercialDetails,
  decideMobilisation,
  uploadMobilisationDocuments,
  deleteMobilisationDocument,
  downloadMobilisationDocument,
  downloadMobilisationExport,
} from '../mobilisations.api.js';
import {
  commercialDetailsFormSchema,
  commercialDetailsToForm,
  decideMobilisationFormSchema,
} from '../mobilisations.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage, cn, formatDate, formatMoney } from '../../../lib/utils.js';
import { MOBILISATION_STATUS_VARIANT, MOBILISATION_DOCUMENT_CATEGORIES, MOBILISATION_DOCUMENT_CATEGORY_LABELS } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/** Green when profit, red when loss — zero stays neutral (not a loss). */
function profitClass(amount) {
  if (amount > 0) return 'text-success';
  if (amount < 0) return 'text-danger';
  return undefined;
}

/** Label/value rows as a real table — reads top-to-bottom instead of
 *  scattered across a grid, which is the point for a section with a dozen+
 *  fields. Rows with no value are simply omitted (same "don't show empty
 *  fields" convention as Field). `overflow-x-auto` is defensive — two
 *  columns of this width never actually needs it, but every wide-ish
 *  container in this app carries its own scroll per the project's no-
 *  horizontal-page-scroll rule. */
function DetailTable({ rows }) {
  const visible = rows.filter((r) => r.value !== undefined && r.value !== null && r.value !== '');
  if (!visible.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {visible.map((r) => (
            <tr key={r.label}>
              <td className="w-2/5 bg-bg/40 px-3 py-2 align-top text-xs uppercase tracking-wide text-muted">
                {r.label}
              </td>
              <td className={cn('px-3 py-2 font-medium', r.valueClassName)}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function userId(entry) {
  return entry.user._id ?? entry.user;
}

/**
 * Extracted so useForm only ever mounts once `m` is real data — this
 * component is placed in the parent's JSX AFTER the loading guard, so its
 * first-ever render already has the right defaultValues. (Calling useForm
 * directly in the parent, before that guard, would freeze defaultValues at
 * `undefined` from the loading-state render and never repopulate — RHF only
 * reads defaultValues at mount.)
 */
function CommercialDetailsCard({ m, canEdit, canDecide, isFinalStep, onSave, saving, onApprove, onReject }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(commercialDetailsFormSchema), defaultValues: commercialDetailsToForm(m) });

  // Server-derived, never typed in (see mobilisation.service.js's
  // computeProfitFields): max(0, client timesheet hours - required
  // timesheet hours), live-updating as the reviewer types the client's
  // actual hours in above.
  const clientTimesheetHoursRaw = watch('clientTimesheetHours');
  const clientTimesheetHours = Number(clientTimesheetHoursRaw);
  const otHoursPreview =
    clientTimesheetHoursRaw !== '' && Number.isFinite(clientTimesheetHours)
      ? Math.max(0, clientTimesheetHours - (m.requiredTimesheetHours ?? 0))
      : 0;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {t('staffMobilisations.detail.detailsSharedByClient')}
      </h2>
      <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffMobilisations.detail.clientQuotation')} disabled={!canEdit} error={errors.clientQuotation?.message} {...register('clientQuotation')} />
          <Input label={t('staffMobilisations.detail.clientQuotationDate')} type="date" disabled={!canEdit} error={errors.clientQuotationDate?.message} {...register('clientQuotationDate')} />
          <Input label={t('staffMobilisations.detail.clientPO')} disabled={!canEdit} error={errors.clientPO?.message} {...register('clientPO')} />
          <Input label={t('staffMobilisations.detail.clientPODate')} type="date" disabled={!canEdit} error={errors.clientPODate?.message} {...register('clientPODate')} />
          <Input label={t('staffMobilisations.detail.subQuotation')} disabled={!canEdit} error={errors.subQuotation?.message} {...register('subQuotation')} />
          <Input label={t('staffMobilisations.detail.subQuotationDate')} type="date" disabled={!canEdit} error={errors.subQuotationDate?.message} {...register('subQuotationDate')} />
          <Input label={t('staffMobilisations.detail.subPO')} disabled={!canEdit} error={errors.subPO?.message} {...register('subPO')} />
          <Input label={t('staffMobilisations.detail.subPODate')} type="date" disabled={!canEdit} error={errors.subPODate?.message} {...register('subPODate')} />
        </div>
        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.detail.sectionOvertimeTimesheet')}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('staffMobilisations.detail.clientTimesheetHours')}
              type="number"
              step="0.01"
              min="0"
              disabled={!canEdit}
              error={errors.clientTimesheetHours?.message}
              {...register('clientTimesheetHours')}
            />
            <Input
              label={t('staffMobilisations.detail.otHours')}
              type="text"
              readOnly
              disabled
              value={otHoursPreview}
            />
            <Input
              label={t('staffMobilisations.detail.otClientRate')}
              type="number"
              step="0.01"
              min="0"
              disabled={!canEdit}
              error={errors.otClientRate?.message}
              {...register('otClientRate')}
            />
            <Input
              label={t('staffMobilisations.detail.otClientCommission')}
              type="number"
              step="0.01"
              min="0"
              disabled={!canEdit}
              error={errors.otClientCommission?.message}
              {...register('otClientCommission')}
            />
            {m.workerType === 'SupplierEmployee' && (
              <>
                <Input
                  label={t('staffMobilisations.detail.otSubcontractorRate')}
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit}
                  error={errors.otSubcontractorRate?.message}
                  {...register('otSubcontractorRate')}
                />
                <Input
                  label={t('staffMobilisations.detail.otSubcontractorCommission')}
                  type="number"
                  step="0.01"
                  min="0"
                  disabled={!canEdit}
                  error={errors.otSubcontractorCommission?.message}
                  {...register('otSubcontractorCommission')}
                />
              </>
            )}
          </div>
        </div>
        <Textarea label={t('staffMobilisations.form.remark')} disabled={!canEdit} error={errors.remark?.message} {...register('remark')} />
        {(canEdit || canDecide) && (
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {canEdit && (
              <Button type="submit" variant="secondary" isLoading={saving}>
                {t('staffMobilisations.detail.saveDetails')}
              </Button>
            )}
            {canDecide && !isFinalStep && (
              // Not the final step (Office Secretary today) — nothing
              // upstream of them to reject, so their only action is to move
              // it forward. Same underlying call as Approve (advances
              // currentStep), just never offered a Reject alongside it.
              <Button type="button" onClick={onApprove}>
                {t('staffMobilisations.detail.submitToNextStep')}
              </Button>
            )}
            {canDecide && isFinalStep && (
              <>
                <Button type="button" variant="danger-ghost" onClick={onReject}>
                  {t('common.reject')}
                </Button>
                <Button type="button" onClick={onApprove}>
                  {t('common.approve')}
                </Button>
              </>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

export default function MobilisationDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteId, setInviteId] = useState('');
  const [toRemove, setToRemove] = useState(null);
  const [decideNote, setDecideNote] = useState('');
  const [rejectionTarget, setRejectionTarget] = useState('');
  const [pendingDecision, setPendingDecision] = useState(null); // 'Approved' | 'Rejected' | null
  const [confirmingComplete, setConfirmingComplete] = useState(false);
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('Contract');
  // TEMPORARY — pre-production cleanup only. Remove confirmingDelete,
  // deleteMutation, the "Delete" button below, and its ConfirmDialog before
  // going live — see the note in mobilisations.api.js.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { data: m, isPending, isError } = useQuery({
    queryKey: ['mobilisation', id],
    queryFn: () => getMobilisation(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mobilisation', id] });
    queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
  };

  const { data: candidates } = useQuery({
    queryKey: ['mobilisations', 'coordinator-candidates'],
    queryFn: listCoordinatorCandidates,
    enabled: Boolean(m) && ['Draft', 'Rejected'].includes(m?.status),
  });

  const commercialMutation = useMutation({
    mutationFn: (values) => saveCommercialDetails(id, values),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.commercialSavedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const addMutation = useMutation({
    mutationFn: (uid) => addCoordinator(id, uid),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.invitedToast'));
      setInviteId('');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const removeMutation = useMutation({
    mutationFn: (uid) => removeCoordinator(id, uid),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.removedToast'));
      setToRemove(null);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const confirmMutation = useMutation({
    mutationFn: () => confirmCoordinator(id, user.id),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.confirmedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const submitMutation = useMutation({
    mutationFn: () => submitMobilisation(id),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.submittedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const completeMutation = useMutation({
    mutationFn: () => completeMobilisation(id),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.completedToast'));
      setConfirmingComplete(false);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  // TEMPORARY — pre-production cleanup only, see the note above confirmingDelete.
  const deleteMutation = useMutation({
    mutationFn: () => deleteMobilisation(id),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.deletedToast'));
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
      navigate('/mobilisations');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const exportMutation = useMutation({
    mutationFn: () => downloadMobilisationExport(id, m.serialNumber),
    onError: (error) => toast.error(apiMessage(error)),
  });
  const decideMutation = useMutation({
    mutationFn: (values) => decideMobilisation(id, values),
    onSuccess: (updated) => {
      // A rejection targeting 'OfficeSecretary' never leaves 'PendingReview'
      // (see rejectMobilisation) — status alone can't distinguish "sent back
      // for rework" from an ordinary in-progress record, so what was
      // actually requested (pendingDecision) picks the toast instead.
      let toastKey = 'approvedToast';
      if (pendingDecision === 'Rejected') {
        toastKey = updated.status === 'PendingReview' ? 'sentBackToast' : 'rejectedToast';
      }
      toast.success(t(`staffMobilisations.detail.${toastKey}`));
      setPendingDecision(null);
      setDecideNote('');
      setRejectionTarget('');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const uploadMutation = useMutation({
    mutationFn: () => uploadMobilisationDocuments(id, files, category),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.documentUploadedToast'));
      setFiles([]);
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });
  const deleteDocMutation = useMutation({
    mutationFn: (fileId) => deleteMobilisationDocument(id, fileId),
    onSuccess: () => {
      toast.success(t('staffMobilisations.detail.documentRemovedToast'));
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !m) {
    return (
      <EmptyState
        title={t('staffMobilisations.detail.notFoundTitle')}
        description={t('staffMobilisations.detail.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/mobilisations')} />}
      />
    );
  }

  const myEntry = m.coordinators.find((c) => userId(c) === user.id);
  const isPrimary = m.coordinators.some((c) => c.isPrimary && userId(c) === user.id);
  const canManage = (user.role === 'Admin' || isPrimary) && ['Draft', 'Rejected'].includes(m.status);
  // Milestone 5: releases the worker back to standby (Employee.coordinator
  // → null) — same primary-coordinator-or-Admin circle as every other
  // record-level action, Approved only (the one status it can be marked
  // complete from).
  const canComplete = (user.role === 'Admin' || isPrimary) && m.status === 'Approved';
  const needsMyConfirmation = myEntry && !myEntry.confirmed && ['Draft', 'Rejected'].includes(m.status);
  const unconfirmed = m.coordinators.filter((c) => !c.confirmed);
  const canSubmit = canManage && unconfirmed.length === 0;
  const canDecide = m.canDecideCurrentStep && m.status === 'PendingReview';
  // Only the workflow's final step gets a real Reject — see
  // CommercialDetailsCard's own comment on why an earlier step (Office
  // Secretary) only ever has "Submit" (the same underlying Approve call).
  const isFinalStep = (m.steps?.length ?? 1) - 1 <= m.currentStep;
  // Section 2's fields are editable only by the workflow's first-step
  // reviewer (Office Secretary today) or Admin — every later step
  // (Marketing Manager, etc.) can see the data and decide on it, never
  // change it. Mirrors mobilisation.service.js's saveCommercialDetails
  // check exactly (currentStep === 0, not steps[currentStep]).
  const canEditDetails = user.role === 'Admin' || (canDecide && m.currentStep === 0);
  // The Edit page is Section 1 (the coordinator's own data) — normally
  // Draft/Rejected only, but ALSO open to whoever can edit Section 2 during
  // their first-step turn (Office Secretary fixing what the coordinator got
  // wrong, logged the same way as any other edit — see updateMobilisation).
  const canEditSection1 = canManage || canEditDetails;
  const hasCommercialFields = 'clientRate' in m;
  // Section 2 (quotation/PO/OT/timesheet/remark) is simply absent from the
  // API response for a plain coordinator — the server strips it
  // unconditionally now (see mobilisation.service.js's REVIEW_FIELDS), so
  // its presence at all is the signal this viewer is entitled to see it
  // (Admin, a 'mobilisationsViewer' Section Access member, or the
  // current-step reviewer).
  const hasReviewFields = 'clientQuotation' in m;
  const documentsEditable = !['Approved', 'Completed'].includes(m.status);
  // Deleting stays Admin/coordinator only. Adding is wider — the current
  // step's reviewer (e.g. Office Secretary) can attach a file too, mirroring
  // the server's assertCanAddDocuments/assertCanDeleteDocuments split.
  const canDeleteDocuments = (user.role === 'Admin' || myEntry) && documentsEditable;
  const canAddDocuments = (user.role === 'Admin' || myEntry || canDecide) && documentsEditable;
  const availableCandidates = (candidates ?? []).filter((c) => !m.coordinators.some((mc) => userId(mc) === c._id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`#${m.serialNumber} — ${m.workerName} — ${m.clientName}`}
        description={m.jobTitle}
        onBack={() => navigate(-1)}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={MOBILISATION_STATUS_VARIANT[m.status]}>{t(`common.status.${m.status}`, m.status)}</Badge>
            <Button size="sm" variant="secondary" isLoading={exportMutation.isPending} onClick={() => exportMutation.mutate()}>
              {t('staffMobilisations.detail.exportExcel')}
            </Button>
            {canEditSection1 && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/mobilisations/${id}/edit`)}>
                {t('common.edit')}
              </Button>
            )}
            {canComplete && (
              <Button size="sm" variant="secondary" onClick={() => setConfirmingComplete(true)}>
                {t('staffMobilisations.detail.markComplete')}
              </Button>
            )}
            {/* TEMPORARY — pre-production cleanup only, see the note above confirmingDelete. */}
            {user.role === 'Admin' && (
              <Button size="sm" variant="danger-ghost" onClick={() => setConfirmingDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t('staffMobilisations.detail.sectionWorkerPlacement')}
        </h2>
        <DetailTable
          rows={[
            { label: t('staffMobilisations.detail.fields.workerName'), value: m.workerName },
            {
              label: t('staffMobilisations.detail.fields.workerType'),
              value: t(`staffMobilisations.form.workerType.${m.workerType}`, m.workerType),
            },
            { label: t('staffMobilisations.detail.fields.iqamaNumber'), value: m.iqamaNumber },
            { label: t('staffMobilisations.detail.fields.nationality'), value: m.nationality },
            { label: t('staffMobilisations.detail.fields.phone'), value: m.phone },
            { label: t('staffMobilisations.detail.fields.jobTitle'), value: m.jobTitle },
            { label: t('staffMobilisations.detail.fields.client'), value: m.clientName },
            ...(m.hasSubcontractor
              ? [{ label: t('staffMobilisations.detail.fields.subcontractor'), value: m.subcontractorName }]
              : []),
            { label: t('staffMobilisations.detail.fields.mobilisationDate'), value: formatDate(m.mobilisationDate) },
            { label: t('staffMobilisations.detail.fields.checkoutDate'), value: m.checkoutDate && formatDate(m.checkoutDate) },
          ]}
        />
        {m.remark && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted">{t('staffMobilisations.detail.remark')}</p>
            <p className="text-sm">{m.remark}</p>
          </div>
        )}
      </Card>

      {hasCommercialFields && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            {t('staffMobilisations.detail.sectionRatesFinancials')}
          </h2>
          <DetailTable
            rows={[
              { label: t('staffMobilisations.detail.fields.clientRate'), value: formatMoney(m.clientRate) },
              { label: t('staffMobilisations.detail.fields.clientCommission'), value: formatMoney(m.clientCommission) },
              { label: t('staffMobilisations.detail.fields.fta'), value: formatMoney(m.fta) },
              { label: t('staffMobilisations.detail.fields.allowance'), value: formatMoney(m.allowance) },
              { label: t('staffMobilisations.detail.fields.requiredTimesheetHours'), value: m.requiredTimesheetHours ?? null },
              { label: t('staffMobilisations.detail.fields.clientTimesheetHours'), value: m.clientTimesheetHours ?? null },
              ...(m.hasSubcontractor
                ? [
                    { label: t('staffMobilisations.detail.fields.subcontractorRate'), value: formatMoney(m.subcontractorRate) },
                    {
                      label: t('staffMobilisations.detail.fields.subcontractorCommission'),
                      value: formatMoney(m.subcontractorCommission),
                    },
                  ]
                : []),
              { label: t('staffMobilisations.detail.fields.profitPerHour'), value: formatMoney(m.profitPerHour) },
              {
                label: t('staffMobilisations.detail.fields.profitPerMonth'),
                value: m.profitPerMonth != null ? formatMoney(m.profitPerMonth) : null,
                valueClassName: profitClass(m.profitPerMonth),
              },
              { label: t('staffMobilisations.detail.fields.otHours'), value: m.otHours ?? null },
              {
                label: t('staffMobilisations.detail.fields.otClientRate'),
                value: m.otClientRate != null ? formatMoney(m.otClientRate) : null,
              },
              {
                label: t('staffMobilisations.detail.fields.otClientCommission'),
                value: m.otClientCommission != null ? formatMoney(m.otClientCommission) : null,
              },
              ...(m.hasSubcontractor
                ? [
                    {
                      label: t('staffMobilisations.detail.fields.otSubcontractorRate'),
                      value: m.otSubcontractorRate != null ? formatMoney(m.otSubcontractorRate) : null,
                    },
                    {
                      label: t('staffMobilisations.detail.fields.otSubcontractorCommission'),
                      value: m.otSubcontractorCommission != null ? formatMoney(m.otSubcontractorCommission) : null,
                    },
                  ]
                : []),
              {
                label: t('staffMobilisations.detail.fields.otProfitTotal'),
                value: m.otProfitTotal ? formatMoney(m.otProfitTotal) : null,
                valueClassName: profitClass(m.otProfitTotal),
              },
            ]}
          />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.detail.coordinatorsTitle')}</h2>
        <ul className="space-y-2">
          {m.coordinators.map((c) => (
            <li key={userId(c)} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {c.user.name ?? userId(c)} {c.isPrimary && <span className="text-xs text-muted">{t('staffMobilisations.detail.primary')}</span>}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={c.confirmed ? 'success' : 'warning'}>{c.confirmed ? t('staffMobilisations.detail.confirmed') : t('staffMobilisations.detail.pending')}</Badge>
                {canManage && !c.isPrimary && !c.confirmed && (
                  <Button size="sm" variant="danger-ghost" onClick={() => setToRemove(c)}>
                    {t('staffMobilisations.detail.remove')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {needsMyConfirmation && (
          <div className="mt-4 rounded-lg bg-warning/10 p-3 text-sm">
            <p className="mb-2">{t('staffMobilisations.detail.needsConfirmationHint')}</p>
            <Button size="sm" isLoading={confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>
              {t('staffMobilisations.detail.confirmButton')}
            </Button>
          </div>
        )}

        {canManage && (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Select
              label={t('staffMobilisations.detail.addJointCoordinator')}
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              className="min-w-[200px]"
            >
              <option value="">{t('staffMobilisations.detail.selectCoordinator')}</option>
              {availableCandidates.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!inviteId}
              isLoading={addMutation.isPending}
              onClick={() => addMutation.mutate(inviteId)}
            >
              {t('staffMobilisations.detail.invite')}
            </Button>
          </div>
        )}

        {canManage && (
          <div className="mt-4 border-t border-border pt-4">
            {!canSubmit && unconfirmed.length > 0 && (
              <p className="mb-2 text-xs text-muted">
                {t('staffMobilisations.detail.waitingOnConfirmation', { names: unconfirmed.map((c) => c.user.name ?? userId(c)).join(', ') })}
              </p>
            )}
            <Button isLoading={submitMutation.isPending} disabled={!canSubmit} onClick={() => submitMutation.mutate()}>
              {t('staffMobilisations.detail.submitForReview')}
            </Button>
          </div>
        )}
      </Card>

      <ApprovalTrailView request={m} />

      {(canDecide || hasReviewFields) && (
        <CommercialDetailsCard
          m={m}
          canEdit={canEditDetails}
          canDecide={canDecide}
          isFinalStep={isFinalStep}
          saving={commercialMutation.isPending}
          onSave={(values) => commercialMutation.mutate(values)}
          onApprove={() => setPendingDecision('Approved')}
          onReject={() => setPendingDecision('Rejected')}
        />
      )}

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.detail.documentsTitle')}</h2>
        {(m.documents ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t('staffMobilisations.detail.noDocuments')}</p>
        ) : (
          <ul className="mb-4 divide-y divide-border">
            {m.documents.map((d) => (
              <li key={d._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {d.originalName} <span className="text-xs text-muted">({t(`staffMobilisations.documentCategoryLabels.${d.category}`, MOBILISATION_DOCUMENT_CATEGORY_LABELS[d.category])})</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => downloadMobilisationDocument(id, d._id, d.originalName)}>
                    {t('common.download')}
                  </Button>
                  {canDeleteDocuments && (
                    <Button size="sm" variant="danger-ghost" isLoading={deleteDocMutation.isPending} onClick={() => deleteDocMutation.mutate(d._id)}>
                      {t('common.delete')}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canAddDocuments && (
          <div className="flex flex-wrap items-end gap-2">
            <Select label={t('staffMobilisations.detail.category')} value={category} onChange={(e) => setCategory(e.target.value)} className="min-w-[140px]">
              {MOBILISATION_DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`staffMobilisations.documentCategoryLabels.${c}`, MOBILISATION_DOCUMENT_CATEGORY_LABELS[c])}
                </option>
              ))}
            </Select>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t('staffMobilisations.detail.filesLabel')}</label>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setFiles([...e.target.files])}
                className="text-sm"
              />
            </div>
            <Button size="sm" disabled={files.length === 0} isLoading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
              {t('staffMobilisations.detail.upload')}
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(toRemove)}
        title={t('staffMobilisations.detail.removeCoordinatorConfirmTitle')}
        message={t('staffMobilisations.detail.removeCoordinatorConfirmMessage', { name: toRemove?.user?.name ?? t('staffMobilisations.detail.defaultCoordinatorName') })}
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(userId(toRemove))}
        onCancel={() => setToRemove(null)}
      />

      <ConfirmDialog
        open={confirmingComplete}
        title={t('staffMobilisations.detail.completeConfirmTitle')}
        message={t('staffMobilisations.detail.completeConfirmMessage', { name: m.workerName })}
        confirmLabel={t('staffMobilisations.detail.markComplete')}
        confirmVariant="primary"
        loading={completeMutation.isPending}
        onConfirm={() => completeMutation.mutate()}
        onCancel={() => setConfirmingComplete(false)}
      />

      {/* TEMPORARY — pre-production cleanup only, see the note above confirmingDelete. */}
      <ConfirmDialog
        open={confirmingDelete}
        title={t('staffMobilisations.detail.deleteConfirmTitle')}
        message={t('staffMobilisations.detail.deleteConfirmMessage', { name: m.workerName })}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmingDelete(false)}
      />

      <Modal
        open={Boolean(pendingDecision)}
        onClose={() => {
          if (decideMutation.isPending) return;
          setPendingDecision(null);
          setDecideNote('');
          setRejectionTarget('');
        }}
        title={pendingDecision === 'Approved' ? t('staffMobilisations.detail.approveModalTitle') : t('staffMobilisations.detail.rejectModalTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {pendingDecision === 'Approved'
              ? t('staffMobilisations.detail.approveModalMessage')
              : t('staffMobilisations.detail.rejectModalMessage')}
          </p>
          {pendingDecision === 'Rejected' && (
            <>
              <Select
                label={t('staffMobilisations.detail.rejectionTargetLabel')}
                value={rejectionTarget}
                onChange={(e) => setRejectionTarget(e.target.value)}
              >
                <option value="">{t('staffMobilisations.detail.rejectionTargetPlaceholder')}</option>
                <option value="Coordinator">{t('staffMobilisations.detail.rejectionTargetCoordinator')}</option>
                <option value="OfficeSecretary">{t('staffMobilisations.detail.rejectionTargetOfficeSecretary')}</option>
                <option value="Both">{t('staffMobilisations.detail.rejectionTargetBoth')}</option>
              </Select>
              <Textarea
                label={t('staffMobilisations.detail.noteRequired')}
                value={decideNote}
                onChange={(e) => setDecideNote(e.target.value)}
                placeholder={t('staffMobilisations.detail.notePlaceholder')}
              />
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" disabled={decideMutation.isPending} onClick={() => setPendingDecision(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={pendingDecision === 'Rejected' ? 'danger' : 'primary'}
              isLoading={decideMutation.isPending}
              onClick={() => {
                const values = { status: pendingDecision, decisionNote: decideNote, rejectionTarget: rejectionTarget || undefined };
                const result = decideMobilisationFormSchema.safeParse(values);
                if (!result.success) {
                  toast.error(result.error.issues[0]?.message ?? t('staffMobilisations.detail.defaultRejectError'));
                  return;
                }
                decideMutation.mutate(values);
              }}
            >
              {pendingDecision === 'Approved' ? t('common.approve') : t('common.reject')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
