CREATE TABLE `announcement_audiences` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`announcement_id` text NOT NULL,
	`audience_type` text NOT NULL,
	`audience_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_announcement_audience` ON `announcement_audiences` (`school_id`,`audience_type`,`audience_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`priority` text DEFAULT 'NORMAL' NOT NULL,
	`published_at` text NOT NULL,
	`expires_at` text,
	`requires_acknowledgement` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_announcements_school_publish` ON `announcements` (`school_id`,`published_at`);--> statement-breakpoint
CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`actual_start_at` text,
	`actual_end_at` text,
	`content` text,
	`repertoire` text,
	`exercises` text,
	`private_notes` text,
	`next_goal` text,
	`replacement_needed` integer DEFAULT false NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_attendance_lesson_student` ON `attendances` (`school_id`,`lesson_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`actor_user_id` text,
	`actor_role` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`outcome` text NOT NULL,
	`ip_hash` text,
	`user_agent_hash` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_school_time` ON `audit_logs` (`school_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`school_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `availability_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text,
	`unit_id` text,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`kind` text NOT NULL,
	`available` integer DEFAULT false NOT NULL,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_availability_exception_range` ON `availability_exceptions` (`school_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `booking_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`slot_start` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_booking_lock` ON `booking_locks` (`school_id`,`resource_type`,`resource_id`,`slot_start`);--> statement-breakpoint
CREATE INDEX `idx_booking_locks_lesson` ON `booking_locks` (`school_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `charges` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`plan_id` text,
	`reference_month` text NOT NULL,
	`due_date` text NOT NULL,
	`original_amount_cents` integer NOT NULL,
	`discount_cents` integer DEFAULT 0 NOT NULL,
	`final_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `financial_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_charges_student_due` ON `charges` (`school_id`,`student_id`,`due_date`);--> statement-breakpoint
CREATE TABLE `class_teachers` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_class_teachers_teacher` ON `class_teachers` (`school_id`,`teacher_id`,`starts_on`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`course_id` text NOT NULL,
	`instrument_id` text,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 1 NOT NULL,
	`modality` text DEFAULT 'IN_PERSON' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_classes_school_unit` ON `classes` (`school_id`,`unit_id`,`status`);--> statement-breakpoint
CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`subject_user_id` text NOT NULL,
	`granted_by_user_id` text,
	`purpose` text NOT NULL,
	`legal_basis` text NOT NULL,
	`notice_version` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`granted_at` text,
	`revoked_at` text,
	`expires_at` text,
	`evidence_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subject_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_consents_subject_purpose` ON `consents` (`school_id`,`subject_user_id`,`purpose`,`status`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_courses_school_active` ON `courses` (`school_id`,`active`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_id` text NOT NULL,
	`student_id` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_enrollment_active` ON `enrollments` (`school_id`,`class_id`,`student_id`,`starts_on`);--> statement-breakpoint
CREATE INDEX `idx_enrollments_student` ON `enrollments` (`school_id`,`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `event_registrations` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'CONFIRMED' NOT NULL,
	`waitlist_position` integer,
	`checked_in_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_event_registration` ON `event_registrations` (`school_id`,`event_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`unit_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`location` text NOT NULL,
	`capacity` integer,
	`audience_json` text DEFAULT '{}' NOT NULL,
	`responsible_user_ids_json` text DEFAULT '[]' NOT NULL,
	`attachment_file_ids_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_school_start` ON `events` (`school_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `feedbacks` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`submission_version_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`private_message` text NOT NULL,
	`strengths_json` text DEFAULT '[]' NOT NULL,
	`improvements_json` text DEFAULT '[]' NOT NULL,
	`grade_value` text,
	`rubric_json` text DEFAULT '{}' NOT NULL,
	`guidance_file_id` text,
	`requests_revision` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_version_id`) REFERENCES `submission_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guidance_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feedback_submission` ON `feedbacks` (`school_id`,`submission_version_id`);--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`original_name` text NOT NULL,
	`extension` text NOT NULL,
	`detected_mime` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`sha256` text NOT NULL,
	`scan_status` text DEFAULT 'QUARANTINED' NOT NULL,
	`sensitivity` text DEFAULT 'PRIVATE' NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_files_storage_key` ON `files` (`school_id`,`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_files_owner` ON `files` (`school_id`,`owner_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `financial_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`billing_cycle` text DEFAULT 'MONTHLY' NOT NULL,
	`lesson_credits` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_plans_school_active` ON `financial_plans` (`school_id`,`active`);--> statement-breakpoint
CREATE TABLE `guardian_links` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`guardian_user_id` text NOT NULL,
	`student_id` text NOT NULL,
	`relationship` text NOT NULL,
	`financial_access` integer DEFAULT true NOT NULL,
	`schedule_authority` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guardian_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_guardian_student` ON `guardian_links` (`school_id`,`guardian_user_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `idx_guardian_links_student` ON `guardian_links` (`school_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`request_key` text NOT NULL,
	`response_json` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_idempotency_request` ON `idempotency_keys` (`school_id`,`user_id`,`action`,`request_key`);--> statement-breakpoint
CREATE TABLE `indicator_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`metrics_json` text NOT NULL,
	`sample_size` integer NOT NULL,
	`source_version` text NOT NULL,
	`calculated_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_indicator_snapshot` ON `indicator_snapshots` (`school_id`,`teacher_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE TABLE `instrument_loans` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`school_instrument_id` text NOT NULL,
	`student_id` text NOT NULL,
	`loaned_at` text NOT NULL,
	`due_at` text NOT NULL,
	`returned_at` text,
	`responsibility_file_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_instrument_id`) REFERENCES `school_instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_loans_school_student` ON `instrument_loans` (`school_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `instrument_maintenances` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`school_instrument_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`description` text NOT NULL,
	`cost_cents` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`school_instrument_id`) REFERENCES `school_instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_maintenance_instrument` ON `instrument_maintenances` (`school_id`,`school_instrument_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`family` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_instruments_school_name` ON `instruments` (`school_id`,`name`);--> statement-breakpoint
CREATE TABLE `lesson_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text DEFAULT 'CONFIRMED' NOT NULL,
	`waitlist_position` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_lesson_participant` ON `lesson_participants` (`school_id`,`lesson_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `idx_lesson_participant_student` ON `lesson_participants` (`school_id`,`student_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `lesson_series` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`rule_rrule` text NOT NULL,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`exception_policy` text DEFAULT 'KEEP' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lesson_series_school` ON `lesson_series` (`school_id`,`starts_on`);--> statement-breakpoint
CREATE TABLE `lesson_substitutions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`original_teacher_id` text NOT NULL,
	`substitute_teacher_id` text NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`original_teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`substitute_teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_substitutions_lesson` ON `lesson_substitutions` (`school_id`,`lesson_id`);--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`series_id` text,
	`class_id` text,
	`teacher_id` text NOT NULL,
	`substitute_teacher_id` text,
	`room_id` text,
	`instrument_id` text,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`buffer_minutes` integer DEFAULT 10 NOT NULL,
	`modality` text DEFAULT 'IN_PERSON' NOT NULL,
	`meeting_url_encrypted` text,
	`status` text DEFAULT 'SCHEDULED' NOT NULL,
	`change_scope` text,
	`cancellation_reason` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`series_id`) REFERENCES `lesson_series`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`substitute_teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lessons_school_range` ON `lessons` (`school_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `idx_lessons_teacher_range` ON `lessons` (`school_id`,`teacher_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_lessons_room_range` ON `lessons` (`school_id`,`room_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `makeup_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`source_lesson_id` text NOT NULL,
	`used_lesson_id` text,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_makeup_student_status` ON `makeup_credits` (`school_id`,`student_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `monthly_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`reference_month` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`published_at` text,
	`published_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_monthly_report` ON `monthly_reports` (`school_id`,`student_id`,`teacher_id`,`reference_month`);--> statement-breakpoint
CREATE INDEX `idx_reports_status_month` ON `monthly_reports` (`school_id`,`status`,`reference_month`);--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`event_type` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_notification_preference` ON `notification_preferences` (`school_id`,`user_id`,`channel`,`event_type`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`read_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_unread` ON `notifications` (`school_id`,`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`charge_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` text NOT NULL,
	`method` text NOT NULL,
	`provider_reference` text,
	`receipt_file_id` text,
	`recorded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`receipt_file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_charge` ON `payments` (`school_id`,`charge_id`,`paid_at`);--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`data_scope` text DEFAULT 'SCHOOL' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permissions_code_unique` ON `permissions` (`code`);--> statement-breakpoint
CREATE TABLE `practice_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`practiced_on` text NOT NULL,
	`minutes` integer NOT NULL,
	`repertoire` text,
	`difficulty` text,
	`observations` text,
	`share_with_teacher` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_practice_student_date` ON `practice_entries` (`school_id`,`student_id`,`practiced_on`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`subject_key` text NOT NULL,
	`operation` text NOT NULL,
	`window_start` text NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rate_limit_window` ON `rate_limits` (`school_id`,`subject_key`,`operation`,`window_start`);--> statement-breakpoint
CREATE TABLE `read_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_read_receipt` ON `read_receipts` (`school_id`,`announcement_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `recurring_availability` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`valid_from` text NOT NULL,
	`valid_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_availability_teacher_day` ON `recurring_availability` (`school_id`,`teacher_id`,`weekday`);--> statement-breakpoint
CREATE TABLE `repertoire_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`title` text NOT NULL,
	`composer` text,
	`kind` text DEFAULT 'MUSIC' NOT NULL,
	`level` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_repertoire_title` ON `repertoire_catalog` (`school_id`,`title`);--> statement-breakpoint
CREATE TABLE `report_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`report_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`author_user_id` text NOT NULL,
	`data_json` text NOT NULL,
	`coordination_comment` text,
	`change_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`report_id`) REFERENCES `monthly_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_version` ON `report_versions` (`school_id`,`report_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`role_id` text NOT NULL,
	`permission_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_role_permissions` ON `role_permissions` (`school_id`,`role_id`,`permission_id`);--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`system_role` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_roles_school_code` ON `roles` (`school_id`,`code`);--> statement-breakpoint
CREATE TABLE `room_resources` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`room_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_room_resources_room` ON `room_resources` (`school_id`,`room_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`name` text NOT NULL,
	`capacity` integer DEFAULT 1 NOT NULL,
	`accessible` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_rooms_unit_name` ON `rooms` (`school_id`,`unit_id`,`name`);--> statement-breakpoint
CREATE TABLE `school_instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`asset_tag` text NOT NULL,
	`condition` text DEFAULT 'GOOD' NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_school_instruments_asset` ON `school_instruments` (`school_id`,`asset_tag`);--> statement-breakpoint
CREATE TABLE `schools` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL,
	`primary_color` text DEFAULT '#102746' NOT NULL,
	`accent_color` text DEFAULT '#E49B32' NOT NULL,
	`logo_file_id` text,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`title` text NOT NULL,
	`target_date` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`progress_percent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_student_goals` ON `student_goals` (`school_id`,`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`birth_date` text,
	`notes_restricted` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_student_profiles_user` ON `student_profiles` (`school_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_students_unit_active` ON `student_profiles` (`school_id`,`unit_id`,`active`);--> statement-breakpoint
CREATE TABLE `student_repertoire` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`repertoire_id` text NOT NULL,
	`tempo_bpm` integer,
	`key_signature` text,
	`level` text,
	`status` text DEFAULT 'CURRENT' NOT NULL,
	`started_on` text,
	`completed_on` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repertoire_id`) REFERENCES `repertoire_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_student_repertoire` ON `student_repertoire` (`school_id`,`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `submission_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`text_content` text,
	`link_url` text,
	`file_ids_json` text DEFAULT '[]' NOT NULL,
	`submitted_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_submission_version` ON `submission_versions` (`school_id`,`submission_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`task_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text DEFAULT 'IN_PROGRESS' NOT NULL,
	`current_version` integer DEFAULT 0 NOT NULL,
	`submitted_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_submission_task_student` ON `submissions` (`school_id`,`task_id`,`student_id`);--> statement-breakpoint
CREATE TABLE `task_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`task_id` text NOT NULL,
	`file_id` text,
	`url` text,
	`label` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_materials_task` ON `task_materials` (`school_id`,`task_id`);--> statement-breakpoint
CREATE TABLE `task_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`task_id` text NOT NULL,
	`student_id` text,
	`class_id` text,
	`status` text DEFAULT 'PUBLISHED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`student_id`) REFERENCES `student_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_recipients_student` ON `task_recipients` (`school_id`,`student_id`,`status`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`course_id` text,
	`instrument_id` text,
	`title` text NOT NULL,
	`instructions` text NOT NULL,
	`published_at` text,
	`due_at` text NOT NULL,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`evaluation_mode` text DEFAULT 'CONCEPT' NOT NULL,
	`criteria_json` text DEFAULT '[]' NOT NULL,
	`max_attempts` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_teacher_due` ON `tasks` (`school_id`,`teacher_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `teacher_absences` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'REQUESTED' NOT NULL,
	`approved_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_id`) REFERENCES `teacher_profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_teacher_absences` ON `teacher_absences` (`school_id`,`teacher_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `teacher_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bio` text,
	`employment_reference` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_teacher_profiles_user` ON `teacher_profiles` (`school_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`address_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_units_school` ON `units` (`school_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	`unit_id` text,
	`granted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_roles_context` ON `user_roles` (`school_id`,`user_id`,`role_id`,`unit_id`);--> statement-breakpoint
CREATE INDEX `idx_user_roles_user` ON `user_roles` (`school_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`identity_subject` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`phone_encrypted` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`mfa_required` integer DEFAULT false NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_school_subject` ON `users` (`school_id`,`identity_subject`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_users_school_email` ON `users` (`school_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_users_school_status` ON `users` (`school_id`,`status`);--> statement-breakpoint
PRAGMA optimize;
