-- Flags the placeholder menu item that backs POS counter items typed by hand.
-- Additive only: existing rows default to false and keep their current pricing.
ALTER TABLE `MenuItem` ADD COLUMN `isExternal` BOOLEAN NOT NULL DEFAULT FALSE;
