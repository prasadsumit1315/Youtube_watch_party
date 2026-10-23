import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { RoomManager } from '../src/domain/room-manager.js';
import { SocketMessageHandler } from '../src/socket/message-handler.js';
import { Role } from '@prisma/client';

describe('Phase 4: REST API & Socket Handler Integration Tests', () => {
  let server: any;
  let ioServer: Server;
  let port: number;
  let roomManager: RoomManager;
  let testApp: any;

  // In-memory repositories mock
  const mockRoomRepo = {
    createRoomWithHost: async (data: any) => ({
      id: 'room-uuid-' + Math.random().toString(36).substring(2, 8),
      code: data.code,
      hostUserId: data.hostUserId,
      currentVideoId: data.currentVideoId ?? null,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      isClosed: false,
    }),
    findByCode: async () => null,
    findById: async () => null,
    updateCurrentVideo: async () => {},
    transferHost: async () => {},
    touchActivity: async () => {},
    deleteExpiredRooms: async () => 0,
  } as any;

  const mockMemberRepo = {
    upsertMember: async () => {},
    updateRole: async () => {},
    markLeft: async () => {},
    removeMember: async () => {},
  } as any;

  const mockBanRepo = {
    banUser: async () => {},
    isBanned: async () => false,
    getBannedUsers: async () => [],
  } as any;

  beforeAll(async () => {
    roomManager = new RoomManager(mockRoomRepo, mockMemberRepo, mockBanRepo);
    const configured = createApp(roomManager);
    testApp = configured.app;

    server = createServer(testApp);
    ioServer = new Server(server, {
      cors: { origin: '*' },
    });
    new SocketMessageHandler(ioServer, roomManager, mockRoomRepo, mockMemberRepo, mockBanRepo);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    server.close();
  });

  describe('REST Endpoints', () => {
    it('POST /api/rooms creates room and returns ONLY { roomId }', async () => {
      const res = await request(testApp)
        .post('/api/rooms')
        .send({ hostUsername: 'Host1' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('roomId');
      expect(res.body).not.toHaveProperty('participants');
      expect(res.body).not.toHaveProperty('socketId');
    });

    it('GET /api/rooms/:id/exists returns { exists: boolean } only', async () => {
      const room = await roomManager.createRoom('u-1', 'HostGuy');
      const res = await request(testApp).get(`/api/rooms/${room.id}/exists`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ exists: true });

      const notFoundRes = await request(testApp).get('/api/rooms/non-existent-id/exists');
      expect(notFoundRes.status).toBe(200);
      expect(notFoundRes.body).toEqual({ exists: false });
    });
  });

  describe('Socket.IO Events & Flows', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;
    let testRoomId: string;

    beforeAll(async () => {
      const room = await roomManager.createRoom('u-host', 'FirstHost', 'dQw4w9WgXcQ');
      testRoomId = room.id;
    });

    afterAll(() => {
      if (client1?.connected) client1.disconnect();
      if (client2?.connected) client2.disconnect();
    });

    it('client1 joins room, becomes HOST, and receives sync_state with reconnect token', async () => {
      client1 = Client(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        client1.on('connect', () => resolve());
      });

      const syncStatePromise = new Promise<any>((resolve) => {
        client1.on('sync_state', (state) => {
          resolve(state);
        });
      });

      client1.emit('join_room', {
        roomId: testRoomId,
        username: '<b>HostGuy</b>',
      });

      const syncState = await syncStatePromise;
      expect(syncState.videoId).toBe('dQw4w9WgXcQ');
      expect(syncState.ownRole).toBe(Role.HOST);
      expect(syncState.participants[0].username).toBe('HostGuy'); // HTML tags stripped
      expect(syncState.reconnectToken).toBeDefined();
    });

    it('client2 joins room, becomes PARTICIPANT, and client1 receives user_joined', async () => {
      client2 = Client(`http://127.0.0.1:${port}`, {
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        client2.on('connect', () => resolve());
      });

      const userJoinedPromise = new Promise<any>((resolve) => {
        client1.on('user_joined', (data) => {
          resolve(data);
        });
      });

      client2.emit('join_room', {
        roomId: testRoomId,
        username: 'ViewerUser',
      });

      const joinedEvent = await userJoinedPromise;
      expect(joinedEvent.user.username).toBe('ViewerUser');
      expect(joinedEvent.user.role).toBe(Role.PARTICIPANT);
      expect(joinedEvent.user).not.toHaveProperty('socketId');
    });

    it('PARTICIPANT cannot play directly, receives FORBIDDEN error_event', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        client2.once('error_event', (err) => resolve(err));
      });

      client2.emit('play', { currentTime: 15 });
      const err = await errorPromise;
      expect(err.code).toBe('FORBIDDEN');
    });

    it('HOST plays, client2 receives updated sync_state with PLAYING state', async () => {
      const syncPromise = new Promise<any>((resolve) => {
        client2.once('sync_state', (state) => resolve(state));
      });

      client1.emit('play', { currentTime: 20 });
      const state = await syncPromise;
      expect(state.playState).toBe('PLAYING');
      expect(state.currentTime).toBe(20);
    });

    it('PARTICIPANT can request_action, HOST receives action_requested and approves it', async () => {
      const requestReceivedPromise = new Promise<any>((resolve) => {
        client1.once('action_requested', (req) => resolve(req));
      });

      client2.emit('request_action', {
        actionType: 'PAUSE',
        targetTime: 25,
      });

      const receivedReq = await requestReceivedPromise;
      expect(receivedReq.actionType).toBe('PAUSE');
      expect(receivedReq.username).toBe('ViewerUser');

      // Now HOST approves
      const syncAfterApproval = new Promise<any>((resolve) => {
        client2.once('sync_state', (state) => resolve(state));
      });

      client1.emit('approve_request', { requestId: receivedReq.id });
      const state = await syncAfterApproval;
      expect(state.playState).toBe('PAUSED');
      expect(state.currentTime).toBe(25);
    });

    it('HOST promotes client2 to MODERATOR, and role_assigned is broadcast', async () => {
      const roleAssignedPromise = new Promise<any>((resolve) => {
        client2.once('role_assigned', (data) => resolve(data));
      });

      const room = roomManager.getRoom(testRoomId)!;
      const client2Participant = Array.from(room['participants'].values()).find(
        (p) => p.username === 'ViewerUser'
      )!;

      client1.emit('assign_role', {
        targetUserId: client2Participant.userId,
        newRole: Role.MODERATOR,
      });

      const res = await roleAssignedPromise;
      expect(res.role).toBe(Role.MODERATOR);
      expect(res.targetUserId).toBe(client2Participant.userId);
    });

    it('Chat messages are HTML escaped and broadcast to all members', async () => {
      const chatPromise = new Promise<any>((resolve) => {
        client1.once('chat_message', (msg) => resolve(msg));
      });

      client2.emit('chat_message', {
        text: 'Hello <b>World</b> & friends!',
      });

      const msg = await chatPromise;
      expect(msg.username).toBe('ViewerUser');
      expect(msg.text).toBe('Hello &lt;b&gt;World&lt;/b&gt; &amp; friends!');
    });
  });
});
