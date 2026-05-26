import { randomUUID } from 'crypto';
import { BookingStatus } from './booking-status.enum';
import { SeatNumber } from './seat-number.value-object';

export class Booking {
  private readonly events: string[] = [];

  private constructor(
    public readonly id: string,
    public readonly concertId: string,
    public readonly seatNumber: string,
    public readonly userId: string,
    public readonly status: BookingStatus,
  ) {}

  static create(concertId: string, seat: SeatNumber, userId: string): Booking {
    const booking = new Booking(
      randomUUID(),
      concertId,
      seat.value,
      userId,
      BookingStatus.CONFIRMED,
    );

    booking.events.push(`booking.confirmed:${booking.id}`);
    return booking;
  }

  pullEvents(): string[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}