import { useCallback, useEffect, useState } from 'react';
import { ScrollText, Users, Settings, User, Swords, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { DmPage } from '../../logic/dm-mode';
import { useDmData } from '../../hooks/useDmData';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { PageContainer } from '../layout/PageContainer';
import { Toast } from '../shared/Toast';
import { AriaLiveAnnouncer } from '../shared/AriaLiveAnnouncer';
import { UpdateBanner } from '../shared/UpdateBanner';
import { CampaignPage } from './CampaignPage';
import { PartyPage } from './PartyPage';
import { EncounterPage } from './EncounterPage';
import { LibraryPage } from './LibraryPage';
import { DmSettingsPage } from './DmSettingsPage';
import navStyles from '../layout/Navigation.module.css';
import appStyles from '../../App.module.css';
import styles from './dm.module.css';

interface DmShellProps {
  page: DmPage;
  onNavigate: (page: DmPage) => void;
  /** Leave the DM workspace for the player's own characters. */
  onOpenPlayer: () => void;
  onTurnOff: () => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

interface DmNavItem {
  id: DmPage;
  label: string;
  icon: LucideIcon;
  shortcut: string;
}

const DM_NAV: DmNavItem[] = [
  { id: 'campaign', label: 'Campaign', icon: ScrollText, shortcut: '1' },
  { id: 'party', label: 'Party', icon: Users, shortcut: '2' },
  { id: 'encounter', label: 'Encounter', icon: Swords, shortcut: '3' },
  { id: 'library', label: 'Library', icon: BookOpen, shortcut: '4' },
  { id: 'settings', label: 'Settings', icon: Settings, shortcut: '5' },
];

/**
 * The Dungeon Master workspace: its own navigation and pages, shown instead of
 * the player sheet while DM mode is on. DM data lives in its own store.
 */
export function DmShell({ page, onNavigate, onOpenPlayer, onTurnOff, theme, onThemeToggle }: DmShellProps) {
  const dm = useDmData();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const notify = useCallback((text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })), []);

  // Number-key shortcuts, ignored while typing in a form field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const item = DM_NAV.find((n) => n.shortcut === e.key);
      if (item) onNavigate(item.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNavigate]);

  const activeLabel = DM_NAV.find((n) => n.id === page)?.label ?? '';

  const navButton = (item: DmNavItem) => {
    const active = item.id === page;
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        className={active ? navStyles.navItemActive : navStyles.navItem}
        onClick={() => onNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        data-section={item.id}
      >
        <span className={navStyles.iconWrapper}>
          <Icon size={18} />
        </span>
        {isMobile ? <span className={navStyles.mobileLabelRow}>{item.label}</span> : <span>{item.label}</span>}
      </button>
    );
  };

  const playerButton = (
    <button type="button" className={navStyles.navItem} onClick={onOpenPlayer} data-section="my-characters">
      <span className={navStyles.iconWrapper}>
        <User size={18} />
      </span>
      {isMobile ? <span className={navStyles.mobileLabelRow}>My characters</span> : <span>My characters</span>}
    </button>
  );

  return (
    <div className={`${appStyles.app} screen-only`} data-testid="dm-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <nav className={navStyles.sidebar} aria-label="Dungeon Master navigation">
        {!isMobile && (
          <div className={navStyles.appTitle}>
            <span className={navStyles.appTitleText}>
              ⚔ D&amp;D 5.5e <span className={styles.dmBadge}>DM</span>
            </span>
          </div>
        )}
        {isMobile ? (
          <div className={navStyles.mobileScrollRow}>
            {DM_NAV.map(navButton)}
            {playerButton}
          </div>
        ) : (
          <>
            {DM_NAV.map(navButton)}
            {playerButton}
          </>
        )}
      </nav>

      <PageContainer pageKey={`dm-${page}`}>
        {page === 'campaign' && (
          <CampaignPage dm={dm} onNotify={notify} onOpenParty={() => onNavigate('party')} />
        )}
        {page === 'party' && (
          <PartyPage dm={dm} onNotify={notify} onOpenCampaign={() => onNavigate('campaign')} />
        )}
        {page === 'encounter' && <EncounterPage dm={dm} onNotify={notify} onOpenCampaign={() => onNavigate('campaign')} />}
        {page === 'library' && <LibraryPage dm={dm} onNotify={notify} onOpenEncounter={() => onNavigate('encounter')} />}
        {page === 'settings' && (
          <DmSettingsPage dm={dm} theme={theme} onThemeToggle={onThemeToggle} onTurnOff={onTurnOff} onNotify={notify} />
        )}
      </PageContainer>

      <Toast key={toast?.id ?? 0} message={toast?.text ?? null} duration={5000} />
      <AriaLiveAnnouncer message={activeLabel} />
      <UpdateBanner />
    </div>
  );
}
