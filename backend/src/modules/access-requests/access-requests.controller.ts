import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { AccessRequestsService } from './access-requests.service.js';
import { CreateAccessRequestDto } from './dto/create-access-request.dto.js';
import { Public, Roles } from '../../auth/decorators/index.js';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private readonly service: AccessRequestsService) {}

  @Post()
  @Public()
  create(@Body() dto: CreateAccessRequestDto) {
    return this.service.create(dto);
  }

  // ─── Email-based approve/reject (public, token = auth) ──────

  @Get('approve/:token')
  @Public()
  async approveByToken(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.service.approveByToken(token);
      res.status(HttpStatus.OK).header('Content-Type', 'text/html').send(
        this.buildHtmlPage(
          'Request Approved',
          `
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #dcfce7; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M5 12L10 17L19 8" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 style="color: #1e293b; margin: 0 0 8px; font-size: 24px; font-weight: 700;">Approved!</h1>
            <p style="color: #475569; margin: 0 0 24px; font-size: 15px; line-height: 1.6;">
              <strong>${result.agencyName}</strong> has been approved.
              An organization and admin account have been created for
              <strong>${result.requesterName}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #64748b; margin: 0 0 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Welcome email sent to</p>
              <p style="color: #1e293b; margin: 0; font-size: 15px; font-weight: 600;">${result.workEmail}</p>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">They'll receive a sign-in link to set up their account.</p>
          `,
        ),
      );
    } catch (err: any) {
      const message = err.message || 'Something went wrong';
      const status = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status).header('Content-Type', 'text/html').send(
        this.buildHtmlPage(
          'Error',
          `
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 style="color: #1e293b; margin: 0 0 8px; font-size: 24px; font-weight: 700;">Unable to Process</h1>
            <p style="color: #475569; margin: 0; font-size: 15px; line-height: 1.6;">${message}</p>
          `,
        ),
      );
    }
  }

  @Get('reject/:token')
  @Public()
  async rejectByToken(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.service.rejectByToken(token);
      res.status(HttpStatus.OK).header('Content-Type', 'text/html').send(
        this.buildHtmlPage(
          'Request Rejected',
          `
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 style="color: #1e293b; margin: 0 0 8px; font-size: 24px; font-weight: 700;">Request Rejected</h1>
            <p style="color: #475569; margin: 0 0 16px; font-size: 15px; line-height: 1.6;">
              The access request from <strong>${result.agencyName}</strong>
              (${result.requesterName}) has been rejected.
            </p>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">A notification has been sent to the requester.</p>
          `,
        ),
      );
    } catch (err: any) {
      const message = err.message || 'Something went wrong';
      const status = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      res.status(status).header('Content-Type', 'text/html').send(
        this.buildHtmlPage(
          'Error',
          `
            <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="#dc2626" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 style="color: #1e293b; margin: 0 0 8px; font-size: 24px; font-weight: 700;">Unable to Process</h1>
            <p style="color: #475569; margin: 0; font-size: 15px; line-height: 1.6;">${message}</p>
          `,
        ),
      );
    }
  }

  // ─── Admin dashboard routes ──────────────────────────

  @Get()
  @Roles('super_admin')
  findAll(@Query('status') status?: string) {
    return this.service.findAll({ status });
  }

  @Get(':id')
  @Roles('super_admin')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  @Roles('super_admin')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.service.updateStatus(id, status, reviewNotes);
  }

  // ─── HTML page builder helper ────────────────────────

  private buildHtmlPage(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Credentis</title>
</head>
<body style="margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;">
    <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 48px 40px; max-width: 480px; width: 100%; text-align: center;">
      <div style="margin-bottom: 24px;">
        <span style="font-weight: 700; font-size: 22px; color: #1e293b;">Credentis</span>
      </div>
      ${body}
    </div>
  </div>
</body>
</html>`;
  }
}
