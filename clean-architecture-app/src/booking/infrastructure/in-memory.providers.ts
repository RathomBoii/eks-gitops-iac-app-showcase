import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Booking } from '../domain/booking.entity';
import { Concert } from '../domain/concert.entity';
import { ConcertStatus } from '../domain/concert-status.enum';
import { Money } from '../domain/money.value-object';
import { Seat } from '../domain/seat.entity';
import { SeatNumber } from '../domain/seat-number.value-object';
import {
  BookingRepository,
  ConcertRepository,
  OutboxRepository,
  PaymentGateway,
  TransactionContext,
  TransactionManager,
} from '../ports/booking.ports';

@Injectable()
export class InMemoryConcertRepository implements ConcertRepository {
  private readonly concerts = new Map<string, Concert>();

  constructor() {
    const seededConcert = new Concert(
      'concert-001',
      'Architecture Live',
      new Money(1500, 'THB'),
      ConcertStatus.OPEN,
    );

    ['A1', 'A2', 'A3'].forEach((seatNumber, index) => {
      seededConcert.addSeat(
        new Seat(`seat-${index + 1}`, new SeatNumber(seatNumber)),
      );
    });

    this.concerts.set(seededConcert.id, seededConcert);
  }

  async findById(id: string, _tx: TransactionContext): Promise<Concert | null> {
    return this.concerts.get(id) ?? null;
  }

  async save(concert: Concert, _tx: TransactionContext): Promise<void> {
    this.concerts.set(concert.id, concert);
  }
}

@Injectable()
export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookings: Booking[] = [];

  async save(booking: Booking, _tx: TransactionContext): Promise<void> {
    this.bookings.push(booking);
  }
}

@Injectable()
export class StubPaymentGateway implements PaymentGateway {
  async charge(
    _userId: string,
    _amount: number,
    _tx: TransactionContext,
  ): Promise<void> {
    return Promise.resolve();
  }
}

@Injectable()
export class InMemoryOutboxRepository implements OutboxRepository {
  private readonly events: string[] = [];

  async saveEvents(events: string[], _tx: TransactionContext): Promise<void> {
    this.events.push(...events);
  }
}

@Injectable()
export class InMemoryTransactionManager implements TransactionManager {
  async run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return work({ id: randomUUID() });
  }
}