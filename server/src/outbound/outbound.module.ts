import { Module } from '@nestjs/common';
import { CampaignService } from './campaign.service';
import { CampaignController } from './campaign.controller';
import { TelephonyModule } from '../telephony/telephony.module';

@Module({
  imports: [TelephonyModule],
  controllers: [CampaignController],
  providers: [CampaignService],
})
export class OutboundModule {}
