import test from 'node:test';
import assert from 'node:assert/strict';

import { TelegramNotificationProvider } from '../src/providers/telegram-notification-provider.ts';

test('Telegram notification sends to per-message destination before default destination', async () => {
  const requests = [];
  const provider = new TelegramNotificationProvider({
    botToken: 'secret-token',
    defaultChatId: 'default-chat',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  await provider.notify({ title: 'Live message', message: 'Ada: hello', destination: 'batch-chat' });

  assert.equal(requests.length, 1);
  assert.match(String(requests[0].url), /\/botsecret-token\/sendMessage$/);
  const payload = JSON.parse(String(requests[0].init.body));
  assert.equal(payload.chat_id, 'batch-chat');
  assert.match(payload.text, /Live message/);
  assert.match(payload.text, /Ada: hello/);
});

test('Telegram notification uses default destination when message destination is absent', async () => {
  let payload;
  const provider = new TelegramNotificationProvider({
    botToken: 'secret-token',
    defaultChatId: 'default-chat',
    fetchImpl: async (_url, init) => {
      payload = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await provider.notify({ title: 'Live message', message: 'Question' });
  assert.equal(payload.chat_id, 'default-chat');
});

test('Telegram provider fails clearly when no destination is configured', async () => {
  const provider = new TelegramNotificationProvider({
    botToken: 'secret-token',
    fetchImpl: async () => new Response('{}', { status: 200 }),
  });
  await assert.rejects(
    () => provider.notify({ title: 'Live message', message: 'Question' }),
    /destination/i,
  );
});

test('Telegram API error is surfaced to caller so durable service can mark notification failure', async () => {
  const provider = new TelegramNotificationProvider({
    botToken: 'secret-token',
    defaultChatId: 'chat',
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, description: 'Bad Request' }), { status: 400 }),
  });
  await assert.rejects(
    () => provider.notify({ title: 'Live message', message: 'Question' }),
    /Telegram notification failed/i,
  );
});
