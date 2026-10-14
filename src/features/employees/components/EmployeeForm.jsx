/**
 * EmployeeForm — one form, two uses: create (blank defaults) and edit
 * (defaults from employeeToForm). The page owns the mutation; this component
 * owns fields + validation. That split means create/edit can never drift
 * apart in layout or rules.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { employeeFormSchema } from '../employees.schema.js';
import { listDesignations } from '../employees.api.js';
import { listStaffUsers } from '../../users/users.api.js';
import { listApprovalWorkflows } from '../../approvals/approvals.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import {
  EMPLOYEE_STATUSES,
  EMPLOYEE_TYPES,
  EMPLOYEE_TYPE_LABELS,
  EMPLOYEE_DEPARTMENTS,
  WEEKDAY_LABELS,
  MANAGER_ELIGIBLE_ROLES,
} from '../../../lib/constants.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { collectFormErrorMessages } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Input from '../../../components/ui/Input.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

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

export default function EmployeeForm({ defaultValues, onSubmit, submitLabel, submitting, isEdit = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const { user } = useAuth();
  // Drives which employee types a Coordinator may pick (below) — unrelated
  // to coordinator ASSIGNMENT itself, which this form no longer sets at all
  // (Milestone 5): coordinator is fully derived from Mobilisation state, so
  // there's nothing left here to show or pick, for anyone.
  // Pay boxes: anyone adding may type salary once (it is never shown back to
  // them); on an edit only 'employeeFinancial' Read sees or changes it.
  const payHidden = isEdit && !user.sectionAccess?.includes('employeeFinancial');
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(employeeFormSchema), defaultValues: { ...defaultValues, payHidden } });

  const { fields: additionalDocumentFields, append: appendDocument, remove: removeDocument } = useFieldArray({
    control,
    name: 'additionalDocuments'
  });

  // Drives which fields below render as required — nationality/mobile/
  // joining date are compliance fields both workforce types need; salary is
  // narrower still (only 'Outsourced', since a Subcontracted worker's pay is
  // the subcontractor's business); an 'Own' (internal staff) record needs
  // none of it.
  const type = watch('type');
  const isWorkforce = type !== 'Own';

  // Designation is picked from the approval roles (Approval Hierarchy / Section Access), or typed
  // when it is a trade with no role behind it; the server keeps the two sides in step.
  const OTHER_DESIGNATION = '__other';
  const { data: designationRoles, isError: designationsError } = useQuery({ queryKey: ['employee-designations'], queryFn: listDesignations });
  const designation = watch('designation');
  const [otherDesignation, setOtherDesignation] = useState(false);
  const typingDesignation = otherDesignation || Boolean(designationRoles && designation && !designationRoles.includes(designation));

  // Only fetched/shown once 'Subcontracted' is picked — who supplied this worker.
  const { data: subcontractorData, isError: subcontractorsError } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
    enabled: type === 'Subcontracted',
  });
  const subcontractors = subcontractorData?.items ?? [];

  // Every 'Own' employee reports to a Manager; an 'Outsourced' employee may
  // too, alongside or instead of a coordinator — so this stays fetched regardless
  // of type. MANAGER_ELIGIBLE_ROLES (Admin or Manager) filtered client-side,
  // since listStaffUsers only takes one exact role per call.
  const { data: staffUsers, isError: managersError } = useQuery({
    queryKey: ['users', {}],
    queryFn: () => listStaffUsers({}),
  });
  const managers = (staffUsers ?? []).filter((u) => MANAGER_ELIGIBLE_ROLES.includes(u.role));

  // Configurable Approval Hierarchy: which workflow governs THIS employee's
  // own requests, overriding the company-wide default for its request
  // type(s). Only active workflows are offered — an inactive one can't be
  // newly assigned, though an employee already pointed at one keeps showing
  // it (see the reapply effect below) rather than silently blanking the field.
  const { data: workflows, isError: workflowsError } = useQuery({ queryKey: ['approval-workflows'], queryFn: listApprovalWorkflows });
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

  const onInvalid = (formErrors) => {
    console.error('[employees] employee form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('staffEmployees.form.invalid'));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      <PickerLoadWarning
        failed={[
          { label: 'subcontractors', isError: subcontractorsError },
          { label: 'managers', isError: managersError },
          { label: 'approval workflows', isError: workflowsError },
          { label: 'designations', isError: designationsError },
        ]}
      />
      <Section title={t('staffEmployees.form.sections.employeeType')}>
        {isEdit ? (
          <div className="sm:col-span-2">
            <Select label={`${t('staffEmployees.form.type')} *`} error={errors.type?.message} {...register('type')}>
              {EMPLOYEE_TYPES.map((ty) => (
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
        ) : (
          // This module only ever adds a real 'Own' (internal staff) employee
          // now (2026-09-30, the user's own ask) — a Freelancer or a
          // subcontractor's worker goes through the Outsourced Employees
          // module instead. No selector to show; `type` stays a fixed 'Own'
          // in emptyEmployeeForm. An EXISTING Outsourced/Subcontracted record
          // is untouched — `isEdit` keeps the full selector for it above, so
          // nothing already in the system is hidden or force-migrated.
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-text">{t('common.employeeType.Own', EMPLOYEE_TYPE_LABELS.Own)}</p>
            <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.typeHintOwn')}</p>
          </div>
        )}
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
        <Input
          label={t('staffEmployees.form.contractStartDate', 'Contract Start Date')}
          type="date"
          error={errors.contractStartDate?.message}
          {...register('contractStartDate')}
        />
        <Input
          label={t('staffEmployees.form.contractEndDate', 'Contract End Date')}
          type="date"
          error={errors.contractEndDate?.message}
          {...register('contractEndDate')}
        />
        <div className="space-y-3">
          <Select
            label={`${t('staffEmployees.form.designation')} *`}
            value={typingDesignation ? OTHER_DESIGNATION : designation || ''}
            error={typingDesignation ? undefined : errors.designation?.message}
            onChange={(e) => {
              const picked = e.target.value;
              setOtherDesignation(picked === OTHER_DESIGNATION);
              setValue('designation', picked === OTHER_DESIGNATION ? '' : picked, { shouldValidate: true });
            }}
          >
            <option value="">{t('staffEmployees.form.designationChoose')}</option>
            {(designationRoles ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={OTHER_DESIGNATION}>{t('staffEmployees.form.designationOther')}</option>
          </Select>
          {typingDesignation && (
            <Input
              label={t('staffEmployees.form.designationTrade')}
              placeholder="Electrician"
              error={errors.designation?.message}
              {...register('designation')}
            />
          )}
          <p className="text-xs text-muted">{t('staffEmployees.form.designationHint')}</p>
        </div>
        <div>
          <Select label={t('staffEmployees.form.department')} error={errors.department?.message} {...register('department')}>
            <option value="">{t('staffEmployees.form.departmentChoose')}</option>
            {EMPLOYEE_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {t(`staffEmployees.departments.${d}`, d)}
              </option>
            ))}
          </Select>
          {defaultValues.departmentLegacy && (
            <p className="mt-1 text-xs text-warning">{t('staffEmployees.form.departmentLegacyHint', { value: defaultValues.departmentLegacy })}</p>
          )}
        </div>
        {!payHidden && (
          <Input
            label={`${t('staffEmployees.form.salaryPerMonth')}${type === 'Outsourced' ? ' *' : ''}`}
            type="number"
            min="0"
            step="50"
            error={errors.salary?.message}
            {...register('salary')}
          />
        )}
        <div>
          <Input
            label={t('staffEmployees.form.contractHours')}
            type="number"
            min="0"
            max="744"
            step="1"
            placeholder="e.g. 240"
            error={errors.contractHours?.message}
            {...register('contractHours')}
          />
          <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.contractHoursHint')}</p>
        </div>
        <div>
          <Input
            label={t('staffEmployees.form.annualVacationDays')}
            type="number"
            min="1"
            max="90"
            step="1"
            placeholder="e.g. 25"
            error={errors.annualVacationDays?.message}
            {...register('annualVacationDays')}
          />
          <p className="mt-1 text-xs text-muted">{t('staffEmployees.form.annualVacationDaysHint')}</p>
        </div>
        {!payHidden && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-muted">{t('staffEmployees.form.wpsBreakdownHint')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input label={t('staffEmployees.form.basic')} type="number" min="0" step="50" error={errors.basicSalary?.message} {...register('basicSalary')} />
              <Input label={t('staffEmployees.form.housingAllowance')} type="number" min="0" step="50" error={errors.housingAllowance?.message} {...register('housingAllowance')} />
              <Input label={t('staffEmployees.form.transportAllowance')} type="number" min="0" step="50" error={errors.transportAllowance?.message} {...register('transportAllowance')} />
              <Input label={t('staffEmployees.form.foodAllowance')} type="number" min="0" step="50" error={errors.foodAllowance?.message} {...register('foodAllowance')} />
            </div>
          </div>
        )}
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

        {/* Additional Documents section */}
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('staffEmployees.form.additionalDocuments')}</h3>
            <Button variant="secondary" size="sm" onClick={() => appendDocument({ name: '', number: '', expiry: '' })}>
              {t('staffEmployees.form.addDocument')}
            </Button>
          </div>
          <div className="space-y-4">
            {additionalDocumentFields.map((field, index) => (
              <div key={field.id} className="relative rounded-md border border-border p-4">
                <button
                  type="button"
                  onClick={() => removeDocument(index)}
                  className="absolute right-2 top-2 text-muted hover:text-red-500"
                  aria-label={t('staffEmployees.form.removeDocument')}
                >
                  &times;
                </button>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Input
                    label={`${t('staffEmployees.form.additionalDocumentName')} *`}
                    placeholder={t('staffEmployees.form.additionalDocumentNamePlaceholder')}
                    error={errors.additionalDocuments?.[index]?.name?.message}
                    {...register(`additionalDocuments.${index}.name`)}
                  />
                  <Input
                    label={t('staffEmployees.form.additionalDocumentNumber')}
                    error={errors.additionalDocuments?.[index]?.number?.message}
                    {...register(`additionalDocuments.${index}.number`)}
                  />
                  <Input
                    label={t('staffEmployees.form.additionalDocumentExpiry')}
                    type="date"
                    error={errors.additionalDocuments?.[index]?.expiry?.message}
                    {...register(`additionalDocuments.${index}.expiry`)}
                  />
                </div>
              </div>
            ))}
            {additionalDocumentFields.length === 0 && (
              <p className="text-sm text-muted">{t('staffEmployees.form.noAdditionalDocuments')}</p>
            )}
          </div>
        </div>
      </Card>

      <Section title={t('staffEmployees.form.sections.emergencyContact')}>
        <Input label={t('staffEmployees.form.emergencyName')} error={errors.emergencyContact?.name?.message} {...register('emergencyContact.name')} />
        <Input label={t('staffEmployees.form.emergencyPhone')} error={errors.emergencyContact?.phone?.message} {...register('emergencyContact.phone')} />
        <Input label={t('staffEmployees.form.emergencyRelation')} placeholder={t('staffEmployees.form.emergencyRelationPlaceholder')} error={errors.emergencyContact?.relation?.message} {...register('emergencyContact.relation')} />
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
