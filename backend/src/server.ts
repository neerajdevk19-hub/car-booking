import http from 'http';
import { app } from './app';
import { PORT } from './config/constants';
import { initSocketServer } from './sockets/socket.server';

const server = http.createServer(app);

// Initialize Socket.IO
initSocketServer(server);

server.listen(PORT, () => {
  console.log(`🚀 RideAI API & WebSocket Server running on port ${PORT}`);
});
