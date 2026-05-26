import { Inject, Injectable } from '@nestjs/common';
import { Booking } from '../domain/booking.entity';
import { ResourceNotFoundError } from '../domain/domain-errors';
import { SeatNumber } from '../domain/seat-number.value-object';
import {
  BOOKING_REPOSITORY,
  BookTicketInput,
  BookTicketOutput,
  BookingRepository,
  CONCERT_REPOSITORY,
  ConcertRepository,
  OUTBOX_REPOSITORY,
  OutboxRepository,
  PAYMENT_GATEWAY,
  PaymentGateway,
  TRANSACTION_MANAGER,
  TransactionManager,
} from '../ports/booking.ports';

@Injectable()
export class BookTicketUseCase {
  constructor(
    @Inject(CONCERT_REPOSITORY)
    private readonly concertRepo: ConcertRepository,
    @Inject(BOOKING_REPOSITORY)
    private readonly bookingRepo: BookingRepository,
    @Inject(PAYMENT_GATEWAY)
    private readonly paymentGateway: PaymentGateway,
    @Inject(OUTBOX_REPOSITORY)
    private readonly outboxRepo: OutboxRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: TransactionManager,
  ) {}

  async execute(input: BookTicketInput): Promise<BookTicketOutput> {
    const booking = await this.txManager.run(async (tx) => {
      const concert = await this.concertRepo.findById(input.concertId, tx);
      if (!concert) {
        throw new ResourceNotFoundError('Concert not found');
      }

      const seat = new SeatNumber(input.seatNumber);
      concert.reserveSeat(seat, input.userId);

      await this.paymentGateway.charge(input.userId, concert.price.amount, tx);

      const newBooking = Booking.create(concert.id, seat, input.userId);

      await Promise.all([
        this.concertRepo.save(concert, tx),
        this.bookingRepo.save(newBooking, tx),
        this.outboxRepo.saveEvents(
          [...concert.pullEvents(), ...newBooking.pullEvents()],
          tx,
        ),
      ]);

      return newBooking;
    });

    return {
      bookingId: booking.id,
      status: booking.status,
    };
  }
}