/**
 * CompanyLogoCard — upload/replace/remove the company logo, embedded at the
 * top of the Timesheet Processor's exported .xlsx AND every generated PDF's
 * letterhead (invoices, quotations, EOSB settlements, certificates,
 * payslips — see server's companySettings/letterhead.pdf.js). Lives on the
 * Company Settings page; whoever can reach that page can manage the logo.
 */
import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanySettings, uploadCompanyLogo, removeCompanyLogo } from '../companySettings.api.js';
import { apiMessage } from '../../../lib/utils.js';
import { useToast } from '../../../components/ui/Toast.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';

const MAX_MB = 2;
const ACCEPT = 'image/png,image/jpeg,image/webp';

export default function CompanyLogoCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [formError, setFormError] = useState(null);

  const { data, isPending } = useQuery({
    queryKey: ['company-settings'],
    queryFn: getCompanySettings,
  });

  // Also invalidates 'company-branding' — BrandLogo's separate, public
  // query (header/login-screen logo) — so a logo change shows up
  // immediately instead of waiting out its 5-minute staleTime.
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    queryClient.invalidateQueries({ queryKey: ['company-branding'] });
  };

  const uploadMutation = useMutation({
    mutationFn: uploadCompanyLogo,
    onSuccess: () => {
      toast.success('Logo updated.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
    onSettled: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeCompanyLogo,
    onSuccess: () => {
      toast.success('Logo removed.');
      invalidate();
    },
    onError: (error) => toast.error(apiMessage(error)),
  });

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    if (file.size > MAX_MB * 1024 * 1024) {
      setFormError(`Image is too large (maximum ${MAX_MB} MB).`);
      e.target.value = '';
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <Card className="mb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Company logo</h2>
          <p className="mt-1 text-xs text-muted">
            Shown on every generated document — invoices, quotations, settlements, certificates, payslips, and
            exported timesheets. PNG, JPG, or WEBP up to {MAX_MB} MB.
          </p>
        </div>

        {isPending ? (
          <Skeleton className="h-16 w-40" />
        ) : (
          <div className="flex items-center gap-4">
            {data?.logoUrl ? (
              <img
                src={data.logoUrl}
                alt="Company logo"
                className="h-16 max-w-[200px] rounded-lg border border-border bg-surface object-contain p-1"
              />
            ) : (
              <span className="text-sm text-muted">No logo set — exports skip the logo band.</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="secondary"
              isLoading={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {data?.logoUrl ? 'Replace' : 'Upload logo'}
            </Button>
            {data?.logoUrl && (
              <Button
                type="button"
                variant="danger-ghost"
                isLoading={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}
              >
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
      {formError && (
        <p role="alert" className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {formError}
        </p>
      )}
    </Card>
  );
}
