import { PinterestClient } from './client.ts';
import { loadConfig, type PinterestConfig } from './config.ts';
import { boards } from './boards.ts';
import { media } from './media.ts';
import { pins } from './pins.ts';
import type { CreatePinInput, Pin, UserAccount } from './types.ts';

export * from './types.ts';
export { PinterestClient, PinterestApiError } from './client.ts';
export { loadConfig, type PinterestConfig } from './config.ts';
export { bestImageUrl } from './pins.ts';

export function createPinterest(config: PinterestConfig = loadConfig()) {
  const client = new PinterestClient(config);

  return {
    client,
    config,
    boards: boards(client),
    pins: pins(client),
    media: media(client),

    /** Cheapest call that proves the token works. Needs `user_accounts:read`. */
    me: () => client.request<UserAccount>('/user_account'),

    /**
     * Upload a rendered video and publish it as a pin in one step — the
     * common path for shipping a Remotion render to Pinterest.
     */
    async publishVideo(
      filePath: string,
      pin: Omit<CreatePinInput, 'media_source'> & { coverImageUrl: string },
    ): Promise<Pin> {
      const { coverImageUrl, ...rest } = pin;
      const mediaId = await media(client).uploadAndWait(filePath);

      return pins(client).create({
        ...rest,
        media_source: {
          source_type: 'video_id',
          media_id: mediaId,
          cover_image_url: coverImageUrl,
        },
      });
    },
  };
}

export type Pinterest = ReturnType<typeof createPinterest>;
