# NestJS Backend - Vercel Deployment

This NestJS backend is configured for deployment on Vercel as a serverless function.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Database**: Ensure your MySQL database is accessible from the internet

## Environment Variables

Set these environment variables in your Vercel project dashboard:

```bash
DATABASE_URL="mysql://username:password@host:port/database"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRES_IN="60d"
NODE_ENV="production"
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. **Navigate to the backend directory**:
   ```bash
   cd nestjs-backend
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

### Option 2: Deploy via GitHub Integration

1. **Create a new repository** with just the `nestjs-backend` folder contents
2. **Connect to Vercel** via GitHub integration
3. **Configure build settings**:
   - Build Command: `npm run vercel-build`
   - Output Directory: `dist`
   - Install Command: `npm install`

## Configuration Files

- **`vercel.json`**: Vercel deployment configuration
- **`api/index.js`**: Serverless function entry point
- **`.vercelignore`**: Files to exclude from deployment

## CORS Configuration

Update the CORS origins in `api/index.js` to match your frontend domain:

```javascript
origin: [
  'http://localhost:3000',
  'https://your-frontend-domain.vercel.app', // Replace with actual domain
  /\.vercel\.app$/,
],
```

## Database Considerations

- Ensure your database accepts connections from Vercel's IP ranges
- Consider using connection pooling for better performance
- Test database connectivity from Vercel environment

## Testing the Deployment

After deployment, test these endpoints:

```bash
# Health check
curl https://your-backend.vercel.app/api/health

# Register user
curl -X POST "https://your-backend.vercel.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST "https://your-backend.vercel.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "mail": "test@example.com",
    "pwd": "password123"
  }'
```

## Troubleshooting

### Common Issues:

1. **Database Connection Timeout**:
   - Check if database allows external connections
   - Verify DATABASE_URL format
   - Consider increasing connection timeout

2. **CORS Errors**:
   - Update allowed origins in `api/index.js`
   - Ensure credentials are properly configured

3. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Verify TypeScript compilation succeeds locally

4. **Function Timeout**:
   - Optimize database queries
   - Consider increasing `maxDuration` in `vercel.json`

### Logs and Debugging:

- View function logs in Vercel dashboard
- Use `vercel logs` command for real-time logs
- Add console.log statements for debugging

## Performance Optimization

- Use database connection pooling
- Implement proper caching strategies
- Optimize cold start times by minimizing dependencies
- Consider using Vercel Edge Functions for better performance

## Security Considerations

- Never commit `.env` files
- Use strong JWT secrets
- Implement rate limiting
- Validate all inputs
- Use HTTPS only in production
