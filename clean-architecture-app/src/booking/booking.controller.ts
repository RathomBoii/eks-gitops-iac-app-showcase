import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { BookTicketUseCase } from './application/book-ticket.use-case';
import { BookTicketRequestDto } from './dto/book-ticket.dto';
import { BookTicketEnvelopeDto } from './dto/book-ticket-response.dto';
import { DomainRuleViolationError, ResourceNotFoundError } from './domain/domain-errors';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookTicket: BookTicketUseCase) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Book a concert seat' })
  @ApiHeader({
    name: 'x-user-id',
    required: true,
    description: 'Authenticated user id passed from upstream auth.',
  })
  @ApiBody({ type: BookTicketRequestDto })
  @ApiCreatedResponse({ type: BookTicketEnvelopeDto })
  @ApiUnprocessableEntityResponse({ description: 'Business rule violation.' })
  async book(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: BookTicketRequestDto,
  ): Promise<BookTicketEnvelopeDto> {
    if (!userId) {
      throw new BadRequestException('Missing x-user-id header');
    }

    try {
      const output = await this.bookTicket.execute({
        concertId: body.concertId,
        seatNumber: body.seatNumber,
        userId,
      });

      return { data: output };
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof DomainRuleViolationError) {
        throw new UnprocessableEntityException(error.message);
      }

      throw error;
    }
  }
}