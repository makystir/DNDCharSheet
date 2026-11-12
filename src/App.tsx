import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Character } from './types/character';
import { saveCharacter } from './storage/character-store';
import { notifyCharacterDataChange } from './storage/character-manager';
import { getSnapshotStore } from './storage/snapshot-store';
import { startSnapshotController } from './storage/snapshot-service';
import { useCharacterManager } from './hooks/useCharacterManager';
import { RestoreLaunchHost } from './components/shared/RestoreLaunchHost';
import { CharacterManagementSheet } from './components/shared/CharacterManagementSheet';
import { CharacterNameHeader } from './components/shared/CharacterNameHeader';
import { useHashRoute } from './hooks/useHashRoute';
import { useViewRoute } from './hooks/useViewRoute';
import { SharedCharacterViewer } from './components/shared/SharedCharacterViewer';
import { useConditionalRouteGuard } from './hooks/useConditionalRouteGuard';
import { usePortrait } from './hooks/usePortrait';
import { Navigation } from './components/layout/Navigation';
import { PageContainer } from './components/layout/PageContainer';
import { NAV_ITEMS } from './components/layout/navItems';
import { AriaLiveAnnouncer } from './components/shared/AriaLiveAnnouncer';
import { SWUpdateProvider } from './hooks/useSWUpdate';
import { UpdateBanner } from './components/shared/UpdateBanner';
import { InstallHintBanner } from './components/shared/InstallPromptControl';
import { CommandPaletteProvider } from './components/command-palette/CommandPaletteContext';
import { useCommandPaletteContext } from './components/command-palette/commandPaletteContextValue';
import { useCommandPalette } from './components/command-palette/useCommandPalette';
import { CommandPalette } from './components/command-palette/CommandPalette';
import { ShortcutsHelp } from './components/shared/ShortcutsHelp';
import { lazy } from 'react';
import { CharacterPage } from './components/pages/CharacterPage';
import { PageLoader } from './components/layout/PageLoader';
import {
  CombatSkeleton,
  InventorySkeleton,
  SpellsSkeleton,
  AdvancementSkeleton,
  SettingsSkeleton,
} from './components/skeletons';
import { PrintLayout } from './components/layout/PrintLayout';
import { WelcomeScreen } from './components/creation/WelcomeScreen';
import { RollDialog } from './components/shared/RollDialog';
import { RollHistoryPanel } from './components/shared/RollHistoryPanel';
import { useUndoStack } from './hooks/useUndoStack';
import { useRollHistory } from './hooks/useRollHistory';
import { mirrorRoll } from './logic/event-log-mirrors';
import { clearEventLog } from './logic/event-log';
import type { RollEventPayload } from './types/character';
import { Dices } from 'lucide-react';
// Stage B9: the heavy pages are code-split with React.lazy and wrapped in a
// PageLoader (Suspense + a page-shaped skeleton fallback) at their render site.
// CharacterPage stays an eager import — it is the default/landing page, so
// lazy-loading it would only add a spinner on first paint. The named page
// exports are mapped to a default export for React.lazy.
const CombatPage = lazy(() =>
  import('./components/pages/CombatPage').then((m) => ({ default: m.CombatPage })),
);
const InventoryPage = lazy(() =>
  import('./components/pages/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const SpellsPage = lazy(() =>
  import('./components/pages/SpellsPage').then((m) => ({ default: m.SpellsPage })),
);
const CompanionsPage = lazy(() =>
  import('./components/pages/CompanionsPage').then((m) => ({ default: m.CompanionsPage })),
);
const AdvancementPage = lazy(() =>
  import('./components/pages/AdvancementPage').then((m) => ({ default: m.AdvancementPage })),
);
const SettingsPage = lazy(() =>
  import('./components/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
import { anySpellcaster } from './logic/spellcasting';
import { Toast } from './components/shared/Toast';
import { useConcentrationAutoEnd } from './hooks/useConcentrationAutoEnd';
import { AssistantProvider } from './components/assistant/AssistantContext';
import { AssistantPanel } from './components/assistant/AssistantPanel';
import { useAssistantActions } from './components/assistant/useAssistantActions';
import type { AssistantRollSeed } from './components/assistant/useAssistantActions';
import { dismissStore } from './components/assistant/dismissStore';
import { getSuggestions } from './logic/assistant/engine';
import { visibleSuggestions } from './logic/assistant/visible';
import type { DismissState } from './logic/assistant/visible';
import type { SuggestionContext } from './logic/assistant/types';
import { getLastBackupAt } from './storage/backup-reminder';
import type { D20Mode } from './logic/dice';
import styles from './App.module.css';

const THEME_KEY = 'dnd-theme';

/**
 * Stage B6: registers the global Ctrl/⌘+K palette-open shortcut (a NEW binding
 * that does not conflict with Navigation's number-key handler) and mounts the
 * palette + the shortcuts overlay. Rendered inside the CommandPaletteProvider so
 * it can read the context. The shortcuts overlay is shown only when opened via
 * the palette footer or the Navigation Shortcuts affordance.
 */
function CommandPaletteHost() {
  useCommandPalette();
  const { shortcutsOpen, closeShortcuts } = useCommandPaletteContext();
  return (
    <>
      <CommandPalette />
      {shortcutsOpen && <ShortcutsHelp onClose={closeShortcuts} />}
    </>
  );
}

function App() {
  // Stage B1: the multi-character manager owns the active character + list and
  // the loading status machine (loading/welcome/ready/error), layered on top of
  // the existing IndexedDB character-store. The active character replaces the
  // former single `state.character`; the status drives the same render branches.
  const {
    status,
    errorMessage,
    characters,
    activeId,
    activeCharacter,
    updateActiveCharacter,
    adoptCharacter,
    switchCharacter,
    duplicateCharacter,
    renameCharacter,
    deleteCharacter,
    reload,
  } = useCharacterManager();

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const { page, subTab, navigate } = useHashRoute();

  // Stage B5: read-only GM "view" route. When the hash is `#view/<payload>`,
  // render ONLY the SharedCharacterViewer — no Navigation, WelcomeScreen, or
  // normal shell — and do so even when the local character DB is empty. Read
  // here (unconditionally, with the other hooks) so the early return below can
  // precede the welcome/ready/loading branches (mirrors the WFRP App's
  // useViewRoute precedence). The payload is UNTRUSTED and decoded/validated
  // inside the viewer; this only decides whether the viewer takes over.
  const viewPayload = useViewRoute();

  // Portrait object-URL lifecycle is owned at the shell, keyed by the active
  // character id so it survives sub-tab navigation (which mounts/unmounts the
  // Overview section). Called unconditionally with a stable call site; an empty
  // id (not yet ready) simply yields no portrait.
  const activeCharacterId = status === 'ready' && activeCharacter ? activeCharacter.id : '';
  const { portraitURL, uploadPortrait, removePortrait } =
    usePortrait(activeCharacterId);

  // Stage B1: the character management sheet open-state + its trigger refs (one
  // per switcher — the desktop sidebar button and the mobile name header — so
  // focus returns to whichever opened it). `creating` forces the welcome flow
  // from the sheet's "New character" action even when characters already exist.
  const [managerOpen, setManagerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const desktopTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  // Which switcher opened the sheet, so focus returns to it on close. Held in
  // state (not a ref) so the ref OBJECT can be passed to the sheet without
  // reading a ref's `.current` during render.
  const [activeTriggerRef, setActiveTriggerRef] = useState<
    React.RefObject<HTMLButtonElement | null>
  >(() => desktopTriggerRef);

  const openManager = useCallback((trigger: React.RefObject<HTMLButtonElement | null>) => {
    setActiveTriggerRef(trigger);
    setManagerOpen(true);
  }, []);

  // Apply + persist theme.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore persistence failure
    }
  }, [theme]);

  // Stage B3: once the manager settles (status 'ready' or 'welcome'), init the
  // isolated snapshot store and start the throttle/flush controller that writes
  // rolling auto-backups on the live change signal. Started once and torn down
  // on unmount. Isolated and non-fatal: a degraded snapshot store never throws
  // and never blocks a live save. Gated to run after the first settle so the
  // controller's `notifyCharacterDataChange` listener is live before any edit.
  const managerSettled = status === 'ready' || status === 'welcome';
  useEffect(() => {
    if (!managerSettled) return;
    let stopped = false;
    let controller: { stop(): void } | null = null;
    void (async () => {
      try {
        const store = getSnapshotStore();
        await store.init();
        if (stopped) return;
        controller = startSnapshotController(store);
      } catch (err) {
        console.warn('Auto-backup controller failed to start (non-fatal):', err);
      }
    })();
    return () => {
      stopped = true;
      controller?.stop();
    };
  }, [managerSettled]);

  // Route guard: if the active route points at a conditional tab the current
  // character can no longer see (e.g. #spells after switching to a non-caster
  // class or dropping below the subclass casting level), redirect to Character.
  // Extracted into a hook so the reactive invalidation (character changes while
  // the route stays active) is unit-testable in isolation (blueprint §6.4).
  useConditionalRouteGuard(
    status === 'ready' ? (activeCharacter ?? undefined) : undefined,
    page,
    navigate,
  );

  const handleChange = useCallback(
    (next: Character) => {
      // Reflect the edit in the manager's in-memory active character + list
      // (name/level/updatedAt) immediately, then persist via the store. The
      // store is the single persistence layer; the manager tracks the index.
      updateActiveCharacter(next);
      void saveCharacter(next)
        .then(() => {
          // Stage B3: tell the snapshot controller a consistent save happened so
          // it can schedule a throttled rolling backup. Fire only after the
          // store write resolves so a snapshot never captures an unsaved edit.
          notifyCharacterDataChange();
        })
        .catch((err) => {
          console.error('Failed to save character:', err);
        });
    },
    [updateActiveCharacter],
  );

  // Stage B7: the bounded undo stack of whole-character snapshots (cap 10) and
  // the edit wrapper that records the PRE-edit character before applying a
  // change. Page edit paths use `undoableChange`; the roll/undo paths below use
  // `handleChange` directly so a roll-log append or an undo revert is not itself
  // pushed onto the stack. The event log is DISPLAY/AUDIT ONLY — undo reverts via
  // the snapshot, never by replaying the log.
  const undoStack = useUndoStack(10);
  const readyCharacter = status === 'ready' ? activeCharacter : null;
  const undoableChange = useCallback(
    (next: Character) => {
      if (readyCharacter) {
        undoStack.push(readyCharacter);
      }
      handleChange(next);
    },
    [readyCharacter, undoStack, handleChange],
  );

  // Clear the undo stack whenever the active character changes, so an undo never
  // reverts one character with another's snapshot (mirrors the WFRP App).
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    if (activeIdRef.current !== activeId) {
      activeIdRef.current = activeId;
      undoStack.clear();
    }
  }, [activeId, undoStack]);

  // Stage B7: roll dialog open-state. `null` = closed. Opened from the shell
  // Roll button; its result flows into `addRoll`.
  const [rollDialogOpen, setRollDialogOpen] = useState(false);

  // Append a resolved roll to the active character's event log via the single
  // roll-log path (mirrorRoll → appendEvent), persisting through handleChange.
  const addRoll = useCallback(
    (payload: RollEventPayload) => {
      if (!readyCharacter) return;
      handleChange(mirrorRoll(readyCharacter, payload));
      setRollDialogOpen(false);
    },
    [readyCharacter, handleChange],
  );

  const clearRollHistory = useCallback(() => {
    if (readyCharacter) {
      handleChange(clearEventLog(readyCharacter));
    }
  }, [readyCharacter, handleChange]);

  const { history: rollHistory } = useRollHistory(
    readyCharacter ?? undefined,
    clearRollHistory,
  );

  // Stage B8: Character Assistant. The deterministic engine is PURE — the shell
  // reads lastBackupAt + now ONCE here and threads them into SuggestionContext
  // so the engine performs no storage read / Date.now() at eval time.
  //
  // A seeded roll opens the SAME B7 RollDialog, carrying only the serializable
  // seed (label/dc/initialMode); the Exhaustion level is read off the active
  // character when the dialog mounts (as the shell Roll button does). Resolved
  // rolls flow into the same addRoll → event-log path. The dispatcher never
  // mutates character state — it only navigates / seeds a roll / runs the B3
  // export.
  const [assistantRollSeed, setAssistantRollSeed] = useState<AssistantRollSeed | null>(null);
  const [assistantNow, setAssistantNow] = useState(() => Date.now());
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() => getLastBackupAt());
  // A monotonically increasing version bumped whenever the persisted dismiss/
  // snooze record changes (dismiss, snooze, or a prune that actually trimmed
  // something). The visible-list memo reads the store fresh keyed by this
  // version, so there is no duplicated dismiss state in React to keep in sync
  // (and no setState inside the prune effect).
  const [dismissVersion, setDismissVersion] = useState(0);

  const openAssistantRoll = useCallback((seed: AssistantRollSeed) => {
    setAssistantRollSeed(seed);
  }, []);

  // After a one-tap file backup, refresh the stale-nudge inputs so it clears.
  const handleFileBackedUp = useCallback(() => {
    setLastBackupAt(getLastBackupAt());
    setAssistantNow(Date.now());
  }, []);

  const dispatchAssistantAction = useAssistantActions({
    navigate: (p, subTab) => navigate(p, subTab ?? undefined),
    openRoll: openAssistantRoll,
    onFileBackedUp: handleFileBackedUp,
  });

  // The engine's raw output for the active character. inCombat is read from the
  // single source of truth (character.combat?.inCombat).
  const rawSuggestions = useMemo(() => {
    const context: SuggestionContext = {
      inCombat: readyCharacter?.combat?.inCombat ?? false,
      lastBackupAt,
      now: assistantNow,
    };
    return getSuggestions(readyCharacter ?? undefined, context);
  }, [readyCharacter, lastBackupAt, assistantNow]);

  // Prune dismissed/snoozed ids that are no longer emitted, so a suggestion
  // reappears when its condition re-triggers. This is a STORAGE write only; it
  // feeds no React state directly. When the prune actually trims the record it
  // bumps `dismissVersion`, which re-keys the visible-list memo below so the
  // reappearance is reflected. pruneDismissed is a no-op write when nothing
  // changed, so the version only advances on a real change.
  useEffect(() => {
    const activeIds = new Set<string>(rawSuggestions.map((s) => s.id));
    const before = dismissStore.read();
    const pruned = dismissStore.pruneDismissed(activeIds);
    if (
      before.dismissed.length !== pruned.dismissed.length ||
      Object.keys(before.snoozedUntil).length !== Object.keys(pruned.snoozedUntil).length
    ) {
      // Intentional setState-in-effect: reconciling React with the EXTERNAL
      // localStorage dismiss store (the sanctioned use — same pattern as
      // useMediaQuery.ts / Tooltip.tsx). The store was just trimmed of ids the
      // engine no longer emits so a dismissed suggestion reappears when its
      // condition re-triggers; bumping the version re-keys the visible-list
      // memo to reflect the trimmed record. Guarded so it fires only on a real
      // change (pruneDismissed is a no-op write otherwise), so it cannot loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissVersion((v) => v + 1);
    }
  }, [rawSuggestions]);

  // The dismiss/snooze-filtered list the panel + badge both consume (one source
  // ⇒ the count and the panel always agree). Reads the dismiss record fresh,
  // re-keyed by `dismissVersion` so a dismiss/snooze/prune re-filters.
  const visibleAssistantSuggestions = useMemo(() => {
    void dismissVersion; // re-key on any dismiss/snooze/prune change
    const dismiss: DismissState = dismissStore.read();
    return visibleSuggestions(rawSuggestions, dismiss, assistantNow);
  }, [rawSuggestions, assistantNow, dismissVersion]);

  const dismissSuggestion = useCallback((id: string) => {
    dismissStore.dismiss(id);
    setDismissVersion((v) => v + 1);
  }, []);
  const snoozeSuggestion = useCallback((id: string) => {
    dismissStore.snooze(id, Date.now());
    setDismissVersion((v) => v + 1);
  }, []);

  // A character produced by the WelcomeScreen (wizard / random / skip): adopt
  // it (persist + make active via the manager), close the management sheet if
  // it drove this creation, and route to the Character tab so the new sheet is
  // shown from the top. Creating from the sheet never blows away existing
  // characters — the store is keyed by id and adopt only adds.
  const handleCharacterReady = useCallback(
    (next: Character) => {
      void adoptCharacter(next).catch((err) => {
        console.error('Failed to save character:', err);
      });
      setCreating(false);
      setManagerOpen(false);
      navigate('character');
    },
    [adoptCharacter, navigate],
  );

  // Stage A5b: Concentration and rest results surface as a Toast. A fresh `id`
  // remounts the Toast so an identical message still shows again.
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const notify = useCallback(
    (text: string) => setToast((prev) => ({ id: (prev?.id ?? 0) + 1, text })),
    [],
  );
  useConcentrationAutoEnd(
    status === 'ready' ? (activeCharacter ?? undefined) : undefined,
    handleChange,
    notify,
  );

  // Stage B7: global Ctrl/⌘+Z → undo the last field edit. Skips when focus is in
  // a text input/textarea/contenteditable so it never clobbers native text undo.
  // Reverts via the recorded PRE-edit snapshot through `handleChange` (not
  // `undoableChange`, so the revert itself is not pushed). Mirrors the WFRP App's
  // keydown wiring. Undo-only: the undo stack stores whole-character snapshots of
  // the PRE-edit state, which cannot reconstruct a post-edit "redo" target, so
  // the Shift+Z redo keybind is intentionally not wired (the task permits
  // undo-only; the stack's redo capability is still unit-pinned by the golden).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target?.isContentEditable === true
      ) {
        return;
      }
      e.preventDefault();
      const snapshot = undoStack.undo();
      if (snapshot) {
        handleChange(snapshot);
        notify('Undo');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [undoStack, handleChange, notify]);

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );

  // Stage B9: mount the print-only sheet ONLY while the browser is in its print
  // flow. The sheet must be in the DOM when the browser snapshots the page, so
  // the `beforeprint` handler commits `printing=true` SYNCHRONOUSLY via
  // flushSync — a plain setState here is batched/asynchronous and would not
  // flush before `window.print()` (triggered from Settings) captures the page,
  // printing a blank sheet. `beforeprint` fires synchronously before the print
  // view is produced, so the flushSync commit lands the PrintLayout in the DOM
  // in time; `afterprint` unmounts it. Keeping it out of the DOM the rest of the
  // time means the live a11y tree and on-screen queries never see a second copy
  // of every section.
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    const onBefore = () => flushSync(() => setPrinting(true));
    const onAfter = () => setPrinting(false);
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    };
  }, []);

  // Stage B6: dispatch target for the command palette's "action" entries. Each
  // key maps to an existing shell handler/navigation path (no new behaviour).
  const runAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'toggle-theme':
          toggleTheme();
          break;
        case 'manage-characters':
          openManager(desktopTriggerRef);
          break;
        case 'open-settings':
          navigate('settings');
          break;
        default:
          break;
      }
    },
    [toggleTheme, openManager, navigate],
  );

  const activeLabel = NAV_ITEMS.find((i) => i.id === page)?.label ?? '';

  // The welcome/creation flow runs on first run (no characters) OR when the
  // management sheet's "New character" action is invoked while characters exist.
  const showWelcome = status === 'welcome' || creating;
  const character = status === 'ready' ? activeCharacter : null;

  // Stage B5: the view-route early return. Placed AFTER every hook call (Rules
  // of Hooks) but BEFORE the normal shell so a `#view/…` link renders only the
  // read-only viewer, independent of the manager status — it works with an
  // empty DB and shows no Navigation/WelcomeScreen/management sheet.
  if (viewPayload !== null) {
    return <SharedCharacterViewer encoded={viewPayload} />;
  }

  return (
    <SWUpdateProvider>
      <CommandPaletteProvider
        character={character ?? undefined}
        navigate={(p) => navigate(p)}
        runAction={runAction}
      >
        <AssistantProvider>
        <div className={`${styles.app} screen-only`}>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>

          <Navigation
            activePage={page}
            onPageChange={navigate}
            character={character ?? undefined}
            onOpenCharacterManager={() => openManager(desktopTriggerRef)}
            characterManagerTriggerRef={desktopTriggerRef}
            assistantCount={visibleAssistantSuggestions.length}
          />

          <PageContainer pageKey={page}>
            {/* Mobile active-character header + switcher (desktop hosts it in the
                sidebar). Shown only when a character is active and not mid-creation. */}
            {character && !showWelcome && (
              <CharacterNameHeader
                ref={mobileTriggerRef}
                characterName={character.name}
                onOpen={() => openManager(mobileTriggerRef)}
              />
            )}

            {status === 'loading' && <p className={styles.status}>Loading…</p>}
            {status === 'error' && (
              <p className={styles.status} role="alert">
                {errorMessage}
              </p>
            )}
            {showWelcome && (
              <WelcomeScreen
                onCharacterReady={handleCharacterReady}
                // Only offer an abort path when creation was launched from the
                // management sheet over an existing active character (`creating`).
                // On true first run (status:'welcome', empty store) there is nothing
                // to return to, so no Cancel is shown. Cancelling clears `creating`,
                // restoring the status:'ready' view of the active character.
                onCancel={creating ? () => setCreating(false) : undefined}
              />
            )}
            {status === 'ready' && !showWelcome && character && (
              <>
                {page === 'character' && (
                  <CharacterPage
                    character={character}
                    onChange={undoableChange}
                    subTab={subTab}
                    onSubTabChange={(tab) => navigate('character', tab)}
                    portraitURL={portraitURL}
                    onPortraitUpload={uploadPortrait}
                    onPortraitRemove={removePortrait}
                    onNotify={notify}
                  />
                )}
                {page === 'combat' && (
                  <PageLoader skeleton={<CombatSkeleton />}>
                    <CombatPage character={character} onChange={undoableChange} onNotify={notify} />
                  </PageLoader>
                )}
                {page === 'inventory' && (
                  <PageLoader skeleton={<InventorySkeleton />}>
                    <InventoryPage character={character} onChange={undoableChange} />
                  </PageLoader>
                )}
                {/* Belt-and-braces with the route guard: only render Spells for a
                    spellcaster (the guard rewrites the hash, this gates the view). */}
                {page === 'spells' && anySpellcaster(character) && (
                  <PageLoader skeleton={<SpellsSkeleton />}>
                    <SpellsPage
                      character={character}
                      onChange={undoableChange}
                      onNotify={notify}
                      subTab={subTab}
                      onSubTabChange={(tab) => navigate('spells', tab)}
                    />
                  </PageLoader>
                )}
                {page === 'companions' && (
                  <PageLoader>
                    <CompanionsPage
                      character={character}
                      onChange={undoableChange}
                      subTab={subTab}
                      onSubTabChange={(tab) => navigate('companions', tab)}
                    />
                  </PageLoader>
                )}
                {page === 'advancement' && (
                  <PageLoader skeleton={<AdvancementSkeleton />}>
                    <AdvancementPage character={character} onChange={undoableChange} />
                  </PageLoader>
                )}
                {page === 'settings' && (
                  <PageLoader skeleton={<SettingsSkeleton />}>
                    <SettingsPage
                      theme={theme}
                      onThemeToggle={toggleTheme}
                      character={character}
                      onChange={handleChange}
                      onAdopt={adoptCharacter}
                      onRestored={() => void reload()}
                    />
                  </PageLoader>
                )}
              </>
            )}
          </PageContainer>

          {/* Stage B1: the multi-character management sheet. Mounted whenever the
              app is past loading so it can open from either switcher. */}
          <CharacterManagementSheet
            isOpen={managerOpen}
            onClose={() => setManagerOpen(false)}
            characters={characters}
            activeId={activeId}
            onSwitchCharacter={(id) => {
              void switchCharacter(id);
              navigate('character');
            }}
            onCreateCharacter={() => {
              // Route through the WelcomeScreen creation flow; closing the sheet
              // and flipping `creating` shows it without touching existing
              // characters (adopt only adds on completion).
              setManagerOpen(false);
              setCreating(true);
            }}
            onRenameCharacter={(id, name) => void renameCharacter(id, name)}
            onDuplicateCharacter={(id) => void duplicateCharacter(id)}
            onDeleteCharacter={(id) => void deleteCharacter(id)}
            triggerRef={activeTriggerRef}
          />

          {/* Stage B3: restore-on-launch host. Mounted once the manager has settled
              and we are not mid-creation, so its run-once discrepancy check can
              prompt (ONLY on a genuine discrepancy) and refresh the manager after a
              confirmed restore. It renders nothing unless a prompt is due. */}
          {managerSettled && !showWelcome && (
            <RestoreLaunchHost onRestored={() => void reload()} />
          )}

          {/* Stage B7: the shell dice-roller. A floating Roll button opens the
              d20 RollDialog (adv/dis, optional DC, manual d20 entry, crit/fumble,
              haptics); resolved rolls flow into addRoll → the per-character event
              log. The RollHistoryPanel shows the newest-first roll log with a
              Clear control. Surfaced at the shell so it is reachable on any page
              and bound to the active character. */}
          {status === 'ready' && !showWelcome && character && (
            <>
              <button
                type="button"
                className={styles.rollFab}
                onClick={() => setRollDialogOpen(true)}
                aria-label="Open dice roller"
                title="Roll a d20"
              >
                <Dices size={20} aria-hidden="true" />
              </button>
              {rollHistory.length > 0 && (
                <div className={styles.rollHistoryDock}>
                  <RollHistoryPanel history={rollHistory} onClear={clearRollHistory} />
                </div>
              )}
              {rollDialogOpen && (
                <RollDialog
                  label="d20 Roll"
                  exhaustionLevel={character.exhaustionLevel ?? 0}
                  hint="Pick Advantage/Disadvantage and an optional DC, then roll."
                  onRoll={addRoll}
                  onClose={() => setRollDialogOpen(false)}
                />
              )}
            </>
          )}

          <Toast key={toast?.id ?? 0} message={toast?.text ?? null} duration={5000} />

          {/* Announces the active page label to assistive tech on route change. */}
          <AriaLiveAnnouncer message={activeLabel} />

          {/* Stage B4: PWA update + install affordances. The UpdateBanner reflects
              the single SWUpdateProvider handle (shown only when an update is
              waiting); the InstallHintBanner is a one-time, dismissible install
              hint. Both read context from the surrounding SWUpdateProvider. */}
          <UpdateBanner />
          <InstallHintBanner />

          {/* Stage B6: command palette (Ctrl/⌘+K) + keyboard-shortcuts overlay.
              Mounted inside the provider so the palette dispatches through the same
              navigation path the nav uses. */}
          <CommandPaletteHost />

          {/* Stage B8: the dismissible Character Assistant drawer/sheet. The
              badge-bearing trigger lives in Navigation; this is the panel it
              opens. Suggestions route through the dispatcher to the existing
              navigate / B7 RollDialog / B3 backup flows — never a direct
              character mutation. */}
          {status === 'ready' && !showWelcome && character && (
            <AssistantPanel
              suggestions={visibleAssistantSuggestions}
              onAction={dispatchAssistantAction}
              onDismiss={dismissSuggestion}
              onSnooze={snoozeSuggestion}
            />
          )}

          {/* A suggestion's seeded roll opens the same B7 RollDialog; the player
              still rolls and logs it (resolved rolls flow into addRoll, the one
              event-log path). Exhaustion is read off the active character. */}
          {status === 'ready' && !showWelcome && character && assistantRollSeed && (
            <RollDialog
              label={assistantRollSeed.label}
              exhaustionLevel={character.exhaustionLevel ?? 0}
              dc={assistantRollSeed.dc}
              initialMode={assistantRollSeed.initialMode as D20Mode | undefined}
              hint="Seeded from a Character Assistant suggestion."
              onRoll={(payload) => {
                addRoll(payload);
                setAssistantRollSeed(null);
              }}
              onClose={() => setAssistantRollSeed(null)}
            />
          )}
        </div>

        {/* Stage B9: the print-only character sheet. Mounted as a sibling of the
            `.screen-only` shell and shown only for print by the `.print-only`
            rule under `@media print`. It is mounted only while the browser is in
            its print flow (`printing`, flipped SYNCHRONOUSLY by the flushSync
            `beforeprint` handler above), so it is already committed to the DOM
            when `window.print()` (triggered from Settings) captures the page and
            is never snapshotted blank. Bound to the active character.
            aria-hidden: the print sheet is a visual duplicate of the live sheet
            for printing only, so it stays out of the a11y tree. */}
        {printing && status === 'ready' && !showWelcome && character && (
          <div className="print-only" aria-hidden="true">
            <PrintLayout character={character} />
          </div>
        )}
        </AssistantProvider>
      </CommandPaletteProvider>
    </SWUpdateProvider>
  );
}

export default App;
