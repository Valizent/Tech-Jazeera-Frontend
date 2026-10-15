/**
 * ConfirmDialog — the mandatory gate in front of every destructive action,
 * and (confirmVariant='primary') the "are you sure?" precautionary gate in
 * front of an Approve/Reject decision — cheap insurance against a stray
 * click on an action that can't be undone from the UI.
 * Never wire a delete or decide button straight to a mutation; route it
 * through here.
 */
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmVariant = 'danger-solid',
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <Modal open={open} onClose={loading ? () => {} : onCancel} title={title}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} isLoading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
