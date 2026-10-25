/**
 * The chat real-time connection - mounted once in the staff shell (DashboardLayout) so the sidebar badge and
 * any open conversation update the moment something happens.
 *
 * The socket carries no message content, only "conversation X changed" (see server chat.socket.js), and this
 * answers by re-fetching over the normal authenticated API. If the socket cannot connect (a blocking network,
 * Nginx not yet configured) nothing breaks: the unread badge still polls (useChatUnread) and the open thread
 * refetches on focus; this just reconnects with a growing delay in the background.
 *
 * Close code 4401 means "the access token ran out or is no longer valid": one cheap authenticated request lets
 * axios refresh it, then the socket reconnects with the new token.
 */
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../../lib/constants.js';
import { getAccessToken } from '../../lib/axios.js';
import { getChatUnreadCount } from './chat.api.js';

const CLOSE_UNAUTHORIZED = 4401;
const MAX_DELAY_MS = 30_000;
const REAUTH_LOOP_GUARD_MS = 10_000;

/** wss://<api host>/ws, derived from the API's own address so one setting (VITE_API_URL) covers both. */
function socketUrl() {
  const url = new URL(API_URL, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

export function useChatSocket(enabled) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    let socket = null;
    let retryTimer = null;
    let attempt = 0;
    let lastAuthFailure = 0;
    let stopped = false;

    const refetchAll = () => queryClient.invalidateQueries({ queryKey: ['chat'] });

    function scheduleReconnect() {
      attempt += 1;
      const delay = Math.min(MAX_DELAY_MS, 1000 * 2 ** Math.min(attempt, 5));
      retryTimer = setTimeout(connect, delay);
    }

    function connect() {
      if (stopped) return;
      const token = getAccessToken();
      if (!token) return scheduleReconnect();

      socket = new WebSocket(socketUrl());
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
      socket.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message.type === 'ready') {
          attempt = 0;
          refetchAll(); // whatever happened while we were disconnected
        } else if (message.type === 'resync') {
          refetchAll();
        } else if (message.type === 'conversation.changed') {
          queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
          queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
          queryClient.invalidateQueries({ queryKey: ['chat', 'messages', message.conversationId] });
        }
      };
      socket.onclose = async (event) => {
        socket = null;
        if (stopped) return;
        if (event.code === CLOSE_UNAUTHORIZED && Date.now() - lastAuthFailure > REAUTH_LOOP_GUARD_MS) {
          lastAuthFailure = Date.now();
          try {
            await getChatUnreadCount(); // a 401 here makes axios refresh the token
          } catch (error) {
            console.error('[chat] could not refresh the session for the live connection', error);
          }
          return connect();
        }
        scheduleReconnect();
      };
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [queryClient, enabled]);
}
