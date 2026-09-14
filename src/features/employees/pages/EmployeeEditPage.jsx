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
import { EMPLOYEE_WRITE_ROLES } from '../../../lib/constants.js';
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
  // Editing an employee is gated by a hardcoded role list (Admin/Manager/HR
  // — see employee.routes.js's PATCH /:id), a DIFFERENT permission from
  // creating one ('employeeCreate' Section Access) — this page previously
  // had no check at all (2026-09-14 fix, a real QA-audit-found gap: direct
  // URL/bookmark reached a fully live form for any staff role).
  const canWrite = EMPLOYEE_WRITE_ROLES.includes(user.role);

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
      <div className="mx-auto max-w-3xl space-y-4">
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
    <div className="mx-auto max-w-3xl">
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
      />
    </div>
  );
}
