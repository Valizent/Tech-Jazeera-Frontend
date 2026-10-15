/**
 * VacationAttachments - the documents attached to an annual vacation while it was approved (air tickets and
 * the like), with the stage each came from and who attached it. Everyone who can see the request sees them,
 * and the employee their own (through `download`). Requests that went through the old travel-documents step
 * also show their day of travel and re-entry visa here, read-only.
 *
 * @param {object} props
 * @param {object} props.request   an annual vacation request as the server returns it
 * @param {{ticket:(id:string,fileId:string,name:string)=>Promise, visa:(id:string,name:string)=>Promise}} props.download
 */
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/ui/Toast.jsx';
import Button from '../../../components/ui/Button.jsx';
import { apiMessage, formatDate, formatFileSize } from '../../../lib/utils.js';

export default function VacationAttachments({ request, download }) {
  const { t } = useTranslation();
  const toast = useToast();
  const files = request.tickets ?? [];
  const visa = request.visaRequest;
  if (files.length === 0 && !request.travelDate && !visa) return null;

  const open = (promise) =>
    promise.catch((error) => {
      console.error('[annualVacation] download failed', error);
      toast.error(apiMessage(error));
    });

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-border/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('staffAnnualVacation.attachments.title')}</p>
      {request.travelDate && (
        <p className="text-sm">
          {t('staffAnnualVacation.attachments.travelDay')}: <span className="font-medium">{formatDate(request.travelDate)}</span>
        </p>
      )}
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file._id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                {file.originalName} <span className="text-xs text-muted">({formatFileSize(file.size)})</span>
                <span className="block text-xs text-muted">
                  {[file.stage, file.uploadedBy, formatDate(file.uploadedAt)].filter(Boolean).join(' · ')}
                </span>
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => open(download.ticket(request._id, file._id, file.originalName))}>
                {t('common.download')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {visa && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>
            {t('staffAnnualVacation.attachments.visa')}
            {visa.status === 'Issued' ? `: ${t('staffAnnualVacation.attachments.visaIssued')}` : ''}
            {visa.visaReferenceNumber ? ` (${visa.visaReferenceNumber})` : ''}
          </span>
          {visa.hasFile && (
            <Button type="button" size="sm" variant="ghost" onClick={() => open(download.visa(request._id, visa.fileName))}>
              {t('common.download')}
            </Button>
          )}
        </p>
      )}
    </div>
  );
}
