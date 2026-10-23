import { randomInt } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Room } from './room.js';
import { Participant } from './participant.js';
import { RoomRepository } from '../repositories/room.repository.js';
import { BanRepository } from '../repositories/ban.repository.js';
import { MemberRepository } from '../repositories/member.repository.js';
import { Role } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// Alphabet with no ambiguous characters (omits 0, 1, I, O, L)
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 8;

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = randomInt(0, CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return code;
}

export class RoomManager {
  // In-memory active rooms keyed by roomId AND roomCode
  private roomsById: Map<string, Room> = new Map();
  private roomsByCode: Map<string, Room> = new Map();

  private roomRepo: RoomRepository;
  private memberRepo: MemberRepository;
  private banRepo: BanRepository;

  constructor(
    roomRepo?: RoomRepository,
    memberRepo?: MemberRepository,
    banRepo?: BanRepository
  ) {
    this.roomRepo = roomRepo ?? new RoomRepository();
    this.memberRepo = memberRepo ?? new MemberRepository();
    this.banRepo = banRepo ?? new BanRepository();

    // Restore cached in-memory rooms across dev restarts
    this.loadCache();

    // Start periodic background cleanup for empty in-memory rooms and expired DB rooms
    this.startCleanupJobs();
  }

  async createRoom(
    hostUserId: string,
    hostUsername: string,
    initialVideoId?: string
  ): Promise<Room> {
    const code = generateRoomCode();
    const roomId = (await import('crypto')).randomUUID();

    // 1. Create in-memory Room instance first for instant availability
    const room = new Room({
      id: roomId,
      code,
      hostUserId,
      initialVideoId,
    });
    this.registerRoomInMemory(room);

    // 2. Persist to DB if database is configured
    try {
      if (env.DATABASE_URL) {
        await this.roomRepo.createRoomWithHost({
          id: roomId,
          code,
          hostUserId,
          hostUsername,
          currentVideoId: initialVideoId,
        });
      }
    } catch (err) {
      logger.warn(
        { error: (err as Error).message, roomId: room.id },
        'DB persistence skipped or failed for room creation; running in-memory'
      );
    }

    return room;
  }

  getRoom(idOrCode: string): Room | undefined {
    return this.roomsById.get(idOrCode) ?? this.roomsByCode.get(idOrCode.toUpperCase());
  }

  /**
   * Hydrates room from PostgreSQL database if not present in memory.
   * Requirement:
   * "On join_room, if the room is not in memory, hydrate it from DB (members' roles, bans, video).
   * Playback resets to paused at 0."
   */
  async hydrateFromDB(codeOrId: string): Promise<Room | null> {
    const inMem = this.getRoom(codeOrId);
    if (inMem) return inMem;

    try {
      let dbRoom = null;
      if (codeOrId.length === 8) {
        dbRoom = await this.roomRepo.findByCode(codeOrId.toUpperCase());
      }
      if (!dbRoom) {
        dbRoom = await this.roomRepo.findById(codeOrId);
      }

      if (!dbRoom) return null;

      // Check if room is expired
      if (dbRoom.expiresAt < new Date()) {
        logger.info({ roomId: dbRoom.id }, 'Attempted to hydrate expired room');
        return null;
      }

      const room = new Room({
        id: dbRoom.id,
        code: dbRoom.code,
        hostUserId: dbRoom.hostUserId,
        initialVideoId: dbRoom.currentVideoId,
      });

      // Hydrate bans
      const bans = await this.banRepo.getBannedUsers(dbRoom.id);
      room.loadBannedUsers(bans.map((b) => b.userId));

      this.registerRoomInMemory(room);
      logger.info({ roomId: room.id, code: room.code }, 'Hydrated room from DB into memory');
      return room;
    } catch (err) {
      logger.warn({ error: (err as Error).message }, 'DB room lookup failed');
      return null;
    }
  }

  private getCachePath(): string {
    return path.join(process.cwd(), '.rooms-cache.json');
  }

  private loadCache(): void {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const p = this.getCachePath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const item of list) {
            const room = new Room({
              id: item.id,
              code: item.code,
              hostUserId: item.hostUserId,
              initialVideoId: item.state?.videoId,
            });
            if (item.state) {
              room.state = item.state;
            }
            this.roomsById.set(room.id, room);
            this.roomsByCode.set(room.code.toUpperCase(), room);
          }
          logger.info({ count: list.length }, 'Restored rooms from dev cache');
        }
      }
    } catch {
      // ignore
    }
  }

  public saveCache(): void {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const list = Array.from(this.roomsById.values()).map((r) => ({
        id: r.id,
        code: r.code,
        hostUserId: r.hostUserId,
        state: r.state,
      }));
      fs.writeFileSync(this.getCachePath(), JSON.stringify(list, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  private registerRoomInMemory(room: Room): void {
    this.roomsById.set(room.id, room);
    this.roomsByCode.set(room.code.toUpperCase(), room);
    this.saveCache();
  }

  removeRoomFromMemory(roomId: string): void {
    const room = this.roomsById.get(roomId);
    if (room) {
      this.roomsById.delete(room.id);
      this.roomsByCode.delete(room.code.toUpperCase());
      this.saveCache();
    }
  }

  /**
   * Cleanup empty rooms:
   * Rooms empty for > 10 minutes in memory are removed from memory (can be re-hydrated if visited).
   */
  cleanupEmptyRooms(): number {
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;

    for (const [roomId, room] of this.roomsById.entries()) {
      if (room.getParticipantCount() === 0 && room.emptySince && now - room.emptySince > TEN_MINUTES_MS) {
        this.removeRoomFromMemory(roomId);
        cleaned++;
      }
    }

    return cleaned;
  }

  private startCleanupJobs(): void {
    // Empty rooms cleanup every 5 minutes
    setInterval(() => {
      try {
        const cleaned = this.cleanupEmptyRooms();
        if (cleaned > 0) {
          logger.info({ cleaned }, 'Evicted idle empty rooms from memory');
        }
      } catch (err) {
        logger.error({ error: (err as Error).message }, 'Error in empty rooms cleanup');
      }
    }, 5 * 60 * 1000);

    // Database expired rooms cleanup every 15 minutes (throttled to 5 min per spec)
    setInterval(async () => {
      try {
        await this.roomRepo.deleteExpiredRooms();
      } catch (err) {
        // Log gracefully if DB not configured yet in local test
        logger.warn({ error: (err as Error).message }, 'Error in expired rooms DB cleanup');
      }
    }, 15 * 60 * 1000);
  }
}
