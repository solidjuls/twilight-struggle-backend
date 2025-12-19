import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure body parser to handle large payloads (for CSV uploads)
  // Increase limits to support large CSV files
  app.useBodyParser('json', {
    limit: '50mb',
    parameterLimit: 100000 // Increase parameter limit for large CSV data
  });
  app.useBodyParser('urlencoded', {
    limit: '50mb',
    extended: true,
    parameterLimit: 100000
  });

  // Enable cookie parser for JWT authentication
  app.use(cookieParser());

  // Get allowed origins from environment variable or use defaults
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  const vercelDomainRegex = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*vercel\.app$/i;


  // Enable CORS for frontend communication
  app.enableCors({
    // The origin function checks the incoming origin against our allowed list and regex.
    origin: (origin, callback) => {
      // 1. Allow requests with no origin (like mobile apps, server-to-server, or same-origin)
      if (!origin) {
        return callback(null, true);
      }
      
      // 2. Check if the origin is in the explicit allowed list
      if (allowedOrigins.includes(origin)) {
        // console.log(`CORS Success: Origin "${origin}" allowed by static list.`); // Optional: Success log
        return callback(null, true);
      }
      
      // 3. Check if the origin matches the Vercel dynamic domain pattern
      if (vercelDomainRegex.test(origin)) {
        // console.log(`CORS Success: Origin "${origin}" allowed by regex.`); // Optional: Success log
        return callback(null, true);
      }

      // 4. If none of the above passed, the request is rejected. Log the failure.
      // Use console.error or a proper NestJS logger for visibility.
      console.error(`CORS Failure: Origin "${origin}" rejected. Does not match static list or regex pattern.`);
      
      // Reject the origin
      const error = new Error(`Not allowed by CORS: ${origin}`);
      return callback(error, false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4002;
  await app.listen(port);

  console.log(`🚀 NestJS Backend is running on: http://localhost:${port}/api`);
}

bootstrap();
