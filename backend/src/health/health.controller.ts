import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/index.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
