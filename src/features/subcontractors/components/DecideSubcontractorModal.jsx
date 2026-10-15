/**
 * DecideSubcontractorModal - approve or reject a pending subcontractor. Approve is one click; Reject needs a short
 * note first, so the person who added it knows what to fix before resubmitting.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decideSubcontractor } from '../subcontractors.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import ApprovalTrailView from '../../../components/shared/ApprovalTrailView.jsx';

export default function DecideSubcontractorModal({ subcontractor, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: (payload) => decideSubcontractor(subcontractor._id, payload),
    onSuccess: (_, payload) => {
      toast.success(
        payload.status === 'Approved'
          ? t('staffSubcontractors.approval.approvedToast', { name: subcontractor.name })
          : t('staffSubcontractors.approval.rejectedToast', { name: subcontractor.name })
      );
      queryClient.invalidateQueries({ queryKey: ['subcontractors'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor', subcontractor._id] });
      onClose();
    },
    onError: (error) => {
      console.error('[subcontractors] decision failed', error);
      toast.error(apiMessage(error));
    },
  });

  function handleClose() {
    setRejecting(false);
    setNote('');
    onClose();
  }

  return (
    <Modal open={Boolean(subcontractor)} onClose={mutation.isPending ? () => {} : handleClose} title={t('staffSubcontractors.approval.modalTitle')}>
      {subcontractor && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-bg p-3">
            <p className="font-medium">{subcontractor.name}</p>
            {(subcontractor.contactPerson || subcontractor.phone || subcontractor.email) && (
              <p className="mt-1 text-xs text-muted">
                {[subcontractor.contactPerson, subcontractor.phone, subcontractor.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <ApprovalTrailView request={subcontractor} pendingStatus="Pending" statusField="approvalStatus" />

          {rejecting ? (
            <>
              <Textarea
                label={t('staffSubcontractors.approval.rejectReasonLabel')}
                placeholder={t('staffSubcontractors.approval.rejectReasonPlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setRejecting(false)} disabled={mutation.isPending}>
                  {t('common.back')}
                </Button>
                <Button
                  icon="close"
                  variant="danger-solid"
                  disabled={!note.trim()}
                  isLoading={mutation.isPending}
                  onClick={() => mutation.mutate({ status: 'Rejected', decisionNote: note.trim() })}
                >
                  {t('staffSubcontractors.approval.confirmRejection')}
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
              <Button icon="check" variant="success-solid" isLoading={mutation.isPending} onClick={() => mutation.mutate({ status: 'Approved' })}>
                {t('common.approve')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
