CREATE TABLE "app_settings" (
	"key" varchar PRIMARY KEY NOT NULL,
	"value" varchar NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assistant_error_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"error_message" varchar NOT NULL,
	"error_category" varchar NOT NULL,
	"file_name" varchar,
	"file_type" varchar,
	"file_size_bytes" bigint,
	"user_agent" varchar,
	"resolved" integer DEFAULT 0 NOT NULL,
	"resolution_action" varchar,
	"resolution_time_ms" integer,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "assistant_error_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"error_category" varchar NOT NULL,
	"total_occurrences" integer DEFAULT 0 NOT NULL,
	"total_resolved" integer DEFAULT 0 NOT NULL,
	"avg_resolution_time_ms" integer,
	"retry_success_count" integer DEFAULT 0 NOT NULL,
	"compressed_success_count" integer DEFAULT 0 NOT NULL,
	"converted_success_count" integer DEFAULT 0 NOT NULL,
	"split_success_count" integer DEFAULT 0 NOT NULL,
	"dismissed_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "assistant_error_stats_error_category_unique" UNIQUE("error_category")
);
--> statement-breakpoint
CREATE TABLE "document_hashes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"sha256_hash" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"size_bytes" bigint NOT NULL,
	"page_count" integer,
	"asset_id" varchar,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "early_access_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"documents_count" integer DEFAULT 0 NOT NULL,
	"questions_total" integer DEFAULT 0 NOT NULL,
	"questions_hour_window_count" integer DEFAULT 0 NOT NULL,
	"questions_hour_window_start" timestamp,
	"ppt_exports_count" integer DEFAULT 0 NOT NULL,
	"proposal_exports_count" integer DEFAULT 0 NOT NULL,
	"email_exports_count" integer DEFAULT 0 NOT NULL,
	"last_reset_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "early_access_usage_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"plan_key" varchar DEFAULT 'free' NOT NULL,
	"device_limit" integer DEFAULT 0 NOT NULL,
	"max_indexed_gb" integer,
	"has_legal_pack" integer DEFAULT 0 NOT NULL,
	"has_finance_pack" integer DEFAULT 0 NOT NULL,
	"has_hr_pack" integer DEFAULT 0 NOT NULL,
	"has_procurement_pack" integer DEFAULT 0 NOT NULL,
	"has_construction_pack" integer DEFAULT 0 NOT NULL,
	"has_compliance_pack" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_queue" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"job_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error" varchar,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_retry_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"schedule" varchar NOT NULL,
	"last_run" timestamp,
	"next_run" timestamp,
	"content" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"price_id" varchar NOT NULL,
	"plan_key" varchar DEFAULT 'free' NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "training_exports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"format" varchar NOT NULL,
	"filename" varchar,
	"content" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "upload_boosts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"max_file_size_mb" integer DEFAULT 50 NOT NULL,
	"stripe_payment_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"used_for_asset_id" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "usage_daily" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"date" date NOT NULL,
	"uploads_count" integer DEFAULT 0 NOT NULL,
	"chat_queries_count" integer DEFAULT 0 NOT NULL,
	"embedding_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_monthly" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"year_month" varchar NOT NULL,
	"storage_bytes" bigint DEFAULT 0 NOT NULL,
	"total_uploads" integer DEFAULT 0 NOT NULL,
	"queries_used" integer DEFAULT 0 NOT NULL,
	"media_seconds_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan" varchar DEFAULT 'free' NOT NULL,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_price_id" varchar,
	"stripe_current_period_end" timestamp,
	"stripe_subscription_status" varchar,
	"billing_cycle_start" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"auth_provider" varchar DEFAULT 'replit',
	"user_group" varchar DEFAULT 'external',
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"stripe_customer_id" varchar,
	"country" varchar,
	"country_code" varchar,
	"city" varchar,
	"region" varchar,
	"timezone" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" varchar NOT NULL,
	"asset_id" varchar NOT NULL,
	"added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"actor_user_id" varchar,
	"action" varchar NOT NULL,
	"target_type" varchar,
	"target_id" varchar,
	"payload_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_commands" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"command_type" varchar NOT NULL,
	"payload_json" jsonb,
	"status" varchar DEFAULT 'queued' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"executed_at" timestamp,
	"result_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "device_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"type" varchar NOT NULL,
	"message" varchar,
	"payload_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "device_folders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" varchar NOT NULL,
	"path_raw" varchar NOT NULL,
	"path_masked" varchar,
	"include_subfolders" boolean DEFAULT true,
	"exclusions_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "download_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"artifact" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "enterprise_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"owner_user_id" varchar,
	"name" varchar NOT NULL,
	"os" varchar,
	"version" varchar,
	"install_mode" varchar DEFAULT 'service',
	"status_override" varchar DEFAULT 'active' NOT NULL,
	"last_seen_at" timestamp,
	"last_state" varchar DEFAULT 'idle',
	"last_sync_at" timestamp,
	"last_scan_at" timestamp,
	"last_progress_at" timestamp,
	"queue_depth" integer DEFAULT 0,
	"last_error_code" varchar,
	"applied_policy_version" integer,
	"agent_token_hash" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enterprise_org_invites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"org_name" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"created_by_user_id" varchar,
	"accepted_by_user_id" varchar,
	"created_org_id" varchar,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"accepted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_agent_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"policy_json" jsonb NOT NULL,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "org_enrollment_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"token_hash" varchar NOT NULL,
	"rotated_at" timestamp DEFAULT now(),
	"rotated_by" varchar
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" varchar DEFAULT 'MEMBER' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"plan" varchar DEFAULT 'enterprise' NOT NULL,
	"plan_device_limit" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pairing_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"code_hash" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "assistant_error_events" ADD CONSTRAINT "assistant_error_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_hashes" ADD CONSTRAINT "document_hashes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "early_access_usage" ADD CONSTRAINT "early_access_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_queue" ADD CONSTRAINT "job_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_exports" ADD CONSTRAINT "training_exports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_boosts" ADD CONSTRAINT "upload_boosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_daily" ADD CONSTRAINT "usage_daily_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_monthly" ADD CONSTRAINT "usage_monthly_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plans" ADD CONSTRAINT "user_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_assets" ADD CONSTRAINT "workspace_assets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_commands" ADD CONSTRAINT "device_commands_device_id_enterprise_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."enterprise_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_events" ADD CONSTRAINT "device_events_device_id_enterprise_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."enterprise_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_folders" ADD CONSTRAINT "device_folders_device_id_enterprise_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."enterprise_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_tokens" ADD CONSTRAINT "download_tokens_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_tokens" ADD CONSTRAINT "download_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_devices" ADD CONSTRAINT "enterprise_devices_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_devices" ADD CONSTRAINT "enterprise_devices_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_org_invites" ADD CONSTRAINT "enterprise_org_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_org_invites" ADD CONSTRAINT "enterprise_org_invites_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enterprise_org_invites" ADD CONSTRAINT "enterprise_org_invites_created_org_id_orgs_id_fk" FOREIGN KEY ("created_org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_agent_policies" ADD CONSTRAINT "org_agent_policies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_agent_policies" ADD CONSTRAINT "org_agent_policies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_enrollment_tokens" ADD CONSTRAINT "org_enrollment_tokens_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_enrollment_tokens" ADD CONSTRAINT "org_enrollment_tokens_rotated_by_users_id_fk" FOREIGN KEY ("rotated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assistant_error_events_category" ON "assistant_error_events" USING btree ("error_category");--> statement-breakpoint
CREATE INDEX "idx_assistant_error_events_user" ON "assistant_error_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_assistant_error_events_resolved" ON "assistant_error_events" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "idx_document_hashes_user" ON "document_hashes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_document_hashes_hash" ON "document_hashes" USING btree ("sha256_hash");--> statement-breakpoint
CREATE INDEX "idx_job_queue_status_priority" ON "job_queue" USING btree ("status","priority");--> statement-breakpoint
CREATE INDEX "idx_job_queue_user" ON "job_queue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_job_queue_type" ON "job_queue" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_job_queue_next_retry" ON "job_queue" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_reports_workspace" ON "reports" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_training_exports_workspace" ON "training_exports" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_usage_daily_user_date" ON "usage_daily" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_usage_monthly_user_month" ON "usage_monthly" USING btree ("user_id","year_month");--> statement-breakpoint
CREATE INDEX "idx_workspace_assets_workspace" ON "workspace_assets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_assets_asset" ON "workspace_assets" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "idx_agent_audit_logs_org" ON "agent_audit_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_agent_audit_logs_action" ON "agent_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_agent_audit_logs_created" ON "agent_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_device_commands_device" ON "device_commands" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_commands_status" ON "device_commands" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_device_events_device" ON "device_events" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_device_events_type" ON "device_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_device_events_created" ON "device_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_device_folders_device" ON "device_folders" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "idx_download_tokens_org" ON "download_tokens" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_download_tokens_hash" ON "download_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_enterprise_devices_org" ON "enterprise_devices" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_enterprise_devices_owner" ON "enterprise_devices" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "idx_enterprise_devices_status" ON "enterprise_devices" USING btree ("status_override");--> statement-breakpoint
CREATE INDEX "idx_enterprise_org_invites_email" ON "enterprise_org_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_enterprise_org_invites_status" ON "enterprise_org_invites" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enterprise_org_invites_token" ON "enterprise_org_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_org_agent_policies_org" ON "org_agent_policies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_agent_policies_version" ON "org_agent_policies" USING btree ("org_id","version");--> statement-breakpoint
CREATE INDEX "idx_org_enrollment_tokens_org" ON "org_enrollment_tokens" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_enrollment_tokens_hash" ON "org_enrollment_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_org_members_org" ON "org_members" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_org_members_user" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pairing_codes_org" ON "pairing_codes" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_pairing_codes_hash" ON "pairing_codes" USING btree ("code_hash");