# Pinterest API setup

This repo talks to the **Pinterest API v5**. Everything below the "Register the
app" step is automated; the registration itself has to be done by a human in
the Pinterest developer portal.

## 1. Register the app

1. Sign in at <https://developers.pinterest.com/> with the Pinterest account
   that owns the boards you want to read or publish to. A **business account**
   is required — personal accounts cannot create apps. You can convert a
   personal account for free in Pinterest settings.
2. Go to **Apps → Create app**, fill in the name and description, and accept
   the developer guidelines.
3. Note the **App ID** and **App secret**. The secret is shown once.

New apps land in **Trial access** automatically.

## 2. Add a redirect URI

In the app's settings, add the redirect URI **exactly** as it appears in your
`.env`, including the trailing path:

```
http://localhost:8085/callback
```

Pinterest requires `https://` for every host except `localhost`. The value sent
in the authorize request must match a registered URI character for character —
a missing or extra trailing slash is the single most common cause of
`invalid_request` at this step.

## 3. Configure the repo

```bash
cp .env.example .env
```

Fill in `PINTEREST_APP_ID` and `PINTEREST_APP_SECRET`. Leave
`PINTEREST_ENV=sandbox` until the app has standard access.

## 4. Authorize

```bash
npm install
npm run pinterest:authorize
```

This starts a local server on port 8085, prints a consent URL, and waits.
Open the URL, approve the scopes, and the callback writes
`.pinterest-token.json` (gitignored, mode 600).

Verify it:

```bash
npm run pinterest:whoami
```

That prints the connected account and lists board IDs.

## 5. Pull pins into the project

```bash
npm run pinterest:sync -- --all --limit 100
npm run pinterest:sync -- --board 1234567890123456789
```

Images land in `assets/pinterest/<board-slug>/`, with
`assets/pinterest/manifest.json` describing every pin (title, description,
dominant colour, source URL, local file). Both are gitignored — media is
re-fetchable, so it does not belong in git.

## Access tiers

| | Trial (default) | Standard (after review) |
|---|---|---|
| Rate limits | per day, per app | per minute, per user, per app |
| Boards/pins created | **sandbox entities — only you can see them** | real, public |
| API host | `api-sandbox.pinterest.com` | `api.pinterest.com` |
| Cost | free | free |

This matters: **anything you create on trial access is invisible to everyone
else.** If a pin publishes successfully but nobody can find it, you are on
trial access, not broken.

To upgrade, the app must already be approved for trial access and comply with
the developer guidelines. You submit a screen recording of the app performing a
real API action — a terminal or Postman recording is accepted. Once approved,
set `PINTEREST_ENV=production` and re-run `pinterest:authorize`; sandbox and
production tokens are not interchangeable, and the code refuses to use a token
minted for the other environment.

## Tokens

- Access tokens last **30 days**; refresh tokens last **1 year**.
- `getAccessToken()` refreshes automatically once a token is within an hour of
  expiring, and requests a rolling refresh token so long-running jobs do not
  hit the one-year cliff.
- If the refresh token does expire, re-run `npm run pinterest:authorize`.
- PKCE (`S256`) is mandatory — Pinterest rejects `plain`. It is handled for you.

## Scopes

| Scope | Needed for |
|---|---|
| `user_accounts:read` | `whoami`, account info, analytics |
| `boards:read` | listing boards and their pins |
| `boards:write` | creating and deleting boards |
| `pins:read` | reading pins and pin analytics |
| `pins:write` | creating pins, uploading media |

Requesting a scope the app has not been granted fails at the consent screen,
not at call time.

## Publishing a render

```ts
import { createPinterest } from './src/pinterest/index.ts';

const pinterest = createPinterest();

await pinterest.publishVideo('out/run-club-teaser.mp4', {
  board_id: '1234567890123456789',
  title: 'Kendu Run Club — Spring',
  description: 'Every Saturday, 7am.',
  link: 'https://example.com',
  coverImageUrl: 'https://example.com/cover.jpg',
});
```

Video pins take three API steps under the hood: register an upload slot, POST
the file to the returned S3 URL with its signed form fields, then poll until
Pinterest finishes transcoding. `publishVideo` does all three and then creates
the pin. `cover_image_url` is **required** for video pins and must be a public
URL — Pinterest fetches it, so a localhost address will not work.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `invalid_request` on the consent screen | redirect URI does not match the registered one exactly |
| `401` on every call | token minted for the other environment, or scopes not granted |
| `429` | rate limited; the client backs off and retries 3 times, honouring `Retry-After` |
| Pin created but invisible | trial access — it is a sandbox entity |
| S3 upload rejected | the bearer token was sent to S3, or form fields were appended after the file |

## Reference

- [Set up authentication and authorization](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)
- [Access tiers](https://developers.pinterest.com/docs/getting-started/access-tiers/)
- [Rate limits](https://developers.pinterest.com/docs/reference/rate-limits/)
- [Create boards and Pins](https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/)
- [Official quickstart code](https://github.com/pinterest/api-quickstart)
