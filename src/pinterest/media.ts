import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { PinterestClient } from './client.ts';
import type {
  MediaType,
  MediaUploadRegistration,
  MediaUploadStatus,
} from './types.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function media(client: PinterestClient) {
  const api = {
    /** Step 1: ask Pinterest for a one-time S3 upload slot. */
    register: (mediaType: MediaType = 'video') =>
      client.request<MediaUploadRegistration>('/media', {
        method: 'POST',
        body: { media_type: mediaType },
      }),

    status: (mediaId: string) =>
      client.request<MediaUploadStatus>(`/media/${mediaId}`),

    /**
     * Step 2: POST the file straight to S3. This request is authenticated by
     * the signed `upload_parameters`, NOT by the Pinterest bearer token —
     * sending the token here makes S3 reject the upload.
     */
    async upload(
      registration: MediaUploadRegistration,
      filePath: string,
      contentType = 'video/mp4',
    ): Promise<void> {
      const bytes = await readFile(filePath);
      const form = new FormData();

      // S3 evaluates its POST policy in field order and ignores anything after
      // the file, so every signed parameter has to be appended first.
      for (const [key, value] of Object.entries(registration.upload_parameters)) {
        form.append(key, value);
      }
      form.append(
        'file',
        new Blob([new Uint8Array(bytes)], { type: contentType }),
        basename(filePath),
      );

      const response = await fetch(registration.upload_url, { method: 'POST', body: form });
      if (!response.ok) {
        throw new Error(
          `Media upload to S3 failed (${response.status}): ${await response.text()}`,
        );
      }
    },

    /** Step 3: wait for Pinterest to finish transcoding. */
    async waitUntilReady(
      mediaId: string,
      { timeoutMs = 10 * 60_000, intervalMs = 5_000 } = {},
    ): Promise<MediaUploadStatus> {
      const deadline = Date.now() + timeoutMs;

      for (;;) {
        const status = await api.status(mediaId);
        if (status.status === 'succeeded') return status;
        if (status.status === 'failed') {
          throw new Error(`Pinterest failed to process media ${mediaId}.`);
        }
        if (Date.now() > deadline) {
          throw new Error(
            `Timed out after ${timeoutMs}ms waiting for media ${mediaId} (last status: ${status.status}).`,
          );
        }
        await sleep(intervalMs);
      }
    },

    /** Steps 1–3 in one call. Returns the media_id to attach to a pin. */
    async uploadAndWait(
      filePath: string,
      { mediaType = 'video' as MediaType, contentType = 'video/mp4' } = {},
    ): Promise<string> {
      const registration = await api.register(mediaType);
      await api.upload(registration, filePath, contentType);
      await api.waitUntilReady(registration.media_id);
      return registration.media_id;
    },
  };

  return api;
}
