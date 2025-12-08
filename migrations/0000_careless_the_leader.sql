CREATE TABLE "delivered_shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_number" text NOT NULL,
	"status" text NOT NULL,
	"shipper_company" text,
	"recipient_company" text,
	"service_type" text,
	"package_weight" text,
	"package_count" integer NOT NULL,
	"expected_delivery" text,
	"actual_delivery" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scanned_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"session_name" text,
	"scanned_numbers" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_number" text NOT NULL,
	"status" text NOT NULL,
	"scheduled_delivery" text,
	"shipper_name" text,
	"shipper_company" text,
	"recipient_name" text,
	"recipient_company" text,
	"master_tracking_number" text,
	"package_count" integer NOT NULL,
	"package_type" text,
	"package_weight" text,
	"total_weight" text,
	"direction" text,
	"service_type" text,
	"last_update" timestamp DEFAULT now() NOT NULL,
	"google_sheet_row" integer,
	"fedex_raw_data" text,
	"child_tracking_numbers" text[],
	"not_scanned" integer DEFAULT 0 NOT NULL,
	"manually_completed" integer DEFAULT 0 NOT NULL,
	"delivered_package_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"source" text NOT NULL,
	"tracking_number" text,
	"success" integer NOT NULL,
	"error_message" text,
	"error_stack" text,
	"sheet_data" text,
	"response_data" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "delivered_tracking_number_idx" ON "delivered_shipments" USING btree ("tracking_number");--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_number_idx" ON "shipments" USING btree ("tracking_number");