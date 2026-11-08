import { useEffect, useState } from 'react';

/**
 * Shows every image in src/assets/references/<topic>/ (sorted by file name) as a
 * small thumbnail; click → full-screen view (click anywhere or Esc to close).
 * import.meta.glob is resolved by Vite at build time, so the folder must be a
 * literal path — one entry per topic below.
 */
const BY_TOPIC: Record<string, Record<string, string>> = {
  idempotency: import.meta.glob('../assets/references/idempotency/*.{png,jpg,jpeg,webp,gif,svg}', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
};

export function ReferenceImages({ topic }: { topic: keyof typeof BY_TOPIC }) {
  const images = Object.entries(BY_TOPIC[topic] ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (images.length === 0) {
    return (
      <p className="empty">
        No reference image yet — drop one into <code>apps/web/src/assets/references/{topic}/</code>
      </p>
    );
  }

  return (
    <div className="thumbs">
      {images.map(([path, url]) => {
        const name = path.split('/').pop()!;
        return (
          <figure key={path} className="thumb">
            <button type="button" onClick={() => setOpen(url)} title="View full screen">
              <img src={url} alt={`${topic} reference: ${name}`} />
            </button>
            <figcaption>{name}</figcaption>
          </figure>
        );
      })}
      {open && (
        <div className="lightbox" role="dialog" aria-label="Reference image" onClick={() => setOpen(null)}>
          <img src={open} alt="" />
          <span className="lightbox-hint">click or Esc to close</span>
        </div>
      )}
    </div>
  );
}
