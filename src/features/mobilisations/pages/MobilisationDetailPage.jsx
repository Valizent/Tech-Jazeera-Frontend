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
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getMobilisation,
  listCoordinatorCandidates,
  addCoordinator,
  removeCoordinator,
  confirmCoordinator,
  submitMobilisation,
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
import MobilisationDocumentPreviewModal from '../components/MobilisationDocumentPreviewModal.jsx';
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

/** A small inline warning triangle — no icon library in this app (Tailwind
 *  only), so every icon here is a hand-drawn SVG, same as the header's
 *  hamburger/theme-toggle icons. */
function WarningIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.29 2.25h17.78A1.5 1.5 0 0 0 22.18 18L13.71 3.86a1.5 1.5 0 0 0-2.62 0Z" />
    </svg>
  );
}

/** Label/value rows as a real table — reads top-to-bottom instead of
 *  scattered across a grid, which is the point for a section with a dozen+
 *  fields. By default a row with no value is simply omitted (an optional
 *  field genuinely not set, e.g. checkout date — nothing to flag). A row
 *  marked `required: true` behaves differently: it's ALWAYS shown, and an
 *  empty value renders as a visible "Missing" warning instead of vanishing
 *  — for fields someone was actually supposed to fill in (Office
 *  Secretary's quotation/PO details), silently hiding an empty one looks
 *  identical to "nothing to see here" when it's really "this hasn't been
 *  done yet". `overflow-x-auto` is defensive — two columns of this width
 *  never actually needs it, but every wide-ish container in this app
 *  carries its own scroll per the project's no-horizontal-page-scroll
 *  rule. */
function DetailTable({ rows }) {
  const { t } = useTranslation();
  const isEmpty = (value) => value === undefined || value === null || value === '';
  const visible = rows.filter((r) => r.required || !isEmpty(r.value));
  if (!visible.length) return null;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-border">
          {visible.map((r) => {
            const missing = r.required && isEmpty(r.value);
            return (
              <tr key={r.label}>
                <td className="w-2/5 bg-bg/40 px-3 py-2 align-top text-xs uppercase tracking-wide text-muted">
                  {r.label}
                </td>
                <td className={cn('px-3 py-2 font-medium', missing ? 'text-danger' : r.valueClassName)}>
                  {missing ? (
                    <span className="inline-flex items-center gap-1.5">
                      <WarningIcon className="h-4 w-4 shrink-0" />
                      {t('staffMobilisations.detail.missing')}
                    </span>
                  ) : (
                    r.value
                  )}
                </td>
              </tr>
            );
          })}
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
/** Approve/Reject, shared by both the read-only and editable renderings
 *  below — identical either way, just placed at the very end of whichever
 *  one is showing. */
function DecideButtons({ canDecide, isFinalStep, onApprove, onReject }) {
  const { t } = useTranslation();
  if (!canDecide) return null;
  if (!isFinalStep) {
    // Not the final step (Office Secretary today) — nothing upstream of
    // them to reject, so their only action is to move it forward. Same
    // underlying call as Approve (advances currentStep), just never
    // offered a Reject alongside it.
    return (
      <Button type="button" onClick={onApprove}>
        {t('staffMobilisations.detail.submitToNextStep')}
      </Button>
    );
  }
  return (
    <>
      <Button type="button" variant="danger-ghost" onClick={onReject}>
        {t('common.reject')}
      </Button>
      <Button type="button" onClick={onApprove}>
        {t('common.approve')}
      </Button>
    </>
  );
}

function CommercialDetailsCard({ m, canEdit, canDecide, isFinalStep, onSave, saving, onApprove, onReject }) {
  const { t } = useTranslation();

  // View-only (Marketing Manager, or any other viewer without edit rights)
  // — a table like every other section on this page, not a form full of
  // disabled inputs nobody can tell apart from an editable one. The
  // overtime/timesheet numbers are deliberately absent here: they're
  // already in the Rates & Financials table above, and repeating them in a
  // second, form-shaped table right below was the actual complaint — same
  // numbers, shown twice, one copy looking editable when it wasn't.
  if (!canEdit) {
    return (
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          {t('staffMobilisations.detail.detailsSharedByClient')}
        </h2>
        <DetailTable
          rows={[
            // Client quotation/PO always apply — every mobilisation bills a
            // client, so these are flagged as missing when Office Secretary
            // hasn't filled them in yet rather than silently disappearing.
            { label: t('staffMobilisations.detail.clientQuotation'), value: m.clientQuotation, required: true },
            {
              label: t('staffMobilisations.detail.clientQuotationDate'),
              value: m.clientQuotationDate && formatDate(m.clientQuotationDate),
              required: true,
            },
            { label: t('staffMobilisations.detail.clientPO'), value: m.clientPO, required: true },
            {
              label: t('staffMobilisations.detail.clientPODate'),
              value: m.clientPODate && formatDate(m.clientPODate),
              required: true,
            },
            // Sub quotation/PO only "required" when there's actually a
            // subcontractor to get one from — otherwise an empty value is
            // correctly N/A, not missing, and stays silently hidden.
            { label: t('staffMobilisations.detail.subQuotation'), value: m.subQuotation, required: m.hasSubcontractor },
            {
              label: t('staffMobilisations.detail.subQuotationDate'),
              value: m.subQuotationDate && formatDate(m.subQuotationDate),
              required: m.hasSubcontractor,
            },
            { label: t('staffMobilisations.detail.subPO'), value: m.subPO, required: m.hasSubcontractor },
            {
              label: t('staffMobilisations.detail.subPODate'),
              value: m.subPODate && formatDate(m.subPODate),
              required: m.hasSubcontractor,
            },
          ]}
        />
        {canDecide && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <DecideButtons canDecide={canDecide} isFinalStep={isFinalStep} onApprove={onApprove} onReject={onReject} />
          </div>
        )}
      </Card>
    );
  }

  // Editable (Office Secretary during their own turn, or Admin) — the real
  // data-entry form, now just the client/sub quotation-PO paper trail. OT
  // rate fields moved to the New/Edit form (2026-09-13) — this page no
  // longer types them in at all, only shows them read-only in Rates &
  // Financials above (they're Section 1 data now, same as clientRate).
  return <CommercialDetailsForm m={m} canDecide={canDecide} isFinalStep={isFinalStep} onSave={onSave} saving={saving} onApprove={onApprove} onReject={onReject} />;
}

function CommercialDetailsForm({ m, canDecide, isFinalStep, onSave, saving, onApprove, onReject }) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(commercialDetailsFormSchema), defaultValues: commercialDetailsToForm(m) });

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        {t('staffMobilisations.detail.detailsSharedByClient')}
      </h2>
      <form onSubmit={handleSubmit(onSave)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffMobilisations.detail.clientQuotation')} error={errors.clientQuotation?.message} {...register('clientQuotation')} />
          <Input label={t('staffMobilisations.detail.clientQuotationDate')} type="date" error={errors.clientQuotationDate?.message} {...register('clientQuotationDate')} />
          <Input label={t('staffMobilisations.detail.clientPO')} error={errors.clientPO?.message} {...register('clientPO')} />
          <Input label={t('staffMobilisations.detail.clientPODate')} type="date" error={errors.clientPODate?.message} {...register('clientPODate')} />
          <Input label={t('staffMobilisations.detail.subQuotation')} error={errors.subQuotation?.message} {...register('subQuotation')} />
          <Input label={t('staffMobilisations.detail.subQuotationDate')} type="date" error={errors.subQuotationDate?.message} {...register('subQuotationDate')} />
          <Input label={t('staffMobilisations.detail.subPO')} error={errors.subPO?.message} {...register('subPO')} />
          <Input label={t('staffMobilisations.detail.subPODate')} type="date" error={errors.subPODate?.message} {...register('subPODate')} />
        </div>
        <Textarea label={t('staffMobilisations.form.remark')} error={errors.remark?.message} {...register('remark')} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="submit" variant="secondary" isLoading={saving}>
            {t('staffMobilisations.detail.saveDetails')}
          </Button>
          <DecideButtons canDecide={canDecide} isFinalStep={isFinalStep} onApprove={onApprove} onReject={onReject} />
        </div>
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
  const [files, setFiles] = useState([]);
  const [category, setCategory] = useState('Contract');
  const [previewDoc, setPreviewDoc] = useState(null);
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
  const needsMyConfirmation = myEntry && !myEntry.confirmed && ['Draft', 'Rejected'].includes(m.status);
  const unconfirmed = m.coordinators.filter((c) => !c.confirmed);
  const canSubmit = canManage && unconfirmed.length === 0;
  const canDecide = m.canDecideCurrentStep && m.status === 'PendingReview';
  // Only the workflow's final step gets a real Reject — see
  // CommercialDetailsCard's own comment on why an earlier step (Office
  // Secretary) only ever has "Submit" (the same underlying Approve call).
  const isFinalStep = (m.steps?.length ?? 1) - 1 <= m.currentStep;
  // Section 2's fields are editable only by the workflow's first-step
  // reviewer (Office Secretary today) or Admin, and ONLY during their own
  // turn (currentStep === 0) — every later step (Marketing Manager, etc.)
  // can see the data and decide on it, never change it. Mirrors
  // mobilisation.service.js's saveCommercialDetails check exactly.
  const canEditDetails = user.role === 'Admin' || (canDecide && m.currentStep === 0);
  // The Edit page is Section 1 (the coordinator's own data) — normally
  // Draft/Rejected only, but ALSO open throughout PendingReview to whoever
  // holds step 0 (Office Secretary today), even after the record has moved
  // on to a later step — a genuinely different, WIDER right than Section
  // 2's own (`canEditDetails` above), driven by the server's own
  // `canEditSection1` flag (see getMobilisation's own doc comment) rather
  // than recomputed here, since "am I a member of step 0's ApprovalRole" is
  // a server-only lookup this client has no way to answer itself.
  const canEditSection1 = canManage || Boolean(m.canEditSection1);
  const hasCommercialFields = 'clientRate' in m;
  // Section 2 (quotation/PO paper trail/remark) is simply absent from the
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
            {m.deployment && (
              <Link to={`/deployments/${m.deployment._id}`}>
                <Button size="sm" variant="secondary">
                  {t('staffMobilisations.detail.viewDeployment')}
                </Button>
              </Link>
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
                  <Button size="sm" variant="ghost" onClick={() => setPreviewDoc(d)}>
                    {t('common.view')}
                  </Button>
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
            { label: t('staffMobilisations.detail.fields.site'), value: m.site },
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
                label: t('staffMobilisations.detail.fields.otProfitPerHour'),
                value: m.otProfitPerHour != null ? formatMoney(m.otProfitPerHour) : null,
                valueClassName: profitClass(m.otProfitPerHour),
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

      <ConfirmDialog
        open={Boolean(toRemove)}
        title={t('staffMobilisations.detail.removeCoordinatorConfirmTitle')}
        message={t('staffMobilisations.detail.removeCoordinatorConfirmMessage', { name: toRemove?.user?.name ?? t('staffMobilisations.detail.defaultCoordinatorName') })}
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(userId(toRemove))}
        onCancel={() => setToRemove(null)}
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
          )}
          {/* A comment is required to reject, but welcome on an approval
              too — the reviewer may want to leave a note either way. */}
          <Textarea
            label={pendingDecision === 'Rejected' ? t('staffMobilisations.detail.noteRequired') : t('staffMobilisations.detail.noteOptional')}
            value={decideNote}
            onChange={(e) => setDecideNote(e.target.value)}
            placeholder={t('staffMobilisations.detail.notePlaceholder')}
          />
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

      <MobilisationDocumentPreviewModal
        mobilisationId={id}
        doc={previewDoc}
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
