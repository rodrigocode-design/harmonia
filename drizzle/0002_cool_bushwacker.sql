ALTER TABLE `charges` ADD `payment_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `charge_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH ranked AS (
	SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id, charge_id ORDER BY paid_at, id) AS sequence
	FROM payments
)
UPDATE payments
SET charge_version = COALESCE((SELECT sequence FROM ranked WHERE ranked.id = payments.id), 0);--> statement-breakpoint
UPDATE charges
SET payment_version = COALESCE((SELECT MAX(charge_version) FROM payments WHERE payments.school_id = charges.school_id AND payments.charge_id = charges.id), 0);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payments_charge_version` ON `payments` (`school_id`,`charge_id`,`charge_version`);
