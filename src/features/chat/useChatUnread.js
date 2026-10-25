/**
 * The sidebar's unread-messages count. The socket keeps it live; the slow poll and the refetch on focus are the
 * safety net for a network where the socket cannot connect.
 */
import { useQuery } from '@tanstack/react-query';
import { getChatUnreadCount } from './chat.api.js';

export function useChatUnread(enabled) {
  const { data = 0 } = useQuery({
    queryKey: ['chat', 'unread'],
    queryFn: getChatUnreadCount,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  return data;
}
