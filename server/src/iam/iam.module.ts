import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RbacService } from './rbac.service';
import { IamService } from './iam.service';
import { AuthController } from './auth.controller';
import { IamController } from './iam.controller';

@Module({
  controllers: [AuthController, IamController],
  providers: [AuthService, RbacService, IamService],
  exports: [AuthService, RbacService, IamService],
})
export class IamModule {}
