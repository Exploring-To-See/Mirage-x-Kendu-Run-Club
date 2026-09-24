import type { PinterestClient } from './client.ts';
import type { CreatePinInput, Pin } from './types.ts';

export function pins(client: PinterestClient) {
  return {
    list: (limit = 500) => client.collect<Pin>('/pins', {}, limit),

    get: (pinId: string) => client.request<Pin>(`/pins/${pinId}`),

    /** Needs `pins:write`. On trial access the pin is a sandbox entity. */
    create: (input: CreatePinInput) =>
      client.request<Pin>('/pins', { method: 'POST', body: input }),

    delete: (pinId: string) => client.request<void>(`/pins/${pinId}`, { method: 'DELETE' }),

    /**
     * Per-pin metrics. `startDate`/`endDate` are YYYY-MM-DD and must be within
     * the last 90 days.
     */
    analytics: (
      pinId: string,
      startDate: string,
      endDate: string,
      metricTypes = ['IMPRESSION', 'SAVE', 'PIN_CLICK', 'OUTBOUND_CLICK'],
    ) =>
      client.request<Record<string, unknown>>(`/pins/${pinId}/analytics`, {
        query: {
          start_date: startDate,
          end_date: endDate,
          metric_types: metricTypes.join(','),
        },
      }),
  };
}

/** Pick the largest available still for a pin, for use as a Remotion asset. */
export function bestImageUrl(pin: Pin): string | undefined {
  const images = pin.media?.images;
  if (!images) return pin.media?.cover_image_url;

  const widest = Object.values(images)
    .filter((v): v is NonNullable<typeof v> => Boolean(v?.url))
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return widest?.url ?? pin.media?.cover_image_url;
}
