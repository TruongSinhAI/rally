import { Module } from '@nestjs/common';
import { ProjectsModule } from '@modules/projects';
import { QualityService } from './application/quality.service';
import { QualityController } from './interface/http/quality.controller';

@Module({
  imports: [ProjectsModule],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}