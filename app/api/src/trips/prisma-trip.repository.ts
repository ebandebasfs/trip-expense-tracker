import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { TripRecord, TripRepository } from './trip.repository';

/**
 * Prisma implementation of TripRepository.
 * Every read and delete filters on id and userId together, so another user's trip is never matched.
 */
@Injectable()
export class PrismaTripRepository implements TripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, name: string): Promise<TripRecord> {
    return this.prisma.trip.create({
      data: { userId, name },
      select: { id: true, userId: true, name: true, createdAt: true },
    });
  }

  async listByOwner(userId: string): Promise<TripRecord[]> {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, userId: true, name: true, createdAt: true },
    });
  }

  async findByIdForOwner(userId: string, id: string): Promise<TripRecord | null> {
    return this.prisma.trip.findFirst({
      where: { id, userId },
      select: { id: true, userId: true, name: true, createdAt: true },
    });
  }

  async deleteForOwner(userId: string, id: string): Promise<boolean> {
    // deleteMany does not throw when no row matches, so a malformed or foreign ID returns false.
    const result = await this.prisma.trip.deleteMany({ where: { id, userId } });
    return result.count > 0;
  }
}
