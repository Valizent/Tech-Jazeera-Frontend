/**
 * Icon — a single-path outline icon (the plain SVG shape every nav/hub/tile
 * icon in this app already used, `strokeLinecap`/`strokeLinejoin: round`,
 * `strokeWidth: 1.5`, `currentColor`). Extracted 2026-09-22 (a real QA-audit
 * finding): DashboardLayout/EssLayout's own `NavIcon` and SectionHubPage/
 * SectionAccessPage's own `ItemIcon`/`GridTileIcon` were four byte-for-byte
 * identical copies of this, differing only in size.
 *
 * `d` is an SVG path's `d` attribute (see navConfig.js's icon strings).
 * `size` picks the Tailwind height/width pair; defaults to the nav-icon size.
 */
const SIZES = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
};

export default function Icon({ d, size = 'sm', className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`${SIZES[size]} ${className}`.trim()}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
