CREATE TABLE IF NOT EXISTS "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(64) NOT NULL,
  "name" varchar(128) NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_code_unique_idx" ON "roles" USING btree ("code");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "assigned_by_user_id" uuid,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_role_id_roles_id_fk"
  FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_assigned_by_user_id_users_id_fk"
  FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx" ON "user_roles" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles" USING btree ("role_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_active_unique_idx"
  ON "user_roles" USING btree ("user_id","role_id")
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

INSERT INTO "roles" ("code", "name", "description", "is_system")
VALUES
  ('user', 'User', 'Default authenticated user role', true),
  ('admin', 'Administrator', 'Full administrative access', true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "authz_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    INSERT INTO "user_roles" ("user_id", "role_id", "assigned_at")
    SELECT
      u."id",
      r."id",
      now()
    FROM "users" u
    INNER JOIN "roles" r
      ON r."code" = u."role"
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
--> statement-breakpoint

INSERT INTO "user_roles" ("user_id", "role_id", "assigned_at")
SELECT u."id", r."id", now()
FROM "users" u
INNER JOIN "roles" r ON r."code" = 'user'
LEFT JOIN "user_roles" ur
  ON ur."user_id" = u."id" AND ur."revoked_at" IS NULL
WHERE ur."id" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "authz_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_sessions" ADD COLUMN IF NOT EXISTS "revoked_reason" text;
--> statement-breakpoint

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "session_id" uuid;
--> statement-breakpoint
UPDATE "refresh_tokens" rt
SET "session_id" = us."id"
FROM "user_sessions" us
WHERE us."session_key" = rt."jti"
  AND rt."session_id" IS NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "refresh_tokens"
    WHERE "session_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot set refresh_tokens.session_id NOT NULL: legacy tokens without matching session';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "refresh_tokens"
  ADD CONSTRAINT "refresh_tokens_session_id_user_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "session_id" SET NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS "refresh_tokens_user_id_expires_at_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "refresh_tokens_user_id_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_session_id_idx" ON "refresh_tokens" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_session_id_expires_at_idx" ON "refresh_tokens" USING btree ("session_id","expires_at");
--> statement-breakpoint

ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
--> statement-breakpoint

ALTER TABLE "auth_audit_logs" ADD COLUMN IF NOT EXISTS "actor_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "auth_audit_logs" ADD COLUMN IF NOT EXISTS "session_id" uuid;
--> statement-breakpoint
ALTER TABLE "auth_audit_logs"
  ADD CONSTRAINT "auth_audit_logs_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "auth_audit_logs"
  ADD CONSTRAINT "auth_audit_logs_session_id_user_sessions_id_fk"
  FOREIGN KEY ("session_id") REFERENCES "public"."user_sessions"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_audit_logs_actor_user_id_idx" ON "auth_audit_logs" USING btree ("actor_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_audit_logs_session_id_idx" ON "auth_audit_logs" USING btree ("session_id");
