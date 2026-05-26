import { DomainRuleViolationError } from './domain-errors';
import { SeatNumber } from './seat-number.value-object';

export class Seat {
  private reserved = false;
  private reservedByUserId: string | null = null;

  constructor(
    public readonly id: string,
    public readonly number: SeatNumber,
    isReserved = false,
    reservedByUserId: string | null = null,
  ) {
    this.reserved = isReserved;
    this.reservedByUserId = reservedByUserId;
  }

  get isReserved(): boolean {
    return this.reserved;
  }

  get reservedBy(): string | null {
    return this.reservedByUserId;
  }

  reserve(userId: string): void {
    if (this.reserved) {
      throw new DomainRuleViolationError('Seat already reserved');
    }

    this.reserved = true;
    this.reservedByUserId = userId;
  }

  release(): void {
    this.reserved = false;
    this.reservedByUserId = null;
  }
}