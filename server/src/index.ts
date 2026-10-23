import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { app, roomManager } from './app.js';
import { env, isOriginAllowed } from './config/env.js';
import { logger } from './utils/logger.js';
import { SocketMessageHandler } from './socket/message-handler.js';

const server = http.createServer(app);

// Initialize Socket.IO server
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024, // 10KB payload limit per spec
});

// Initialize socket handlers
new SocketMessageHandler(io, roomManager);

server.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
});

export { server, io };
