import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DuplicateEmailError,
  type NewUser,
  type UserRecord,
  type UserRepository,
} from './user.repository';

/** Prisma error code for a unique constraint violation. */
const UNIQUE_CONSTRAINT_CODE = 'P2002';

/** True when a Prisma unique-constraint error names the email column. */
function isEmailUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== UNIQUE_CONSTRAINT_CODE) {
    return false;
  }
  const target: unknown = error.meta?.target;
  const names = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return names.some((name) => name.includes('email'));
}

/** Prisma implementation of UserRepository. Uses parameterized calls only. */
@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });
  }

  async create(user: NewUser): Promise<UserRecord> {
    try {
      return await this.prisma.user.create({
        data: { email: user.email, passwordHash: user.passwordHash },
        select: { id: true, email: true, passwordHash: true },
      });
    } catch (error) {
      // The unique constraint on User.email blocks a second sign-up that raced the first.
      if (isEmailUniqueViolation(error)) {
        throw new DuplicateEmailError();
      }
      throw error;
    }
  }
}
