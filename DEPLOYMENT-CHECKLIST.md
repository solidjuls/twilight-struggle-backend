# Vercel Deployment Checklist

## Pre-Deployment Setup

### 1. Database Configuration
- [ ] Ensure MySQL database is accessible from the internet
- [ ] Test database connection from external IP
- [ ] Configure database to accept connections from Vercel IP ranges
- [ ] Backup your database before deployment

### 2. Environment Variables
Set these in your Vercel project dashboard:

- [ ] `DATABASE_URL` - Your MySQL connection string
- [ ] `JWT_SECRET` - Strong secret key (generate new one for production)
- [ ] `JWT_EXPIRES_IN` - Token expiration time (e.g., "60d")
- [ ] `NODE_ENV` - Set to "production"

### 3. CORS Configuration
- [ ] Update frontend domain in `src/main.ts` and `api/index.js`
- [ ] Replace `https://your-frontend-domain.vercel.app` with actual domain
- [ ] Test CORS settings with your frontend

### 4. Code Preparation
- [ ] Remove any console.log statements with sensitive data
- [ ] Ensure all dependencies are in `package.json`
- [ ] Test build locally: `npm run build`
- [ ] Verify TypeScript compilation succeeds

## Deployment Steps

### Option 1: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy from nestjs-backend directory
cd nestjs-backend
vercel --prod
```

### Option 2: GitHub Integration
1. [ ] Create new repository with nestjs-backend contents
2. [ ] Connect repository to Vercel
3. [ ] Configure build settings:
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist`
   - Install Command: `npm install`

## Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-backend.vercel.app/api/health
```
Expected: `{"status":"ok","timestamp":"..."}`

### 2. User Registration
```bash
curl -X POST "https://your-backend.vercel.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```
Expected: `{"success":true,"message":"User registered successfully",...}`

### 3. User Login
```bash
curl -X POST "https://your-backend.vercel.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "mail": "test@example.com",
    "pwd": "password123"
  }'
```
Expected: User data with Set-Cookie header

### 4. Protected Route Test
```bash
# First login to get cookie, then:
curl "https://your-backend.vercel.app/api/auth/profile" \
  -H "Cookie: token=your-jwt-token"
```
Expected: User profile data

## Frontend Integration

### Update Frontend API Base URL
In your frontend project, update the API base URL:

```typescript
// services/auth.service.ts
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://your-backend.vercel.app/api'
  : 'http://localhost:4002/api';
```

### Environment Variables for Frontend
Set in your frontend Vercel project:
- [ ] `NEXT_PUBLIC_API_URL` - Your backend Vercel URL

## Monitoring and Maintenance

### 1. Set up Monitoring
- [ ] Monitor function execution time in Vercel dashboard
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Monitor database performance

### 2. Performance Optimization
- [ ] Implement database connection pooling
- [ ] Add response caching where appropriate
- [ ] Monitor cold start times

### 3. Security
- [ ] Regularly rotate JWT secrets
- [ ] Monitor for suspicious activity
- [ ] Keep dependencies updated
- [ ] Implement rate limiting if needed

## Troubleshooting

### Common Issues:
1. **Database Connection Errors**
   - Check DATABASE_URL format
   - Verify database allows external connections
   - Test connection from Vercel environment

2. **CORS Errors**
   - Verify frontend domain in CORS configuration
   - Check that credentials are properly set

3. **Function Timeouts**
   - Optimize database queries
   - Consider increasing maxDuration in vercel.json

4. **Build Failures**
   - Check all dependencies are listed in package.json
   - Verify TypeScript compilation locally

### Getting Help:
- Check Vercel function logs in dashboard
- Use `vercel logs` for real-time debugging
- Review Vercel documentation for serverless functions
