/**
 * MobilisationForm — Section 1 fields (worker type/job/client billing/
 * subcontractor/dates), used by both the New and Edit pages. Section 2
 * (the current-step reviewer's quotation/PO/overtime fields) and the submit/
 * decide actions live on the detail page this form doesn't know about.
 *
 * `workerType` drives worker identity: 'Employee' keeps the original Employee
 * picker (Own-type only — Outsourced/Subcontracted employees go through
 * Supplier Employee/Freelancer instead); 'SupplierEmployee'/'Freelancer'
 * have no Employee record at all, so name/Iqama/nationality/phone are typed
 * directly, each backed by a live autocomplete of previously-entered values
 * (not a managed picklist like Job title — just a suggestion aid, same
 * spirit as the Nationality
 * field's static `<datalist>` on the Employee form, but sourced live). The
 * subcontractor block only appears for 'SupplierEmployee' — same
 * reveal-on-condition pattern as DeploymentForm's client-dependent site
 * dropdown.
 */
import { useEffect, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobilisationFormSchema, WORKER_TYPES } from '../mobilisations.schema.js';
import { createJobTitle } from '../../jobTitles/jobTitles.api.js';
import { getMobilisationSuggestions } from '../mobilisations.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import CountrySelect from '../../../components/ui/CountrySelect.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';

/** Free-typed field + a live `<datalist>` of previously-entered values —
 *  the datalist id must stay unique per field since every instance of this
 *  form shares the DOM with itself only once, but a stable id is simplest. */
function SuggestedInput({ field, label, error, register, ...props }) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['mobilisation-suggestions', field],
    queryFn: () => getMobilisationSuggestions(field),
  });
  const listId = `mobilisation-${field}-suggestions`;
  return (
    <>
      <Input label={label} list={listId} error={error} {...register(field)} {...props} />
      <datalist id={listId}>
        {suggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </>
  );
}

export default function MobilisationForm({
  workers,
  clients,
  subcontractors,
  jobTitles,
  coordinatorCandidates,
  defaultValues,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(mobilisationFormSchema), defaultValues });

  const workerType = useWatch({ control, name: 'workerType' });

  const [addingJobTitle, setAddingJobTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  // The list invalidation refetches asynchronously, so the new <option> isn't
  // in the DOM yet at the moment createJobTitle resolves — selecting it here
  // would silently no-op. Defer the actual selection until jobTitles (the
  // prop, refreshed by the invalidated query) really contains it.
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

  useEffect(() => {
    if (pendingJobTitle && jobTitles.some((jt) => jt.name === pendingJobTitle)) {
      setValue('jobTitle', pendingJobTitle, { shouldValidate: true, shouldDirty: true });
      setPendingJobTitle(null);
    }
  }, [jobTitles, pendingJobTitle, setValue]);

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Office Secretary only — creating this on behalf of a Coordinator
          who's busy. Every other creator never sees this (coordinatorCandidates
          is only passed by MobilisationNewPage when the logged-in user is
          Office Secretary) and becomes the primary coordinator themselves,
          as before. */}
      {coordinatorCandidates && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionOnBehalf')}</h3>
          <Select
            label={t('staffMobilisations.form.onBehalfOfLabel')}
            error={errors.onBehalfOf?.message}
            {...register('onBehalfOf')}
          >
            <option value="">{t('staffMobilisations.form.selectCoordinator')}</option>
            {coordinatorCandidates.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionWorkerJob')}</h3>
        <Select label={t('staffMobilisations.form.workerTypeLabel')} error={errors.workerType?.message} {...register('workerType')}>
          {WORKER_TYPES.map((wt) => (
            <option key={wt} value={wt}>
              {t(`staffMobilisations.form.workerType.${wt}`)}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workerType === 'Employee' ? (
            <Select label={t('staffMobilisations.form.workerLabel')} error={errors.worker?.message} {...register('worker')}>
              <option value="">{t('staffMobilisations.form.selectWorker')}</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.fullName} ({w.employeeId})
                </option>
              ))}
            </Select>
          ) : (
            <>
              <SuggestedInput
                field="workerName"
                label={t('staffMobilisations.form.workerNameLabel')}
                error={errors.workerName?.message}
                register={register}
              />
              <SuggestedInput
                field="iqamaNumber"
                label={t('staffMobilisations.form.iqamaNumberLabel')}
                error={errors.iqamaNumber?.message}
                register={register}
              />
              <Controller
                name="nationality"
                control={control}
                render={({ field }) => (
                  <CountrySelect
                    label={t('staffMobilisations.form.nationalityLabel')}
                    error={errors.nationality?.message}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
              <Input label={t('staffMobilisations.form.phoneLabel')} error={errors.phone?.message} {...register('phone')} />
            </>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-text">{t('staffMobilisations.form.jobTitleLabel')}</label>
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setAddingJobTitle(true)}
              >
                {t('staffMobilisations.form.addNew')}
              </button>
            </div>
            <Select error={errors.jobTitle?.message} {...register('jobTitle')}>
              <option value="">{t('staffMobilisations.form.selectJobTitle')}</option>
              {jobTitles.map((jt) => (
                <option key={jt._id} value={jt.name}>
                  {jt.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionClientBilling')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={t('staffMobilisations.form.clientLabel')} error={errors.client?.message} {...register('client')}>
            <option value="">{t('staffMobilisations.form.selectClient')}</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>
                {c.companyName}
              </option>
            ))}
          </Select>
          <Input label={t('staffMobilisations.form.clientRate')} type="number" step="0.01" min="0" error={errors.clientRate?.message} {...register('clientRate')} />
          <Input label={t('staffMobilisations.form.clientCommission')} type="number" step="0.01" min="0" error={errors.clientCommission?.message} {...register('clientCommission')} />
          <Input label={t('staffMobilisations.form.fta')} type="number" step="0.01" min="0" error={errors.fta?.message} {...register('fta')} />
          <Input label={t('staffMobilisations.form.allowance')} type="number" step="0.01" min="0" error={errors.allowance?.message} {...register('allowance')} />
          <Input
            label={t('staffMobilisations.form.requiredTimesheetHours')}
            type="number"
            step="0.01"
            min="0"
            error={errors.requiredTimesheetHours?.message}
            {...register('requiredTimesheetHours')}
          />
        </div>
      </section>

      {workerType === 'SupplierEmployee' && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionSubcontractor')}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label={t('staffMobilisations.form.subcontractorLabel')} error={errors.subcontractor?.message} {...register('subcontractor')}>
              <option value="">{t('staffMobilisations.form.selectSubcontractor')}</option>
              {subcontractors.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input
              label={t('staffMobilisations.form.subcontractorRate')}
              type="number"
              step="0.01"
              min="0"
              error={errors.subcontractorRate?.message}
              {...register('subcontractorRate')}
            />
            <Input
              label={t('staffMobilisations.form.subcontractorCommission')}
              type="number"
              step="0.01"
              min="0"
              error={errors.subcontractorCommission?.message}
              {...register('subcontractorCommission')}
            />
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionEconomicsDates')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffMobilisations.form.mobilisationDate')} type="date" error={errors.mobilisationDate?.message} {...register('mobilisationDate')} />
          <Input label={t('staffMobilisations.form.checkoutDate')} type="date" error={errors.checkoutDate?.message} {...register('checkoutDate')} />
        </div>
      </section>

      <Textarea label={t('staffMobilisations.form.remark')} placeholder={t('common.optional')} error={errors.remark?.message} {...register('remark')} />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>

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
