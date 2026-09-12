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
 * directly. Iqama is the durable identity for these two types — once a
 * worker's 10-digit Iqama is fully typed, `useIqamaAutofill` below looks up
 * their most recent past mobilisation (any coordinator, any status — see
 * mobilisation.service.js's lookupWorkerByIqama) and fills in name/
 * nationality/phone/subcontractor automatically, so a worker released back
 * to standby and mobilised again doesn't need re-typing from scratch. `site`
 * uses the same free-typed-with-suggestions pattern (SuggestInput, a themed
 * combobox — never the browser's own unstyled `<datalist>` popup, which
 * can't be styled at all) — unrelated to worker identity. The subcontractor
 * block only appears for 'SupplierEmployee'.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobilisationFormSchema, WORKER_TYPES } from '../mobilisations.schema.js';
import { createJobTitle } from '../../jobTitles/jobTitles.api.js';
import { getMobilisationSuggestions, lookupMobilisationWorkerByIqama } from '../mobilisations.api.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';

/** Free-typed field + a themed dropdown of previously-entered values, via
 *  SuggestInput — never a native `<datalist>` (unstyled, can't be themed). */
function SuggestedInput({ field, label, error, control, placeholder }) {
  const { data: suggestions = [] } = useQuery({
    queryKey: ['mobilisation-suggestions', field],
    queryFn: () => getMobilisationSuggestions(field),
  });
  return (
    <Controller
      name={field}
      control={control}
      render={({ field: { value, onChange, onBlur } }) => (
        <SuggestInput
          label={label}
          error={error}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          options={suggestions}
        />
      )}
    />
  );
}

/** Once `iqamaNumber` reaches a full 10 digits, looks up whether this worker
 *  has been mobilised before and — if so — fills in name/nationality/phone/
 *  workerType/subcontractor. Applies at most once per distinct Iqama value
 *  (via `appliedRef`) so it never fights a coordinator's own edits to the
 *  same fields afterward. */
function useIqamaAutofill({ control, workerType, setValue, toast, t }) {
  const iqamaRaw = useWatch({ control, name: 'iqamaNumber' });
  const iqamaDigits = (iqamaRaw || '').replace(/\D/g, '');
  const enabled = workerType !== 'Employee' && iqamaDigits.length === 10;

  const { data: foundWorker } = useQuery({
    queryKey: ['mobilisation-worker-lookup', iqamaDigits],
    queryFn: () => lookupMobilisationWorkerByIqama(iqamaDigits),
    enabled,
    staleTime: 60_000,
  });

  const appliedRef = useRef(null);
  useEffect(() => {
    if (!foundWorker || appliedRef.current === iqamaDigits) return;
    appliedRef.current = iqamaDigits;
    setValue('workerName', foundWorker.workerName ?? '', { shouldValidate: true, shouldDirty: true });
    setValue('nationality', foundWorker.nationality ?? '', { shouldDirty: true });
    setValue('phone', foundWorker.phone || '+966', { shouldDirty: true });
    if (foundWorker.workerType && foundWorker.workerType !== workerType) {
      setValue('workerType', foundWorker.workerType, { shouldDirty: true });
    }
    if (foundWorker.subcontractor) {
      setValue('subcontractor', foundWorker.subcontractor, { shouldDirty: true });
    }
    toast.success(t('staffMobilisations.form.iqamaAutofillToast', { name: foundWorker.workerName }));
  }, [foundWorker, iqamaDigits, setValue, workerType, toast, t]);
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
  useIqamaAutofill({ control, workerType, setValue, toast, t });

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
              <Input
                label={t('staffMobilisations.form.workerNameLabel')}
                error={errors.workerName?.message}
                {...register('workerName')}
              />
              <Input
                label={t('staffMobilisations.form.iqamaNumberLabel')}
                inputMode="numeric"
                maxLength={10}
                placeholder={t('staffMobilisations.form.iqamaNumberPlaceholder')}
                error={errors.iqamaNumber?.message}
                {...register('iqamaNumber')}
              />
              <Controller
                name="nationality"
                control={control}
                render={({ field }) => (
                  <SuggestInput
                    label={t('staffMobilisations.form.nationalityLabel')}
                    error={errors.nationality?.message}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={COUNTRIES}
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
          <SuggestedInput
            field="site"
            label={t('staffMobilisations.form.siteLabel')}
            placeholder={t('common.optional')}
            error={errors.site?.message}
            control={control}
          />
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
