/**
 * VacationDaysEditor - HR changing the number of days of ONE request at the HR
 * step, with the reason (usually what the employee asked for in the notes). The
 * contract's days stay on the employee record; only this request changes.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { changeVacationDays, VACATION_QUEUE_KEY } from '../annualVacation.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';

export default function VacationDaysEditor({ request }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(String(request.requestedDays));
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => changeVacationDays(request._id, { requestedDays: Number(days), ...(note.trim() && { note: note.trim() }) }),
    onSuccess: () => {
      toast.success(t('staffAnnualVacation.daysChangedToast'));
      setOpen(false);
      setNote('');
      queryClient.invalidateQueries({ queryKey: VACATION_QUEUE_KEY });
    },
    onError: (error) => {
      console.error('[annualVacation] changing the days failed', error);
      toast.error(apiMessage(error));
    },
  });

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => setOpen(true)}>
        {t('staffAnnualVacation.changeDays')}
      </Button>
    );
  }

  const valid = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90 && Number(days) !== request.requestedDays;
  return (
    <div className="mt-2 grid grid-cols-1 gap-3 rounded-lg border border-border/60 p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
      <Input label={t('staffAnnualVacation.newDays')} type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} />
      <Input label={t('staffAnnualVacation.changeNote')} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" isLoading={mutation.isPending} disabled={!valid} onClick={() => mutation.mutate()}>
          {t('staffAnnualVacation.saveDays')}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
