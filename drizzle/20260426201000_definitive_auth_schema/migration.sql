CREATE TABLE IF NOT EXISTS "one_time_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" varchar(64) NOT NULL,
  "token_hash" text NOT NULL,
  "requested_by_ip" varchar(64),
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'one_time_tokens_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "one_time_tokens"
      ADD CONSTRAINT "one_time_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "one_time_tokens_user_id_idx" ON "one_time_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "one_time_tokens_user_id_type_idx" ON "one_time_tokens" USING btree ("user_id","type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "one_time_tokens_type_expires_at_idx" ON "one_time_tokens" USING btree ("type","expires_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_security_state" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "failed_login_count" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp with time zone,
  "last_failed_login_at" timestamp with time zone,
  "last_password_change_at" timestamp with time zone,
  "suspicious_activity_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_security_state_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint

ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
UPDATE "refresh_tokens" rt
SET "user_id" = us."user_id"
FROM "user_sessions" us
WHERE rt."session_id" = us."id"
  AND rt."user_id" IS NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "refresh_tokens"
    WHERE "user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot set refresh_tokens.user_id NOT NULL: orphan refresh tokens without a valid session';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refresh_tokens_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "refresh_tokens"
      ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens" USING btree ("user_id","expires_at");
--> statement-breakpoint

ALTER TABLE "auth_audit_logs" ADD COLUMN IF NOT EXISTS "role_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'auth_audit_logs_role_id_roles_id_fk'
  ) THEN
    ALTER TABLE "auth_audit_logs"
      ADD CONSTRAINT "auth_audit_logs_role_id_roles_id_fk"
      FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id")
      ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_audit_logs_role_id_idx" ON "auth_audit_logs" USING btree ("role_id");
--> statement-breakpoint

INSERT INTO "one_time_tokens" (
  "user_id",
  "type",
  "token_hash",
  "requested_by_ip",
  "expires_at",
  "used_at",
  "created_at"
)
SELECT
  evt."user_id",
  'email_verification',
  evt."token_hash",
  NULL,
  evt."expires_at",
  evt."used_at",
  evt."created_at"
FROM "email_verification_tokens" evt
WHERE NOT EXISTS (
  SELECT 1
  FROM "one_time_tokens" ott
  WHERE ott."user_id" = evt."user_id"
    AND ott."type" = 'email_verification'
    AND ott."token_hash" = evt."token_hash"
    AND ott."created_at" = evt."created_at"
);
--> statement-breakpoint
INSERT INTO "one_time_tokens" (
  "user_id",
  "type",
  "token_hash",
  "requested_by_ip",
  "expires_at",
  "used_at",
  "created_at"
)
SELECT
  prt."user_id",
  'password_reset',
  prt."token_hash",
  prt."requested_by_ip",
  prt."expires_at",
  prt."used_at",
  prt."created_at"
FROM "password_reset_tokens" prt
WHERE NOT EXISTS (
  SELECT 1
  FROM "one_time_tokens" ott
  WHERE ott."user_id" = prt."user_id"
    AND ott."type" = 'password_reset'
    AND ott."token_hash" = prt."token_hash"
    AND ott."created_at" = prt."created_at"
);
