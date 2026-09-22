import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJobTitle } from './jobTitles.api.js';
import { apiMessage } from '../../lib/utils.js';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * The inline "+ Add new" job-title quick-create used by both
 * MobilisationForm and RequirementFormModal — extracted 2026-09-22 (a real
 * QA-audit finding: the two were a near-exact duplicate, state shape and
 * all). Handles the create mutation AND the auto-select-once-it-exists
 * timing fix: `setValue` right after the mutation resolves would point the
 * field at an `<option>` the invalidated list query hasn't refetched into
 * the DOM yet (silently no-ops) — so selection is deferred to an effect
 * that waits for `jobTitles` (the caller's own list, refreshed by the
 * invalidation below) to actually contain it.
 *
 * Call this AFTER `useForm()` in the caller — it needs `setValue` already
 * resolved, the same ordering constraint each original inline copy had.
 *
 * @param {object} params
 * @param {Array<{name:string}>|undefined} params.jobTitles the caller's own live job-title list
 * @param {(field:string, value:string, opts?:object) => void} params.setValue react-hook-form's setValue, for the 'jobTitle' field
 */
export function useJobTitleQuickCreate({ jobTitles, setValue }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [addingJobTitle, setAddingJobTitle] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [pendingJobTitle, setPendingJobTitle] = useState(null);

  const addJobTitleMutation = useMutation({
    mutationFn: () => createJobTitle(newJobTitle.trim()),
    onSuccess: (created) => {
      toast.success(t('staffMobilisations.form.jobTitleAddedToast', { name: created.name }));
      queryClient.invalidateQueries({ queryKey: ['job-titles'] });
      setPendingJobTitle(created.name);
      setAddingJobTitle(false);
      setNewJobTitle('');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  useEffect(() => {
    if (pendingJobTitle && jobTitles?.some((jt) => jt.name === pendingJobTitle)) {
      setValue('jobTitle', pendingJobTitle, { shouldValidate: true, shouldDirty: true });
      setPendingJobTitle(null);
    }
  }, [jobTitles, pendingJobTitle, setValue]);

  return { addingJobTitle, setAddingJobTitle, newJobTitle, setNewJobTitle, addJobTitleMutation };
}
