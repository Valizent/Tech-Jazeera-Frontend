/**
 * CandidateFormModal — add a candidate to a requirement, or edit one.
 *
 * A candidate is a worker being lined up: where they come from (a subcontractor,
 * or independent), who they are, and how far their paperwork is. Iqama and phone
 * are optional here — at this stage they often aren't known yet — but a mobilisation
 * can't be submitted for review without them, so they're worth filling in as they
 * arrive. The worker type can't change once added (remove and re-add instead), which
 * is why it's only shown when adding.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addCandidate, updateCandidate } from '../requirements.api.js';
import { candidateFormSchema, candidateToForm, emptyCandidateForm, CANDIDATE_MANUAL_STATUSES, CANDIDATE_WORKER_TYPES } from '../requirements.schema.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';

export default function CandidateFormModal({ open, requirementId, candidate, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(candidate);

  // Same key and function the Mobilisation form uses, so the cache is shared.
  const { data: subcontractorData, isError: subcontractorsError } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(candidateFormSchema), defaultValues: emptyCandidateForm });
  const workerType = watch('workerType');

  // Re-seed whenever the dialog opens (new vs. which candidate is being edited).
  useEffect(() => {
    if (open) reset(candidate ? candidateToForm(candidate) : emptyCandidateForm);
  }, [open, candidate, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const supplier = values.workerType === 'SupplierEmployee';
      const common = {
        workerName: values.workerName,
        iqamaNumber: values.iqamaNumber,
        nationality: values.nationality,
        phone: values.phone,
        docsNote: values.docsNote,
      };
      if (isEdit) {
        return updateCandidate(requirementId, candidate._id, {
          ...common,
          ...(supplier && { subcontractor: values.subcontractor }),
          // A mobilised worker's status is the system's, not ours to send.
          ...(candidate.status !== 'Mobilised' && { status: values.status }),
        });
      }
      return addCandidate(requirementId, {
        workerType: values.workerType,
        ...common,
        ...(supplier && { subcontractor: values.subcontractor }),
        status: values.status,
      });
    },
    onSuccess: () => {
      toast.success(t(isEdit ? 'staffRequirements.candidates.toasts.updated' : 'staffRequirements.candidates.toasts.added'));
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      onClose();
    },
    onError: (error) => {
      console.error('[requirements] saving a candidate failed', error);
      toast.error(apiMessage(error));
    },
  });

  // Every client-side validation failure must be visible — react-hook-form never
  // calls a mutation's own onError for one (the standing error-surfacing rule).
  const onInvalid = (formErrors) => {
    console.error('[requirements] candidate form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffRequirements.formInvalid')
    );
  };

  const lockedStatus = candidate?.status === 'Mobilised';

  return (
    <Modal open={open} onClose={onClose} title={t(isEdit ? 'staffRequirements.candidates.editTitle' : 'staffRequirements.candidates.addTitle')} size="lg">
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        <PickerLoadWarning failed={[{ label: 'subcontractors', isError: subcontractorsError }]} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isEdit && (
            <Select label={t('staffRequirements.candidates.form.workerType')} {...register('workerType')}>
              {CANDIDATE_WORKER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`staffRequirements.candidates.workerType.${type}`)}
                </option>
              ))}
            </Select>
          )}
          {workerType === 'SupplierEmployee' && (
            <Select label={t('staffRequirements.candidates.form.subcontractor')} error={errors.subcontractor?.message} {...register('subcontractor')}>
              <option value="">{t('staffRequirements.candidates.form.selectSubcontractor')}</option>
              {(subcontractorData?.items ?? []).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Input label={t('staffRequirements.candidates.form.workerName')} className="sm:col-span-2" error={errors.workerName?.message} {...register('workerName')} />
          <Input label={t('staffRequirements.candidates.form.iqama')} inputMode="numeric" maxLength={10} error={errors.iqamaNumber?.message} {...register('iqamaNumber')} />
          <Controller
            name="nationality"
            control={control}
            render={({ field }) => (
              <SuggestInput
                label={t('staffRequirements.candidates.form.nationality')}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                options={COUNTRIES}
                error={errors.nationality?.message}
              />
            )}
          />
          <Input label={t('staffRequirements.candidates.form.phone')} type="tel" error={errors.phone?.message} {...register('phone')} />
          <Select label={t('staffRequirements.candidates.form.status')} disabled={lockedStatus} error={errors.status?.message} {...register('status')}>
            {CANDIDATE_MANUAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`staffRequirements.candidates.status.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <Textarea
          label={t('staffRequirements.candidates.form.docsNote')}
          rows={2}
          placeholder={t('staffRequirements.candidates.form.docsNotePlaceholder')}
          error={errors.docsNote?.message}
          {...register('docsNote')}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
