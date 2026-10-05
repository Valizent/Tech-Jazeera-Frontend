/**
 * New client — header + ClientForm + create mutation.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createClient } from '../clients.api.js';
import { emptyClientForm, formToPayload } from '../clients.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import ClientForm from '../components/ClientForm.jsx';

export default function ClientNewPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values) => createClient(formToPayload(values)),
    onSuccess: (client) => {
      toast.success(t('staffClients.new.addedToast', { name: client.companyName }));
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clients/${client._id}`, { replace: true });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={t('staffClients.new.pageTitle')}
        description={t('staffClients.new.pageDescription')}
        onBack={() => navigate(-1)}
      />
      <ClientForm
        defaultValues={emptyClientForm}
        onSubmit={(values) => mutation.mutate(values)}
        submitLabel={t('staffClients.new.submitLabel')}
        submitting={mutation.isPending}
      />
    </div>
  );
}
