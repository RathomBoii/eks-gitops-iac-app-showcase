import { Booking } from '../domain/booking.entity';
import { Concert } from '../domain/concert.entity';

export interface TransactionContext {
  readonly id: string;
}

export interface BookTicketInput {
  concertId: string;
  seatNumber: string;
  userId: string;
}

export interface BookTicketOutput {
  bookingId: string;
  status: string;
}

export interface ConcertRepository {
  findById(id: string, tx: TransactionContext): Promise<Concert | null>;
  save(concert: Concert, tx: TransactionContext): Promise<void>;
}

export interface BookingRepository {
  save(booking: Booking, tx: TransactionContext): Promise<void>;
}

export interface PaymentGateway {
  charge(userId: string, amount: number, tx: TransactionContext): Promise<void>;
}

export interface OutboxRepository {
  saveEvents(events: string[], tx: TransactionContext): Promise<void>;
}

export interface TransactionManager {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

export const CONCERT_REPOSITORY = Symbol('CONCERT_REPOSITORY');
export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export const OUTBOX_REPOSITORY = Symbol('OUTBOX_REPOSITORY');
export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');