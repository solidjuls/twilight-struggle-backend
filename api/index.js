// Vercel serverless function entry point
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const cookieParser = require('cookie-parser');

let app;

async function createApp() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    // Enable CORS for production
    app.enableCors({
      origin: [
        'http://localhost:3000',
        'https://your-frontend-domain.vercel.app', // Replace with your actual frontend domain
        /\.vercel\.app$/,
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    });

    app.use(cookieParser());
    app.setGlobalPrefix('api');
    
    await app.init();
  }
  return app;
}

module.exports = async (req, res) => {
  const app = await createApp();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
};
