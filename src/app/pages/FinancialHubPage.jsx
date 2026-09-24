/**
 * FinancialHubPage — the Financial section's own landing page. Attaches a
 * live "N overdue" badge to the Invoices card (2026-09-24, a real UX gap:
 * this hub used to be a dead directory with zero live numbers) by reusing
 * the existing invoice list endpoint's own `overdue` filter + `total` count
 * — no new endpoint, same definition of "overdue" the list page and the
 * background job both already use.
 */
import { useQuery } from '@tanstack/react-query';
import SectionHubPage from '../../components/shared/SectionHubPage.jsx';
import { useAuth } from '../../features/auth/AuthContext.jsx';
import { listInvoices } from '../../features/invoices/invoices.api.js';
import { NAV_GROUPS } from '../navConfig.js';

const group = NAV_GROUPS.find((g) => g.key === 'financial');

export default function FinancialHubPage() {
  const { user } = useAuth();
  const canReadInvoices = Boolean(user.sectionAccess?.includes('invoices'));

  const { data } = useQuery({
    queryKey: ['invoices', 'overdue-count'],
    queryFn: () => listInvoices({ overdue: true, limit: 1 }),
    enabled: canReadInvoices,
  });
  const overdueCount = data?.total ?? 0;

  const items = group.items.map((item) => (item.to === '/invoices' && overdueCount > 0 ? { ...item, badgeCount: overdueCount } : item));

  return (
    <SectionHubPage title={group.label} titleKey={group.labelKey} description={group.description} descriptionKey={group.descriptionKey} items={items} />
  );
}
