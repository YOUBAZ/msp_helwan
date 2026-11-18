import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { BootstrapService } from './bootstrap.service';
import { MembersController } from './members.controller';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { TokensService } from './tokens.service';
import { UsersService } from './users.service';

/** Accounts, login, invitations, roles and permissions (RBAC). */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        let secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          if (config.get('NODE_ENV') === 'production') {
            throw new Error('JWT_SECRET must be set in production.');
          }
          secret = randomBytes(32).toString('hex');
          Logger.warn(
            'JWT_SECRET not set; using a random one (sessions reset on restart).',
            'AccessModule',
          );
        }
        return { secret, signOptions: { expiresIn: '8h' } };
      },
    }),
  ],
  controllers: [AuthController, MembersController, RolesController],
  providers: [
    AuthGuard,
    AuthService,
    BootstrapService,
    RolesService,
    TokensService,
    UsersService,
  ],
  exports: [AuthGuard, UsersService, JwtModule],
})
export class AccessModule {}
