/**
 * MobilisationEditPage — edits a Draft or Rejected mobilisation's Section 1
 * fields. MobilisationDetailPage is the "view" (coordinators, submit,
 * Marketing Manager review, documents); this page is Section 1 only.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { getMobilisation, updateMobilisation } from '../mobilisations.api.js';
import { mobilisationToForm } from '../mobilisations.schema.js';
import { listEmployees } from '../../employees/employees.api.js';
import { listClients } from '../../clients/clients.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { listJobTitles } from '../../jobTitles/jobTitles.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import MobilisationForm from '../components/MobilisationForm.jsx';

export default function MobilisationEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: mobilisation, isPending, isError } = useQuery({
    queryKey: ['mobilisation', id],
    queryFn: () => getMobilisation(id),
  });
  // Unfiltered here (unlike the New page's server-side type+loginRole
  // filter) — an existing mobilisation may already reference an employee
  // that wouldn't qualify under today's rules (wrong type, or an office-
  // staff login rather than a real Worker one) from before this restriction
  // existed; the client-side filter below keeps that one selectable so
  // editing an old record never shows a blank worker field.
  const { data: workerData, isPending: workersLoading } = useQuery({
    queryKey: ['employees', { forMobilisation: true }],
    queryFn: () => listEmployees({ limit: 100 }),
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
    mutationFn: (values) => updateMobilisation(id, values),
    onSuccess: () => {
      toast.success(t('staffMobilisations.edit.updatedToast'));
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
      queryClient.invalidateQueries({ queryKey: ['mobilisation', id] });
      navigate(`/mobilisations/${id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  const loading = isPending || workersLoading || clientsLoading || subcontractorsLoading || jobTitlesLoading;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !mobilisation) {
    return (
      <EmptyState
        title={t('staffMobilisations.edit.notFoundTitle')}
        description={t('staffMobilisations.edit.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/mobilisations')} />}
      />
    );
  }

  // Normally Draft/Rejected only — ALSO open throughout PendingReview to
  // whoever holds step 0 (Office Secretary today), fixing whatever the
  // coordinator entered wrong, even after the record has moved on to a
  // later step (server-enforced in updateMobilisation; `canEditSection1` is
  // the same server-computed flag the detail page's Edit button uses).
  if (!['Draft', 'Rejected'].includes(mobilisation.status) && !mobilisation.canEditSection1) {
    return (
      <EmptyState
        title={t('staffMobilisations.edit.cannotEditTitle')}
        description={t('staffMobilisations.edit.cannotEditDescription', { status: t(`common.status.${mobilisation.status}`, mobilisation.status) })}
        action={<BackButton onClick={() => navigate(`/mobilisations/${id}`)} />}
      />
    );
  }

  const workers = (workerData?.items ?? []).filter(
    (w) => w._id === mobilisation.worker || (w.status !== 'Exited' && w.type === 'Own' && w.login?.role === 'Worker')
  );
  const clients = clientData?.items ?? [];
  const subcontractors = subcontractorData?.items ?? [];
  const jobTitles = jobTitleData ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('staffMobilisations.edit.pageTitle')}
        description={t('staffMobilisations.edit.descriptionLine', { worker: mobilisation.workerName, client: mobilisation.clientName })}
        onBack={() => navigate(-1)}
      />
      <Card>
        <MobilisationForm
          workers={workers}
          clients={clients}
          subcontractors={subcontractors}
          jobTitles={jobTitles}
          defaultValues={mobilisationToForm(mobilisation)}
          onSubmit={(values) => mutation.mutate(values)}
          onCancel={() => navigate(`/mobilisations/${id}`)}
          submitLabel={t('staffMobilisations.edit.submitLabel')}
          submitting={mutation.isPending}
        />
      </Card>
    </div>
  );
}
