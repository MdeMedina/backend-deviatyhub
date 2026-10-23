import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  Get,
  Headers,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto } from './dto/auth.dto';
import { SetPasswordDto } from '../users/dto/users.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
  ) {
    this.logger.log('AuthController initialized');
  }

  // No hay registro público: las cuentas se crean solo por invitación
  // (POST /auth/users/invite). El antiguo /auth/register aceptaba la clínica y
  // el rol que mandara cualquiera, y dejaba quedarse con un correo de
  // PLATFORM_ADMIN_EMAILS que aún no tuviera cuenta.

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() loginDto: LoginDto) {
    this.logger.log(`login - login attempt for email: ${loginDto.email}`);
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    this.logger.log('refresh - refreshing user tokens');
    return this.authService.refreshTokens(refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('authorization') auth: string,
    @Body() dto: RefreshTokenDto,
  ) {
    this.logger.log('logout - logging out user');
    const token = auth?.split(' ')[1];
    await this.authService.logout(token, dto.refresh_token);
    return { message: 'Sesión cerrada correctamente' };
  }

  @Public()
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  setPassword(@Body() setPasswordDto: SetPasswordDto) {
    this.logger.log('setPassword - setting user password');
    return this.authService.setPassword(setPasswordDto);
  }

  @Get('me')
  getMe(@Headers('x-user-id') userId: string) {
    this.logger.log(`getMe - fetching self context for userId: ${userId}`);
    return this.authService.getMe(userId);
  }
}

