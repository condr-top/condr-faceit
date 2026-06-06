import { Controller, Post, Get, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: any,
    @Body('reportedId') reportedId: number,
    @Body('reason') reason: string,
    @Body('description') description?: string,
  ) {
    return this.reportsService.createReport(req.user.id, reportedId, reason, description);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  list(@Query('status') status?: string) {
    return this.reportsService.listReports(status);
  }
}
