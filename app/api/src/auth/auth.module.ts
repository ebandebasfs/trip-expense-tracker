import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaSessionRepository } from './prisma-session.repository';
import { PrismaUserRepository } from './prisma-user.repository';

/** Injection token for the UserRepository port. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
/** Injection token for the SessionRepository port. */
export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

@Module({
  providers: [
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
  ],
  exports: [USER_REPOSITORY, SESSION_REPOSITORY],
})
export class AuthModule {}
