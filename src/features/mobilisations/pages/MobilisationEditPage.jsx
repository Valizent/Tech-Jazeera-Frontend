/**
 * MobilisationEditPage — edits a Draft or Rejected mobilisation's Section 1
 * fields. MobilisationDetailPage is the "view" (coordinators, submit,
 * Marketing Manager review, documents); this page is Section 1 only.
 * The Employees picker is NOT fetched here — MobilisationForm fetches it
 * itself, only while the record's worker type is actually 'Employee' (see
 * that file's own `useEmployeeWorkers` — 2026-09-16, a real user-reported
 * gap where fetching it unconditionally broke this page for anyone missing
 * Employees Section Access, even when editing a SupplierEmployee/Freelancer
 * record that never needed that picker at all). `existingWorkerId` is
 * passed through so an already-referenced employee stays selectable even if
 * they wouldn't qualify under today's rules — see that hook's own comment.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getMobilisation, updateMobilisation } from '../mobilisations.api.js';
import { mobilisationToForm } from '../mobilisations.schema.js';
import { listClients } from '../../clients/clients.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { listJobTitles } from '../../jobTitles/jobTitles.api.js';
import { listLocations } from '../../locations/locations.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import MobilisationForm from '../components/MobilisationForm.jsx';

export default function MobilisationEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: mobilisation, isPending, isError } = useQuery({
    queryKey: ['mobilisation', id],
    queryFn: () => getMobilisation(id),
  });
  const { data: clientData, isPending: clientsLoading, isError: clientsError } = useQuery({
    queryKey: ['clients', { active: true }],
    queryFn: () => listClients({ status: 'Active', approvalStatus: 'Approved', limit: 100 }),
  });
  const { data: subcontractorData, isPending: subcontractorsLoading, isError: subcontractorsError } = useQuery({
    queryKey: ['subcontractors', { active: true }],
    queryFn: () => listSubcontractors({ status: 'Active', limit: 100 }),
  });
  const { data: jobTitleData, isPending: jobTitlesLoading, isError: jobTitlesError } = useQuery({
    queryKey: ['job-titles'],
    queryFn: () => listJobTitles({ activeOnly: 'true' }),
  });
  const { data: locationData, isPending: locationsLoading, isError: locationsError } = useQuery({
    queryKey: ['locations'],
    queryFn: listLocations,
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

  const loading = isPending || clientsLoading || subcontractorsLoading || jobTitlesLoading || locationsLoading;

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

  // Draft/Rejected: only the primary coordinator or Admin (server:
  // assertPrimaryOrAdmin) — a joint (non-primary) coordinator, or a
  // mobilisationsViewer Read-only grantee who can see a Rejected record,
  // must NOT get a live edit form just because the record happens to be in
  // an editable status. PendingReview: whoever holds step 0 right now
  // (Office Secretary today), even after the record has moved past step 0
  // (`canEditSection1` is the same server-computed flag the detail page's
  // Edit button uses — see mobilisation.service.js's getMobilisation).
  // Found 2026-09-14: the original check only gated the PendingReview
  // branch, so a Draft/Rejected record was a live form for ANY viewer who
  // could reach this URL at all, primary or not.
  const isPrimary = mobilisation.coordinators.some((c) => (c.user._id ?? c.user) === user.id && c.isPrimary);
  const isDraftOrRejected = ['Draft', 'Rejected'].includes(mobilisation.status);
  const canEdit = isDraftOrRejected ? user.role === 'Admin' || isPrimary : Boolean(mobilisation.canEditSection1);

  if (!canEdit) {
    return (
      <EmptyState
        title={t('staffMobilisations.edit.cannotEditTitle')}
        description={t('staffMobilisations.edit.cannotEditDescription', { status: t(`common.status.${mobilisation.status}`, mobilisation.status) })}
        action={<BackButton onClick={() => navigate(`/mobilisations/${id}`)} />}
      />
    );
  }

  const clients = clientData?.items ?? [];
  const subcontractors = subcontractorData?.items ?? [];
  const jobTitles = jobTitleData ?? [];
  const locations = locationData ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('staffMobilisations.edit.pageTitle')}
        description={t('staffMobilisations.edit.descriptionLine', { worker: mobilisation.workerName, client: mobilisation.clientName })}
        onBack={() => navigate(-1)}
      />
      <Card>
        <PickerLoadWarning
          failed={[
            { label: 'clients', isError: clientsError },
            { label: 'subcontractors', isError: subcontractorsError },
            { label: 'job titles', isError: jobTitlesError },
            { label: 'locations', isError: locationsError },
          ]}
        />
        <MobilisationForm
          clients={clients}
          subcontractors={subcontractors}
          jobTitles={jobTitles}
          locations={locations}
          existingWorkerId={mobilisation.worker}
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
