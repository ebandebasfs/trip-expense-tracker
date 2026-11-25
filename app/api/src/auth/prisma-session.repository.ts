import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NewSession, SessionRepository } from './session.repository';

/** Prisma implementation of SessionRepository. Stores only the token hash. */
@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(session: NewSession): Promise<void> {
    await this.prisma.session.create({
      data: { userId: session.userId, tokenHash: session.tokenHash },
    });
  }
}
