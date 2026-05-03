DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "users"
    LEFT JOIN "user_credentials"
      ON "users"."id" = "user_credentials"."user_id"
    WHERE "users"."password_hash" IS NOT NULL
      AND "user_credentials"."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot drop users.password_hash before migrating legacy credentials into user_credentials';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "password_hash";
