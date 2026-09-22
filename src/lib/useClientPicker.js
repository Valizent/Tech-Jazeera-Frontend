import { useQuery } from '@tanstack/react-query';
import { listClients } from '../features/clients/clients.api.js';

/**
 * Shared "pick a client" query — the first 100, sorted by name — reused by
 * every module that just needs a plain client dropdown (Documents' owner
 * picker, Expenses' client picker). One consistent query key so these
 * identical requests share a single cache entry instead of each caller
 * re-fetching independently (2026-09-22, a real QA-audit finding — P9:
 * `['ownerPicker','Client']` and `['clients','all-for-expense']` were two
 * separate cache entries for the exact same endpoint/params/shape). Mirrors
 * `useEmployeePicker.js`'s own precedent exactly. Deliberately NOT reused
 * by `DeploymentListPage`'s own client filter — that one calls
 * `listClients({ limit: 100 })` with no explicit sort, a genuinely
 * different query shape, so it stays on its own key.
 */
export function useClientPicker(options = {}) {
  return useQuery({
    queryKey: ['clients', 'picker'],
    queryFn: () => listClients({ limit: 100, sortBy: 'companyName', sortOrder: 'asc' }),
    ...options,
  });
}
