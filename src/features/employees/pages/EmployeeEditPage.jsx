/**
 * Edit employee — loads the record, maps it to form values, saves a patch.
 */
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getEmployee, updateEmployee } from '../employees.api.js';
import { employeeToForm, formToEmployeePayload } from '../employees.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import EmployeeForm from '../components/EmployeeForm.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  // Editing is its own Section Access permission ('employeeEdit' Write),
  // separate from adding one. The route guard already checks it; this keeps
  // the page itself safe if it is ever mounted elsewhere.
  const canWrite = Boolean(user.sectionAccessWrite?.includes('employeeEdit'));

  const { data: employee, isPending, isError } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => getEmployee(id),
  });

  const mutation = useMutation({
    mutationFn: (values) => updateEmployee(id, values),
    onSuccess: (updated) => {
      toast.success(t('staffEmployees.editPage.updatedSuccess', { name: updated.fullName }));
      // Both the list and this profile are now stale.
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      navigate(`/employees/${id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-[1600px] space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffEmployees.editPage.notFound')}
        description={t('staffEmployees.editPage.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/employees')} />}
      />
    );
  }
  if (!canWrite) {
    return (
      <EmptyState
        title={t('common.noSectionAccessTitle')}
        description={t('common.noSectionAccessDescription')}
        action={<BackButton onClick={() => navigate(`/employees/${id}`)} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffEmployees.editPage.title', { name: employee.fullName })}
        description={employee.employeeId}
        onBack={() => navigate(-1)}
      />
      <EmployeeForm
        defaultValues={employeeToForm(employee)}
        onSubmit={(values) => mutation.mutate(formToEmployeePayload(values))}
        submitLabel={t('staffEmployees.editPage.submitLabel')}
        submitting={mutation.isPending}
        isEdit
      />
    </div>
  );
}
