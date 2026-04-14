# SportsBook - Admin Portal
The **SportsBook Admin Portal** is a management dashboard (Created in **Next.js 15**) designed for facility administrators. It gives control over users, bookings, and sports events. This project shares a central database and WebSocket server with the User Platform.
## Admin Capabilities
### User & Athlete Management
*   **Directory Access**: Full overview of all registered athletes and their activity.
### Live match control
*   **Score Management**: Update live match scores that broadcast globally.
*   **Event Control**: Start, pause, or conclude match sessions.
*   **Real-time Sync**: Changes are instantly pushed to the User Platform via WebSockets.
### Facility & Booking Oversight
*   **Approval System**: Manage court bookings and equipment returns.

### Security
*   **Rate Limiting**: Global and per-IP rate limiting is enforced via Next.js Middleware (30 requests/min per IP, 500/min total globally) to ensure dashboard stability.

## The Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15, React 19 |
| **Styling** | Tailwind CSS, Framer Motion |
| **Database** | PostgreSQL (Prisma ORM) |
| **Networking** | Socket.io |
## Setup
### 1. Installation
```bash
npm install # To install the dependencies
```
### 2. Environment Configuration
Create a `.env` file in the `admin-website` root:
```env
DATABASE_URL=""
JWT_SECRET=""
NEXT_PUBLIC_SOCKET_URL=""
SMTP_HOST=""
SMTP_USER=""
SMTP_PASS=""
```

### 3. Execution
```bash
npm run dev
```
## Note
- Access is strictly restricted to accounts with the **`Admin`** role.
- Self-registration is disabled.
---
