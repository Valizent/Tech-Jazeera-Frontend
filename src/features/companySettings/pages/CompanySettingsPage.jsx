/**
 * CompanySettingsPage — the company's own legal/contact/bank identity, used
 * as the letterhead on every generated PDF (invoices, quotations, EOSB
 * settlements, certificates, payslips). Edit access is dynamic (Admin, plus
 * whoever an Admin has granted via the Section Access page's
 * 'companySettings' section), so this page is visible to every staff role
 * in the nav and a non-eligible viewer sees this page's own explained 403,
 * not a route redirect — same pattern as the Approval Log. Who gets that
 * grant is configured entirely on the Section Access page now, not here.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanySettings, updateCompanySettings } from '../companySettings.api.js';
import { companySettingsFormSchema, companySettingsToForm } from '../companySettings.schema.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import PageHeader from '../../../components/shared/PageHeader.jsx';
import Card from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import CompanyLogoCard from '../components/CompanyLogoCard.jsx';

function Field({ name, label, register, errors, type = 'text' }) {
  return <Input label={label} type={type} error={errors[name]?.message} {...register(name)} />;
}

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isPending, isError, error } = useQuery({
    queryKey: ['company-settings'],
    queryFn: getCompanySettings,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(companySettingsFormSchema), defaultValues: companySettingsToForm(null) });

  useEffect(() => {
    if (settings) reset(companySettingsToForm(settings));
  }, [settings, reset]);

  const saveMutation = useMutation({
    mutationFn: updateCompanySettings,
    onSuccess: () => {
      toast.success('Company settings saved.');
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
      // BrandLogo's header/login-screen branding is a separate, public query
      // (different endpoint, deliberately no Section Access gate — see
      // companySettings.routes.js) — invalidate it too so a name change
      // shows up immediately instead of waiting out its 5-minute staleTime.
      queryClient.invalidateQueries({ queryKey: ['company-branding'] });
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Company Settings" onBack={() => navigate(-1)} />
        <EmptyState
          title="You don't have access to this page"
          description={apiMessage(error) || 'Company settings can only be managed by Admin, Manager, or a role added to the access list.'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Company Settings"
        description="Your company's own identity — printed as the letterhead on every generated document."
        onBack={() => navigate(-1)}
      />

      <CompanyLogoCard />

      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate className="space-y-6">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Legal identity</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="companyName" label="Company name (English)" register={register} errors={errors} />
            <Field name="companyNameAr" label="Company name (Arabic)" register={register} errors={errors} />
            <Field name="crNumber" label="CR number" register={register} errors={errors} />
            <Field name="vatNumber" label="VAT registration number" register={register} errors={errors} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Contact & address</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="address" label="Address" register={register} errors={errors} />
            <Field name="phone" label="Phone" register={register} errors={errors} />
            <Field name="email" label="Email" type="email" register={register} errors={errors} />
            <Field name="website" label="Website" register={register} errors={errors} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Bank details</h2>
          <p className="mb-4 text-xs text-muted">Shown as payment instructions on an unpaid invoice.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="bankName" label="Bank name" register={register} errors={errors} />
            <Field name="bankIban" label="IBAN" register={register} errors={errors} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">Authorized signatory</h2>
          <p className="mb-4 text-xs text-muted">Printed on certificates and official letters.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="signatoryName" label="Name" register={register} errors={errors} />
            <Field name="signatoryTitle" label="Title" register={register} errors={errors} />
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={saveMutation.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}
