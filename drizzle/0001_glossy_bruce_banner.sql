CREATE TABLE `makeup_credit_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`credit_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_id`) REFERENCES `makeup_credits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_makeup_credit_once` ON `makeup_credit_uses` (`school_id`,`credit_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_makeup_lesson_once` ON `makeup_credit_uses` (`school_id`,`lesson_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_makeup_source_student` ON `makeup_credits` (`school_id`,`student_id`,`source_lesson_id`);--> statement-breakpoint
PRAGMA optimize;
