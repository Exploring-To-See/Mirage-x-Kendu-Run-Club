import type { PinterestClient } from './client.ts';
import type { Board, BoardSection, CreateBoardInput, Pin } from './types.ts';

export function boards(client: PinterestClient) {
  return {
    /** Every board on the authorised account. Needs `boards:read`. */
    list: (limit = 250) => client.collect<Board>('/boards', {}, limit),

    get: (boardId: string) => client.request<Board>(`/boards/${boardId}`),

    create: (input: CreateBoardInput) =>
      client.request<Board>('/boards', { method: 'POST', body: input }),

    delete: (boardId: string) =>
      client.request<void>(`/boards/${boardId}`, { method: 'DELETE' }),

    sections: (boardId: string) =>
      client.collect<BoardSection>(`/boards/${boardId}/sections`),

    /** Pins on a board, newest first. Needs `boards:read` and `pins:read`. */
    pins: (boardId: string, limit = 500) =>
      client.collect<Pin>(`/boards/${boardId}/pins`, {}, limit),

    /** Lazy variant — use when you want to stop early. */
    pinsStream: (boardId: string, limit = 500) =>
      client.paginate<Pin>(`/boards/${boardId}/pins`, {}, limit),
  };
}
