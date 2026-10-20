import './upstream-badge.css';

/** Marks a provider climb its upstream source no longer lists; it stays searchable and playable. */
export function UpstreamRemovedBadge() {
  return <span className="upstream-badge">Removed upstream</span>;
}
