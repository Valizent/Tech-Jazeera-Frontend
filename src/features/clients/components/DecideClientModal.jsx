/**
 * DecideClientModal — approve or reject a Coordinator's pending client
 * submission. Approve is one click (no note needed); Reject needs a short
 * note first, so the Coordinator knows exactly what to fix before
 * resubmitting (see client.service.js decideClient / updateClient).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decideClient } from '../clients.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';

export default function DecideClientModal({ client, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => decideClient(client._id, payload),
    onSuccess: (_, payload) => {
      toast.success(
        payload.status === 'Approved'
          ? t('staffClients.decide.approvedToast', { name: client.companyName })
          : t('staffClients.decide.rejectedToast', { name: client.companyName })
      );
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function handleClose() {
    setRejecting(false);
    setNote('');
    onClose();
  }

  return (
    <Modal open={Boolean(client)} onClose={mutation.isPending ? () => {} : handleClose} title={t('staffClients.decide.modalTitle')}>
      {client && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="font-medium">{client.companyName}</p>
            <p className="text-xs text-muted">
              {t('staffClients.decide.submittedBy', { name: client.createdBy?.name ?? t('staffClients.decide.unknownSubmitter') })}
              {client.industry && ` · ${client.industry}`}
            </p>
            {(client.contactPerson || client.phone || client.email) && (
              <p className="mt-1 text-xs text-muted">
                {[client.contactPerson, client.phone, client.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <ApprovalTrailView request={client} pendingStatus="Pending" statusField="approvalStatus" />

          {rejecting ? (
            <>
              <Textarea
                label={t('staffClients.decide.rejectReasonLabel')}
                placeholder={t('staffClients.decide.rejectReasonPlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setRejecting(false)} disabled={mutation.isPending}>
                  {t('common.back')}
                </Button>
                <Button
                  variant="danger-solid"
                  disabled={!note.trim()}
                  isLoading={mutation.isPending}
                  onClick={() => mutation.mutate({ status: 'Rejected', decisionNote: note.trim() })}
                >
                  {t('staffClients.decide.confirmRejection')}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleClose} disabled={mutation.isPending}>
                {t('common.cancel')}
              </Button>
              <Button icon="close" variant="danger-solid" onClick={() => setRejecting(true)} disabled={mutation.isPending}>
                {t('common.reject')}
              </Button>
              <Button icon="check"
                variant="success-solid"
                isLoading={mutation.isPending}
                onClick={() => mutation.mutate({ status: 'Approved' })}
              >
                {t('common.approve')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
