import { describe, it, expect } from 'vitest';
import { SPECIES_CATALOG } from '../species';
import { FEAT_CATALOG } from '../feats';
import { CLASS_CATALOG } from '../classes';

// Player-facing effect text must never carry developer notes.
const DEV_PHRASES = /later stage|handled in a later|\bTODO\b|\bFIXME\b|\bTBD\b/i;

describe('data catalogs carry no developer notes in effect text', () => {
  it('species trait effects', () => {
    for (const species of Object.values(SPECIES_CATALOG)) {
      for (const trait of species.traits) {
        expect(trait.effect, `${species.id}: ${trait.name}`).not.toMatch(DEV_PHRASES);
      }
    }
  });

  it('feat effects', () => {
    for (const feat of Object.values(FEAT_CATALOG)) {
      expect(feat.effect, feat.id).not.toMatch(DEV_PHRASES);
    }
  });

  it('class feature effects', () => {
    for (const cls of Object.values(CLASS_CATALOG)) {
      for (const feature of cls.features) {
        expect(feature.effect, `${cls.id}: ${feature.name}`).not.toMatch(DEV_PHRASES);
      }
    }
  });
});
