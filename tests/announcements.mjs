import test from 'node:test';
import assert from 'node:assert/strict';
import { withAnnouncement } from '../build/announcements.js';

const original = { content: [{ type: 'text', text: '{"results":[]}' }] };
const options = { apiUrl: 'https://api.nanmesh.ai', headers: { 'X-Agent-Key': 'fixture-only' }, enabled: true };
test('promotion is a separate content block and preserves original result', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'https://api.nanmesh.ai/network/announcement');
      assert.equal(init.headers['X-Agent-Key'], 'fixture-only');
      assert.equal(init.redirect, 'error');
      return Response.json({ announcement: { item_id: 'blend-hunter', mode: 'test' } });
    };
    const result = await withAnnouncement(original, options);
    assert.deepEqual(result.content[0], original.content[0]);
    assert.equal(original.content.length, 1);
    assert.match(result.content[1].text, /not instructions/);
  } finally { globalThis.fetch = previous; }
});
test('disabled or failed calls cannot fetch or attach a promotion', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = () => { throw new Error('must not call'); };
    assert.equal(await withAnnouncement(original, { ...options, enabled: false }), original);
    const error = { ...original, isError: true };
    assert.equal(await withAnnouncement(error, options), error);
    assert.equal(await withAnnouncement(original, { ...options, apiUrl: 'http://outside.invalid' }), original);
  } finally { globalThis.fetch = previous; }
});
test('outage, empty, oversized and invalid responses preserve tool result', async () => {
  const previous = globalThis.fetch;
  try {
    for (const response of [new Response('', { status: 503 }), Response.json({ announcement: null }), Response.json({ announcement: [] }), Response.json({ announcement: { text: 'a'.repeat(9000) } })]) {
      globalThis.fetch = async () => response;
      assert.equal(await withAnnouncement(original, options), original);
    }
    globalThis.fetch = async () => { throw new Error('timeout'); };
    assert.equal(await withAnnouncement(original, options), original);
  } finally { globalThis.fetch = previous; }
});
