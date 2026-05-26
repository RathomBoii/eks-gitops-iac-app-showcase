import { BookTicketUseCase } from '../src/booking/application/book-ticket.use-case';
import {
  InMemoryBookingRepository,
  InMemoryConcertRepository,
  InMemoryOutboxRepository,
  InMemoryTransactionManager,
  StubPaymentGateway,
} from '../src/booking/infrastructure/in-memory.providers';

describe('BookTicketUseCase', () => {
  let useCase: BookTicketUseCase;

  beforeEach(() => {
    useCase = new BookTicketUseCase(
      new InMemoryConcertRepository(),
      new InMemoryBookingRepository(),
      new StubPaymentGateway(),
      new InMemoryOutboxRepository(),
      new InMemoryTransactionManager(),
    );
  });

  it('books an available seat', async () => {
    const result = await useCase.execute({
      concertId: 'concert-001',
      seatNumber: 'A1',
      userId: 'user-123',
    });

    expect(result.status).toBe('CONFIRMED');
    expect(result.bookingId).toBeDefined();
  });

  it('rejects an already reserved seat', async () => {
    await useCase.execute({
      concertId: 'concert-001',
      seatNumber: 'A2',
      userId: 'user-123',
    });

    await expect(
      useCase.execute({
        concertId: 'concert-001',
        seatNumber: 'A2',
        userId: 'user-999',
      }),
    ).rejects.toThrow('Seat already reserved');
  });
});