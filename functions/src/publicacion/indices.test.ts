import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const indices = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../firestore.indexes.json'), 'utf8'));

it.each([['status'], ['parentRef.status']])('declara el índice de targets por %s y scheduledAt', (campo) => {
  expect(indices.indexes).toContainEqual({
    collectionGroup: 'targets',
    queryScope: 'COLLECTION_GROUP',
    fields: [
      { fieldPath: campo, order: 'ASCENDING' },
      { fieldPath: 'scheduledAt', order: 'ASCENDING' },
    ],
  });
});
