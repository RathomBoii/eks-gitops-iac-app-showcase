import { Module } from '@nestjs/common';
import { BookTicketUseCase } from './application/book-ticket.use-case';
import { BookingController } from './booking.controller';
import {
  BOOKING_REPOSITORY,
  CONCERT_REPOSITORY,
  OUTBOX_REPOSITORY,
  PAYMENT_GATEWAY,
  TRANSACTION_MANAGER,
} from './ports/booking.ports';
import {
  InMemoryBookingRepository,
  InMemoryConcertRepository,
  InMemoryOutboxRepository,
  InMemoryTransactionManager,
  StubPaymentGateway,
} from './infrastructure/in-memory.providers';

@Module({
  controllers: [BookingController],
  providers: [
    BookTicketUseCase,
    InMemoryConcertRepository,
    InMemoryBookingRepository,
    InMemoryOutboxRepository,
    InMemoryTransactionManager,
    StubPaymentGateway,
    {
      provide: CONCERT_REPOSITORY,
      useExisting: InMemoryConcertRepository,
    },
    {
      provide: BOOKING_REPOSITORY,
      useExisting: InMemoryBookingRepository,
    },
    {
      provide: OUTBOX_REPOSITORY,
      useExisting: InMemoryOutboxRepository,
    },
    {
      provide: TRANSACTION_MANAGER,
      useExisting: InMemoryTransactionManager,
    },
    {
      provide: PAYMENT_GATEWAY,
      useExisting: StubPaymentGateway,
    },
  ],
})
export class BookingModule {}