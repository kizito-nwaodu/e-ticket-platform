# Integrated E-Ticketing Platform

A web-based event ticketing and gate validation system built with React, Node.js, Express, and Prisma.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: SQLite (Prisma)
- **Deployment**: Vercel

## Key Features

- Event listing and attendee registration.
- Digital entry passes with QR codes.
- Camera-based gate scanner with duplicate admission prevention.
- Dedicated portals for attendees, organizers, gate staff, supervisors, and admins.
- Attendance export and activity audit logs.

## Setup and Installation

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Install dependencies for server and client
npm run install:all

# Initialize database schema and seed demo records
cd server
npx prisma db push
npm run seed
cd ..
```

### Running the Application

Start the backend API (port 5000):
```bash
cd server
npm run dev
```

Start the frontend client (port 5173):
```bash
cd client
npm run dev
```

## Demo Credentials

Default password for all accounts: `Password@123`

| Role | Email | Access |
|---|---|---|
| Attendee | attendee@iconic.edu.ng | View personal passes and entry QR codes |
| Organiser | organiser@iconic.edu.ng | Event management, registrations, and exports |
| Scanner Operator | scanner@iconic.edu.ng | Gate camera scanner for validating passes |
| Gate Supervisor | supervisor@iconic.edu.ng | Gate resolution and manual overrides |
| Administrator | admin@iconic.edu.ng | System-wide events, users, and audit logs |
| Auditor | auditor@iconic.edu.ng | Read-only inspection of system audit logs |
