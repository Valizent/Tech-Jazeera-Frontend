/**
 * Composer - the box under a thread: text (Enter sends, Shift+Enter adds a line) and one optional attachment
 * (an image or a PDF, up to 10 MB). A failed send keeps what was typed so nothing is lost.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../../../components/ui/Button.jsx';
import Icon from '../../../components/ui/Icon.jsx';
import { useToast } from '../../../components/ui/Toast.jsx';
import { RECEIPT_ACCEPT, RECEIPT_MAX_MB } from '../../../lib/constants.js';
import { apiMessage, formatFileSize } from '../../../lib/utils.js';
import { sendChatMessage } from '../chat.api.js';

const PAPERCLIP =
  'M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13';
const SEND = 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5';

export default function Composer({ conversationId, onSent }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);

  const send = useMutation({
    mutationFn: () => sendChatMessage(conversationId, { body: text.trim(), file }),
    onSuccess: () => {
      setText('');
      setFile(null);
      onSent();
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
    onError: (error) => {
      console.error('[chat] send failed', error);
      toast.error(apiMessage(error, t('chat.sendFailed')));
    },
  });

  const canSend = (text.trim() || file) && !send.isPending;

  function handleFileChange(event) {
    const picked = event.target.files?.[0];
    event.target.value = ''; // picking the same file again must still fire
    if (!picked) return;
    if (!RECEIPT_ACCEPT.split(',').includes(picked.type)) {
      toast.error(t('chat.wrongFileType'));
      return;
    }
    if (picked.size > RECEIPT_MAX_MB * 1024 * 1024) {
      toast.error(t('chat.fileTooLarge', { max: RECEIPT_MAX_MB }));
      return;
    }
    setFile(picked);
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) send.mutate();
    }
  }

  return (
    <div className="border-t border-border bg-surface p-3">
      {file && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 py-1.5 text-sm">
          <Icon d={PAPERCLIP} className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-muted">{formatFileSize(file.size)}</span>
          <button type="button" className="shrink-0 text-xs font-medium text-danger hover:underline" onClick={() => setFile(null)}>
            {t('chat.removeAttachment')}
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <input ref={fileInput} type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={handleFileChange} />
        <Button variant="secondary" aria-label={t('chat.attach')} title={t('chat.attach')} onClick={() => fileInput.current?.click()}>
          <Icon d={PAPERCLIP} />
        </Button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4000}
          placeholder={t('chat.typeMessage')}
          aria-label={t('chat.typeMessage')}
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button aria-label={t('chat.send')} title={t('chat.send')} disabled={!canSend} isLoading={send.isPending} onClick={() => send.mutate()}>
          <Icon d={SEND} className="rtl:-scale-x-100" />
        </Button>
      </div>
    </div>
  );
}
