/**
 * New EOSB settlement — pick the exiting employee, exit date, and reason;
 * the server computes and saves the full breakdown in one step (no
 * client-side preview of the money figure — the leave-balance half of the
 * total needs a real server query, so a "close but not authoritative"
 * estimate would risk being read as the real number; see docs/P3-A-notes.md).
 * Accepts `?employee=<id>` to preset from an Employee profile, and
 * additionally `?exitDate=&exitReason=` when arriving from Deployment's
 * demobilise Exit-outcome follow-up prompt (see DeploymentDetailPage.jsx) —
 * both optional and independent of `employee`.
 */
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createSettlement } from '../eosb.api.js';
import { settlementFormSchema, emptySettlementForm } from '../eosb.schema.js';
import { listEmployees } from '../../employees/employees.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { EXIT_REASONS, EXIT_REASON_LABELS } from '../../../lib/constants.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';

export default function SettlementNewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const presetEmployee = searchParams.get('employee') ?? '';
  const presetExitDate = searchParams.get('exitDate') ?? '';
  const presetExitReason = searchParams.get('exitReason') ?? '';

  const { data: employeeData } = useQuery({
    queryKey: ['employees', { forEosb: true }],
    queryFn: () => listEmployees({ limit: 100, sortBy: 'fullName', sortOrder: 'asc' }),
  });
  const employees = employeeData?.items ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(settlementFormSchema),
    defaultValues: useMemo(
      () => ({ ...emptySettlementForm, employee: presetEmployee, exitDate: presetExitDate, exitReason: presetExitReason }),
      [presetEmployee, presetExitDate, presetExitReason]
    ),
  });
  const exitReason = watch('exitReason');

  // Found during this feature's verification: a `?employee=` preset (this
  // page's original mechanism, from the Employee profile's "Calculate EOSB"
  // button) silently failed to select anything whenever the employee list
  // hadn't finished loading yet at mount — react-hook-form sets a native
  // <select>'s value via an uncontrolled ref, so it's a no-op if the
  // matching <option> doesn't exist in the DOM yet, and nothing re-applies
  // it once the list arrives. Same bug class, same fix, as
  // MobilisationForm.jsx's job-title auto-select.
  useEffect(() => {
    if (presetEmployee && employees.some((e) => e._id === presetEmployee)) {
      setValue('employee', presetEmployee, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, presetEmployee]);

  const mutation = useMutation({
    mutationFn: createSettlement,
    onSuccess: (settlement) => {
      toast.success(t('staffEosb.new.computedToast', { name: settlement.employeeName }));
      navigate(`/eosb/${settlement._id}`, { replace: true });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t('staffEosb.new.pageTitle')}
        description={t('staffEosb.new.pageDescription')}
        onBack={() => navigate(-1)}
      />
      <Card>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="space-y-4">
          <Select label={t('staffEosb.new.employee')} error={errors.employee?.message} {...register('employee')}>
            <option value="">{t('staffEosb.new.selectEmployee')}</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.fullName} ({e.employeeId})
              </option>
            ))}
          </Select>

          <Input label={t('staffEosb.new.exitDate')} type="date" error={errors.exitDate?.message} {...register('exitDate')} />

          <Select label={t('staffEosb.new.exitReason')} error={errors.exitReason?.message} {...register('exitReason')}>
            <option value="">{t('staffEosb.new.chooseReason')}</option>
            {EXIT_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`staffEosb.exitReasonLabels.${r}`, EXIT_REASON_LABELS[r])}
              </option>
            ))}
          </Select>
          {exitReason && <p className="-mt-2 text-xs text-muted">{t(`staffEosb.new.reasonHints.${exitReason}`)}</p>}

          <Textarea label={t('staffEosb.new.notes')} placeholder={t('common.optional')} error={errors.notes?.message} {...register('notes')} />

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={mutation.isPending}>
              {t('staffEosb.new.computeButton')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
