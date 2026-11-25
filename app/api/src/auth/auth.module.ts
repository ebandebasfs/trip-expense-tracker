import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { NestAuthLogger } from './auth-logger';
import {
  AUTH_LOGGER,
  PASSWORD_HASHER,
  SESSION_REPOSITORY,
  UNIT_OF_WORK,
  USER_REPOSITORY,
} from './auth.tokens';
import { PrismaSessionRepository } from './prisma-session.repository';
import { PrismaUnitOfWork } from './prisma-unit-of-work';
import { PrismaUserRepository } from './prisma-user.repository';
import { ScryptPasswordHasher } from './password-hasher';
import { SessionGuard } from './session.guard';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AuthController],
  providers: [
    PrismaService,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: SESSION_REPOSITORY, useClass: PrismaSessionRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: AUTH_LOGGER, useClass: NestAuthLogger },
    AuthService,
    SessionGuard,
  ],
  exports: [USER_REPOSITORY, SESSION_REPOSITORY],
})
export class AuthModule {}
