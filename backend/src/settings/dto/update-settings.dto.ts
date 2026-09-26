import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/**
 * Partial update payload for `PATCH /settings`.
 *
 * This must be a concrete class rather than `Partial<SettingsDto>`: a mapped
 * type erases the emitted design-time type to `Object`, and `ValidationPipe`
 * skips `Object`, which silently disabled `whitelist` and every constraint.
 *
 * `@ValidateIf(v !== undefined)` is used instead of `@IsOptional()` on the
 * non-nullable columns so an explicit `null` is rejected with a 400 instead of
 * reaching Prisma and failing against the column constraint.
 */
export class UpdateSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(150)
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  /**
   * VAT/PAN registration number. Optional, so `@IsOptional()` is correct here
   * (unlike `businessName`) — a `null` is legitimately storable in this column.
   */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxNumber?: string | null;

  /** Data URL of the cafe logo, or `null` to remove the current one. */
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  taxEnabled?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  taxInclusive?: boolean;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(50)
  timezone?: string;
}
