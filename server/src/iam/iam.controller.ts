import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IamService } from './iam.service';
import { RequirePerm } from '../common/auth.guard';
import { CreateUserDto, DeptDto, SkillGroupDto, UpdateUserDto } from './dto';

@Controller()
export class IamController {
  constructor(private svc: IamService) {}

  @Get('users') @RequirePerm('crm:read') listUsers(@Query() q: any) { return this.svc.listUsers(q); }
  @Post('users') @RequirePerm('crm:write') createUser(@Body() dto: CreateUserDto) { return this.svc.createUser(dto); }
  @Patch('users/:id') @RequirePerm('crm:write') updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) { return this.svc.updateUser(id, dto); }
  @Delete('users/:id') @RequirePerm('crm:write') deleteUser(@Param('id') id: string) { return this.svc.deleteUser(id); }

  @Get('departments') listDepts() { return this.svc.listDepts(); }
  @Post('departments') @RequirePerm('crm:write') createDept(@Body() dto: DeptDto) { return this.svc.createDept(dto); }

  @Get('skill-groups') listGroups() { return this.svc.listSkillGroups(); }
  @Post('skill-groups') @RequirePerm('crm:assign') createGroup(@Body() dto: SkillGroupDto) { return this.svc.createSkillGroup(dto); }
  @Get('skill-groups/:id/members') groupMembers(@Param('id') id: string) { return this.svc.groupMembers(id); }
  @Post('skill-groups/:id/members') @RequirePerm('crm:assign') setMembers(@Param('id') id: string, @Body() b: { memberIds: string[] }) { return this.svc.setGroupMembers(id, b.memberIds || []); }
}
