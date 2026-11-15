import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryLegacyRoutes } from '../scripts/inventory-legacy-routes';

test('inventories literal Express routes and direct collection references', () => {
  const source = [
    "app.get('/api/profile', (req, res) => {",
    '  const user = db.users.find((entry) => entry.id === req.user.id);',
    '  const posts = db.posts.filter((post) => post.authorId === user.id);',
    '  res.json(posts);',
    '});',
    "app.post('/api/messages', async (req, res) => {",
    '  const conversation = db.conversations.find((entry) => entry.id === req.body.id);',
    '  db.messages.push({ conversationId: conversation.id });',
    '});',
  ].join('\n');

  const report = inventoryLegacyRoutes(source);
  assert.equal(report.routeCount, 2);
  assert.equal(report.directDatabaseReferenceCount, 4);
  assert.deepEqual(report.routes[0].collections, ['posts', 'users']);
  assert.deepEqual(report.routes[1].collections, ['conversations', 'messages']);
  assert.equal(report.collectionReferenceCounts.users, 1);
  assert.equal(report.collectionReferenceCounts.messages, 1);
});

test('returns an empty, deterministic inventory when no literal app routes exist', () => {
  const report = inventoryLegacyRoutes('const app = createServer();');
  assert.equal(report.routeCount, 0);
  assert.equal(report.directDatabaseReferenceCount, 0);
  assert.deepEqual(report.routes, []);
  assert.ok(report.limitations.length > 0);
});

test('does not include source values in the report', () => {
  const report = inventoryLegacyRoutes(
    "app.post('/api/login', (req, res) => { const password = 'private-value'; const user = db.users[0]; });",
  );
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('private-value'), false);
  assert.equal(serialized.includes('password'), false);
});
