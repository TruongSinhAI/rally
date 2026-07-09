import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrors, ApiPagedResponse, buildPageArgs } from '@platform';
import type { JwtPayload, PagedResult } from '@platform';
import { CurrentUser } from '@modules/identity';
import { RequireProjectPermission, AuthProjectScoped } from '@modules/access';
import { MilestonesService } from '../../application/milestones.service';
import { MilestoneQueryDto, CreateMilestoneDto, UpdateMilestoneDto } from './dto/milestone-request.dto';
import { MilestoneResponseDto, MilestoneListItemDto } from './dto/milestone-response.dto';
import type { Milestone } from '../../domain/milestone.types';

function toMilestoneDto(m: Milestone): MilestoneResponseDto {
  return {
    id: m.id,
    tenantId: m.tenantId,
    projectId: m.projectId,
    name: m.name,
    description: m.description,
    notes: m.notes,
    status: m.status,
    ownerId: m.ownerId,
    targetStartDate: m.targetStartDate,
    targetEndDate: m.targetEndDate,
    releaseIds: m.releaseIds,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

@ApiTags('milestones')
@Controller('milestones')
@AuthProjectScoped()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Get()
  @ApiOperation({ summary: 'List milestones for a project' })
  @ApiPagedResponse(MilestoneListItemDto)
  @ApiCommonErrors(400, 401, 404)
  async listMilestones(
    @CurrentUser() user: JwtPayload,
    @Query() query: MilestoneQueryDto,
  ): Promise<PagedResult<MilestoneListItemDto>> {
    const args = buildPageArgs(query);
    const page = await this.milestonesService.listMilestones(user, query.projectId, args);
    return { data: page.data.map(toMilestoneDto), pageInfo: page.pageInfo };
  }

  @Post()
  @RequireProjectPermission('milestone:manage', 'body', 'projectId')
  @ApiOperation({ summary: 'Create a milestone' })
  @ApiResponse({ status: 201, type: MilestoneResponseDto })
  @ApiCommonErrors(400, 401, 404, 422)
  async createMilestone(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMilestoneDto,
  ): Promise<MilestoneResponseDto> {
    const milestone = await this.milestonesService.createMilestone(user, dto.projectId, dto.name, {
      description: dto.description,
      notes: dto.notes,
      status: dto.status,
      ownerId: dto.ownerId,
      releaseIds: dto.releaseIds,
    });
    return toMilestoneDto(milestone);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get milestone details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: MilestoneResponseDto })
  @ApiCommonErrors(401, 404)
  async getMilestone(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MilestoneResponseDto> {
    const milestone = await this.milestonesService.getMilestone(user.tenantId, id);
    return toMilestoneDto(milestone);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update milestone details' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: MilestoneResponseDto })
  @ApiCommonErrors(400, 401, 403, 404, 422)
  async updateMilestone(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMilestoneDto,
  ): Promise<MilestoneResponseDto> {
    const milestone = await this.milestonesService.updateMilestone(user, id, dto);
    return toMilestoneDto(milestone);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a milestone' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Milestone deleted' })
  @ApiCommonErrors(400, 401, 403, 404)
  async deleteMilestone(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.milestonesService.deleteMilestone(user, id);
  }
}