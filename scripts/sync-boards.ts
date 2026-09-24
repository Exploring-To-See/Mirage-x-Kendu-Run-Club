/**
 * Pull pins off Pinterest into local assets Remotion can import.
 *
 *   npm run pinterest:sync -- --board <board_id> [--board <id>...] [--limit 200]
 *   npm run pinterest:sync -- --all
 *
 * Writes images to assets/pinterest/<board-name>/ and a manifest.json
 * describing every pin, so compositions can read structured data instead of
 * globbing a directory.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPinterest, bestImageUrl, type Pin } from '../src/pinterest/index.ts';
import { SetupError, runCli } from '../src/pinterest/errors.ts';

interface ManifestEntry {
  pinId: string;
  boardId: string;
  boardName: string;
  title: string;
  description: string;
  link: string | undefined;
  dominantColor: string | undefined;
  file: string | undefined;
  sourceUrl: string | undefined;
}

function parseArgs(argv: string[]) {
  const boardIds: string[] = [];
  let limit = 200;
  let all = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--board') boardIds.push(argv[++i] ?? '');
    else if (arg === '--limit') limit = Number(argv[++i]);
    else if (arg === '--all') all = true;
  }

  if (!all && boardIds.length === 0) {
    throw new SetupError('Pass --all, or one or more --board <board_id>. Run pinterest:whoami to list board ids.');
  }
  if (!Number.isFinite(limit) || limit < 1) throw new SetupError('--limit must be a positive number.');

  return { boardIds: boardIds.filter(Boolean), limit, all };
}

/** Filesystem-safe, stable directory name for a board. */
const slug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';

async function download(url: string, destination: string): Promise<boolean> {
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`  ! ${response.status} fetching ${url}`);
    return false;
  }
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return true;
}

await runCli(async () => {
  const { boardIds, limit, all } = parseArgs(process.argv.slice(2));
  const pinterest = createPinterest();
  const outputRoot = join(process.cwd(), 'assets', 'pinterest');

  const targets = all
    ? await pinterest.boards.list()
    : await Promise.all(boardIds.map((id) => pinterest.boards.get(id)));

  const manifest: ManifestEntry[] = [];

  for (const board of targets) {
    const directory = join(outputRoot, slug(board.name));
    await mkdir(directory, { recursive: true });
    console.log(`\n${board.name} (${board.id})`);

    const pins: Pin[] = await pinterest.boards.pins(board.id, limit);
    console.log(`  ${pins.length} pin(s)`);

    for (const pin of pins) {
      const url = bestImageUrl(pin);
      let file: string | undefined;

      if (url) {
        // Pinterest CDN URLs always carry a real extension; default to .jpg.
        const extension = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif)$/i)?.[0] ?? '.jpg';
        const name = `${pin.id}${extension}`;
        if (await download(url, join(directory, name))) file = `${slug(board.name)}/${name}`;
      }

      manifest.push({
        pinId: pin.id,
        boardId: board.id,
        boardName: board.name,
        title: pin.title ?? '',
        description: pin.description ?? pin.note ?? '',
        link: pin.link,
        dominantColor: pin.dominant_color,
        file,
        sourceUrl: url,
      });
    }
  }

  await mkdir(outputRoot, { recursive: true });
  await writeFile(
    join(outputRoot, 'manifest.json'),
    `${JSON.stringify({ syncedAt: new Date().toISOString(), pins: manifest }, null, 2)}\n`,
  );

  const withMedia = manifest.filter((entry) => entry.file).length;
  console.log(`\nSynced ${manifest.length} pin(s), ${withMedia} with media.`);
  console.log(`Manifest: assets/pinterest/manifest.json`);
});
