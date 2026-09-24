import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createLocation } from './locations.api.js';
import { apiMessage } from '../../lib/utils.js';
import { useToast } from '../../components/ui/Toast.jsx';

/**
 * The inline "+ Add new" location quick-create, shared by MobilisationForm
 * and RequirementFormModal — same shape as useJobTitleQuickCreate.js (see
 * its own doc comment for the deferred-selection timing fix this also
 * carries: `setValue` right after the mutation resolves would point the
 * field at a suggestion the invalidated list query hasn't refetched yet).
 *
 * Call this AFTER `useForm()` in the caller — it needs `setValue` already
 * resolved.
 *
 * @param {object} params
 * @param {Array<{name:string}>|undefined} params.locations the caller's own live location list
 * @param {(field:string, value:string, opts?:object) => void} params.setValue react-hook-form's setValue, for the 'site' field
 */
export function useLocationQuickCreate({ locations, setValue }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [addingLocation, setAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [pendingLocation, setPendingLocation] = useState(null);

  const addLocationMutation = useMutation({
    mutationFn: () => createLocation(newLocation.trim()),
    onSuccess: (created) => {
      toast.success(t('staffMobilisations.form.locationAddedToast', { name: created.name }));
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setPendingLocation(created.name);
      setAddingLocation(false);
      setNewLocation('');
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  useEffect(() => {
    if (pendingLocation && locations?.some((l) => l.name === pendingLocation)) {
      setValue('site', pendingLocation, { shouldValidate: true, shouldDirty: true });
      setPendingLocation(null);
    }
  }, [locations, pendingLocation, setValue]);

  return { addingLocation, setAddingLocation, newLocation, setNewLocation, addLocationMutation };
}
