import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString() username!: string;
  @IsString() @MinLength(6) password!: string;
}
export class RefreshDto { @IsString() refreshToken!: string; }
export class CreateUserDto {
  @IsString() username!: string;
  @IsString() realName!: string;
  @IsOptional() @IsString() password?: string;
  @IsOptional() @IsString() deptId?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() roleAlias?: 'ADMIN' | 'MANAGER' | 'AGENT';
  @IsOptional() @IsString() jobNo?: string;
}
export class UpdateUserDto {
  @IsOptional() @IsString() realName?: string;
  @IsOptional() @IsString() deptId?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() roleAlias?: 'ADMIN' | 'MANAGER' | 'AGENT';
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() password?: string;
}
export class DeptDto { @IsString() name!: string; @IsOptional() @IsString() parentId?: string; }
export class SkillGroupDto {
  @IsString() name!: string;
  @IsOptional() @IsString() strategy?: 'ROUND_ROBIN' | 'LEAST_LOAD' | 'SKILL_MATCH';
  @IsOptional() memberIds?: string[];
}
