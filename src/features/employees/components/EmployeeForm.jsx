/**
 * EmployeeForm — one form, two uses: create (blank defaults) and edit
 * (defaults from employeeToForm). The page owns the mutation; this component
 * owns fields + validation. That split means create/edit can never drift
 * apart in layout or rules.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeFormSchema } from '../employees.schema.js';
import { listStaffUsers } from '../../users/users.api.js';
import { listApprovalWorkflows } from '../../approvals/approvals.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  WEEKDAY_LABELS,
  MANAGER_ELIGIBLE_ROLES,
} from '../../../lib/constants.js';
import { COUNTRIES } from '../../../lib/countries.js';
import Input from '../../../components/ui/Input.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';

/** The five identity documents, rendered uniformly from this config —
 *  `key` doubles as the i18n key under staffEmployees.form.documents.*. */
const DOCUMENTS = ['passport', 'visa', 'iqama', 'medical', 'drivingLicense'];

/** Section wrapper: consistent heading + responsive field grid. */
function Section({ title, children }) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

export default function EmployeeForm({ defaultValues, onSubmit, submitLabel, submitting }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  // Drives which employee types a Coordinator may pick (below) — unrelated
  // to coordinator ASSIGNMENT itself, which this form no longer sets at all
  // (Milestone 5): coordinator is fully derived from Mobilisation state, so
  // there's nothing left here to show or pick, for anyone.
  const isCoordinator = user.role === 'Coordinator';
  // The server always overrides 'Own' to 'Outsourced' for a Coordinator's own
  // submission (a Coordinator can never create an internal-staff record —
  // see employee.service.js's createEmployee) AND, since that override runs
  // after Zod validation, requires nationality/mobile/joiningDate that the
  // 'Own' branch of the schema doesn't ask for — offering 'Own' here would
  // let a Coordinator fill a form that validates, then 400s server-side on
  // fields they were never shown as required. Simplest correct fix: never
  // offer the type they can't actually end up with.
  const selectableTypes = isCoordinator ? EMPLOYEE_TYPES.filter((t) => t !== 'Own') : EMPLOYEE_TYPES;
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(employeeFormSchema), defaultValues });

  // Drives which fields below render as required — nationality/mobile/
  // joining date are compliance fields both workforce types need; salary is
  // narrower still (only 'Outsourced', since a Subcontracted worker's pay is
  // the subcontractor's business); an 'Own' (internal staff) record needs
  // none of it.
  const type = watch('type');
  const isWorkforce = type !== 'Own';

  // Only fetched/shown once 'Subcontracted' is picked — who supplied this worker.
  const { data: subcontractorData } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
    enabled: type === 'Subcontracted',
  });
  const subcontractors = subcontractorData?.items ?? [];

  // Every 'Own' employee reports to a Manager; an 'Outsourced' employee may
  // too, alongside or instead of a coordinator — so this stays fetched regardless
  // of type. MANAGER_ELIGIBLE_ROLES (Admin or Manager) filtered client-side,
  // since listStaffUsers only takes one exact role per call.
  const { data: staffUsers } = useQuery({
    queryKey: ['users', {}],
    queryFn: () => listStaffUsers({}),
  });
  const managers = (staffUsers ?? []).filter((u) => MANAGER_ELIGIBLE_ROLES.includes(u.role));

  // Configurable Approval Hierarchy: which workflow governs THIS employee's
  // own requests, overriding the company-wide default for its request
  // type(s). Only active workflows are offered — an inactive one can't be
  // newly assigned, though an employee already pointed at one keeps showing
  // it (see the reapply effect below) rather than silently blanking the field.
  const { data: workflows } = useQuery({ queryKey: ['approval-workflows'], queryFn: listApprovalWorkflows });
  const activeWorkflows = (workflows ?? []).filter((w) => w.isActive || w._id === defaultValues.approvalWorkflow);

  // The <select>s mount (via register's ref) before these async lists
  // resolve, so setting their value to an id with no matching <option> yet
  // silently fails — a native select doesn't retroactively select an option
  // added later. Re-apply the defaults once the real options exist.
  useEffect(() => {
    if (staffUsers && defaultValues.manager) {
      setValue('manager', defaultValues.manager);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUsers]);
  useEffect(() => {
    if (workflows && defaultValues.approvalWorkflow) {
      setValue('approvalWorkflow', defaultValues.approvalWorkflow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflows]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Section title={t('staffEmployees.form.sections.employeeType')}>
        <div className="sm:col-span-2">
          <Select label={`${t('staffEmployees.form.type')} *`} error={errors.type?.message} {...register('type')}>
            {selectableTypes.map((ty) => (
              <option key={ty} value={ty}>
                {t(`common.employeeType.${ty}`, EMPLOYEE_TYPE_LABELS[ty])}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {type === 'Own' && t('staffEmployees.form.typeHintOwn')}
            {type === 'Outsourced' && t('staffEmployees.form.typeHintOutsourced')}
            {type === 'Subcontracted' && t('staffEmployees.form.typeHintSubcontracted')}
          </p>
        </div>
        {type === 'Subcontracted' && (
          <div className="sm:col-span-2">
            <Select label={`${t('staffEmployees.form.subcontractor')} *`} error={errors.subcontractor?.message} {...register('subcontractor')}>
              <option value="">{t('staffEmployees.form.selectSubcontractor')}</option>
              {subcontractors.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.subcontractorHint')}</p>
          </div>
        )}
      </Section>

      <Section title={t('staffEmployees.form.sections.personalDetails')}>
        <Input label={`${t('staffEmployees.form.employeeId')} *`} placeholder="AJ-001" error={errors.employeeId?.message} {...register('employeeId')} />
        <Input label={`${t('staffEmployees.form.fullName')} *`} error={errors.fullName?.message} {...register('fullName')} />
        <Controller
          name="nationality"
          control={control}
          render={({ field }) => (
            <SuggestInput
              label={`${t('staffEmployees.form.nationality')}${isWorkforce ? ' *' : ''}`}
              error={errors.nationality?.message}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              options={COUNTRIES}
            />
          )}
        />
        <Input
          label={`${t('staffEmployees.form.mobile')}${isWorkforce ? ' *' : ''}`}
          placeholder="+966 5x xxx xxxx"
          error={errors.mobile?.message}
          {...register('mobile')}
        />
        <Input label={t('staffEmployees.form.email')} type="email" error={errors.email?.message} {...register('email')} />
      </Section>

      <Section title={t('staffEmployees.form.sections.employment')}>
        <Input
          label={`${t('staffEmployees.form.joiningDate')}${isWorkforce ? ' *' : ''}`}
          type="date"
          error={errors.joiningDate?.message}
          {...register('joiningDate')}
        />
        <Input label={`${t('staffEmployees.form.designation')} *`} placeholder="Electrician" error={errors.designation?.message} {...register('designation')} />
        <Input label={t('staffEmployees.form.department')} placeholder="Maintenance" error={errors.department?.message} {...register('department')} />
        <Input
          label={`${t('staffEmployees.form.salaryPerMonth')}${type === 'Outsourced' ? ' *' : ''}`}
          type="number"
          min="0"
          step="50"
          error={errors.salary?.message}
          {...register('salary')}
        />
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-muted">{t('staffEmployees.form.wpsBreakdownHint')}</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label={t('staffEmployees.form.basic')} type="number" min="0" step="50" error={errors.basicSalary?.message} {...register('basicSalary')} />
            <Input label={t('staffEmployees.form.housingAllowance')} type="number" min="0" step="50" error={errors.housingAllowance?.message} {...register('housingAllowance')} />
            <Input label={t('staffEmployees.form.transportAllowance')} type="number" min="0" step="50" error={errors.transportAllowance?.message} {...register('transportAllowance')} />
          </div>
        </div>
        <Input label={t('staffEmployees.form.accommodation')} placeholder="Company camp, room 12" error={errors.accommodation?.message} {...register('accommodation')} />
        <div>
          <Input
            label={t('staffEmployees.form.expectedDailyHours')}
            type="number"
            min="0"
            max="24"
            step="0.5"
            placeholder="e.g. 9.5"
            error={errors.expectedDailyHours?.message}
            {...register('expectedDailyHours')}
          />
          <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.expectedDailyHoursHint')}</p>
        </div>
        <div>
          <Select label={t('staffEmployees.form.weeklyOffDay')} error={errors.weeklyOffDay?.message} {...register('weeklyOffDay')}>
            <option value="">{t('staffEmployees.form.noFixedDayOff')}</option>
            {WEEKDAY_LABELS.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.weeklyOffDayHint')}</p>
        </div>
        <Select label={t('staffEmployees.form.status')} error={errors.status?.message} {...register('status')}>
          {EMPLOYEE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`common.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <div>
          <Select label={t('staffEmployees.form.manager')} error={errors.manager?.message} {...register('manager')}>
            <option value="">{t('common.notAssigned')}</option>
            {managers.map((m) => (
              <option key={m._id} value={m._id}>
                {m.name} ({m.role})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">
            {type === 'Own' ? t('staffEmployees.form.managerHintOwn') : t('staffEmployees.form.managerHintOther')}
          </p>
        </div>
        <div>
          <Select label={t('staffEmployees.form.approvalWorkflowOverride')} error={errors.approvalWorkflow?.message} {...register('approvalWorkflow')}>
            <option value="">{t('staffEmployees.form.useCompanyDefault')}</option>
            {activeWorkflows.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.approvalWorkflowHint')}</p>
        </div>
      </Section>

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.form.sections.documents')}</h2>
        <p className="mb-4 text-sm text-muted">{t('staffEmployees.form.documentsHint')}</p>
        <div className="space-y-4">
          {DOCUMENTS.map((key) => {
            const label = t(`staffEmployees.form.documents.${key}`);
            return (
              <div key={key} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label={t('staffEmployees.form.documentNumber', { document: label })}
                  error={errors[key]?.number?.message}
                  {...register(`${key}.number`)}
                />
                <Input
                  label={t('staffEmployees.form.documentExpiry', { document: label })}
                  type="date"
                  error={errors[key]?.expiry?.message}
                  {...register(`${key}.expiry`)}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Section title={t('staffEmployees.form.sections.emergencyContact')}>
        <Input label={t('staffEmployees.form.emergencyName')} error={errors.emergencyContact?.name?.message} {...register('emergencyContact.name')} />
        <Input label={t('staffEmployees.form.emergencyPhone')} error={errors.emergencyContact?.phone?.message} {...register('emergencyContact.phone')} />
        <Input label={t('staffEmployees.form.emergencyRelation')} placeholder="Wife, brother…" error={errors.emergencyContact?.relation?.message} {...register('emergencyContact.relation')} />
      </Section>

      <Card>
        <Textarea label={t('staffEmployees.form.notes')} placeholder={t('staffEmployees.form.notesPlaceholder')} error={errors.notes?.message} {...register('notes')} />
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => navigate(-1)} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" isLoading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
