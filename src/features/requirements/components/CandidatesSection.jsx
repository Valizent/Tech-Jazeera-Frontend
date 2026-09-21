/**
 * CandidatesSection — the workers being lined up for a requirement, inside the
 * card detail. Each row shows who they are, where they came from, how far their
 * paperwork is (a status the coordinator can change in place), and — once started —
 * the mobilisation made for them. "Start mobilisation" opens the normal New
 * Mobilisation form pre-filled from the card and the candidate; the two ids in the
 * URL are all that's passed, the form fetches the rest itself.
 *
 * Which buttons show comes from the card's server-computed `permissions.edit`
 * (whoever may edit the card may keep its candidate list) plus whether the viewer
 * may create a mobilisation at all — the server re-checks both.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCandidate, removeCandidate } from '../requirements.api.js';
import { CANDIDATE_MANUAL_STATUSES } from '../requirements.schema.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import CandidateFormModal from './CandidateFormModal.jsx';

const STATUS_VARIANT = { Identified: 'default', DocsInProgress: 'warning', DocsReady: 'primary', Mobilised: 'success', Dropped: 'danger' };

export default function CandidatesSection({ requirement, canEdit, onBusyChange }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ open: false, candidate: null });
  const [toRemove, setToRemove] = useState(null);

  // Tell the card dialog underneath when one of OUR dialogs is up, so a single
  // Escape (every dialog listens on window) closes only the top one.
  const busy = form.open || Boolean(toRemove);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  const candidates = requirement.candidates ?? [];
  const canStartMobilisation = Boolean(user.sectionAccessWrite?.includes('mobilisationsSelfMobilise'));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['requirements'] });
  const onError = (what) => (error) => {
    console.error(`[requirements] ${what} failed`, error);
    toast.error(apiMessage(error));
  };

  const statusMutation = useMutation({
    mutationFn: ({ candidateId, status }) => updateCandidate(requirement._id, candidateId, { status }),
    onSuccess: invalidate,
    onError: onError('changing a candidate status'),
  });
  const removeMutation = useMutation({
    mutationFn: (candidateId) => removeCandidate(requirement._id, candidateId),
    onSuccess: () => {
      toast.success(t('staffRequirements.candidates.toasts.removed'));
      setToRemove(null);
      invalidate();
    },
    onError: (error) => {
      setToRemove(null);
      onError('removing a candidate')(error);
    },
  });

  const startMobilisation = (candidate) => navigate(`/mobilisations/new?requirement=${requirement._id}&candidate=${candidate._id}`);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {t('staffRequirements.candidates.heading')}
          <span className="ms-2 font-normal text-muted">
            {t('staffRequirements.candidates.progress', { mobilised: requirement.mobilisedCount, headcount: requirement.headcount })}
          </span>
        </h3>
        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setForm({ open: true, candidate: null })}>
            {t('staffRequirements.candidates.add')}
          </Button>
        )}
      </div>

      {candidates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          {canEdit ? t('staffRequirements.candidates.emptyEditable') : t('staffRequirements.candidates.emptyReadOnly')}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {candidates.map((c) => {
            const started = Boolean(c.mobilisation);
            const canStart = canEdit && canStartMobilisation && !started && c.status !== 'Dropped' && c.status !== 'Mobilised';
            return (
              <li key={c._id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {c.workerName}{' '}
                      <span className="text-xs font-normal text-muted">
                        {c.workerType === 'SupplierEmployee' ? c.subcontractorName : t('staffRequirements.candidates.workerType.Freelancer')}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      {[c.iqamaNumber && `${t('staffRequirements.candidates.iqamaShort')} ${c.iqamaNumber}`, c.nationality, c.phone].filter(Boolean).join(' · ') ||
                        t('staffRequirements.candidates.noIdentity')}
                    </p>
                    {c.docsNote && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.docsNote}</p>}
                  </div>
                  {canEdit && c.status !== 'Mobilised' ? (
                    <select
                      value={c.status}
                      disabled={statusMutation.isPending}
                      onChange={(e) => statusMutation.mutate({ candidateId: c._id, status: e.target.value })}
                      aria-label={t('staffRequirements.candidates.statusAria', { name: c.workerName })}
                      className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-text"
                    >
                      {CANDIDATE_MANUAL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {t(`staffRequirements.candidates.status.${s}`)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant={STATUS_VARIANT[c.status]}>{t(`staffRequirements.candidates.status.${c.status}`)}</Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs">
                    {started && (
                      <Link to={`/mobilisations/${c.mobilisation._id}`} className="font-medium text-primary hover:underline">
                        {c.mobilisation.serialNumber} · {t(`common.status.${c.mobilisation.status}`, c.mobilisation.status)}
                      </Link>
                    )}
                  </div>
                  <span className="flex flex-wrap items-center gap-1">
                    {canStart && (
                      <Button size="sm" variant={c.status === 'DocsReady' ? 'primary' : 'secondary'} onClick={() => startMobilisation(c)}>
                        {t('staffRequirements.candidates.startMobilisation')}
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, candidate: c })}>
                        {t('common.edit')}
                      </Button>
                    )}
                    {canEdit && !started && (
                      <Button size="sm" variant="danger-ghost" onClick={() => setToRemove(c)}>
                        {t('common.delete')}
                      </Button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <CandidateFormModal
        open={form.open}
        requirementId={requirement._id}
        candidate={form.candidate}
        onClose={() => setForm({ open: false, candidate: null })}
      />

      <ConfirmDialog
        open={Boolean(toRemove)}
        title={t('staffRequirements.candidates.removeConfirmTitle')}
        message={t('staffRequirements.candidates.removeConfirmMessage', { name: toRemove?.workerName })}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(toRemove._id)}
        onCancel={() => setToRemove(null)}
      />
    </section>
  );
}
