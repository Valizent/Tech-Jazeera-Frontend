/**
 * FinancialHubPage — the Financial section's own landing page. Plain
 * directory passthrough (the live "N overdue" badge this page used to carry
 * was Invoice-specific — removed 2026-09-27 alongside the Invoice module
 * itself; see docs/CHANGELOG.md).
 */
import SectionHubPage from '../../components/shared/SectionHubPage.jsx';
import { NAV_GROUPS } from '../navConfig.js';

const group = NAV_GROUPS.find((g) => g.key === 'financial');

export default function FinancialHubPage() {
  return (
    <SectionHubPage title={group.label} titleKey={group.labelKey} description={group.description} descriptionKey={group.descriptionKey} items={group.items} />
  );
}
