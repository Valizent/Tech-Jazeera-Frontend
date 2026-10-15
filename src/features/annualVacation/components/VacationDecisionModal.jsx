/**
 * VacationDecisionModal - approve or reject an annual vacation request. A remark (shown with the stage to
 * everyone in the chain and to the employee) and, when approving, any documents to attach (air tickets and the
 * like): they go with the request to the next stage and, on final approval, into the employee's own documents.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { formatFileSize } from '../../../lib/utils.js';

/** Mirror of the server's upload limits (middleware/upload.js). */
const ATTACHMENT_MAX_MB = 10;
const ATTACHMENT_MAX_FILES = 10;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';

/**
 * @param {object} props
 * @param {{req: object, decision: 'Approved'|'Rejected'}|null} props.decision  null = closed
 * @param {boolean} props.saving
 * @param {(payload: {id: string, decision: string, decisionNote: string, files: File[]}) => void} props.onConfirm
 * @param {() => void} props.onClose
 */
export default function VacationDecisionModal({ decision, saving, onConfirm, onClose }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);
  const approving = decision?.decision === 'Approved';

  function close() {
    if (saving) return;
    setNote('');
    setFiles([]);
    onClose();
  }

  function pick(event) {
    const chosen = [...event.target.files];
    event.target.value = '';
    const tooBig = chosen.find((f) => f.size > ATTACHMENT_MAX_MB * 1024 * 1024);
    if (tooBig) {
      toast.error(t('staffAnnualVacation.decision.tooLarge', { name: tooBig.name, max: ATTACHMENT_MAX_MB }));
      return;
    }
    if (files.length + chosen.length > ATTACHMENT_MAX_FILES) {
      toast.error(t('staffAnnualVacation.decision.tooMany', { max: ATTACHMENT_MAX_FILES }));
      return;
    }
    setFiles((current) => [...current, ...chosen]);
  }

  return (
    <Modal open={Boolean(decision)} onClose={close} title={t(approving ? 'staffAnnualVacation.approveTitle' : 'staffAnnualVacation.rejectTitle')}>
      {decision && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {t(approving ? 'staffAnnualVacation.approveMessage' : 'staffAnnualVacation.rejectMessage', { name: decision.req.employee?.fullName })}
          </p>
          <Textarea
            label={t('staffAnnualVacation.decision.remark')}
            placeholder={t('common.optional')}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <p className="-mt-2 text-xs text-muted">{t('staffAnnualVacation.decision.remarkHint')}</p>

          {approving && (
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{t('staffAnnualVacation.decision.documents')}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                  {t('staffAnnualVacation.decision.addFiles')}
                </Button>
              </div>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={pick} className="hidden" />
              {files.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-border/60 p-2">
                  {files.map((file, i) => (
                    <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        {file.name} <span className="text-xs text-muted">({formatFileSize(file.size)})</span>
                      </span>
                      <Button type="button" size="sm" variant="danger-ghost" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}>
                        {t('common.delete')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs text-muted">
                {t('staffAnnualVacation.decision.documentsHint', { max: ATTACHMENT_MAX_MB, count: ATTACHMENT_MAX_FILES })}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={approving ? 'primary' : 'danger'}
              isLoading={saving}
              onClick={() => onConfirm({ id: decision.req._id, decision: decision.decision, decisionNote: note.trim(), files: approving ? files : [] })}
            >
              {t(approving ? 'common.approve' : 'common.reject')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
