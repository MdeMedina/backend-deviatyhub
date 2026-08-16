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
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
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

  @Public()
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    this.logger.log(`register - registering email: ${registerDto.email}`);
    return this.authService.register(registerDto);
  }

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

