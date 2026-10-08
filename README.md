# AI Ride Booking System

This is a comprehensive Ride Booking system with an integrated AI agent for natural language booking, route optimization, and real-time ride management.

## Folder Structure

The project is structured as a monorepo containing two main parts:
- **`frontend/`**: The user interface and client application.
- **`backend/`**: The API, database models, AI integrations, and real-time socket server.

## Technologies Used

**Frontend (`frontend/`)**
- Next.js 14 & React 18
- TailwindCSS (Styling)
- Zustand (State Management)
- React Leaflet (Interactive Maps)
- Socket.IO Client (Real-time updates)

**Backend (`backend/`)**
- Node.js & Express
- TypeScript
- Prisma ORM (Database access)
- Socket.IO (Real-time WebSocket server)
- Google GenAI & OpenAI (AI Agent capabilities)
- Zod (Validation), JWT (Authentication), Bcrypt (Security)

## How to Setup the Project

1. **Install Dependencies**
   From the root of the project, run:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Ensure you have a `.env` file in the `backend/` directory configured properly with your database URL, AI API keys, and JWT secrets based on `.env.example`.

3. **Database Initialization**
   Set up your database schema and seed it with initial data:
   ```bash
   npm run db:push
   npm run db:seed
   ```
   *Note: Prisma client generation is handled via `npm run db:generate`.*

## How to Run Locally

You can run the frontend and backend concurrently or in separate terminals from the root directory:

**Run the Backend API:**
```bash
npm run dev:backend
```

**Run the Frontend App:**
```bash
npm run dev:frontend
```

## Database & Ports

- **Database:** This project uses **SQLite** by default. SQLite is a lightweight, file-based database, which means it **does not run on a separate network port** (unlike traditional databases such as MySQL or PostgreSQL). Instead, Prisma reads and writes directly to a local file (e.g., `dev.db`) located in the `backend/` directory.
- **Backend Server:** The Node.js Express API and Socket.IO server run on **Port 5000** (configurable in `backend/.env`).
- **Frontend Server:** The Next.js web application runs on **Port 3000**.


## How We Test

Testing is configured for the backend using **Vitest**. To run the test suite:
```bash
npm run test
```

## Deploy on Render

The root `render.yaml` configures both services and automatically deploys new
commits pushed to the connected Blueprint branch. Builds use the root npm
workspace lockfile. Render generates the JWT secret and supplies the backend's
public URL to the frontend, so no URLs need to be entered manually.

1. Commit and push `render.yaml` and the accompanying seed/Next.js changes to GitHub.
2. Open [Deploy to Render](https://render.com/deploy?repo=https://github.com/neerajdevk19-hub/car-booking),
   sign in, select the repository branch, and create the Blueprint using `render.yaml`.
3. Wait until `rideai-backend` and `rideai-frontend` are live, then open the
   frontend URL shown by Render. Future pushes deploy automatically.

The backend creates the SQLite schema at startup and seeds an empty database.
The `--if-empty` seed option preserves existing demo data when initialization
runs again. To enable Gemini, add `GEMINI_API_KEY` and optionally `GEMINI_MODEL`
to the backend's environment in Render; without a key, the local assistant works.

This is a public demo with simulated drivers and demo authentication. Do not use
it for real customer data. Free services have ephemeral storage: SQLite bookings
and conversations reset on redeploy, restart, or idle shutdown. For permanent
storage, configure a persistent database or a paid service with a persistent disk.
See [Render's free service limits](https://render.com/docs/free).

## Flow of the Project

1. **Authentication:** User logs in/registers via the frontend. The backend issues a JWT token.
2. **Booking via UI or AI:** The user either manually selects pickup and drop-off points or interacts with the natural language AI assistant to book a ride.
3. **AI Processing:** The AI processes the intent, identifies coordinates, and interacts with the internal system to dispatch a ride.
4. **Database & Real-time Sync:** The backend saves the ride state in the database and emits `Socket.IO` events to the frontend.
5. **Live Tracking:** The frontend uses React Leaflet to show the ride in real-time, consuming socket events to update the car's position on the map.

## Route Optimization Scoring Logic
The AI agent includes a dynamic route optimization engine to select the best possible route based on real-time traffic conditions.

### The Algorithm
`Score = ETA + (Congestion * 0.05) + (Distance * 0.2)`
**The lowest score wins.**
1. **ETA (Primary Factor):** Each minute of ETA contributes 1 point.
2. **Congestion Penalty (Secondary Factor):** Each percentage point of congestion adds 0.05 points.
3. **Distance Penalty (Tertiary Factor):** Each kilometer adds 0.2 points.

During an active ride, the system continuously evaluates if a better route is available due to shifting traffic. The AI will suggest an alternate route only if it saves **5 minutes or more** or avoids a high-congestion spike.

---
**See `overview.md` for a deep dive into the user guide, testing prompts, and system limits.**
