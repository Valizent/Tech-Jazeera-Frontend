import { useQuery } from '@tanstack/react-query';
import { listEmployees } from '../features/employees/employees.api.js';

/**
 * Shared "pick an employee" query — the first 100, sorted by name — reused
 * by every module that just needs a plain employee dropdown/list
 * (Attendance, Assets, EOSB, Timesheet Processor). One consistent query key
 * so these identical requests share a single cache entry instead of each
 * caller re-fetching independently. Pass `{ enabled }` the same way you
 * would to useQuery directly when the picker shouldn't fetch yet (e.g. a
 * modal that isn't open, or a viewer without write access).
 */
export function useEmployeePicker(options = {}) {
  return useQuery({
    queryKey: ['employees', 'picker'],
    queryFn: () => listEmployees({ limit: 100, sortBy: 'fullName', sortOrder: 'asc' }),
    ...options,
  });
}
