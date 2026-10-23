import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { RoomManager } from '../domain/room-manager.js';
import { extractYouTubeVideoId, sanitizeUsername } from '../utils/sanitizer.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const createRoomSchema = z.object({
  initialVideoUrl: z.string().optional(),
  hostUsername: z.string().min(1).max(24).optional(),
});

export function createRoomsRouter(roomManager: RoomManager): Router {
  const router = Router();

  /**
   * POST /api/rooms
   * Returns: { roomId } only
   */
  router.post('/rooms', async (req: Request, res: Response) => {
    try {
      const parsed = createRoomSchema.safeParse(req.body || {});
      const hostUsername = parsed.success && parsed.data.hostUsername
        ? sanitizeUsername(parsed.data.hostUsername)
        : 'Host';
      
      let videoId: string | undefined;
      if (parsed.success && parsed.data.initialVideoUrl) {
        videoId = extractYouTubeVideoId(parsed.data.initialVideoUrl) ?? undefined;
      }

      const hostUserId = randomUUID();
      const room = await roomManager.createRoom(hostUserId, hostUsername, videoId);

      // SPEC: { roomId } only
      return res.status(201).json({
        roomId: room.id,
      });
    } catch (err) {
      logger.error({ error: (err as Error).message }, 'Failed to create room endpoint');
      return res.status(500).json({ error: 'Failed to create room' });
    }
  });

  /**
   * GET /api/rooms/:id/exists
   * Returns: { exists: boolean } only
   */
  router.get('/rooms/:id/exists', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id || id.length > 64) {
        return res.json({ exists: false });
      }

      const room = await roomManager.hydrateFromDB(id);
      return res.json({ exists: !!room });
    } catch {
      return res.json({ exists: false });
    }
  });

  return router;
}
