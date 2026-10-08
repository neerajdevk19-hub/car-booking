# Ultimate Project Overview & System Guide

This document is a comprehensive guide to everything in the AI Ride Booking system. It covers all terminal commands, internal architecture, real-time tracking mechanisms, the traffic routing algorithm, and detailed instructions for testing the AI agent.

---

## 1. Project Commands & Setup (Sari Commands)

To run, manage, and test this project, you use the following scripts from the root directory. This monorepo uses workspaces to manage `frontend` and `backend` together.

- **`npm install`**: Installs all dependencies for both the frontend and backend simultaneously.
- **`npm run db:push`**: Syncs your Prisma schema with the database (creates tables).
- **`npm run db:generate`**: Generates the Prisma Client used in the backend code to query the database.
- **`npm run db:seed`**: Populates the database with initial dummy data (drivers, zones, simulated traffic points).
- **`npm run dev:backend`**: Starts the Node.js backend server with hot-reloading (usually on port 3001 or 5000).
- **`npm run dev:frontend`**: Starts the Next.js frontend server (usually on port 3000).
- **`npm run build:frontend` & `npm run build:backend`**: Compiles the code for production deployment.
- **`npm run test`**: Runs the Vitest automated test suite for the backend APIs and logic.

---

## 2. Core Architecture (Kese Work Ho Rha Hai)

The system operates on a modern client-server architecture powered by real-time WebSockets.

### Frontend (`/frontend`)
- **Framework**: Built with Next.js and React.
- **State Management**: Uses **Zustand** to keep track of user location, AI chat history, active rides, and driver positions.
- **Maps**: Uses **React Leaflet** (with OpenStreetMap) to draw the visual map, polylines (routes), and markers (cars, pickup, dropoff).

### Backend (`/backend`)
- **Framework**: Node.js and Express API.
- **Database**: PostgreSQL/SQLite managed via Prisma ORM.
- **Real-time Server**: **Socket.IO** is attached to the Express server to handle continuous 2-way communication (like live GPS tracking).
- **AI Integration**: Connects to LLMs (Google GenAI/OpenAI) to parse human language into executable booking functions.

---

## 3. The Booking Flow (Booking Kese Hoti Hai)

1. **User Intent**: The user either clicks on the interactive map to select locations or tells the AI: *"Book a car to Central Park."*
2. **AI Parsing**: If using AI, the backend extracts the coordinates for pickup and drop-off and standardizes the request into JSON.
3. **Route Calculation**: The backend calculates the fastest polyline (path) and calculates the ETA and pricing based on distance.
4. **Database Save**: The ride is created in the database as `PENDING`.
5. **Dispatch & Accept**: A simulated driver in the area is assigned. The ride status changes to `ACCEPTED`.
6. **Socket Broadcast**: The backend emits an event via Socket.IO to the frontend, which immediately updates the UI without requiring a page refresh.

---

## 4. Live Tracking Mechanism (Tracking Kese Work Kar Rhi Hai)

Live tracking gives the illusion that a real car is moving on the map. This is achieved through a continuous backend loop:

1. **The Route (Polyline)**: When a ride starts, the backend has an array of GPS coordinates representing the path from the driver to the user.
2. **The Worker Loop**: The backend starts an asynchronous interval (a loop that runs every few seconds).
3. **Position Calculation**: During each tick of the loop, the backend calculates the car's next step along the polyline based on simulated speed.
4. **Socket.IO `location_update`**: The backend fires an event:
   ```javascript
   socket.emit('location_update', { rideId: '123', lat: 40.71, lng: -74.00, heading: 90 })
   ```
5. **Frontend Rendering**: The Next.js app listens to this event, updates the Zustand state, and React Leaflet smoothly animates the car marker to the new coordinates.

---

## 5. Traffic & Route Optimization Logic (Traffic Wala Logic)

The AI agent includes a dynamic route optimization engine to select the best possible route based on real-time traffic conditions.

### The Scoring Algorithm
The system evaluates multiple potential paths using this formula:
`Score = ETA + (Congestion * 0.05) + (Distance * 0.2)`

**The lowest score wins.**
1. **ETA (Primary):** Every minute of estimated time adds 1 point. Faster routes are heavily favored.
2. **Congestion Penalty (Secondary):** Every percentage point of traffic adds 0.05 points. If two routes have similar times, the one with less stop-and-go traffic wins.
3. **Distance Penalty (Tertiary):** Every kilometer adds 0.2 points. This prevents the system from choosing extremely long detours just to save 1 minute.

### Mid-Ride Traffic Updates
While a ride is active, traffic conditions can change. The backend continuously checks for better routes.
- The AI will **only** suggest a new route if it saves **5 minutes or more** OR if a massive traffic spike occurs on the current route.
- **User Prompt**: If a better route is found, the Socket sends an alert to the UI: *"Traffic increased. Found an alternate route saving 6 minutes. Switch?"*

---

## 6. How AI Works & Rate Limiting (AI Limits Kese Work Karta Hai)

The AI chat acts as a "power user" interface, directly communicating with backend services via natural language.

### Hitting the Limit
To prevent abuse (and save API costs), users are rate-limited (e.g., 5 AI queries per hour). 
1. **HTTP 429 Status**: Once the limit is exceeded, the backend stops processing LLM requests and returns a `429 Too Many Requests` error.
2. **Graceful Fallback**: The frontend catches this error and displays: *"AI limit reached. Please use the manual booking interface."*
3. **Manual Mode**: The app does not break. Users simply revert to using the standard buttons and map clicks to book rides. The core app remains 100% functional without AI.

---

## 7. AI Testing Guide & Prompts (AI Prompts Check Karne Ke Liye)

To test the full capability of the system, paste these prompts into the AI chat window:

**Standard Booking:**
- *"I need a ride from Times Square to Central Park."*
- *"Book a premium SUV for me right now."*

**Complex Multi-Step Queries:**
- *"I'm at JFK Airport, take me to Brooklyn Bridge and make sure it's an economy car."*
- *"What's the price for a ride from my current location to the nearest hospital?"*

**Testing Route/Traffic Logic:**
- *"Is there a faster route? Traffic seems bad right now."* (Forces the backend to recalculate the Scoring Algorithm).

**Active Ride Management:**
- *"Where is my driver right now?"*
- *"Cancel my current ride immediately."*

**Testing the Fallback (Spam Test):**
- Send random messages rapidly like *"Hello"*, *"Test"*, *"Book a car"* multiple times. Once the backend rate limit is hit, verify that the manual map UI is suggested and still works correctly.
