# Mirage x Kendu Run Club

Video tooling for the Mirage x Kendu Run Club, with a Pinterest API v5
integration for sourcing reference imagery and publishing finished renders.

## Layout

```
src/pinterest/     Pinterest API v5 client (OAuth, boards, pins, media upload)
scripts/           CLI entrypoints
docs/              Setup guides
.agents/skills/    Installed agent skills (Remotion, video-shotcraft)
```

## Pinterest

Full walkthrough in **[docs/PINTEREST_SETUP.md](docs/PINTEREST_SETUP.md)**.

```bash
npm install
cp .env.example .env          # add your app ID and secret
npm run pinterest:authorize   # one-time OAuth, writes .pinterest-token.json
npm run pinterest:whoami      # verify, and list board IDs
npm run pinterest:sync -- --all --limit 100
```

`pinterest:sync` writes images to `assets/pinterest/<board-slug>/` and a
`manifest.json` alongside them, so Remotion compositions can read structured
pin data rather than globbing a directory.

In code:

```ts
import { createPinterest } from './src/pinterest/index.ts';

const pinterest = createPinterest();

const boards = await pinterest.boards.list();
const pins = await pinterest.boards.pins(boards[0]!.id);

await pinterest.publishVideo('out/teaser.mp4', {
  board_id: boards[0]!.id,
  title: 'Kendu Run Club',
  coverImageUrl: 'https://example.com/cover.jpg',
});
```

Tokens refresh automatically. Nothing secret is committed — `.env` and
`.pinterest-token.json` are gitignored.

## Skills

Two agent skills are installed under `.agents/skills/`, symlinked into
`.claude/skills/`:

- **remotion-best-practices** — router for Remotion create/render/studio/captions
- **video-shotcraft** — shot recipe cards and the Ink Press template

## Scripts

| Command | Does |
|---|---|
| `npm run pinterest:authorize` | one-time OAuth, writes the token cache |
| `npm run pinterest:whoami` | verify the token, list boards |
| `npm run pinterest:sync` | download pins + manifest into `assets/pinterest/` |
| `npm run typecheck` | `tsc --noEmit` |
