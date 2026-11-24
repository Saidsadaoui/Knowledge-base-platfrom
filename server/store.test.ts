import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_CATEGORY_NAMES, StoreError, VaultStore } from './store';

function createTempStore(): { store: VaultStore; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-store-test-'));
  const dbPath = path.join(dir, 'vault.json');
  const store = new VaultStore(dbPath);
  return {
    store,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('Default categories seeded on user creation', () => {
  const { store, cleanup } = createTempStore();
  try {
    const userA = store.findOrCreateUser('usera@example.com');
    const cats = store.listCategories(userA.id);
    assert.deepEqual(
      cats.map((c) => c.name),
      [...DEFAULT_CATEGORY_NAMES],
    );
  } finally {
    cleanup();
  }
});

test('User isolation (RLS parity): User B cannot access or mutate User A data', () => {
  const { store, cleanup } = createTempStore();
  try {
    const userA = store.findOrCreateUser('a@example.com');
    const userB = store.findOrCreateUser('b@example.com');
    const catA = store.listCategories(userA.id)[0];

    const itemA = store.createItem(userA.id, {
      url: 'https://example.com/secret-note',
      title: 'Private Link',
      type: 'article',
      note: 'User A secret note',
      category_id: catA.id,
      tags: ['private'],
    });

    // User B lists items -> empty
    assert.equal(store.listItems(userB.id).items.length, 0);

    // User B tries to get/update/delete User A's item -> 404
    assert.throws(() => store.getItem(userB.id, itemA.id), (e: unknown) => e instanceof StoreError && e.status === 404);
    assert.throws(
      () => store.updateItem(userB.id, itemA.id, { title: 'Hacked' }),
      (e: unknown) => e instanceof StoreError && e.status === 404,
    );
    assert.throws(
      () => store.deleteItem(userB.id, itemA.id),
      (e: unknown) => e instanceof StoreError && e.status === 404,
    );

    // User B tries to create item inside User A's category -> 400
    assert.throws(
      () =>
        store.createItem(userB.id, {
          url: 'https://example.com/b',
          title: 'B item',
          type: 'article',
          category_id: catA.id,
        }),
      (e: unknown) => e instanceof StoreError && e.status === 400,
    );
  } finally {
    cleanup();
  }
});

test('Duplicate URL rejected with 409 and existingItem, category delete moves items to Inbox', () => {
  const { store, cleanup } = createTempStore();
  try {
    const user = store.findOrCreateUser('dup@example.com');
    const aiCat = store.listCategories(user.id).find((c) => c.name === 'AI')!;

    const created = store.createItem(user.id, {
      url: 'https://www.youtube.com/watch?v=12345',
      title: 'Agents talk',
      type: 'video',
      category_id: aiCat.id,
    });

    assert.throws(
      () =>
        store.createItem(user.id, {
          url: 'https://www.youtube.com/watch?v=12345',
          title: 'Duplicate',
          type: 'video',
          category_id: aiCat.id,
        }),
      (e: unknown) =>
        e instanceof StoreError &&
        e.status === 409 &&
        e.existingItem?.id === created.id,
    );

    // Delete category -> item moves to Inbox (category_id === null)
    store.deleteCategory(user.id, aiCat.id);
    const updated = store.getItem(user.id, created.id);
    assert.equal(updated.category_id, null);
    assert.equal(store.listItems(user.id, { inbox: true }).items.length, 1);
  } finally {
    cleanup();
  }
});
