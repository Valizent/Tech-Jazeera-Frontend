/**
 * ChatPage - conversations on one side, the open thread on the other. On a phone-width screen only one shows at
 * a time: the list at /chat, the thread at /chat/:id (a push notification opens that address).
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import { cn } from '../../../lib/utils.js';
import { listConversations } from '../chat.api.js';
import ConversationList from '../components/ConversationList.jsx';
import ThreadView from '../components/ThreadView.jsx';
import NewChatModal from '../components/NewChatModal.jsx';

export default function ChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [newChatOpen, setNewChatOpen] = useState(false);

  const conversationsQuery = useQuery({ queryKey: ['chat', 'conversations'], queryFn: listConversations });
  const conversations = conversationsQuery.data ?? [];
  const selected = id ? conversations.find((c) => c.id === id) : null;
  const canModerate = user.role === 'Admin' || user.sectionAccessWrite?.includes('chatModeration');

  let thread;
  if (!id) {
    thread = (
      <div className="grid h-full place-items-center p-6">
        <EmptyState title={t('chat.selectConversationTitle')} description={t('chat.selectConversationDescription')} />
      </div>
    );
  } else if (selected) {
    thread = <ThreadView key={selected.id} conversation={selected} myId={user.id} />;
  } else if (conversationsQuery.isLoading) {
    thread = (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else {
    thread = (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          title={t('chat.notFoundTitle')}
          description={t('chat.notFoundDescription')}
          action={<BackButton onClick={() => navigate('/chat')} />}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-sm sm:h-[calc(100dvh-8rem)]">
      <aside className={cn('flex min-h-0 w-full flex-col border-border md:w-80 md:border-e lg:w-96', id && 'hidden md:flex')}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold">{t('chat.title')}</h1>
          <div className="flex items-center gap-2">
            {canModerate && (
              <Link to="/chat/reports">
                <Button size="sm" variant="secondary">
                  {t('chat.reportsLink')}
                </Button>
              </Link>
            )}
            <Button size="sm" variant="success-solid" icon="plus" onClick={() => setNewChatOpen(true)}>
              {t('chat.newChat')}
            </Button>
          </div>
        </div>
        <ConversationList
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          isError={conversationsQuery.isError}
          onRetry={() => conversationsQuery.refetch()}
          myId={user.id}
        />
      </aside>

      <section className={cn('min-h-0 min-w-0 flex-1', !id && 'hidden md:block')}>{thread}</section>

      <NewChatModal open={newChatOpen} onClose={() => setNewChatOpen(false)} />
    </div>
  );
}
