import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOutsourcedEmployee, createOutsourcedEmployee, updateOutsourcedEmployee } from '../outsourcedEmployees.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage } from '../../../lib/utils.js';
import Modal from '../../../components/ui/Modal.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  workerType: z.enum(['Freelancer', 'SupplierEmployee']),
  subcontractor: z.string().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email('Invalid email').max(100).nullable().optional().or(z.literal('')),
  agreedRate: z.number().min(0, 'Rate must be positive').nullable().optional(),
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
  phone: '',
  email: '',
  agreedRate: '',
  notes: '',
};

export default function OutsourcedEmployeeFormModal({ open, employeeId, onClose }) {
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

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const workerType = watch('workerType');

  useEffect(() => {
    if (open) {
      if (isEdit && employee) {
        reset({
          name: employee.name,
          workerType: employee.workerType,
          subcontractor: employee.subcontractor?._id || '',
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
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4">
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

            <Input label={t('employees.outsourced.phone', 'Phone')} error={errors.phone?.message} {...register('phone')} />
            <Input label={t('employees.outsourced.email', 'Email')} type="email" error={errors.email?.message} {...register('email')} />
            <Input label={t('employees.outsourced.agreedRate', 'Agreed Rate (SAR)')} type="number" step="0.01" error={errors.agreedRate?.message} {...register('agreedRate', { valueAsNumber: true, setValueAs: v => v === '' ? '' : Number(v) })} />
          </div>
          
          <Textarea label={t('common.notes')} rows={3} error={errors.notes?.message} {...register('notes')} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={saveMutation.isPending}>{t('common.save')}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
