import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { startDriverSimulator } from './driver-simulator';

let ioServer: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server {
  ioServer = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  ioServer.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected to Socket.IO: ${socket.id}`);

    // Join ride tracking room
    socket.on('ride:join', (bookingId: string) => {
      socket.join(`ride:${bookingId}`);
      console.log(`Socket ${socket.id} joined ride room: ride:${bookingId}`);
    });

    // Join driver notifications room
    socket.on('driver:join', (driverId: string) => {
      socket.join(`driver:${driverId}`);
      console.log(`Socket ${socket.id} joined driver room: driver:${driverId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Start background location simulator
  startDriverSimulator(ioServer);

  return ioServer;
}

export function getSocketServer(): Server | null {
  return ioServer;
}
