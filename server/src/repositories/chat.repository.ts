import { PrismaClient, ChatMessage } from '@prisma/client';
import { db } from '../db/client.js';

export class ChatRepository {
  constructor(private prisma: PrismaClient = db) {}

  async saveMessage(
    roomId: string,
    userId: string,
    username: string,
    text: string
  ): Promise<ChatMessage> {
    return this.prisma.chatMessage.create({
      data: {
        roomId,
        userId,
        username,
        text,
      },
    });
  }

  async getRecentMessages(roomId: string, limit = 50): Promise<ChatMessage[]> {
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
