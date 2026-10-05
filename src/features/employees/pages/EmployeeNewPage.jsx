/**
 * New employee — thin page: header + EmployeeForm + create mutation.
 */
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createEmployee } from '../employees.api.js';
import { emptyEmployeeForm, formToEmployeePayload } from '../employees.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import EmployeeForm from '../components/EmployeeForm.jsx';

export default function EmployeeNewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (employee) => {
      toast.success(t('staffEmployees.new.addedSuccess', { name: employee.fullName }));
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      navigate(`/employees/${employee._id}`, { replace: true });
    },
    // Server-side rejections (e.g. duplicate employee ID → 409) surface here.
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffEmployees.new.title')}
        description={t('staffEmployees.new.description')}
        onBack={() => navigate(-1)}
      />
      <EmployeeForm
        defaultValues={emptyEmployeeForm}
        onSubmit={(values) => mutation.mutate(formToEmployeePayload(values))}
        submitLabel={t('staffEmployees.new.submitLabel')}
        submitting={mutation.isPending}
        isEdit={false}
      />
    </div>
  );
}
