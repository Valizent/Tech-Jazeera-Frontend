/**
 * MobilisationNewPage — loads the clients/subcontractors/job-titles pickers,
 * then hands off to MobilisationForm. Always creates a Draft; inviting
 * co-coordinators and submitting for review happen on MobilisationDetailPage.
 * The Employees picker (for the "Own Employee" worker type) is NOT fetched
 * here — MobilisationForm fetches it itself, only once that worker type is
 * actually selected (2026-09-16, a real user-reported gap: fetching it
 * unconditionally meant a Section-Access-denied Employees list broke this
 * whole page for anyone who only ever mobilises SupplierEmployee/Freelancer
 * workers).
 *
 * Can arrive pre-filled via query params (2026-09-16, the user's own ask) —
 * StandbyListPage's "Mobilise" button deep-links here instead of making
 * someone re-type/re-search a worker they just looked at. `workerType` +
 * `worker` for an Employee (their live record already has trustworthy
 * name/nationality/phone, no need to snapshot it into the URL); `workerType`
 * + `workerName`/`iqamaNumber`/`nationality`/`phone`(+`subcontractor` for
 * SupplierEmployee) for a SupplierEmployee/Freelancer, the same fields
 * MobilisationForm's own PreviousWorkerPicker/Iqama-autofill already fill in
 * — this is just a second way to arrive at the same filled-in state, read
 * once into `defaultValues` rather than pushed in after mount.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createMobilisation, listCoordinatorCandidates } from '../mobilisations.api.js';
import { emptyMobilisationForm, WORKER_TYPES } from '../mobilisations.schema.js';
import { listClients } from '../../clients/clients.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { listJobTitles } from '../../jobTitles/jobTitles.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Card from '../../../components/ui/Card.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import MobilisationForm from '../components/MobilisationForm.jsx';

/** Reads the recognized prefill params (see this file's own header comment)
 *  into a partial form-values object, ignoring anything unrecognized —
 *  an unknown/garbled `workerType` just falls back to a blank form, same
 *  as arriving here with no query string at all. */
function prefillFromSearchParams(searchParams) {
  const workerType = searchParams.get('workerType');
  if (!WORKER_TYPES.includes(workerType)) return {};
  const prefill = { workerType };
  if (workerType === 'Employee') {
    const worker = searchParams.get('worker');
    if (worker) prefill.worker = worker;
    return prefill;
  }
  for (const field of ['workerName', 'iqamaNumber', 'nationality', 'phone']) {
    const value = searchParams.get(field);
    if (value) prefill[field] = value;
  }
  if (workerType === 'SupplierEmployee') {
    const subcontractor = searchParams.get('subcontractor');
    if (subcontractor) prefill.subcontractor = subcontractor;
  }
  return prefill;
}

export default function MobilisationNewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOfficeSecretary = user.role === 'Office Secretary';
  const [searchParams] = useSearchParams();

  // Office Secretary only — the "create for a Coordinator who's busy" picker.
  const { data: coordinatorData, isPending: coordinatorsLoading, isError: coordinatorsError } = useQuery({
    queryKey: ['mobilisations', 'coordinator-candidates'],
    queryFn: listCoordinatorCandidates,
    enabled: isOfficeSecretary,
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

  if (clientsLoading || subcontractorsLoading || jobTitlesLoading || (isOfficeSecretary && coordinatorsLoading)) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

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
        <PickerLoadWarning
          failed={[
            { label: 'clients', isError: clientsError },
            { label: 'subcontractors', isError: subcontractorsError },
            { label: 'job titles', isError: jobTitlesError },
            ...(isOfficeSecretary ? [{ label: 'coordinators', isError: coordinatorsError }] : []),
          ]}
        />
        <MobilisationForm
          clients={clients}
          subcontractors={subcontractors}
          jobTitles={jobTitles}
          coordinatorCandidates={isOfficeSecretary ? (coordinatorData ?? []) : undefined}
          defaultValues={{ ...emptyMobilisationForm, ...prefillFromSearchParams(searchParams) }}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/mobilisations')}
          submitLabel={t('staffMobilisations.new.submitLabel')}
          submitting={mutation.isPending}
        />
      </Card>
    </div>
  );
}
