/** Smoke test: proves the cached token works. `npm run pinterest:whoami` */
import { createPinterest } from '../src/pinterest/index.ts';
import { runCli } from '../src/pinterest/errors.ts';

await runCli(async () => {
  const pinterest = createPinterest();
  const me = await pinterest.me();

  console.log(`Connected as @${me.username} (${me.account_type}, id ${me.id})`);
  console.log(`Environment: ${pinterest.config.env}`);

  const boards = await pinterest.boards.list(25);
  if (boards.length === 0) {
    console.log('\nNo boards found.');
    return;
  }

  console.log(`\n${boards.length} board(s):`);
  for (const board of boards) {
    console.log(`  ${board.id}  ${board.name} (${board.pin_count ?? 0} pins)`);
  }
});
