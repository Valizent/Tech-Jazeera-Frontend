/**
 * DeploymentRedirectPage — `/deployments/:id` forwards to the placement's page,
 * on its Deployment tab. A deployment is not its own page any more (2026-10-12:
 * it is the second tab of the mobilisation it was born from), but the link is
 * still everywhere — dashboard cards, the hours review and invoicing queues,
 * notifications, bookmarks — so it keeps working. Reads the deployment first
 * (the same call, and the same access check, as before) to learn which
 * mobilisation it belongs to.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDeployment } from '../deployments.api.js';
import BackButton from '../../../components/shared/BackButton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function DeploymentRedirectPage() {
  const { id } = useParams();
  const { search } = useLocation();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: deployment, isPending, isError } = useQuery({
    queryKey: ['deployment', id],
    queryFn: () => getDeployment(id),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !deployment?.mobilisation?._id) {
    return (
      <EmptyState
        title={t('staffDeployments.detail.notFoundTitle')}
        description={t('staffDeployments.detail.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/mobilisations')} />}
      />
    );
  }
  const params = new URLSearchParams(search);
  params.set('tab', 'deployment');
  return <Navigate to={`/mobilisations/${deployment.mobilisation._id}?${params}`} replace />;
}
