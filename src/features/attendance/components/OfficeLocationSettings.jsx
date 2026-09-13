/**
 * OfficeLocationSettings — geofence config for self-marked attendance
 * (P2-M3). A Worker's own "Mark attendance" button is gated on being within
 * `radiusMeters` of this point, or on their request coming from one of
 * `allowedIps` — see docs/P2-M3-notes.md for why this replaces "connect to
 * the office WiFi" (browsers can't read a WiFi network's name).
 *
 * Section Access key 'attendanceOfficeLocation' (was hardcoded Admin-only;
 * split off 2026-09-13). This page previously had only one audience (Admin,
 * who could always edit), so there was no read-only mode at all — now that
 * Read and Write can be granted separately, a Read-only viewer sees the form
 * disabled with no Save button, rather than being able to type into fields
 * a submit would just 403 on.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getOfficeLocation, setOfficeLocation } from '../attendance.api.js';
import {
  officeLocationFormSchema,
  emptyOfficeLocationForm,
  officeLocationToForm,
  formToOfficeLocationPayload,
} from '../officeLocation.schema.js';
import { useDeviceLocation } from '../../../lib/useDeviceLocation.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function OfficeLocationSettings() {
  const toast = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const canWrite = Boolean(user.sectionAccessWrite?.includes('attendanceOfficeLocation'));
  const queryClient = useQueryClient();
  const { locating, getLocation } = useDeviceLocation();

  const { data: location, isPending } = useQuery({
    queryKey: ['office-location'],
    queryFn: getOfficeLocation,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({ resolver: zodResolver(officeLocationFormSchema), defaultValues: emptyOfficeLocationForm });

  useEffect(() => {
    if (location !== undefined) reset(officeLocationToForm(location));
  }, [location, reset]);

  const saveMutation = useMutation({
    mutationFn: (values) => setOfficeLocation(formToOfficeLocationPayload(values)),
    onSuccess: () => {
      toast.success(t('staffAttendance.officeLocation.savedSuccess'));
      queryClient.invalidateQueries({ queryKey: ['office-location'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  async function useMyLocation() {
    const location = await getLocation();
    if (!location) {
      toast.error(t('staffAttendance.officeLocation.locationError'));
      return;
    }
    setValue('lat', String(location.lat));
    setValue('lng', String(location.lng));
    toast.success(t('staffAttendance.officeLocation.locationFilledSuccess'));
  }

  if (isPending) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">{t('staffAttendance.officeLocation.title')}</h2>
      <p className="mb-4 text-sm text-muted">
        {t('staffAttendance.officeLocation.hint')}
        {!location && t('staffAttendance.officeLocation.notConfigured')}
      </p>
      {!canWrite && (
        <p className="mb-4 rounded-lg bg-muted/10 px-3 py-2 text-xs text-muted">{t('staffAttendance.officeLocation.readOnlyHint')}</p>
      )}
      <fieldset disabled={!canWrite} className="space-y-4 disabled:opacity-60">
        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-4">
          <Input label={t('staffAttendance.officeLocation.locationName')} placeholder="Head Office" error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label={`${t('staffAttendance.officeLocation.latitude')} *`} placeholder="24.7136" error={errors.lat?.message} {...register('lat')} />
            <Input label={`${t('staffAttendance.officeLocation.longitude')} *`} placeholder="46.6753" error={errors.lng?.message} {...register('lng')} />
          </div>
          {canWrite && (
            <Button type="button" variant="secondary" size="sm" onClick={useMyLocation} isLoading={locating}>
              {t('staffAttendance.officeLocation.useMyLocation')}
            </Button>
          )}
          <Input
            label={`${t('staffAttendance.officeLocation.allowedRadius')} *`}
            type="number"
            min="10"
            max="5000"
            error={errors.radiusMeters?.message}
            {...register('radiusMeters')}
          />
          <Textarea
            label={t('staffAttendance.officeLocation.officeIps')}
            placeholder={t('staffAttendance.officeLocation.officeIpsPlaceholder')}
            rows={3}
            error={errors.allowedIpsText?.message}
            {...register('allowedIpsText')}
          />
          <p className="text-xs text-muted">{t('staffAttendance.officeLocation.ipsHint')}</p>
          {canWrite && (
            <div className="flex justify-end">
              <Button type="submit" isLoading={saveMutation.isPending}>
                {t('common.save')}
              </Button>
            </div>
          )}
        </form>
      </fieldset>
    </Card>
  );
}
