/**
 * VacationRequestForm — file an Annual Vacation request. Used by the ESS page
 * (always for yourself) and the staff page (for yourself, or — with Write on
 * the section — for another employee, chosen from `employeeOptions`).
 */
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { annualVacationFormSchema, emptyAnnualVacationForm, toAnnualVacationPayload } from '../annualVacation.schema.js';
import { apiMessage, collectFormErrorMessages, formatDate } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

const MS_PER_DAY = 86_400_000;

/**
 * @param {object} props
 * @param {(payload:object) => Promise<object>} props.submit
 * @param {() => void} [props.onSubmitted]
 * @param {{value:string,label:string}[]|null} [props.employeeOptions] when given, shows an
 *   employee picker; `allowSelf` adds a "Myself" choice first.
 * @param {boolean} [props.allowSelf]
 * @param {(employeeId?: string) => Promise<{eligible:boolean, reason:string|null, contractDays:number|null}>} props.loadEligibility
 *   asks the server whether this person may ask yet and how many days their contract gives (the form never types days).
 */
export default function VacationRequestForm({ submit, onSubmitted, loadEligibility, employeeOptions = null, allowSelf = true }) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(annualVacationFormSchema), defaultValues: emptyAnnualVacationForm });

  const [startDate, selectedEmployee] = useWatch({ control, name: ['startDate', 'employee'] });
  const eligibilityQuery = useQuery({
    queryKey: ['annual-vacation', 'eligibility', selectedEmployee || 'me'],
    queryFn: () => loadEligibility(selectedEmployee || undefined),
    // A login with no employee record of its own (Admin) must pick someone first.
    enabled: allowSelf || Boolean(selectedEmployee),
  });
  const eligibility = eligibilityQuery.data;
  const days = eligibility?.contractDays ?? null;
  const blocked = Boolean(eligibility) && !eligibility.eligible;
  // Only days after the contract end date (the replaced end, when it was renewed) can be picked.
  const today = new Date().toISOString().slice(0, 10);
  const earliest = eligibility?.earliestStart ? String(eligibility.earliestStart).slice(0, 10) : null;
  const minDate = earliest && earliest > today ? earliest : today;
  const lastDay =
    startDate && Number.isInteger(days) && days >= 1
      ? new Date(new Date(startDate).getTime() + (days - 1) * MS_PER_DAY).toISOString().slice(0, 10)
      : null;

  const submitMutation = useMutation({
    mutationFn: (values) => submit(toAnnualVacationPayload(values)),
    onSuccess: () => {
      toast.success(t('staffAnnualVacation.submittedToast'));
      reset(emptyAnnualVacationForm);
      onSubmitted?.();
    },
    onError: (error) => {
      console.error('[annualVacation] submit failed', error);
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[annualVacation] form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('staffAnnualVacation.formInvalid'));
  };

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffAnnualVacation.formTitle')}</h2>
      <p className="mb-4 text-sm text-muted">{t('staffAnnualVacation.formHint')}</p>
      <form onSubmit={handleSubmit((values) => submitMutation.mutate(values), onInvalid)} noValidate className="space-y-4">
        {employeeOptions && (
          <Select label={t('staffAnnualVacation.employee')} error={errors.employee?.message} {...register('employee')}>
            <option value="">{allowSelf ? t('staffAnnualVacation.myself') : t('staffAnnualVacation.chooseEmployee')}</option>
            {employeeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        {blocked && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-text">{eligibility.reason}</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffAnnualVacation.startDate')} type="date" min={minDate} error={errors.startDate?.message} {...register('startDate')} />
          {/* The days are the contract's, set by HR: shown, never typed. */}
          <Input label={t('staffAnnualVacation.daysFromContract')} value={days ?? ''} readOnly disabled />
        </div>
        {earliest && earliest > today && <p className="text-sm text-muted">{t('staffAnnualVacation.earliestStart', { date: formatDate(earliest) })}</p>}
        {lastDay && <p className="text-sm text-muted">{t('staffAnnualVacation.lastDay', { date: lastDay })}</p>}
        <Textarea label={t('staffAnnualVacation.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending} disabled={blocked || eligibilityQuery.isPending}>
            {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
