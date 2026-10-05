/**
 * Edit client — loads the record, maps it to form values, saves a patch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { getClient, updateClient } from '../clients.api.js';
import { clientToForm, formToPayload } from '../clients.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import ClientForm from '../components/ClientForm.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

export default function ClientEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: client, isPending, isError } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id),
  });

  const mutation = useMutation({
    mutationFn: (values) => updateClient(id, formToPayload(values)),
    onSuccess: (updated) => {
      toast.success(t('staffClients.edit.updatedToast', { name: updated.companyName }));
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      navigate(`/clients/${id}`);
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        title={t('staffClients.edit.notFoundTitle')}
        description={t('staffClients.edit.notFoundDescription')}
        action={<BackButton onClick={() => navigate('/clients')} />}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader title={t('staffClients.edit.pageTitlePrefix', { name: client.companyName })} onBack={() => navigate(-1)} />
      <ClientForm
        defaultValues={clientToForm(client)}
        onSubmit={(values) => mutation.mutate(values)}
        submitLabel={t('staffClients.edit.submitLabel')}
        submitting={mutation.isPending}
        client={client}
      />
    </div>
  );
}
