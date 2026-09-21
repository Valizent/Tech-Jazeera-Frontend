/**
 * RequirementFormModal — add a requirement, or edit one.
 *
 * Client and job title are free-typed with suggestions (SuggestInput) rather
 * than strict pickers: a requirement can arrive from a company that isn't a
 * client yet, and the server links the name to a real Client the moment it
 * matches one. The suggestion lists are a convenience — if they fail to load
 * (no Clients access, say) the fields still work as plain text.
 *
 * The coordinators picker shows only to someone who may assign them (team-write);
 * a coordinator adding their own requirement never sees it — it's theirs.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createRequirement, updateRequirement } from '../requirements.api.js';
import { buildRequirementFormSchema, emptyRequirementForm, requirementToForm } from '../requirements.schema.js';
import { listClients } from '../../clients/clients.api.js';
import { listJobTitles, createJobTitle } from '../../jobTitles/jobTitles.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';
import { PillChecklist } from '../../../components/ui/TogglePill.jsx';

export default function RequirementFormModal({ open, requirement, canAssign, coordinators, defaultCoordinatorId, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(requirement);
  // Editing: only whoever may manage owners. Adding: only whoever may assign.
  const showCoordinators = isEdit ? requirement.permissions.manageOwners : canAssign;

  // Same query keys and functions the Mobilisation form uses, so the cache is shared.
  const { data: clientData, isError: clientsError } = useQuery({
    queryKey: ['clients', { active: true }],
    queryFn: () => listClients({ status: 'Active', approvalStatus: 'Approved', limit: 100 }),
    enabled: open,
  });
  const { data: jobTitles } = useQuery({
    queryKey: ['job-titles'],
    queryFn: () => listJobTitles({ activeOnly: 'true' }),
    enabled: open,
  });

  const [addingJobTitle, setAddingJobTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [pendingJobTitle, setPendingJobTitle] = useState(null);

  const addJobTitleMutation = useMutation({
    mutationFn: () => createJobTitle(newJobTitle.trim()),
    onSuccess: (created) => {
      toast.success(t('staffMobilisations.form.jobTitleAddedToast', { name: created.name }));
      queryClient.invalidateQueries({ queryKey: ['job-titles'] });
      setPendingJobTitle(created.name);
      setAddingJobTitle(false);
      setNewJobTitle('');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    // The picker, whenever it's shown, must end up with at least one coordinator.
    resolver: zodResolver(buildRequirementFormSchema(showCoordinators)),
    defaultValues: emptyRequirementForm,
  });

  // Select a just-created job title only once the refetched list actually contains it (setValue
  // before that would point the field at an option that isn't there yet — same fix as the
  // Mobilisation form). Declared AFTER useForm: it reads `setValue`, so above it the whole
  // component threw "Cannot access 'setValue' before initialization" and the board crashed.
  useEffect(() => {
    if (pendingJobTitle && jobTitles?.some((jt) => jt.name === pendingJobTitle)) {
      setValue('jobTitle', pendingJobTitle, { shouldValidate: true, shouldDirty: true });
      setPendingJobTitle(null);
    }
  }, [jobTitles, pendingJobTitle, setValue]);

  // Re-seed whenever the dialog opens (new vs. which card is being edited).
  useEffect(() => {
    if (!open) return;
    reset(requirement ? requirementToForm(requirement) : { ...emptyRequirementForm, coordinators: defaultCoordinatorId ? [defaultCoordinatorId] : [] });
  }, [open, requirement, defaultCoordinatorId, reset]);

  const selectedCoordinators = watch('coordinators');
  const toggleCoordinator = (id) =>
    setValue('coordinators', selectedCoordinators.includes(id) ? selectedCoordinators.filter((c) => c !== id) : [...selectedCoordinators, id], {
      shouldValidate: true,
      shouldDirty: true,
    });

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        clientName: values.clientName,
        jobTitle: values.jobTitle,
        headcount: Number(values.headcount),
        neededBy: values.neededBy,
        site: values.site,
        notes: values.notes,
        ...(showCoordinators && { coordinators: values.coordinators }),
      };
      return isEdit ? updateRequirement(requirement._id, payload) : createRequirement(payload);
    },
    onSuccess: () => {
      toast.success(t(isEdit ? 'staffRequirements.toasts.updated' : 'staffRequirements.toasts.added'));
      queryClient.invalidateQueries({ queryKey: ['requirements'] });
      onClose();
    },
    onError: (error) => {
      console.error('[requirements] saving a requirement failed', error);
      toast.error(apiMessage(error));
    },
  });

  // Every client-side validation failure must be visible — react-hook-form never
  // calls a mutation's own onError for one (the standing error-surfacing rule).
  const onInvalid = (formErrors) => {
    console.error('[requirements] form invalid', formErrors);
    toast.error(
      Object.values(formErrors)
        .map((e) => e?.message)
        .filter(Boolean)
        .join(' ') || t('staffRequirements.formInvalid')
    );
  };

  return (
    <>
    <Modal open={open} onClose={onClose} title={t(isEdit ? 'staffRequirements.form.editTitle' : 'staffRequirements.form.addTitle')} size="lg">
      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Controller
              name="clientName"
              control={control}
              render={({ field }) => (
                <SuggestInput
                  label={t('staffRequirements.form.client')}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={(clientData?.items ?? []).map((c) => c.companyName)}
                  error={errors.clientName?.message}
                />
              )}
            />
            {/* A failed lookup is said out loud, not left looking like "no clients exist" —
                the field still works as plain text either way. */}
            <p className="mt-1 text-xs text-muted">{t(clientsError ? 'staffRequirements.form.clientHintNoSuggestions' : 'staffRequirements.form.clientHint')}</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-text">{t('staffRequirements.form.jobTitle')}</label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setAddingJobTitle(true)}
              >
                {t('staffMobilisations.form.addNew')}
              </button>
            </div>
            <Controller
              name="jobTitle"
              control={control}
              render={({ field }) => (
                <SuggestInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={(jobTitles ?? []).map((j) => j.name)}
                  error={errors.jobTitle?.message}
                />
              )}
            />
          </div>
          <Input label={t('staffRequirements.form.headcount')} type="number" min="1" max="500" error={errors.headcount?.message} {...register('headcount')} />
          <Input label={t('staffRequirements.form.neededBy')} type="date" error={errors.neededBy?.message} {...register('neededBy')} />
          <Input label={t('staffRequirements.form.site')} className="sm:col-span-2" error={errors.site?.message} {...register('site')} />
        </div>
        <Textarea label={t('staffRequirements.form.notes')} rows={3} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />

        {showCoordinators && (
          <div>
            <p className="mb-1.5 text-sm font-medium">{t('staffRequirements.form.coordinators')}</p>
            <PillChecklist
              items={coordinators ?? []}
              selected={selectedCoordinators}
              onToggle={toggleCoordinator}
              emptyMessage={t('staffRequirements.form.noCoordinators')}
            />
            {errors.coordinators?.message && <p className="mt-1.5 text-sm text-danger">{errors.coordinators.message}</p>}
          </div>
        )}

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

    <Modal open={addingJobTitle} onClose={() => setAddingJobTitle(false)} title={t('staffMobilisations.form.addJobTitleModalTitle')}>
      <div className="flex flex-col gap-4">
        <Input
          label={t('staffMobilisations.form.jobTitleFieldLabel')}
          placeholder={t('staffMobilisations.form.jobTitlePlaceholder')}
          value={newJobTitle}
          onChange={(e) => setNewJobTitle(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setAddingJobTitle(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => addJobTitleMutation.mutate()}
            isLoading={addJobTitleMutation.isPending}
            disabled={!newJobTitle.trim()}
          >
            {t('common.add')}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
