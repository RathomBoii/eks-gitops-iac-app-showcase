import { ApiProperty } from '@nestjs/swagger';

export class BookTicketResponseDto {
  @ApiProperty({ example: 'booking-1234' })
  bookingId!: string;

  @ApiProperty({ example: 'CONFIRMED' })
  status!: string;
}

export class BookTicketEnvelopeDto {
  @ApiProperty({ type: BookTicketResponseDto })
  data!: BookTicketResponseDto;
}