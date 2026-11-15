import { useState } from 'react';
import { ScrollText, FolderOpen } from 'lucide-react';
import type { DmCampaign } from '../../types/dm';
import type { DmApi } from './dmApi';
import {
  activeCampaign,
  createCampaign,
  deleteCampaign,
  renameCampaign,
  setActiveCampaign,
  setCampaignNotes,
} from '../../logic/dm-campaign';
import { Card } from '../shared/Card';
import { SectionHeader } from '../shared/SectionHeader';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import styles from './dm.module.css';

interface CampaignPageProps {
  dm: DmApi;
  onNotify: (text: string) => void;
  onOpenParty: () => void;
}

/** Campaign name and notes, plus the list of campaigns on this device. */
export function CampaignPage({ dm, onNotify, onOpenParty }: CampaignPageProps) {
  const campaign = activeCampaign(dm.data);
  const [newName, setNewName] = useState('');
  const [deleting, setDeleting] = useState<DmCampaign | null>(null);

  const create = () => {
    dm.update((d) => createCampaign(d, { id: crypto.randomUUID(), name: newName, now: Date.now() }));
    setNewName('');
    onNotify('Campaign created.');
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Campaign</h1>

      {campaign && (
        <Card>
          <SectionHeader icon={ScrollText} title="Current campaign" />
          <div className={styles.stack}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Name</span>
              {/* Uncommitted text lives in the input; it is saved on blur or Enter. */}
              <input
                key={campaign.id}
                className={styles.input}
                defaultValue={campaign.name}
                maxLength={80}
                onBlur={(e) => {
                  const value = e.currentTarget.value;
                  if (value.trim() === '') e.currentTarget.value = campaign.name;
                  else dm.update((d) => renameCampaign(d, campaign.id, value, Date.now()));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Notes</span>
              <textarea
                key={`notes-${campaign.id}`}
                className={styles.textarea}
                defaultValue={campaign.notes}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  dm.update((d) => setCampaignNotes(d, campaign.id, value, Date.now()));
                }}
              />
            </label>
            <div className={styles.row}>
              <span className={styles.muted}>
                {campaign.party.length} party {campaign.party.length === 1 ? 'member' : 'members'}
              </span>
              <button type="button" className={styles.btn} onClick={onOpenParty}>
                Open party
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <SectionHeader icon={FolderOpen} title="Campaigns" />
        <div className={styles.stack}>
          {dm.data.campaigns.length === 0 ? (
            <p className={styles.muted}>No campaigns yet. Name one below to start tracking a party.</p>
          ) : (
            <ul className={styles.campaignList}>
              {dm.data.campaigns.map((c) => {
                const isActive = c.id === campaign?.id;
                return (
                  <li key={c.id} className={`${styles.campaignItem} ${isActive ? styles.campaignItemActive : ''}`}>
                    <span>
                      <span className={styles.campaignName}>{c.name}</span>
                      <span className={styles.muted}>
                        {' '}
                        · {c.party.length} {c.party.length === 1 ? 'member' : 'members'}
                      </span>
                    </span>
                    <span className={styles.row}>
                      {isActive ? (
                        <span className={styles.muted}>Open now</span>
                      ) : (
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => dm.update((d) => setActiveCampaign(d, c.id))}
                          aria-label={`Open campaign ${c.name}`}
                        >
                          Open
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={() => setDeleting(c)}
                        aria-label={`Delete campaign ${c.name}`}
                      >
                        Delete
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className={styles.row}
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <label className={styles.field}>
              <span className={styles.fieldLabel}>New campaign name</span>
              <input
                className={styles.input}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={80}
                placeholder="For example: Curse of the Ember Throne"
              />
            </label>
            <button type="submit" className={styles.btnPrimary} style={{ alignSelf: 'flex-end' }}>
              Create campaign
            </button>
          </form>
        </div>
      </Card>

      {deleting && (
        <ConfirmDialog
          title="Delete campaign"
          message={`Delete "${deleting.name}", its notes and its ${deleting.party.length} party ${deleting.party.length === 1 ? 'member' : 'members'}? This cannot be undone. Export your DM data from Settings first if you want a copy.`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const id = deleting.id;
            dm.update((d) => deleteCampaign(d, id));
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
