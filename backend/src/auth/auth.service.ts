import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { blacklistToken } from '../common/guards/jwt-auth.guard';

const BCRYPT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      displayName: dto.displayName,
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.users.findByEmail(dto.username);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user);
  }

  logout(jti?: string): void {
    if (jti) blacklistToken(jti);
  }

  toPublic(user: User): PublicUser {
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  private async issueToken(user: User): Promise<AuthResult> {
    const jti = randomUUID();
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      { jwtid: jti },
    );
    return { user: this.toPublic(user), accessToken };
  }
}
