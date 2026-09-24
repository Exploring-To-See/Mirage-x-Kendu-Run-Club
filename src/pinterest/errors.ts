/**
 * A problem with the operator's setup rather than a bug — missing credentials,
 * no token, a bad flag. These print as a plain message; everything else keeps
 * its stack trace.
 */
export class SetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SetupError';
  }
}

/** Wraps a CLI entrypoint so setup mistakes read as advice, not a crash. */
export async function runCli(main: () => Promise<void> | void): Promise<void> {
  try {
    await main();
  } catch (error) {
    if (error instanceof SetupError) {
      console.error(`\n${error.message}\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
