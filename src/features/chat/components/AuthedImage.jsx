/**
 * AuthedImage - an <img> for a private file. The file is fetched through the authenticated API as a Blob (a plain
 * <img src> cannot carry the in-memory access token) and shown from an object URL that is released on unmount.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Skeleton from '../../../components/ui/Skeleton.jsx';

export default function AuthedImage({ fileId, fetchBlob, alt, className, onClick }) {
  const { t } = useTranslation();
  const [state, setState] = useState({ url: null, failed: false });

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    fetchBlob(fileId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, failed: false });
      })
      .catch((error) => {
        console.error('[chat] could not load the image', error);
        if (!cancelled) setState({ url: null, failed: true });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, fetchBlob]);

  if (state.failed) return <p className="text-xs text-muted">{t('chat.imageUnavailable')}</p>;
  if (!state.url) return <Skeleton className="h-40 w-56 max-w-full" />;
  const image = <img src={state.url} alt={alt} className={className} />;
  return onClick ? (
    <button type="button" onClick={onClick} className="block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
      {image}
    </button>
  ) : (
    image
  );
}
