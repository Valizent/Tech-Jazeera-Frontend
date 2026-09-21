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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createMobilisation, listCoordinatorCandidates } from '../mobilisations.api.js';
import { getRequirement } from '../../requirements/requirements.api.js';
import { emptyMobilisationForm, WORKER_TYPES } from '../mobilisations.schema.js';
import { listClients } from '../../clients/clients.api.js';
import { listSubcontractors } from '../../subcontractors/subcontractors.api.js';
import { listJobTitles } from '../../jobTitles/jobTitles.api.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import PickerLoadWarning from '../../../components/shared/PickerLoadWarning.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
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

/**
 * "Start mobilisation" on a Requirements card's candidate (milestone 3): pre-fill
 * this form from the card and the candidate. Only the two ids arrive in the URL —
 * the card is fetched here — so no worker details ever sit in the address bar, and
 * what's filled in is always the current data. Each card field is used only when it
 * matches a real option in the pickers this page loaded (a client the viewer can
 * see, a job title on the list): an unlisted value would leave a <select> looking
 * empty while secretly holding a string nobody chose. The two ids ride along in
 * the form's create-only `requirement`/`requirementCandidate` fields, which the
 * server verifies before creating anything.
 */
function prefillFromRequirement({ requirement, candidate, clients, subcontractors, jobTitles }) {
  const jobTitle = jobTitles.find((j) => j.name.toLowerCase() === requirement.jobTitle.toLowerCase())?.name ?? '';
  return {
    requirement: requirement._id,
    requirementCandidate: candidate._id,
    workerType: candidate.workerType,
    workerName: candidate.workerName,
    iqamaNumber: candidate.iqamaNumber ?? '',
    nationality: candidate.nationality ?? '',
    ...(candidate.phone && { phone: candidate.phone }),
    subcontractor: subcontractors.some((s) => s._id === candidate.subcontractor) ? candidate.subcontractor : '',
    client: clients.some((c) => c._id === requirement.client) ? requirement.client : '',
    jobTitle,
    site: requirement.site ?? '',
  };
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

  // Arrived from a Requirements card's "Start mobilisation"?
  const requirementId = searchParams.get('requirement');
  const candidateId = searchParams.get('candidate');
  const fromRequirement = Boolean(requirementId && candidateId);
  const { data: requirement, isPending: requirementLoading } = useQuery({
    queryKey: ['requirements', 'detail', requirementId],
    queryFn: () => getRequirement(requirementId),
    enabled: fromRequirement,
  });

  const mutation = useMutation({
    mutationFn: createMobilisation,
    onSuccess: (mobilisation) => {
      toast.success(t('staffMobilisations.new.createdToast'));
      queryClient.invalidateQueries({ queryKey: ['mobilisations'] });
      // The candidate now has a mobilisation — the card and board must show it.
      if (fromRequirement) queryClient.invalidateQueries({ queryKey: ['requirements'] });
      navigate(`/mobilisations/${mobilisation._id}`);
    },
    onError: (error) => {
      console.error('[mobilisations] creating a mobilisation failed', error);
      toast.error(apiMessage(error));
    },
  });

  function handleSubmit(values) {
    mutation.mutate(values);
  }

  if (clientsLoading || subcontractorsLoading || jobTitlesLoading || (isOfficeSecretary && coordinatorsLoading) || (fromRequirement && requirementLoading)) {
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

  // The card + candidate this came from — only if both actually loaded. A card the
  // viewer can't open (or that's gone) means the link is DROPPED, not half-applied:
  // the form still works as an ordinary new mobilisation and says so.
  const candidate = fromRequirement ? (requirement?.candidates?.find((c) => c._id === candidateId) ?? null) : null;
  const linked = Boolean(requirement && candidate);

  // A candidate can have only one mobilisation — send them to it instead of a form
  // the server would refuse (409) on submit.
  if (linked && candidate.mobilisation) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <EmptyState
          title={t('staffMobilisations.new.alreadyStartedTitle', { name: candidate.workerName })}
          description={t('staffMobilisations.new.alreadyStartedDescription', { serial: candidate.mobilisation.serialNumber })}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={`/mobilisations/${candidate.mobilisation._id}`}>
                <Button>{t('staffMobilisations.new.openMobilisation')}</Button>
              </Link>
              <Link to={`/requirements?open=${requirement._id}`}>
                <Button variant="secondary">{t('staffMobilisations.new.backToRequirement')}</Button>
              </Link>
            </div>
          }
        />
      </div>
    );
  }

  const defaultValues = {
    ...emptyMobilisationForm,
    ...(linked ? prefillFromRequirement({ requirement, candidate, clients, subcontractors, jobTitles }) : prefillFromSearchParams(searchParams)),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('staffMobilisations.new.pageTitle')}
        description={t('staffMobilisations.new.pageDescription')}
        onBack={() => navigate(-1)}
      />
      <Card>
        {linked && (
          <p className="mb-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            {t('staffMobilisations.new.fromRequirement', {
              serial: requirement.serialNumber,
              client: requirement.clientName,
              name: candidate.workerName,
            })}
          </p>
        )}
        {fromRequirement && !linked && (
          <p role="alert" className="mb-4 rounded-lg bg-warning/10 p-3 text-sm text-warning">
            {t('staffMobilisations.new.linkUnavailable')}
          </p>
        )}
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
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/mobilisations')}
          submitLabel={t('staffMobilisations.new.submitLabel')}
          submitting={mutation.isPending}
        />
      </Card>
    </div>
  );
}
