/**
 * VacationTravelDocuments - the travel side of an annual vacation: the day of
 * travel, the air tickets, and the re-entry visa request raised from that day.
 * Everyone who can see the request sees it read-only (and the employee their own,
 * through `download`); the people holding the step that carries the
 * 'TravelDocuments' duty (Accounts) also get the forms to attach the tickets and
 * upload the visa. The request moves on by itself once both are in.
 *
 * @param {object} props
 * @param {object} props.request   an annual vacation request as the server returns it
 * @param {boolean} [props.canAct] true for whoever holds the TravelDocuments step right now
 * @param {{ticket:(id:string,fileId:string,name:string)=>Promise, visa:(id:string,name:string)=>Promise}} props.download
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  attachVacationTickets,
  removeVacationTicket,
  uploadVacationVisa,
  VACATION_QUEUE_KEY,
} from '../annualVacation.api.js';
import { apiMessage, formatDate, formatFileSize } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';

const FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';
const dateOnly = (value) => (value ? String(value).slice(0, 10) : '');

export default function VacationTravelDocuments({ request, canAct = false, download }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [travelDate, setTravelDate] = useState(dateOnly(request.travelDate) || dateOnly(request.startDate));
  const [tickets, setTickets] = useState([]);
  const [visaFile, setVisaFile] = useState(null);
  const [visaReference, setVisaReference] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: VACATION_QUEUE_KEY });
  const onError = (error) => {
    console.error('[annualVacation] travel documents failed', error);
    toast.error(apiMessage(error));
  };

  const attachMutation = useMutation({
    mutationFn: () => attachVacationTickets(request._id, { files: tickets, travelDate }),
    onSuccess: () => {
      toast.success(t('staffAnnualVacation.travel.attachedToast'));
      setTickets([]);
      refresh();
    },
    onError,
  });
  const removeMutation = useMutation({
    mutationFn: (fileId) => removeVacationTicket(request._id, fileId),
    onSuccess: refresh,
    onError,
  });
  const visaMutation = useMutation({
    mutationFn: () => uploadVacationVisa(request._id, { file: visaFile, visaReferenceNumber: visaReference }),
    onSuccess: () => {
      toast.success(t('staffAnnualVacation.travel.visaUploadedToast'));
      setVisaFile(null);
      setVisaReference('');
      refresh();
    },
    onError,
  });

  const visa = request.visaRequest;
  const issued = visa?.status === 'Issued';

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border/60 bg-border/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t('staffAnnualVacation.travel.title')}</p>

      {request.travelDate && (
        <p className="text-sm">
          {t('staffAnnualVacation.travel.travelDay')}: <span className="font-medium">{formatDate(request.travelDate)}</span>
        </p>
      )}

      <div>
        <p className="text-xs font-medium text-muted">{t('staffAnnualVacation.travel.tickets')}</p>
        {request.tickets?.length ? (
          <ul className="mt-1 space-y-1">
            {request.tickets.map((ticket) => (
              <li key={ticket._id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {ticket.originalName} <span className="text-xs text-muted">({formatFileSize(ticket.size)})</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => download.ticket(request._id, ticket._id, ticket.originalName).catch(onError)}>
                    {t('common.download')}
                  </Button>
                  {canAct && (
                    <Button type="button" size="sm" variant="danger-ghost" onClick={() => removeMutation.mutate(ticket._id)}>
                      {t('common.delete')}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('staffAnnualVacation.travel.noTickets')}</p>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted">{t('staffAnnualVacation.travel.visa')}</p>
        {!visa ? (
          <p className="text-sm text-muted">{t('staffAnnualVacation.travel.visaNotRaised')}</p>
        ) : issued ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {t('staffAnnualVacation.travel.visaIssued')}
              {visa.visaReferenceNumber ? ` (${visa.visaReferenceNumber})` : ''}
            </span>
            {visa.hasFile && (
              <Button type="button" size="sm" variant="ghost" onClick={() => download.visa(request._id, visa.fileName).catch(onError)}>
                {t('common.download')}
              </Button>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted">
            {t('staffAnnualVacation.travel.visaWaiting', { from: formatDate(visa.departureDate), to: formatDate(visa.expectedReturnDate) })}
          </p>
        )}
      </div>

      {canAct && (
        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('staffAnnualVacation.travel.travelDay')} type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t('staffAnnualVacation.travel.tickets')}</label>
              <input
                type="file"
                multiple
                accept={FILE_TYPES}
                onChange={(e) => setTickets([...e.target.files])}
                className="text-sm"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            isLoading={attachMutation.isPending}
            disabled={!travelDate || (tickets.length === 0 && !request.tickets?.length)}
            onClick={() => attachMutation.mutate()}
          >
            {t('staffAnnualVacation.travel.attach')}
          </Button>

          {visa && !issued && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{t('staffAnnualVacation.travel.visaDocument')}</label>
                <input type="file" accept={FILE_TYPES} onChange={(e) => setVisaFile(e.target.files[0] ?? null)} className="text-sm" />
              </div>
              <Input label={t('staffAnnualVacation.travel.visaReference')} value={visaReference} onChange={(e) => setVisaReference(e.target.value)} />
              <div className="sm:col-span-2">
                <Button type="button" size="sm" isLoading={visaMutation.isPending} disabled={!visaFile} onClick={() => visaMutation.mutate()}>
                  {t('staffAnnualVacation.travel.uploadVisa')}
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted">{t('staffAnnualVacation.travel.movesOnItsOwn')}</p>
        </div>
      )}
    </div>
  );
}
