import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../features/dashboard/dashboard.api.js';

export function useNavCounts() {
  // Use a fixed 30-day threshold here so we can share the cache with the default Dashboard view
  // if the user hasn't overridden it, or at least have a stable query key for the sidebar/hubs.
  const { data } = useQuery({
    queryKey: ['dashboard', 30],
    queryFn: () => getDashboard(30),
    staleTime: 60_000,
  });

  const badgeCounts = {};
  if (data?.myPendingActions) {
    for (const action of data.myPendingActions) {
      if (action.url) {
        // If an item maps multiple actions to the same URL (e.g. Salary Advances and Reimbursements both go to /financial-requests), sum them up.
        // For query strings (e.g. /daily-updates?tab=tasks), we also map it to the base path if we want the hub card to show it.
        const baseUrl = action.url.split('?')[0];
        
        badgeCounts[action.url] = (badgeCounts[action.url] || 0) + action.count;
        if (baseUrl !== action.url) {
          badgeCounts[baseUrl] = (badgeCounts[baseUrl] || 0) + action.count;
        }
      }
    }
  }

  return badgeCounts;
}
