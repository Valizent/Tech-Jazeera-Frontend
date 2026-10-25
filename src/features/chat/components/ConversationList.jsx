/**
 * ConversationList - the left pane: every conversation you are in, newest activity first, with an unread badge
 * and a preview line. Search filters by name on the page (the list is capped at 100 conversations).
 */
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import { cn, timeAgo } from '../../../lib/utils.js';
import { conversationTitle } from '../chat.utils.js';

function previewText(conversation, myId, t) {
  const last = conversation.lastMessage;
  if (!last) return t('chat.noMessagesYet');
  const body = last.deleted ? t('chat.messageDeleted') : last.snippet || t('chat.attachment');
  return last.senderId === myId ? t('chat.youPrefix', { text: body }) : body;
}

export default function ConversationList({ conversations, isLoading, isError, onRetry, myId }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-6 text-center text-sm">
        <p className="text-muted">{t('chat.loadFailed')}</p>
        <button type="button" className="mt-2 font-medium text-primary hover:underline" onClick={onRetry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-medium">{t('chat.noConversations')}</p>
        <p className="mt-1 text-sm text-muted">{t('chat.noConversationsDescription')}</p>
      </div>
    );
  }

  const needle = query.trim().toLowerCase();
  const shown = needle ? conversations.filter((c) => conversationTitle(c, myId, t).toLowerCase().includes(needle)) : conversations;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3 pb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('chat.searchConversations')}
          aria-label={t('chat.searchConversations')}
          className="h-9 w-full rounded-lg border border-border bg-bg/60 px-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      {shown.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted">{t('common.tryClearingFilters')}</p>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
          {shown.map((conversation) => {
            const title = conversationTitle(conversation, myId, t);
            return (
              <li key={conversation.id}>
                <NavLink
                  to={`/chat/${conversation.id}`}
                  className={({ isActive }) => cn('flex items-center gap-3 px-3 py-3 transition-colors hover:bg-border/30', isActive && 'bg-primary/5')}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-inset ring-primary/20">
                    {title.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-sm', conversation.unread > 0 ? 'font-semibold' : 'font-medium')}>{title}</span>
                      <span className="shrink-0 text-[11px] text-muted">{conversation.lastMessage ? timeAgo(conversation.lastMessage.at) : ''}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-xs', conversation.unread > 0 ? 'text-text' : 'text-muted')}>{previewText(conversation, myId, t)}</span>
                      {conversation.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                          {conversation.unread > 99 ? '99+' : conversation.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
