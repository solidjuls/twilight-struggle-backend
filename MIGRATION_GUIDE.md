# Migration Guide: Next.js API Routes to NestJS

This document outlines the migration of the tournaments API from Next.js API routes to NestJS.

## ✅ Completed: GET Endpoints

### Original Next.js API Route
**File:** `pages/api/game/tournaments.ts`

### Migrated NestJS Implementation
**Files:**
- `src/tournaments/tournaments.controller.ts`
- `src/tournaments/tournaments.service.ts`
- `src/tournaments/dto/tournament.dto.ts`

### Endpoints Migrated

| Method | Original Endpoint | NestJS Endpoint | Status |
|--------|------------------|-----------------|---------|
| GET | `/api/game/tournaments?status=1,2,3,4` | `/api/tournaments?status=1,2,3,4` | ✅ Complete |
| GET | `/api/game/tournaments?id=322` | `/api/tournaments?id=322` | ✅ Complete |
| GET | `/api/game/tournaments?id=322&players=true` | `/api/tournaments?id=322&players=true` | ✅ Complete |

### Key Changes

1. **URL Structure**: Removed `/game` prefix for cleaner API structure
2. **Module Organization**: Separated into dedicated tournaments module
3. **Type Safety**: Added DTOs for better type safety
4. **Database Service**: Created dedicated database service using Prisma
5. **Error Handling**: Improved error handling with NestJS exception filters

### Testing the Migrated Endpoints

```bash
# Get tournaments by status
curl "http://localhost:4001/api/tournaments?status=1,2,3,4"

# Get specific tournament
curl "http://localhost:4001/api/tournaments?id=322"

# Get registered players
curl "http://localhost:4001/api/tournaments?id=322&players=true"

# Health check
curl "http://localhost:4001/api/tournaments/health"
```

## 🚧 Pending: Other HTTP Methods

The following endpoints still need to be migrated:

### POST Endpoints
- Tournament registration: `POST /api/game/tournaments`
- Tournament status update: `POST /api/game/tournaments`

### PUT Endpoints
- Full tournament update: `PUT /api/game/tournaments`

### PATCH Endpoints
- Tournament creation: `PATCH /api/game/tournaments`

### DELETE Endpoints
- Tournament deletion: `DELETE /api/game/tournaments`

## Database Integration

### Current Setup
- ✅ Prisma client configured
- ✅ Database service created
- ✅ Connection to existing MySQL database
- ✅ Schema copied from main project

### Database Functions Migrated
- ✅ `getTournamentsByStatus()`
- ✅ `getTournamentsById()`
- ✅ `getRegisteredPlayers()`

### Database Functions Pending
- ⏳ `addTournament()`
- ⏳ `updateTournament()`
- ⏳ `updateTournamentFull()`
- ⏳ `registerTournament()`
- ⏳ `unregisterTournament()`
- ⏳ `removeTournament()`

## Next Steps

1. **Implement POST endpoints** for tournament registration and status updates
2. **Implement PUT endpoints** for full tournament updates
3. **Implement PATCH endpoints** for tournament creation
4. **Implement DELETE endpoints** for tournament deletion
5. **Add authentication/authorization** middleware
6. **Add validation** using class-validator
7. **Add comprehensive error handling**
8. **Add logging** for better debugging
9. **Add unit and integration tests**
10. **Update frontend** to use new NestJS endpoints

## Frontend Integration

Once all endpoints are migrated, update the frontend to point to the new NestJS backend:

```typescript
// Change from:
const response = await axios.get('/api/game/tournaments?status=1,2,3,4');

// To:
const response = await axios.get('http://localhost:4001/api/tournaments?status=1,2,3,4');
```

## Benefits of Migration

1. **Better Architecture**: Modular structure with clear separation of concerns
2. **Type Safety**: Strong typing with TypeScript and DTOs
3. **Scalability**: Easy to add new features and modules
4. **Testing**: Better testing capabilities with NestJS testing utilities
5. **Documentation**: Auto-generated API documentation with Swagger (can be added)
6. **Validation**: Built-in validation with decorators
7. **Dependency Injection**: Better dependency management
8. **Independent Deployment**: Backend can be deployed separately from frontend
