import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Booking API')
    .setDescription('NestJS API adapted from the Booking clean architecture example.')
    .setVersion('1.0.0')
    .addTag('bookings')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-user-id',
        description: 'Simulated authenticated user id.',
      },
      'x-user-id',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(3000);
}

void bootstrap();