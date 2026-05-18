CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_security_state" (
	"user_id" uuid PRIMARY KEY,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_failed_login_at" timestamp with time zone,
	"last_password_change_at" timestamp with time zone,
	"suspicious_activity_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD COLUMN "actor_user_id" uuid;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "session_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "authz_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN "revoked_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "authz_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
CREATE INDEX "auth_audit_logs_session_id_idx" ON "auth_audit_logs" ("session_id");--> statement-breakpoint
CREATE INDEX "auth_audit_logs_role_id_idx" ON "auth_audit_logs" ("role_id");--> statement-breakpoint
CREATE INDEX "auth_audit_logs_actor_user_id_idx" ON "auth_audit_logs" ("actor_user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" ("session_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_expires_at_idx" ON "refresh_tokens" ("session_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_unique_idx" ON "roles" ("code");--> statement-breakpoint
CREATE INDEX "user_roles_user_id_idx" ON "user_roles" ("user_id");--> statement-breakpoint
CREATE INDEX "user_roles_role_id_idx" ON "user_roles" ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_active_unique_idx" ON "user_roles" ("user_id","role_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_actor_user_id_users_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_session_id_user_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_user_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_users_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_security_state" ADD CONSTRAINT "user_security_state_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;