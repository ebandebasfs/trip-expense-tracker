import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UnitOfWork } from './unit-of-work';
import type { UserRecord } from './user.repository';

/** Prisma implementation of UnitOfWork. Uses parameterized calls only. */
@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    // One transaction. The Session rows, and later the trip tables, go through ON DELETE CASCADE.
    await this.prisma.$transaction([this.prisma.user.deleteMany({ where: { id: userId } })]);
  }
}
