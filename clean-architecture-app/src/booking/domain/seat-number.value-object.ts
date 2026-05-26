import { DomainRuleViolationError } from './domain-errors';

export class SeatNumber {
  public readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      throw new DomainRuleViolationError('Seat number is required');
    }

    this.value = normalized;
  }
}