import { ConcertStatus } from './concert-status.enum';
import { DomainRuleViolationError } from './domain-errors';
import { Money } from './money.value-object';
import { Seat } from './seat.entity';
import { SeatNumber } from './seat-number.value-object';

export class Concert {
  private readonly seats = new Map<string, Seat>();
  private readonly events: string[] = [];

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly price: Money,
    private status: ConcertStatus = ConcertStatus.OPEN,
  ) {}

  addSeat(seat: Seat): void {
    this.seats.set(seat.number.value, seat);
  }

  reserveSeat(seatNumber: SeatNumber, userId: string): this {
    if (this.status !== ConcertStatus.OPEN) {
      throw new DomainRuleViolationError('Concert is not open');
    }

    const seat = this.seats.get(seatNumber.value);
    if (!seat) {
      throw new DomainRuleViolationError('Seat not found');
    }

    if (this.hasUserBooked(userId)) {
      throw new DomainRuleViolationError('User already has a booking');
    }

    seat.reserve(userId);
    this.events.push(`concert.seat_reserved:${this.id}:${seatNumber.value}`);
    return this;
  }

  cancelConcert(): void {
    this.status = ConcertStatus.CANCELLED;
    this.seats.forEach((seat) => seat.release());
  }

  pullEvents(): string[] {
    const pendingEvents = [...this.events];
    this.events.length = 0;
    return pendingEvents;
  }

  private hasUserBooked(userId: string): boolean {
    return [...this.seats.values()].some((seat) => seat.reservedBy === userId);
  }
}