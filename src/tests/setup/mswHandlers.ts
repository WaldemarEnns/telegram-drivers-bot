import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Captures every sendMessage call so tests can assert on chat_id and text.
export const sentMessages: Array<{ chat_id: number; text: string }> = [];

export const server = setupServer(
  // The token 'test:FAKE_TOKEN_FOR_MSW' contains a colon, so use a regex
  // instead of a path-to-regexp pattern to avoid confusion.
  http.post(/https:\/\/api\.telegram\.org\/bot.*\/sendMessage/, async ({ request }) => {
    const body = (await request.json()) as { chat_id: number; text: string };
    sentMessages.push(body);
    return HttpResponse.json({ ok: true, result: { message_id: 1 } });
  }),

  // Catch-all for any other Telegram method grammy might call
  http.post(/https:\/\/api\.telegram\.org\/bot.*\/.*/, () =>
    HttpResponse.json({ ok: true, result: true })
  ),
);
