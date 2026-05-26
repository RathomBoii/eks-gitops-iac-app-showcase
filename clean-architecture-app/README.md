# Booking NestJS App

This NestJS application turns the example code in `Booking/` into a runnable HTTP API with Swagger documentation.

## Endpoints

- `POST /bookings`
- Swagger UI: `GET /docs`

## Sample request

Use header `x-user-id` and the seeded concert id `concert-001`.

```bash
curl -X POST http://localhost:3000/bookings \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: user-123' \
  -d '{"concertId":"concert-001","seatNumber":"A1"}'
```

## Commands

```bash
npm install
npm run build
npm run start:dev
```