export interface AriaLiveAnnouncerProps {
  message: string;
}

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * A visually-hidden live region for route/status announcements. Uses
 * aria-live="polite" (paired with role="status") so route-change announcements
 * do not interrupt the user mid-utterance; status/role being consistent avoids
 * the assertive/status contradiction the WFRP source carried.
 */
export function AriaLiveAnnouncer({ message }: AriaLiveAnnouncerProps) {
  return (
    <div aria-live="polite" role="status" style={visuallyHiddenStyle}>
      {message}
    </div>
  );
}
