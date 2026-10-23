import { PrismaClient, ChatMessage } from '@prisma/client';
import { db } from '../db/client.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatRepository {
  constructor(private prisma: PrismaClient = db) {}

  async saveMessage(
    roomId: string,
    userId: string,
    username: string,
    text: string
  ): Promise<ChatMessage | null> {
    if (!UUID_REGEX.test(roomId)) {
      return null;
    }
    const safeUserId = UUID_REGEX.test(userId) ? userId : (await import('crypto')).randomUUID();
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        userId: safeUserId,
        username: username.slice(0, 24),
        text: text.slice(0, 300),
      },
    });
  }

  async getRecentMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
    if (!UUID_REGEX.test(roomId)) {
      return [];
    }
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
