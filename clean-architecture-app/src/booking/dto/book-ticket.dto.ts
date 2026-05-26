import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BookTicketRequestDto {
  @ApiProperty({ example: 'concert-001' })
  @IsString()
  @IsNotEmpty()
  concertId!: string;

  @ApiProperty({ example: 'A1' })
  @IsString()
  @IsNotEmpty()
  seatNumber!: string;
}