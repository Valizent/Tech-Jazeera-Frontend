/**
 * VacationRequestForm — file an Annual Vacation request. Used by the ESS page
 * (always for yourself) and the staff page (for yourself, or — with Write on
 * the section — for another employee, chosen from `employeeOptions`).
 */
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { annualVacationFormSchema, emptyAnnualVacationForm, toAnnualVacationPayload } from '../annualVacation.schema.js';
import { apiMessage, collectFormErrorMessages } from '../../../lib/utils.js';
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
 */
export default function VacationRequestForm({ submit, onSubmitted, employeeOptions = null, allowSelf = true }) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(annualVacationFormSchema), defaultValues: emptyAnnualVacationForm });

  const [startDate, requestedDays] = useWatch({ control, name: ['startDate', 'requestedDays'] });
  const days = Number(requestedDays);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label={t('staffAnnualVacation.startDate')} type="date" error={errors.startDate?.message} {...register('startDate')} />
          <Input
            label={t('staffAnnualVacation.days')}
            type="number"
            min="1"
            max="90"
            step="1"
            error={errors.requestedDays?.message}
            {...register('requestedDays')}
          />
        </div>
        {lastDay && <p className="text-sm text-muted">{t('staffAnnualVacation.lastDay', { date: lastDay })}</p>}
        <Textarea label={t('staffAnnualVacation.reason')} placeholder={t('common.optional')} error={errors.reason?.message} {...register('reason')} />
        <div className="flex justify-end">
          <Button type="submit" isLoading={submitMutation.isPending}>
            {t('common.submitRequest')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
