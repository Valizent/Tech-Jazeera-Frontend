import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOutsourcedEmployee,
  createOutsourcedEmployee,
  updateOutsourcedEmployee,
  saveOutsourcedEmployeeDocument,
  updateOutsourcedEmployeeDocument,
  deleteOutsourcedEmployeeDocument,
  downloadOutsourcedEmployeeDocument,
} from '../outsourcedEmployees.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { lookupMobilisationWorkerByIqama } from '../../mobilisations/mobilisations.api.js';
import { SAUDI_PHONE_REGEX } from '../../mobilisations/mobilisations.schema.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, collectFormErrorMessages, formatFileSize, formatDate } from '../../../lib/utils.js';
import { OUTSOURCED_DOCUMENT_TYPES } from '../../../lib/constants.js';
import Badge from '../../../components/ui/Badge.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import SuggestInput from '../../../components/ui/SuggestInput.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  workerType: z.enum(['Freelancer', 'SupplierEmployee']),
  subcontractor: z.string().nullable().optional(),
  iqamaNumber: z.string().optional().or(z.literal('')).refine((v) => !v || /^\d{10}$/.test(v), {
    message: 'Iqama number must be exactly 10 digits.',
  }),
  nationality: z.string().max(80).nullable().optional(),
  // Same Saudi-mobile rule the server enforces — caught here instead of after a round trip.
  phone: z.string().trim().max(30).nullable().optional().refine((v) => !v || SAUDI_PHONE_REGEX.test(v), {
    message: 'Enter a valid Saudi mobile number (e.g. 05XXXXXXXX or +9665XXXXXXXX).',
  }),
  email: z.string().email('Invalid email').max(100).nullable().optional().or(z.literal('')),
  notes: z.string().max(1000).nullable().optional(),
}).superRefine((val, ctx) => {
  if (val.workerType === 'SupplierEmployee' && !val.subcontractor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Subcontractor is required', path: ['subcontractor'] });
  }
});

const defaultValues = {
  name: '',
  workerType: 'Freelancer',
  subcontractor: '',
  iqamaNumber: '',
  nationality: '',
  phone: '',
  email: '',
  notes: '',
};

/** Once `iqamaNumber` reaches a full 10 digits, looks up whether this worker has ever been mobilised (or is
 *  already in the register) - the same lookup MobilisationForm's Iqama-typed autofill uses - and fills in
 *  name/nationality/phone/workerType/subcontractor, since this record and a Mobilisation share the same
 *  Iqama-based identity for a Freelancer/SupplierEmployee worker. */
function useIqamaAutofill({ control, setValue, toast }) {
  const iqamaRaw = useWatch({ control, name: 'iqamaNumber' });
  const iqamaDigits = (iqamaRaw || '').replace(/\D/g, '');
  const enabled = iqamaDigits.length === 10;

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
    setValue('name', foundWorker.workerName ?? '', { shouldValidate: true, shouldDirty: true });
    setValue('nationality', foundWorker.nationality ?? '', { shouldDirty: true });
    setValue('phone', foundWorker.phone || '', { shouldDirty: true });
    if (foundWorker.workerType) setValue('workerType', foundWorker.workerType, { shouldDirty: true });
    if (foundWorker.subcontractor) setValue('subcontractor', foundWorker.subcontractor, { shouldDirty: true });
    toast.success(`Found ${foundWorker.workerName} in past mobilisations filled in their known details.`);
  }, [foundWorker, iqamaDigits, setValue, toast]);

}

/** Which stage a document is at, from its expiry date and its own reminder lead time. */
function documentStatus(doc) {
  if (!doc.expiryDate) return null;
  const days = Math.round((new Date(doc.expiryDate).setUTCHours(0, 0, 0, 0) - new Date().setUTCHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return { label: 'Expired', variant: 'danger', days };
  if (days <= (doc.reminderDays ?? 30)) return { label: 'Expiring', variant: 'warning', days };
  return { label: 'Valid', variant: 'success', days };
}

const emptyDocument = { type: 'Ajeer', title: '', number: '', expiryDate: '', reminderDays: '30' };
const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

/** Papers kept on an outsourced worker (Ajeer, Muqeem, passport...): pick the kind (or name it), add its number
 *  and expiry date, and say how many days before the expiry the reminders should start. The scan is optional and
 *  can be attached later. Only shown once the record exists. */
function DocumentsSection({ employeeId, documents, canWrite, toast, queryClient, t }) {
  // null = no form open, 'new' = adding, otherwise the id of the document being edited.
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyDocument);
  const [file, setFile] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['outsourcedEmployee', employeeId] });
    queryClient.invalidateQueries({ queryKey: ['outsourcedEmployees'] });
    queryClient.invalidateQueries({ queryKey: ['documents', 'expiry-tracker'] });
  };
  const closeForm = () => {
    setEditing(null);
    setForm(emptyDocument);
    setFile(null);
  };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function open(doc) {
    setEditing(doc ? doc._id : 'new');
    setForm(
      doc
        ? { type: doc.type ?? 'Other', title: doc.type === 'Other' ? doc.title : '', number: doc.number ?? '', expiryDate: dateOnly(doc.expiryDate), reminderDays: String(doc.reminderDays ?? 30) }
        : emptyDocument
    );
    setFile(null);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const details = {
        type: form.type,
        title: form.type === 'Other' ? form.title.trim() : undefined,
        number: form.number.trim(),
        expiryDate: form.expiryDate,
        reminderDays: form.reminderDays,
      };
      if (editing === 'new') return saveOutsourcedEmployeeDocument(employeeId, details, file);
      const clearing = !form.expiryDate && documents.find((d) => d._id === editing)?.expiryDate;
      return updateOutsourcedEmployeeDocument(employeeId, editing, { ...details, ...(clearing && { clearExpiry: 'true' }) }, file);
    },
    onSuccess: () => {
      toast.success(t('employees.outsourced.documents.savedToast', 'Document saved.'));
      closeForm();
      invalidate();
    },
    onError: (error) => {
      console.error('[employees] outsourced employee document save failed', error);
      toast.error(apiMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (fileId) => deleteOutsourcedEmployeeDocument(employeeId, fileId),
    onSuccess: () => {
      toast.success(t('employees.outsourced.documents.removedToast', 'Document removed.'));
      setConfirmDeleteId(null);
      invalidate();
    },
    onError: (error) => {
      console.error('[employees] outsourced employee document delete failed', error);
      toast.error(apiMessage(error));
      setConfirmDeleteId(null);
    },
  });

  const valid = form.type !== 'Other' || form.title.trim().length >= 2;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{t('employees.outsourced.documents.heading', 'Documents')}</h3>
        {canWrite && editing === null && (
          <Button type="button" size="sm" variant="secondary" onClick={() => open(null)}>
            {t('employees.outsourced.documents.add', 'Add document')}
          </Button>
        )}
      </div>

      {documents.length === 0 && editing !== 'new' ? (
        <p className="text-sm text-muted">{t('employees.outsourced.documents.empty', 'No documents recorded yet.')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => {
            const status = documentStatus(d);
            return (
              <li key={d._id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-text">{d.title}</span>
                  {d.number && <span className="text-xs text-muted"> · {d.number}</span>}
                  <span className="block text-xs text-muted">
                    {d.expiryDate
                      ? `${t('employees.outsourced.documents.expires', 'expires')} ${formatDate(d.expiryDate)} · ${t('employees.outsourced.documents.remindBeforeShort', 'reminder {{days}} days before', { days: d.reminderDays ?? 30 })}`
                      : t('employees.outsourced.documents.noExpiry', 'No expiry date')}
                    {' · '}
                    {d.fileName ? `${d.originalName} (${formatFileSize(d.size)})` : t('employees.outsourced.documents.noFile', 'no file attached')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {status && <Badge variant={status.variant}>{status.label}</Badge>}
                  {d.fileName && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => downloadOutsourcedEmployeeDocument(employeeId, d._id, d.originalName)}>
                      {t('common.download')}
                    </Button>
                  )}
                  {canWrite && (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => open(d)}>
                        {t('common.edit')}
                      </Button>
                      <Button type="button" size="sm" variant="danger-ghost" onClick={() => setConfirmDeleteId(d._id)}>
                        {t('common.delete')}
                      </Button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && editing !== null && (
        <div className="space-y-3 rounded-lg border border-border bg-bg/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label={t('employees.outsourced.documents.typeLabel', 'Document')} value={form.type} onChange={set('type')}>
              {OUTSOURCED_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === 'Other' ? t('employees.outsourced.documents.other', 'Other (name it)') : type}
                </option>
              ))}
            </Select>
            {form.type === 'Other' ? (
              <Input label={t('employees.outsourced.documents.nameLabel', 'Name of the document')} value={form.title} onChange={set('title')} />
            ) : (
              <Input label={t('employees.outsourced.documents.numberLabel', 'Number (optional)')} value={form.number} onChange={set('number')} />
            )}
            {form.type === 'Other' && (
              <Input label={t('employees.outsourced.documents.numberLabel', 'Number (optional)')} value={form.number} onChange={set('number')} />
            )}
            <Input label={t('employees.outsourced.documents.expiryLabel', 'Expiry date')} type="date" value={form.expiryDate} onChange={set('expiryDate')} />
            <Input
              label={t('employees.outsourced.documents.remindLabel', 'Remind this many days before')}
              type="number"
              min="1"
              max="365"
              value={form.reminderDays}
              onChange={set('reminderDays')}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              {editing === 'new'
                ? t('employees.outsourced.documents.fileLabel', 'File (optional, can be added later)')
                : t('employees.outsourced.documents.replaceFileLabel', 'Replace the file (optional)')}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files[0] ?? null)}
              className="text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={closeForm} disabled={saveMutation.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="button" size="sm" disabled={!valid} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title={t('employees.outsourced.documents.deleteConfirmTitle', 'Delete document?')}
        message={t('employees.outsourced.documents.deleteConfirmMessage', 'This cannot be undone.')}
        confirmLabel={t('common.delete')}
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}

export default function OutsourcedEmployeeFormModal({ open, employeeId, canWrite = true, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(employeeId);

  const { data: employee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ['outsourcedEmployee', employeeId],
    queryFn: () => getOutsourcedEmployee(employeeId),
    enabled: open && isEdit,
  });

  const { data: subcontractorData, isError: subcontractorsError } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
    enabled: open,
  });

  const { register, handleSubmit, reset, watch, control, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const workerType = watch('workerType');
  useIqamaAutofill({ control, setValue, toast });

  useEffect(() => {
    if (open) {
      if (isEdit && employee) {
        reset({
          name: employee.name,
          workerType: employee.workerType,
          subcontractor: employee.subcontractor?._id || '',
          iqamaNumber: employee.iqamaNumber || '',
          nationality: employee.nationality || '',
          phone: employee.phone || '',
          email: employee.email || '',
          notes: employee.notes || '',
        });
      } else if (!isEdit) {
        reset(defaultValues);
      }
    }
  }, [open, isEdit, employee, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => {
      const payload = {
        ...values,
        subcontractor: values.workerType === 'SupplierEmployee' ? values.subcontractor : null,
        iqamaNumber: values.iqamaNumber || null,
        nationality: values.nationality || null,
        phone: values.phone || null,
        email: values.email || null,
      };
      return isEdit ? updateOutsourcedEmployee(employeeId, payload) : createOutsourcedEmployee(payload);
    },
    onSuccess: () => {
      toast.success(t(isEdit ? 'common.updated' : 'common.created'));
      queryClient.invalidateQueries({ queryKey: ['outsourcedEmployees'] });
      onClose();
    },
    onError: (error) => {
      toast.error(apiMessage(error));
    },
  });

  const onInvalid = (formErrors) => {
    console.error('[employees] outsourced employee form invalid', formErrors);
    toast.error(collectFormErrorMessages(formErrors).join(' ') || t('common.formInvalid', 'Please check the form and try again.'));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('employees.outsourced.edit', 'Edit Outsourced Employee') : t('employees.outsourced.add', 'Add Outsourced Employee')}
      size="lg"
    >
      {isEdit && isLoadingEmployee ? (
        <div className="py-8 text-center text-muted">{t('common.loading')}</div>
      ) : (
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v), onInvalid)} className="space-y-4">
          <PickerLoadWarning failed={[{ label: 'subcontractors', isError: subcontractorsError }]} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('common.name')} className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
            
            <Select label={t('common.type')} error={errors.workerType?.message} {...register('workerType')}>
              <option value="Freelancer">{t('staffMobilisations.form.workerType.Freelancer')}</option>
              <option value="SupplierEmployee">{t('staffMobilisations.form.workerType.SupplierEmployee')}</option>
            </Select>

            {workerType === 'SupplierEmployee' && (
              <Select label={t('employees.outsourced.subcontractor', 'Subcontractor')} error={errors.subcontractor?.message} {...register('subcontractor')}>
                <option value="">{t('common.select')}</option>
                {(subcontractorData?.items || []).map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </Select>
            )}

            <Input
              label={t('employees.outsourced.iqamaNumber', 'Iqama Number')}
              inputMode="numeric"
              maxLength={10}
              placeholder="1234567890"
              error={errors.iqamaNumber?.message}
              {...register('iqamaNumber')}
            />
            <Controller
              name="nationality"
              control={control}
              render={({ field }) => (
                <SuggestInput
                  label={t('employees.outsourced.nationality', 'Nationality')}
                  error={errors.nationality?.message}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  options={COUNTRIES}
                />
              )}
            />

            <Input label={t('employees.outsourced.phone', 'Phone')} error={errors.phone?.message} {...register('phone')} />
            <Input label={t('employees.outsourced.email', 'Email')} type="email" error={errors.email?.message} {...register('email')} />
          </div>
          
          <Textarea label={t('common.notes')} rows={3} error={errors.notes?.message} {...register('notes')} />

          {isEdit && employee && (
            <DocumentsSection
              employeeId={employeeId}
              documents={employee.documents ?? []}
              canWrite={canWrite}
              toast={toast}
              queryClient={queryClient}
              t={t}
            />
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={saveMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
