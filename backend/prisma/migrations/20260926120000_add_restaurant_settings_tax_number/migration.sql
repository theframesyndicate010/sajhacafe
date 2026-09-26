-- Add the optional VAT/PAN registration number to the cafe settings row.
-- Nullable so existing tenants keep working and the field stays optional.
ALTER TABLE `RestaurantSettings` ADD COLUMN `taxNumber` VARCHAR(50) NULL;
