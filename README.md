# NestJS Backend API

A NestJS backend API service designed to replace the Next.js API routes with a dedicated backend service.

## Features

- ✅ NestJS framework with TypeScript
- ✅ CORS enabled for frontend communication
- ✅ Global API prefix (`/api`)
- ✅ Health check endpoint
- ✅ Environment configuration
- ✅ Development hot reload

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

The server will start on `http://localhost:4000`

### Available Scripts

- `npm run start` - Start the application
- `npm run start:dev` - Start in development mode with hot reload
- `npm run start:debug` - Start in debug mode
- `npm run build` - Build the application
- `npm run start:prod` - Start the production build

## API Endpoints

### Base URL: `http://localhost:4001/api`

#### General Endpoints
- `GET /` - Hello World endpoint
- `GET /health` - Health check endpoint

#### Tournaments Module
- `GET /tournaments` - Get tournaments with optional filters
- `GET /tournaments/health` - Tournaments module health check

### Tournament API Examples

**Get tournaments by status:**
```bash
curl "http://localhost:4001/api/tournaments?status=1,2,3,4"
```

**Get tournament by ID:**
```bash
curl "http://localhost:4001/api/tournaments?id=322"
```

**Get registered players for a tournament:**
```bash
curl "http://localhost:4001/api/tournaments?id=322&players=true"
```

### Example Responses

**GET /api/**
```json
"Hello World from NestJS Backend!"
```

**GET /api/health**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "nestjs-backend",
  "version": "1.0.0",
  "uptime": 123.456
}
```

## Project Structure

```
src/
├── app.controller.ts           # Main application controller
├── app.module.ts              # Root application module
├── app.service.ts             # Main application service
├── main.ts                    # Application entry point
├── database/
│   ├── database.module.ts     # Database module (Prisma)
│   └── database.service.ts    # Database service
└── tournaments/
    ├── dto/
    │   └── tournament.dto.ts   # Data Transfer Objects
    ├── tournaments.controller.ts # Tournaments controller
    ├── tournaments.module.ts    # Tournaments module
    └── tournaments.service.ts   # Tournaments service
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Next Steps

1. Add database integration (Prisma/TypeORM)
2. Implement authentication/authorization
3. Create specific API modules (tournaments, users, etc.)
4. Add validation and error handling
5. Implement logging
6. Add testing setup

## Deployment

This backend is designed to be deployed independently from the frontend.

### Vercel Deployment

This project is configured for Vercel deployment. Follow these steps:

1. **Create a new repository** and copy the contents of this folder

2. **Connect to Vercel**
   ```bash
   # Install Vercel CLI (optional)
   npm i -g vercel

   # Deploy
   vercel
   ```

3. **Configure Environment Variables** in Vercel Dashboard:
   - Go to Project > Settings > Environment Variables
   - Add the following variables:

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | MySQL connection string |
   | `JWT_SECRET` | Secret for JWT tokens |
   | `TOKEN_SECRET` | Secret for email verification tokens |
   | `FRONTEND_URL` | Your frontend URL (for email links) |
   | `CORS_ORIGINS` | Comma-separated allowed origins |
   | `SMTP_HOST` | SMTP server hostname |
   | `SMTP_PORT` | SMTP port (587 or 465) |
   | `SMTP_SECURE` | "true" or "false" |
   | `SMTP_USER` | SMTP username |
   | `SMTP_PASSWORD` | SMTP password |

4. **Database Setup**
   - Use a MySQL-compatible database (PlanetScale, AWS RDS, etc.)
   - Ensure your database allows connections from Vercel's IP ranges

### Build Settings

If deploying via Vercel Dashboard:
- **Build Command**: `npm run vercel-build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Other Deployment Options

- **Development**: Local development server
- **Docker**: Container-based deployment
- **AWS/Heroku**: Traditional cloud platforms
