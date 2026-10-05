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
  uploadOutsourcedEmployeeDocument,
  deleteOutsourcedEmployeeDocument,
  downloadOutsourcedEmployeeDocument,
} from '../outsourcedEmployees.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { lookupMobilisationWorkerByIqama } from '../../mobilisations/mobilisations.api.js';
import { COUNTRIES } from '../../../lib/countries.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, collectFormErrorMessages, formatMoney, formatFileSize, formatDate } from '../../../lib/utils.js';
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
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email('Invalid email').max(100).nullable().optional().or(z.literal('')),
  // Left blank, register('agreedRate', { valueAsNumber: true, setValueAs })
  // below actually produces NaN, not '' — RHF applies valueAsNumber's own
  // coercion regardless of setValueAs, a real pre-existing mismatch found
  // while testing this form live. Preprocess maps '', null, AND NaN to
  // undefined first, same fix as the server's own schema.
  agreedRate: z.preprocess(
    (v) => (v === '' || v == null || (typeof v === 'number' && Number.isNaN(v)) ? undefined : v),
    z.number().min(0, 'Rate must be positive').optional()
  ),
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
  agreedRate: '',
  notes: '',
};

/** Once `iqamaNumber` reaches a full 10 digits, looks up whether this worker
 *  has ever been mobilised before (mobilisation.service.js's own
 *  lookupWorkerByIqama — the same lookup MobilisationForm's Iqama-typed
 *  autofill uses) and fills in name/nationality/phone/workerType/
 *  subcontractor, since this record and a Mobilisation both use the same
 *  Iqama-based identity for a Freelancer/SupplierEmployee worker. Returns the
 *  raw lookup result too, so its last-known client/subcontractor rate can be
 *  shown as a read-only reference next to Agreed Rate — never auto-applied
 *  into the real field, same "a rate can genuinely differ this time" rule
 *  MobilisationForm's own hint follows. */
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

  return { previousWorker: enabled ? foundWorker : null };
}

/** ID copies, contracts, CVs — one at a time, each with its own title and
 *  optional expiry date. Only shown once the record exists (a new record has
 *  no id to attach a document to yet — save it first). Reuses the same
 *  private-Cloudinary/signed-URL pipeline every other document upload in
 *  this app uses (see middleware/upload.js). Added 2026-09-30: this record's
 *  `documents` field existed since the module was first built with no route
 *  or UI ever wired to it — a real gap found live, not a new feature ask. */
function DocumentsSection({ employeeId, documents, canWrite, toast, queryClient, t }) {
  const [title, setTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['outsourcedEmployee', employeeId] });
    queryClient.invalidateQueries({ queryKey: ['outsourcedEmployees'] });
  };

  const uploadMutation = useMutation({
    mutationFn: () => uploadOutsourcedEmployeeDocument(employeeId, file, { title, expiryDate: expiryDate || undefined }),
    onSuccess: () => {
      toast.success(t('employees.outsourced.documents.uploadedToast', 'Document uploaded.'));
      setTitle('');
      setExpiryDate('');
      setFile(null);
      invalidate();
    },
    onError: (error) => {
      console.error('[employees] outsourced employee document upload failed', error);
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
    },
  });

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-text">{t('employees.outsourced.documents.heading', 'Documents')}</h3>

      {documents.length === 0 ? (
        <p className="text-sm text-muted">{t('employees.outsourced.documents.empty', 'No documents uploaded yet.')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li key={d._id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-text">{d.title}</span>{' '}
                <span className="text-xs text-muted">
                  ({d.originalName}, {formatFileSize(d.size)}
                  {d.expiryDate && `, ${t('employees.outsourced.documents.expires', 'expires')} ${formatDate(d.expiryDate)}`})
                </span>
              </span>
              <span className="flex shrink-0 gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => downloadOutsourcedEmployeeDocument(employeeId, d._id, d.originalName)}>
                  {t('common.download')}
                </Button>
                {canWrite && (
                  <Button type="button" size="sm" variant="danger-ghost" onClick={() => setConfirmDeleteId(d._id)}>
                    {t('common.delete')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            label={t('employees.outsourced.documents.titleLabel', 'Title')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-[140px]"
          />
          <Input
            label={t('employees.outsourced.documents.expiryLabel', 'Expiry (optional)')}
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium">{t('employees.outsourced.documents.fileLabel', 'File')}</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files[0] ?? null)}
              className="text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!file || !title.trim()}
            isLoading={uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {t('employees.outsourced.documents.upload', 'Upload')}
          </Button>
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
  const { previousWorker } = useIqamaAutofill({ control, setValue, toast });

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
          agreedRate: employee.agreedRate ?? '',
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
        agreedRate: values.agreedRate === '' ? null : Number(values.agreedRate),
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
      size="md"
    >
      {isEdit && isLoadingEmployee ? (
        <div className="py-8 text-center text-muted">{t('common.loading')}</div>
      ) : (
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v), onInvalid)} className="space-y-4">
          <PickerLoadWarning failed={[{ label: 'subcontractors', isError: subcontractorsError }]} />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('common.name')} className="sm:col-span-2" error={errors.name?.message} {...register('name')} />
            
            <Select label={t('common.type')} error={errors.workerType?.message} {...register('workerType')}>
              <option value="Freelancer">{t('employees.workerTypes.Freelancer', 'Freelancer')}</option>
              <option value="SupplierEmployee">{t('employees.workerTypes.SupplierEmployee', 'Supplier Employee')}</option>
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
            <div>
              <Input label={t('employees.outsourced.agreedRate', 'Agreed Rate (SAR)')} type="number" step="0.01" error={errors.agreedRate?.message} {...register('agreedRate', { setValueAs: (v) => (v === '' ? '' : Number(v)) })} />
              {previousWorker?.clientRate != null && (
                <p className="mt-1 text-xs text-muted">
                  {t('employees.outsourced.previousClientRateHint', 'Last billed to client')}: {formatMoney(previousWorker.clientRate)}
                </p>
              )}
              {previousWorker?.subcontractorRate != null && (
                <p className="mt-1 text-xs text-muted">
                  {t('employees.outsourced.previousSubcontractorRateHint', 'Last paid to subcontractor')}: {formatMoney(previousWorker.subcontractorRate)}
                </p>
              )}
            </div>
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
