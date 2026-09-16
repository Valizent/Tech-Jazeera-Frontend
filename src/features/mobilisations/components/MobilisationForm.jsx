/**
 * MobilisationForm — Section 1 fields (worker type/job/client billing/OT
 * rates/subcontractor/dates), used by both the New and Edit pages. Section 2
 * (the current-step reviewer's quotation/PO paper trail) and the submit/
 * decide actions live on the detail page this form doesn't know about. OT
 * rate fields moved here from Section 2 (2026-09-13, the user's own ask) —
 * the coordinator/whoever creates the mobilisation now sets them up front,
 * same as every other rate on this form, instead of waiting on the later
 * reviewer's own pass.
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
 * can't be styled at all) — unrelated to worker identity.
 *
 * Layout order (2026-09-16, the user's own ask): worker type first, then —
 * for SupplierEmployee/Freelancer only — the subcontractor block (Supplier
 * only, since a Freelancer has no subcontractor at all) and a
 * `PreviousWorkerPicker` BEFORE the identity fields, not after. Picking a
 * subcontractor first, then a name off its own "who have we supplied
 * before" list, is meant to be the fast path; the Iqama-typed autofill
 * above stays as the alternative for a worker not on that list yet (or for
 * Employee-adjacent muscle memory). Freelancer gets the "adjacent idea": no
 * subcontractor to scope by, so its picker is just company-wide.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mobilisationFormSchema, WORKER_TYPES, FTA_TYPES } from '../mobilisations.schema.js';
import { createJobTitle } from '../../jobTitles/jobTitles.api.js';
import {
  getMobilisationSuggestions,
  lookupMobilisationWorkerByIqama,
  listPreviousMobilisedWorkers,
} from '../mobilisations.api.js';
import { listEmployees } from '../../employees/employees.api.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
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
 *  same fields afterward. Returns `markApplied` so a SIBLING autofill path
 *  (PreviousWorkerPicker below) can pre-mark the Iqama it just wrote as
 *  "already applied" — otherwise this effect would immediately re-fire for
 *  that same value once the picker's own `setValue('iqamaNumber', ...)`
 *  lands, showing a redundant second toast.
 *
 *  `appliedRef` is SEEDED with whatever Iqama the form already started with
 *  (2026-09-16) rather than always starting at `null` — a form that arrives
 *  already holding a full 10-digit Iqama (MobilisationEditPage's own
 *  existing record, or MobilisationNewPage's new standby "Mobilise"
 *  deep-link prefill) has nothing new to announce; without this, opening
 *  Edit on any SupplierEmployee/Freelancer record re-fired this lookup and
 *  showed "Found X..." on every single page load. */
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

  const appliedRef = useRef(iqamaDigits || null);
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

  return {
    markApplied: (iqamaValue) => {
      appliedRef.current = (iqamaValue || '').replace(/\D/g, '');
    },
  };
}

/** "Who have we mobilised before?" (2026-09-16, the user's own ask) — for
 *  SupplierEmployee, scoped to the currently-picked subcontractor (hidden
 *  until one is picked); for Freelancer, company-wide (no grouping entity
 *  exists for them, the "adjacent idea"). A plain themed `<Select>`, same
 *  as every other picker on this form — not a bound field, just a one-shot
 *  action: choosing an option fires `onSelect` with that worker's snapshot
 *  and immediately resets back to the placeholder. Hidden entirely when
 *  there's nothing to pick from yet (a brand new subcontractor/freelancer),
 *  rather than showing an empty picker. */
function PreviousWorkerPicker({ workerType, subcontractorId, label, onSelect }) {
  const { t } = useTranslation();
  const enabled = workerType === 'Freelancer' || (workerType === 'SupplierEmployee' && Boolean(subcontractorId));
  const { data: previousWorkers = [] } = useQuery({
    queryKey: ['mobilisation-previous-workers', workerType, subcontractorId],
    queryFn: () => listPreviousMobilisedWorkers({ workerType, subcontractor: subcontractorId }),
    enabled,
    staleTime: 30_000,
  });

  if (!enabled || previousWorkers.length === 0) return null;

  return (
    <Select
      label={label}
      value=""
      onChange={(e) => {
        const picked = previousWorkers.find((w) => w.iqamaNumber === e.target.value);
        if (picked) onSelect(picked);
      }}
    >
      <option value="">{t('staffMobilisations.form.selectPreviousWorker')}</option>
      {previousWorkers.map((w) => (
        <option key={w.iqamaNumber} value={w.iqamaNumber}>
          {w.workerName} — {w.iqamaNumber}
        </option>
      ))}
    </Select>
  );
}

/** Mirrors Client rate into OT client rate as it's typed — a sensible
 *  default (OT usually bills at the same rate) — but only while OT client
 *  rate is still empty OR still holds whatever value WE last wrote, same
 *  "never fight a manual edit" rule as useIqamaAutofill above: the moment
 *  the coordinator types their own OT rate, further Client rate edits stop
 *  touching it. Skips the very first run (mount) so opening Edit on an
 *  existing record with its own already-different OT rate never gets
 *  silently overwritten.
 *
 *  `lastAutoValueRef` (2026-09-16, a real user-reported bug) is the fix for
 *  a genuine multi-keystroke desync: typing a Client rate character by
 *  character fires this effect once per keystroke, not once for the final
 *  value — the ORIGINAL `!getValues('otClientRate')` check alone couldn't
 *  tell "empty because nothing's been typed" apart from "non-empty because
 *  I just autofilled it a moment ago," so after the very first digit
 *  autofilled OT client rate to e.g. "3", the second digit's own check saw
 *  a non-empty OT field and refused to update it further — leaving OT
 *  client rate stuck on a leading digit while Client rate kept changing,
 *  which reads exactly like "the autofill doesn't work" (the user's own
 *  report: they gave up and typed a value in by hand). Tracking the exact
 *  value we last wrote lets every subsequent keystroke recognize its own
 *  prior output and keep mirroring, while a REAL manual edit (the field no
 *  longer matches what we last set) still correctly stops it. */
function useOtClientRateAutofill({ control, getValues, setValue }) {
  const clientRate = useWatch({ control, name: 'clientRate' });
  const mountedRef = useRef(false);
  const lastAutoValueRef = useRef(undefined);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const current = getValues('otClientRate');
    if (!current || current === lastAutoValueRef.current) {
      setValue('otClientRate', clientRate, { shouldDirty: true });
      lastAutoValueRef.current = clientRate;
    }
  }, [clientRate, getValues, setValue]);
}

/**
 * The Employee picker's own data (2026-09-16, a real user-reported gap):
 * previously fetched unconditionally by whichever page rendered this form,
 * which meant a Section-Access-denied Employees list (`employeeCreate`
 * read — Admin-only by default) broke the form with a scary red banner for
 * anyone who only ever mobilises SupplierEmployee/Freelancer workers and
 * never touches "Own Employee" at all. Now fetched HERE, gated on the
 * live (not just initial) `workerType`, so the request is never even made
 * unless "Own Employee" is actually selected.
 *
 * `existingWorkerId` (MobilisationEditPage only) keeps an already-
 * referenced employee selectable even if they wouldn't qualify under
 * today's rules (wrong type, or an office-staff login rather than a real
 * Worker one) from before this restriction existed — same "don't show a
 * blank worker field on an old record" reasoning the filter always had,
 * just relocated. MobilisationNewPage never passes this, so its list stays
 * exactly as strict as before (server-filtered `type:'Own'`,
 * `loginRole:'Worker'`).
 */
function useEmployeeWorkers({ workerType, existingWorkerId }) {
  const enabled = workerType === 'Employee';
  const { data, isPending, isError } = useQuery({
    queryKey: ['employees', { forMobilisation: true, existingWorkerId: existingWorkerId ?? null }],
    queryFn: () =>
      existingWorkerId ? listEmployees({ limit: 100 }) : listEmployees({ limit: 100, type: 'Own', loginRole: 'Worker' }),
    enabled,
  });
  const workers = (data?.items ?? []).filter((w) =>
    existingWorkerId
      ? w._id === existingWorkerId || (w.status !== 'Exited' && w.type === 'Own' && w.login?.role === 'Worker')
      : w.status !== 'Exited' && w.type === 'Own'
  );
  return { workers, workersLoading: enabled && isPending, workersError: enabled && isError };
}

export default function MobilisationForm({
  clients,
  subcontractors,
  jobTitles,
  coordinatorCandidates,
  existingWorkerId,
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
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(mobilisationFormSchema), defaultValues });

  const workerType = useWatch({ control, name: 'workerType' });
  const ftaType = useWatch({ control, name: 'ftaType' });
  const checkoutDate = useWatch({ control, name: 'checkoutDate' });
  const subcontractorValue = useWatch({ control, name: 'subcontractor' });
  const { markApplied: markIqamaApplied } = useIqamaAutofill({ control, workerType, setValue, toast, t });
  useOtClientRateAutofill({ control, getValues, setValue });
  const { workers, workersLoading, workersError } = useEmployeeWorkers({ workerType, existingWorkerId });

  // Fed to PreviousWorkerPicker for both SupplierEmployee (subcontractor-
  // scoped) and Freelancer (company-wide) — same fields useIqamaAutofill
  // fills in, plus markIqamaApplied so the Iqama-typed lookup above doesn't
  // immediately re-fire a second, redundant toast for the same worker.
  function applyPreviousWorker(picked) {
    setValue('workerName', picked.workerName ?? '', { shouldValidate: true, shouldDirty: true });
    setValue('nationality', picked.nationality ?? '', { shouldDirty: true });
    setValue('phone', picked.phone || '+966', { shouldDirty: true });
    if (picked.iqamaNumber) {
      setValue('iqamaNumber', picked.iqamaNumber, { shouldValidate: true, shouldDirty: true });
      markIqamaApplied(picked.iqamaNumber);
    }
    toast.success(t('staffMobilisations.form.previousWorkerAppliedToast', { name: picked.workerName }));
  }

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

  // Client-side (Zod) validation failures never reach onSubmit at all, so
  // the mutation's own onError toast above never fires for them — silently
  // doing nothing on a bad click is indistinguishable from a broken button.
  // Bug found 2026-09-12: a validation error on a field the current
  // worker type doesn't even render (phone, Own Employee) had genuinely no
  // way to be seen. Every field's own Zod message is already
  // human-readable, so surface it directly rather than a generic "check
  // the form" toast that wouldn't have named the actual problem either.
  function onInvalid(formErrors) {
    const messages = Object.values(formErrors)
      .map((err) => err?.message)
      .filter(Boolean);
    console.error('[MobilisationForm] validation failed:', formErrors);
    toast.error(messages.length ? messages.join(' · ') : t('staffMobilisations.form.fixHighlighted'));
  }

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
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

        {/* Moved here from its own section below Client & Billing
            (2026-09-16, the user's own ask): filled FIRST for a
            SupplierEmployee, before the identity fields, so the "who has
            this subcontractor supplied before" picker right after it can
            populate those fields instead of re-typing them. */}
        {workerType === 'SupplierEmployee' && (
          <div className="space-y-4 rounded-lg border border-border/60 bg-bg/40 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {t('staffMobilisations.form.sectionSubcontractor')}
            </h4>
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
            <PreviousWorkerPicker
              workerType="SupplierEmployee"
              subcontractorId={subcontractorValue}
              label={t('staffMobilisations.form.previousSupplierWorkerLabel')}
              onSelect={applyPreviousWorker}
            />
          </div>
        )}

        {workerType === 'Freelancer' && (
          <PreviousWorkerPicker
            workerType="Freelancer"
            label={t('staffMobilisations.form.previousFreelancerLabel')}
            onSelect={applyPreviousWorker}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workerType === 'Employee' ? (
            <div className="space-y-2">
              <PickerLoadWarning failed={[{ label: 'workers', isError: workersError }]} />
              <Select
                label={t('staffMobilisations.form.workerLabel')}
                error={errors.worker?.message}
                disabled={workersLoading}
                {...register('worker')}
              >
                <option value="">
                  {workersLoading ? t('staffMobilisations.form.loadingWorkers') : t('staffMobilisations.form.selectWorker')}
                </option>
                {workers.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.fullName} ({w.employeeId})
                  </option>
                ))}
              </Select>
            </div>
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
          <Select label={t('staffMobilisations.form.ftaTypeLabel')} error={errors.ftaType?.message} {...register('ftaType')}>
            <option value="">{t('staffMobilisations.form.selectFtaType')}</option>
            {FTA_TYPES.map((ft) => (
              <option key={ft} value={ft}>
                {t(`staffMobilisations.form.ftaType.${ft}`)}
              </option>
            ))}
          </Select>
          <Input
            label={t('staffMobilisations.form.fta')}
            type="number"
            step="0.01"
            min="0"
            disabled={!ftaType}
            placeholder={ftaType ? undefined : t('staffMobilisations.form.selectFtaTypeFirst')}
            error={errors.fta?.message}
            {...register('fta')}
          />
          <Input label={t('staffMobilisations.form.allowance')} type="number" step="0.01" min="0" error={errors.allowance?.message} {...register('allowance')} />
          <Input
            label={t('staffMobilisations.form.allowanceRemark')}
            maxLength={200}
            placeholder={t('staffMobilisations.form.allowanceRemarkPlaceholder')}
            error={errors.allowanceRemark?.message}
            {...register('allowanceRemark')}
          />
          <Input
            label={t('staffMobilisations.form.requiredTimesheetHours')}
            type="number"
            step="0.01"
            min="0"
            error={errors.requiredTimesheetHours?.message}
            {...register('requiredTimesheetHours')}
          />
          <Input
            label={t('staffMobilisations.form.otClientRate')}
            type="number"
            step="0.01"
            min="0"
            error={errors.otClientRate?.message}
            {...register('otClientRate')}
          />
          <Input
            label={t('staffMobilisations.form.otEmployeeRate')}
            type="number"
            step="0.01"
            min="0"
            error={errors.otEmployeeRate?.message}
            {...register('otEmployeeRate')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffMobilisations.form.sectionEconomicsDates')}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffMobilisations.form.mobilisationDate')} type="date" error={errors.mobilisationDate?.message} {...register('mobilisationDate')} />
          <div className="flex flex-col gap-1.5">
            <Input label={t('staffMobilisations.form.checkoutDate')} type="date" error={errors.checkoutDate?.message} {...register('checkoutDate')} />
            {checkoutDate ? (
              <button
                type="button"
                onClick={() => setValue('checkoutDate', '', { shouldDirty: true, shouldValidate: true })}
                className="self-start text-xs font-medium text-muted hover:text-text"
              >
                {t('staffMobilisations.form.clearCheckoutDate')}
              </button>
            ) : (
              <p className="text-xs text-muted">{t('staffMobilisations.form.checkoutDateHint')}</p>
            )}
          </div>
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
