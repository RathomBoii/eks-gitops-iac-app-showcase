class PostgresConcertRepository implements ConcertRepository {

  async findById(id: string, tx: Transaction): Promise<Concert | null> {

    // 1. fetch raw data จาก DB
    const concertRow = await client.query(
      `SELECT * FROM concerts WHERE id = $1`, [id]
    )
    if (!concertRow.rows[0]) return null

    const seatRows = await client.query(
      `SELECT * FROM seats WHERE concert_id = $1`, [id]
    )

    // 2. reconstruct → return Concert instance
    return this.toDomain(concertRow.rows[0], seatRows.rows)
  }

  // toDomain — แปลง raw DB rows → Concert aggregate
  private toDomain(concertRow: any, seatRows: any[]): Concert {

    // สร้าง Concert instance
    const concert = new Concert(
      concertRow.id,
      concertRow.name,
      new Money(concertRow.price, concertRow.currency),
      ConcertStatus[concertRow.status as keyof typeof ConcertStatus]
    )

    // reconstruct seats กลับเข้าไปใน Concert
    for (const row of seatRows) {
      concert.addSeat(
        new Seat(
          row.id,
          new SeatNumber(row.seat_number),
          row.is_reserved,
          row.reserved_by_user_id
        )
      )
    }

    return concert
    // ↑ Concert instance พร้อมเรียก .reserveSeat() ได้เลย
  }
}