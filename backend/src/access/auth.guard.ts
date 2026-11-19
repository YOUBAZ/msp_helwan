import {
  applyDecorators,
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';
import { type AuthedRequest, hasAll } from './current-user';
import type { Permission } from './permissions';

export type JwtPayload = { sub: string; tv: number };

const PERMS_KEY = 'requiredPermissions';
const ANY_PERMS_KEY = 'anyPermissions';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    // Load fresh from the database so role changes and disabled accounts
    // take effect immediately.
    const user = await this.users.loadCurrentUser(payload.sub, payload.tv);
    if (!user)
      throw new UnauthorizedException('Session expired. Please log in again.');
    req.user = user;

    const required =
      this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (!hasAll(user, required)) {
      throw new ForbiddenException("You don't have permission to do that.");
    }
    const any =
      this.reflector.getAllAndOverride<Permission[]>(ANY_PERMS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];
    if (any.length && !any.some((p) => hasAll(user, [p]))) {
      throw new ForbiddenException("You don't have permission to do that.");
    }
    return true;
  }
}

/** Require a logged-in user holding all the given permissions. */
export const Auth = (...permissions: Permission[]) =>
  applyDecorators(SetMetadata(PERMS_KEY, permissions), UseGuards(AuthGuard));

export const Me = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthedRequest>().user,
);

/** Require a logged-in user holding at least one of the given permissions. */
export const AuthAny = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(ANY_PERMS_KEY, permissions),
    UseGuards(AuthGuard),
  );
