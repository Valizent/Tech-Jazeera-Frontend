/**
 * MobilisationNewPage — loads the workers/clients/subcontractors pickers,
 * then hands off to MobilisationForm. Always creates a Draft; inviting
 * co-coordinators and submitting for review happen on MobilisationDetailPage.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createMobilisation, listCoordinatorCandidates } from '../mobilisations.api.js';
import { emptyMobilisationForm } from '../mobilisations.schema.js';
import { listEmployees } from '../../employees/employees.api.js';
import { listClients } from '../../clients/clients.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { listJobTitles } from '../../jobTitles/jobTitles.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import MobilisationForm from '../components/MobilisationForm.jsx';

export default function MobilisationNewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOfficeSecretary = user.role === 'Office Secretary';

  const { data: workerData, isPending: workersLoading } = useQuery({
    queryKey: ['employees', { forMobilisation: true }],
    queryFn: () => listEmployees({ limit: 100, type: 'Own', loginRole: 'Worker' }),
  });
  // Office Secretary only — the "create for a Coordinator who's busy" picker.
  const { data: coordinatorData, isPending: coordinatorsLoading } = useQuery({
    queryKey: ['mobilisations', 'coordinator-candidates'],
    queryFn: listCoordinatorCandidates,
    enabled: isOfficeSecretary,
  });
  const { data: clientData, isPending: clientsLoading } = useQuery({
    queryKey: ['clients', { active: true }],
    queryFn: () => listClients({ status: 'Active', approvalStatus: 'Approved', limit: 100 }),
  });
  const { data: subcontractorData, isPending: subcontractorsLoading } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
  });
  const { data: jobTitleData, isPending: jobTitlesLoading } = useQuery({
    queryKey: ['job-titles'],
    queryFn: () => listJobTitles({ activeOnly: 'true' }),
  });

  const mutation = useMutation({
    mutationFn: createMobilisation,
    onSuccess: (mobilisation) => {
      toast.success(t('staffMobilisations.new.createdToast'));
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
      navigate(`/mobilisations/${mobilisation._id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function handleSubmit(values) {
    mutation.mutate(values);
  }

  if (workersLoading || clientsLoading || subcontractorsLoading || jobTitlesLoading || (isOfficeSecretary && coordinatorsLoading)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Own-type AND a real Worker login only — "Own Employee" means a field
  // worker directly employed by the company, not any internal staff member
  // who happens to have an Own-type Employee record for payroll (Admin,
  // Manager, Coordinator, HR, Accounts, Office Secretary, Staff all can —
  // see employee.service.js's loginRole filter). An Outsourced/Subcontracted
  // worker is placed via the Supplier Employee/Freelancer types instead (see
  // MobilisationForm's workerType selector).
  const workers = (workerData?.items ?? []).filter((w) => w.status !== 'Exited' && w.type === 'Own');
  const clients = clientData?.items ?? [];
  const subcontractors = subcontractorData?.items ?? [];
  const jobTitles = jobTitleData ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('staffMobilisations.new.pageTitle')}
        description={t('staffMobilisations.new.pageDescription')}
        onBack={() => navigate(-1)}
      />
      <Card>
        <MobilisationForm
          workers={workers}
          clients={clients}
          subcontractors={subcontractors}
          jobTitles={jobTitles}
          coordinatorCandidates={isOfficeSecretary ? (coordinatorData ?? []) : undefined}
          defaultValues={emptyMobilisationForm}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/mobilisations')}
          submitLabel={t('staffMobilisations.new.submitLabel')}
          submitting={mutation.isPending}
        />
      </Card>
    </div>
  );
}
