/**
 * One-time OAuth bootstrap.
 *
 *   npm run pinterest:authorize
 *
 * Spins up a throwaway HTTP server on the port in PINTEREST_REDIRECT_URI,
 * prints the Pinterest consent URL, and writes the resulting token pair to
 * .pinterest-token.json (gitignored). Everything else in the codebase reads
 * that cache and refreshes it automatically.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { buildAuthorizeUrl, createPkce, exchangeCode, saveToken } from '../src/pinterest/auth.ts';
import { loadConfig } from '../src/pinterest/config.ts';
import { SetupError, runCli } from '../src/pinterest/errors.ts';

await runCli(async () => {
  const config = loadConfig();
  const pkce = createPkce();
  const state = randomBytes(16).toString('hex');

  const redirect = new URL(config.redirectUri);
  const port = Number(redirect.port || 8085);

  if (redirect.protocol !== 'https:' && redirect.hostname !== 'localhost') {
    throw new SetupError(
      `PINTEREST_REDIRECT_URI must use https:// unless the host is localhost (got ${config.redirectUri}).`,
    );
  }

  const reply = (body: string) =>
    `<!doctype html><meta charset="utf-8"><title>Pinterest</title>` +
    `<body style="font:16px system-ui;padding:3rem;max-width:34rem">${body}</body>`;

  const token = await new Promise<Awaited<ReturnType<typeof exchangeCode>>>((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${redirect.host}`);
      if (url.pathname !== redirect.pathname) {
        res.writeHead(404).end();
        return;
      }

      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      const fail = (message: string) => {
        res.writeHead(400, { 'content-type': 'text/html' }).end(reply(`<h1>Failed</h1><p>${message}</p>`));
        server.close();
        reject(new Error(message));
      };

      if (error) return fail(`Pinterest returned "${error}".`);
      if (!code) return fail('No authorization code in the callback.');
      // Guards against a forged callback replaying someone else's code.
      if (returnedState !== state) return fail('State mismatch — aborting.');

      res
        .writeHead(200, { 'content-type': 'text/html' })
        .end(reply('<h1>Connected</h1><p>Token saved. You can close this tab.</p>'));
      server.close();

      exchangeCode(config, code, pkce.verifier).then(resolve, reject);
    });

    server.on('error', reject);
    server.listen(port, () => {
      console.log(`\nEnvironment : ${config.env}`);
      console.log(`Scopes      : ${config.scopes.join(', ')}`);
      console.log(`Listening   : ${config.redirectUri}\n`);
      console.log('Open this URL to authorize:\n');
      console.log(`  ${buildAuthorizeUrl(config, pkce, state)}\n`);
    });
  });

  saveToken(config, token);

  console.log('Token saved to .pinterest-token.json');
  console.log(`Access token expires  : ${new Date(token.expiresAt).toISOString()}`);
  console.log(`Refresh token expires : ${new Date(token.refreshExpiresAt).toISOString()}`);
  console.log(`Granted scopes        : ${token.scopes.join(', ')}`);
});
