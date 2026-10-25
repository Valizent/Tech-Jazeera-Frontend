/**
 * ThreadView - the right pane: the messages of one conversation, oldest at the top, the composer underneath.
 *
 * The thread stays glued to the newest message while you are at the bottom (or just sent something) and is left
 * alone while you read older ones; "Load earlier" keeps your place. Opening a conversation with unread messages
 * (and coming back to a hidden tab) marks it read.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ConfirmDialog from '../../../components/shared/ConfirmDialog.jsx';
import BackButton from '../../../components/shared/BackButton.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { apiMessage, formatDate } from '../../../lib/utils.js';
import { deleteChatMessage, listChatMessages, markChatRead } from '../chat.api.js';
import { conversationTitle } from '../chat.utils.js';
import MessageBubble from './MessageBubble.jsx';
import Composer from './Composer.jsx';
import ReportDialog from './ReportDialog.jsx';
import GroupInfoModal from './GroupInfoModal.jsx';

const STICK_THRESHOLD_PX = 120;

export default function ThreadView({ conversation, myId }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);
  const heightBeforeLoadingOlder = useRef(null);
  const [toDelete, setToDelete] = useState(null);
  const [toReport, setToReport] = useState(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const messagesQuery = useInfiniteQuery({
    queryKey: ['chat', 'messages', conversation.id],
    queryFn: ({ pageParam }) => listChatMessages(conversation.id, { before: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
  });

  // Pages arrive newest first; the screen reads oldest first.
  const messages = useMemo(() => (messagesQuery.data ? messagesQuery.data.pages.flatMap((p) => p.items).reverse() : []), [messagesQuery.data]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (heightBeforeLoadingOlder.current !== null) {
      el.scrollTop = el.scrollHeight - heightBeforeLoadingOlder.current; // keep the message you were reading in place
      heightBeforeLoadingOlder.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const markRead = useMutation({
    mutationFn: () => markChatRead(conversation.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'unread'] });
    },
    onError: (error) => console.error('[chat] could not mark as read', error),
  });

  useEffect(() => {
    if (conversation.unread > 0 && document.visibilityState === 'visible' && !markRead.isPending) markRead.mutate();
    // markRead is a fresh object each render; the unread count and conversation are what should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.unread, conversation.id]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && conversation.unread > 0) markRead.mutate();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.unread, conversation.id]);

  const deleteMessage = useMutation({
    mutationFn: (message) => deleteChatMessage(message.id),
    onSuccess: () => {
      toast.success(t('chat.messageDeletedToast'));
      setToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['chat'] });
    },
    onError: (error) => {
      console.error('[chat] delete failed', error);
      toast.error(apiMessage(error));
    },
  });

  function handleScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  }

  function loadEarlier() {
    heightBeforeLoadingOlder.current = scrollRef.current.scrollHeight;
    messagesQuery.fetchNextPage();
  }

  const title = conversationTitle(conversation, myId, t);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <BackButton onClick={() => navigate('/chat')} className="md:hidden" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          {conversation.type === 'group' && (
            <p className="truncate text-xs text-muted">{conversation.members.map((m) => m.name).join(', ')}</p>
          )}
        </div>
        {conversation.type === 'group' && (
          <Button size="sm" variant="secondary" onClick={() => setInfoOpen(true)}>
            {t('chat.groupInfo')}
          </Button>
        )}
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg/40 p-4">
        {messagesQuery.isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="ms-auto h-10 w-1/2" />
            <Skeleton className="h-16 w-3/5" />
          </div>
        )}
        {messagesQuery.isError && (
          <div className="py-8 text-center text-sm">
            <p className="text-muted">{t('chat.loadFailed')}</p>
            <button type="button" className="mt-2 font-medium text-primary hover:underline" onClick={() => messagesQuery.refetch()}>
              {t('common.retry')}
            </button>
          </div>
        )}
        {messagesQuery.hasNextPage && (
          <div className="text-center">
            <Button size="sm" variant="secondary" isLoading={messagesQuery.isFetchingNextPage} onClick={loadEarlier}>
              {t('chat.loadEarlier')}
            </Button>
          </div>
        )}
        {!messagesQuery.isLoading && !messagesQuery.isError && messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">{t('chat.threadEmpty')}</p>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
          const mine = message.senderId === myId;
          return (
            <div key={message.id} className="space-y-3">
              {newDay && <p className="text-center text-xs font-medium text-muted">{formatDate(message.createdAt)}</p>}
              <MessageBubble
                message={message}
                mine={mine}
                showSender={conversation.type === 'group' && (newDay || previous.senderId !== message.senderId)}
                onDelete={setToDelete}
                onReport={setToReport}
              />
            </div>
          );
        })}
      </div>

      <Composer
        key={conversation.id}
        conversationId={conversation.id}
        onSent={() => {
          stickToBottom.current = true;
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title={t('chat.deleteConfirmTitle')}
        message={t('chat.deleteConfirmMessage')}
        confirmLabel={t('chat.delete')}
        loading={deleteMessage.isPending}
        onConfirm={() => deleteMessage.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />
      <ReportDialog message={toReport} onClose={() => setToReport(null)} />
      {conversation.type === 'group' && <GroupInfoModal conversation={conversation} myId={myId} open={infoOpen} onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
