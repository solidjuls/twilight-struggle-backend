/**
 * CI-only script: generates openapi.json from the NestJS app.
 *
 * Usage:  GENERATE_OPENAPI=true yarn ts-node scripts/generate-spec.ts
 *
 * Skips the DB connection, writes the spec, and exits.
 */
process.env.GENERATE_OPENAPI = 'true';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const versionFile = path.join(process.cwd(), 'api-version.json');
  let apiVersion = '1.0.0';
  try {
    if (fs.existsSync(versionFile)) {
      apiVersion = JSON.parse(fs.readFileSync(versionFile, 'utf-8')).version;
    }
  } catch {}

  const config = new DocumentBuilder()
    .setTitle('Twilight Struggle API')
    .setDescription('API contract for the Twilight Struggle backend')
    .setVersion(apiVersion)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const specPath = path.join(process.cwd(), 'openapi.json');
  fs.writeFileSync(specPath, JSON.stringify(document, null, 2));

  console.log(`OpenAPI spec written to ${specPath} (v${apiVersion})`);
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
