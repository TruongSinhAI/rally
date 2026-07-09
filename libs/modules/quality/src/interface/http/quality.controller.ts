import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrors } from '@platform';
import type { JwtPayload } from '@platform';
import { CurrentUser } from '@modules/identity';
import { AuthProjectScoped } from '@modules/access';
import { QualityService } from '../../application/quality.service';
import { DefectQueryDto } from './dto/defect-query.dto';
import { DefectListResponseDto } from './dto/defect-response.dto';

@ApiTags('quality')
@Controller('quality')
@AuthProjectScoped()
export class QualityController {
  constructor(private readonly qualityService: QualityService) {}

  @Get('defects')
  @ApiOperation({ summary: 'List defects with metrics for a project' })
  @ApiCommonErrors(400, 401, 404)
  async listDefects(
    @CurrentUser() user: JwtPayload,
    @Query() query: DefectQueryDto,
  ): Promise<DefectListResponseDto> {
    return this.qualityService.getDefects(user, query.projectId, {
      search: query.search,
      severity: query.severity,
      environment: query.environment,
      limit: query.limit,
    }) as any;
  }
}