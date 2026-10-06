-- =============================================================
-- ATLAS Platform: Full Migration Dump from Local SQLite to Supabase
-- Generated: 2026-10-06T13:47:17.298929 UTC
-- Target: Supabase (PostgreSQL 15+)
-- =============================================================

-- Disable foreign key checks during batch ingestion
SET session_replication_role = 'replica';

-- =============================================================
-- 1. SCHEMA DEFINITIONS (TABLES & INDEXES)
-- =============================================================

-- Table: anonymous_accounts
CREATE TABLE anonymous_accounts (
	id VARCHAR(36) NOT NULL, 
	secret_hash BYTEA NOT NULL, 
	valid_until TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_anonymous_accounts_secret_hash ON anonymous_accounts (secret_hash);

CREATE INDEX ix_anonymous_accounts_id ON anonymous_accounts (id);

-- Table: anonymous_categories
CREATE TABLE anonymous_categories (
	id SERIAL NOT NULL, 
	slug VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description VARCHAR(255) NOT NULL, 
	sort_order INTEGER, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_anonymous_categories_slug ON anonymous_categories (slug);

CREATE INDEX ix_anonymous_categories_id ON anonymous_categories (id);

-- Table: anonymous_issuances
CREATE TABLE anonymous_issuances (
	student_hmac BYTEA NOT NULL, 
	semester VARCHAR(20) NOT NULL, 
	issued_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (student_hmac, semester)
);

-- Table: anonymous_posts
CREATE TABLE anonymous_posts (
	id SERIAL NOT NULL, 
	content TEXT NOT NULL, 
	domain VARCHAR(50), 
	is_mental_health BOOLEAN, 
	is_flagged BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_anonymous_posts_id ON anonymous_posts (id);

-- Table: anonymous_reports
CREATE TABLE anonymous_reports (
	id SERIAL NOT NULL, 
	reporter_hash BYTEA NOT NULL, 
	target_type VARCHAR(10) NOT NULL, 
	target_id INTEGER NOT NULL, 
	reason VARCHAR(50) NOT NULL, 
	note TEXT, 
	handled BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_anonymous_reports_target_id ON anonymous_reports (target_id);

CREATE INDEX ix_anonymous_reports_reporter_hash ON anonymous_reports (reporter_hash);

CREATE INDEX ix_anonymous_reports_id ON anonymous_reports (id);

-- Table: anonymous_spent_vouchers
CREATE TABLE anonymous_spent_vouchers (
	token_hash BYTEA NOT NULL, 
	semester VARCHAR(20) NOT NULL, 
	spent_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (token_hash)
);

-- Table: anonymous_votes
CREATE TABLE anonymous_votes (
	voter_key VARCHAR(64) NOT NULL, 
	target_type VARCHAR(10) NOT NULL, 
	target_id INTEGER NOT NULL, 
	vote INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (voter_key, target_type, target_id)
);

-- Table: revoked_tokens
CREATE TABLE revoked_tokens (
	id SERIAL NOT NULL, 
	jti VARCHAR(64) NOT NULL, 
	expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_revoked_tokens_id ON revoked_tokens (id);

CREATE UNIQUE INDEX ix_revoked_tokens_jti ON revoked_tokens (jti);

-- Table: students
CREATE TABLE students (
	id SERIAL NOT NULL, 
	roll_number VARCHAR(20) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	email VARCHAR(100), 
	password_hash VARCHAR(255) NOT NULL, 
	branch VARCHAR(50), 
	year INTEGER, 
	domains VARCHAR(200), 
	study_hours_per_week FLOAT, 
	goals TEXT, 
	weak_subjects TEXT, 
	"wakingHoursPerDay" INTEGER, 
	cpi FLOAT, 
	sleep_hours FLOAT, 
	screen_time_hours FLOAT, 
	role VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE INDEX ix_students_id ON students (id);

CREATE UNIQUE INDEX ix_students_email ON students (email);

CREATE UNIQUE INDEX ix_students_roll_number ON students (roll_number);

-- Table: ai_chats
CREATE TABLE ai_chats (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	title VARCHAR(200), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_ai_chats_id ON ai_chats (id);

-- Table: anonymous_post_reports
CREATE TABLE anonymous_post_reports (
	id SERIAL NOT NULL, 
	post_id INTEGER NOT NULL, 
	student_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT unique_post_student_report UNIQUE (post_id, student_id), 
	FOREIGN KEY(post_id) REFERENCES anonymous_posts (id) ON DELETE CASCADE, 
	FOREIGN KEY(student_id) REFERENCES students (id) ON DELETE CASCADE
);

CREATE INDEX ix_anonymous_post_reports_student_id ON anonymous_post_reports (student_id);

CREATE INDEX ix_anonymous_post_reports_post_id ON anonymous_post_reports (post_id);

CREATE INDEX ix_anonymous_post_reports_id ON anonymous_post_reports (id);

-- Table: anonymous_posts_v2
CREATE TABLE anonymous_posts_v2 (
	id SERIAL NOT NULL, 
	slug VARCHAR(32) NOT NULL, 
	category_id INTEGER NOT NULL, 
	is_anonymous BOOLEAN NOT NULL, 
	account_id VARCHAR(36), 
	student_id INTEGER, 
	kind VARCHAR(20) NOT NULL, 
	title VARCHAR(250) NOT NULL, 
	body TEXT NOT NULL, 
	is_official BOOLEAN NOT NULL, 
	is_flagged BOOLEAN NOT NULL, 
	images TEXT NOT NULL, 
	upvotes INTEGER NOT NULL, 
	downvotes INTEGER NOT NULL, 
	metoo INTEGER NOT NULL, 
	reply_count INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(category_id) REFERENCES anonymous_categories (id), 
	FOREIGN KEY(account_id) REFERENCES anonymous_accounts (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE UNIQUE INDEX ix_anonymous_posts_v2_slug ON anonymous_posts_v2 (slug);

CREATE INDEX ix_anonymous_posts_v2_id ON anonymous_posts_v2 (id);

CREATE INDEX ix_anonymous_posts_v2_student_id ON anonymous_posts_v2 (student_id);

CREATE INDEX ix_anonymous_posts_v2_account_id ON anonymous_posts_v2 (account_id);

CREATE INDEX ix_anonymous_posts_v2_created_at ON anonymous_posts_v2 (created_at);

-- Table: burnout_scores
CREATE TABLE burnout_scores (
	id SERIAL NOT NULL, 
	student_id INTEGER, 
	score FLOAT NOT NULL, 
	study_hours FLOAT, 
	workload_factor FLOAT, 
	stress_level INTEGER, 
	consistency_factor FLOAT, 
	risk_level VARCHAR(50), 
	cgpa FLOAT, 
	daily_sleep_hours FLOAT, 
	daily_study_hours FLOAT, 
	physical_activity_hours FLOAT, 
	social_support_score FLOAT, 
	ml_screen_time_hours FLOAT, 
	weekly_working_hours FLOAT, 
	deadline_pressure FLOAT, 
	sleep_deficit_hours FLOAT, 
	task_backlog_score FLOAT, 
	telemetry_score FLOAT, 
	ml_score FLOAT, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_burnout_scores_id ON burnout_scores (id);

-- Table: events
CREATE TABLE events (
	id SERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	event_date TIMESTAMP WITHOUT TIME ZONE, 
	location VARCHAR(200), 
	domain VARCHAR(50), 
	organizer VARCHAR(100), 
	created_by_id INTEGER, 
	slides_link VARCHAR(500), 
	recording_link VARCHAR(500), 
	is_archived BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by_id) REFERENCES students (id)
);

CREATE INDEX ix_events_created_by_id ON events (created_by_id);

CREATE INDEX ix_events_id ON events (id);

-- Table: google_accounts
CREATE TABLE google_accounts (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	email VARCHAR(150) NOT NULL, 
	name VARCHAR(150), 
	picture VARCHAR(500), 
	encrypted_access_token TEXT NOT NULL, 
	encrypted_refresh_token TEXT, 
	token_expiry TIMESTAMP WITHOUT TIME ZONE, 
	scopes TEXT, 
	drive_root_folder_id VARCHAR(100), 
	calendar_id VARCHAR(150), 
	is_active BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_google_accounts_id ON google_accounts (id);

CREATE UNIQUE INDEX ix_google_accounts_student_id ON google_accounts (student_id);

-- Table: planner_events
CREATE TABLE planner_events (
	id SERIAL NOT NULL, 
	"userId" INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	date TIMESTAMP WITHOUT TIME ZONE, 
	"startTime" VARCHAR(5) NOT NULL, 
	"endTime" VARCHAR(5) NOT NULL, 
	description TEXT, 
	location VARCHAR(200), 
	tag VARCHAR(20) NOT NULL, 
	category VARCHAR(20) NOT NULL, 
	"isWorkingHour" BOOLEAN, 
	link VARCHAR(500), 
	"isRecurring" BOOLEAN, 
	"recurrenceDay" INTEGER, 
	"isCompleted" BOOLEAN NOT NULL, 
	"userComment" TEXT, 
	"deletedAt" TIMESTAMP WITHOUT TIME ZONE, 
	exdates TEXT, 
	deadline_date TIMESTAMP WITHOUT TIME ZONE, 
	deadline_label VARCHAR(200), 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY("userId") REFERENCES students (id)
);

CREATE INDEX ix_planner_events_date ON planner_events (date);

CREATE INDEX ix_planner_events_id ON planner_events (id);

CREATE INDEX "ix_planner_events_userId" ON planner_events ("userId");

CREATE INDEX "ix_planner_events_deletedAt" ON planner_events ("deletedAt");

-- Table: post_replies
CREATE TABLE post_replies (
	id SERIAL NOT NULL, 
	post_id INTEGER, 
	content TEXT NOT NULL, 
	is_senior_verified BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES anonymous_posts (id)
);

CREATE INDEX ix_post_replies_id ON post_replies (id);

-- Table: resources
CREATE TABLE resources (
	id SERIAL NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	url VARCHAR(500), 
	content TEXT, 
	domain VARCHAR(50) NOT NULL, 
	course VARCHAR(100), 
	resource_type VARCHAR(50), 
	upvotes INTEGER, 
	uploader_id INTEGER, 
	is_private BOOLEAN, 
	is_curated BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(uploader_id) REFERENCES students (id)
);

CREATE INDEX ix_resources_id ON resources (id);

-- Table: senior_journeys
CREATE TABLE senior_journeys (
	id SERIAL NOT NULL, 
	author_id INTEGER, 
	title VARCHAR(200) NOT NULL, 
	domain VARCHAR(50) NOT NULL, 
	content TEXT NOT NULL, 
	year_completed INTEGER, 
	tags VARCHAR(200), 
	upvotes INTEGER, 
	is_verified BOOLEAN, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(author_id) REFERENCES students (id)
);

CREATE INDEX ix_senior_journeys_id ON senior_journeys (id);

-- Table: task_logs
CREATE TABLE task_logs (
	id SERIAL NOT NULL, 
	student_id INTEGER, 
	title VARCHAR(200) NOT NULL, 
	description TEXT, 
	domain VARCHAR(50), 
	priority INTEGER, 
	estimated_hours FLOAT, 
	actual_hours FLOAT, 
	completed BOOLEAN, 
	due_date TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_task_logs_id ON task_logs (id);

-- Table: user_api_keys
CREATE TABLE user_api_keys (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	provider VARCHAR(30) NOT NULL, 
	encrypted_key TEXT NOT NULL, 
	model_name VARCHAR(100), 
	base_url VARCHAR(255), 
	is_active BOOLEAN, 
	last_validated_at TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT unique_student_provider_key UNIQUE (student_id, provider), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_user_api_keys_student_id ON user_api_keys (student_id);

CREATE INDEX ix_user_api_keys_id ON user_api_keys (id);

-- Table: ai_messages
CREATE TABLE ai_messages (
	id SERIAL NOT NULL, 
	chat_id INTEGER NOT NULL, 
	role VARCHAR(20) NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(chat_id) REFERENCES ai_chats (id)
);

CREATE INDEX ix_ai_messages_id ON ai_messages (id);

-- Table: anonymous_metoos
CREATE TABLE anonymous_metoos (
	voter_key VARCHAR(64) NOT NULL, 
	post_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (voter_key, post_id), 
	FOREIGN KEY(post_id) REFERENCES anonymous_posts_v2 (id) ON DELETE CASCADE
);

-- Table: anonymous_replies_v2
CREATE TABLE anonymous_replies_v2 (
	id SERIAL NOT NULL, 
	post_id INTEGER NOT NULL, 
	parent_id INTEGER, 
	is_anonymous BOOLEAN NOT NULL, 
	account_id VARCHAR(36), 
	student_id INTEGER, 
	body TEXT NOT NULL, 
	is_official BOOLEAN NOT NULL, 
	is_senior_verified BOOLEAN NOT NULL, 
	upvotes INTEGER NOT NULL, 
	downvotes INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(post_id) REFERENCES anonymous_posts_v2 (id) ON DELETE CASCADE, 
	FOREIGN KEY(parent_id) REFERENCES anonymous_replies_v2 (id) ON DELETE CASCADE, 
	FOREIGN KEY(account_id) REFERENCES anonymous_accounts (id), 
	FOREIGN KEY(student_id) REFERENCES students (id)
);

CREATE INDEX ix_anonymous_replies_v2_id ON anonymous_replies_v2 (id);

CREATE INDEX ix_anonymous_replies_v2_account_id ON anonymous_replies_v2 (account_id);

CREATE INDEX ix_anonymous_replies_v2_parent_id ON anonymous_replies_v2 (parent_id);

CREATE INDEX ix_anonymous_replies_v2_student_id ON anonymous_replies_v2 (student_id);

CREATE INDEX ix_anonymous_replies_v2_post_id ON anonymous_replies_v2 (post_id);

-- Table: deadline_subtasks
CREATE TABLE deadline_subtasks (
	id SERIAL NOT NULL, 
	deadline_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	is_completed BOOLEAN NOT NULL, 
	"order" INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(deadline_id) REFERENCES planner_events (id) ON DELETE CASCADE
);

CREATE INDEX ix_deadline_subtasks_id ON deadline_subtasks (id);

CREATE INDEX ix_deadline_subtasks_deadline_id ON deadline_subtasks (deadline_id);

-- Table: journey_upvotes
CREATE TABLE journey_upvotes (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	journey_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT unique_user_journey_upvote UNIQUE (student_id, journey_id), 
	FOREIGN KEY(student_id) REFERENCES students (id), 
	FOREIGN KEY(journey_id) REFERENCES senior_journeys (id)
);

CREATE INDEX ix_journey_upvotes_id ON journey_upvotes (id);

-- Table: resource_bookmarks
CREATE TABLE resource_bookmarks (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	resource_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT unique_user_resource_bookmark UNIQUE (student_id, resource_id), 
	FOREIGN KEY(student_id) REFERENCES students (id), 
	FOREIGN KEY(resource_id) REFERENCES resources (id)
);

CREATE INDEX ix_resource_bookmarks_id ON resource_bookmarks (id);

-- Table: resource_upvotes
CREATE TABLE resource_upvotes (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	resource_id INTEGER NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	CONSTRAINT unique_user_resource_upvote UNIQUE (student_id, resource_id), 
	FOREIGN KEY(student_id) REFERENCES students (id), 
	FOREIGN KEY(resource_id) REFERENCES resources (id)
);

CREATE INDEX ix_resource_upvotes_id ON resource_upvotes (id);

-- Table: smart_suggestions
CREATE TABLE smart_suggestions (
	id SERIAL NOT NULL, 
	student_id INTEGER NOT NULL, 
	title VARCHAR(200) NOT NULL, 
	reason TEXT NOT NULL, 
	action_steps TEXT NOT NULL, 
	priority INTEGER, 
	status VARCHAR(20), 
	is_pinned BOOLEAN, 
	resource_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE, 
	updated_at TIMESTAMP WITHOUT TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(student_id) REFERENCES students (id), 
	FOREIGN KEY(resource_id) REFERENCES resources (id)
);

CREATE INDEX ix_smart_suggestions_id ON smart_suggestions (id);

-- =============================================================
-- 2. DATA INGESTION
-- =============================================================

-- Data for anonymous_accounts (2 rows)
INSERT INTO "anonymous_accounts" ("id", "secret_hash", "valid_until", "status", "created_at") VALUES ('e489be0f-4d09-4af0-add6-2b4cd0360c04', '\x34b92496ae195c64d05d6bc536762ce6f51bfce45110dbdad547848cda08f544'::bytea, '2027-04-02 07:34:00.008008', 'active', '2026-10-04 07:34:00.011193') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_accounts" ("id", "secret_hash", "valid_until", "status", "created_at") VALUES ('46baaaf8-31a6-4ae2-9b0d-7dfbd3b98e65', '\xd12f3f26f9304bf0904451a015e32a1fc89f1ee553313a68f9d613584930635d'::bytea, '2027-04-02 08:50:22.766311', 'active', '2026-10-04 08:50:22.767317') ON CONFLICT DO NOTHING;

-- Data for anonymous_categories (8 rows)
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (1, 'hostel-mess', 'Hostel & Mess', 'Mess food quality, rooms, hygiene, water, WiFi/LAN, maintenance, and hostel councils.', 1) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (2, 'academics', 'Academics & Grading', 'Courses, grading curves, quiz leaks/policy, TAs, academic probation, and DAMP.', 2) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (3, 'wellbeing', 'Wellbeing & Mind', 'Stress, burnout, loneliness, relationship pressure, and imposter syndrome.', 3) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (4, 'placements', 'Placements & Interns', 'PT Cell, JAF policies, shortlists, interview fundae, and internship experiences.', 4) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (5, 'harassment', 'Harassment & Safety', 'Ragging, unsafe campus areas, discrimination, and situations that feel unsafe.', 5) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (6, 'administration', 'Administration & SAC', 'Dean SA, ASC portal, Gymkhana, fee hikes, mess rebate, cycle/vehicle rules.', 6) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (7, 'insti-life', 'Insti Life & General', 'Mood Indigo, Techfest, tech teams, cult, hostel banter, and general campus fundae.', 7) ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_categories" ("id", "slug", "name", "description", "sort_order") VALUES (8, 'official', 'Official Announcements', 'Verified updates from Atlas Team, Student Council, and Institute bodies.', 8) ON CONFLICT DO NOTHING;

-- Data for anonymous_issuances (1 rows)
INSERT INTO "anonymous_issuances" ("student_hmac", "semester", "issued_at") VALUES ('\x45294e6dfb168438ab7df33916dfe1f70179838625c29991fbc2735b555f2040'::bytea, '2026-autumn', '2026-10-04 08:50:22.749996') ON CONFLICT DO NOTHING;

-- Data for anonymous_spent_vouchers (1 rows)
INSERT INTO "anonymous_spent_vouchers" ("token_hash", "semester", "spent_at") VALUES ('\x86d8913076cfbae5c8e0d79fd5e94140c6fe8a2c03be47ec3286b771447a43fb'::bytea, '2026-autumn', '2026-10-04 08:50:22.768317') ON CONFLICT DO NOTHING;

-- Data for anonymous_votes (1 rows)
INSERT INTO "anonymous_votes" ("voter_key", "target_type", "target_id", "vote", "created_at") VALUES ('stud:45294e6dfb168438ab7df33916dfe1f7', 'post', 1, -1, '2026-10-05 07:44:36.562563') ON CONFLICT DO NOTHING;

-- Data for revoked_tokens (2 rows)
INSERT INTO "revoked_tokens" ("id", "jti", "expires_at", "created_at") VALUES (1, 'c9ccf08cf65d4d8cb0335ea469059f5f', '2026-09-05 17:43:49.000000', '2026-09-05 16:43:49.464263') ON CONFLICT DO NOTHING;
INSERT INTO "revoked_tokens" ("id", "jti", "expires_at", "created_at") VALUES (2, '851e3c67f47240e184e697218008fcca', '2026-09-05 17:44:06.000000', '2026-09-05 16:44:06.871651') ON CONFLICT DO NOTHING;

-- Data for students (3 rows)
INSERT INTO "students" ("id", "roll_number", "name", "email", "password_hash", "branch", "year", "domains", "study_hours_per_week", "goals", "weak_subjects", "wakingHoursPerDay", "cpi", "sleep_hours", "screen_time_hours", "created_at", "role") VALUES (1, '21001001', 'Amit Patel', 'amit.patel@iitb.ac.in', '$2b$12$u61Bfna.oFlbbnCJ/BSOFOB0MZHh0t2UFHgaOOgAEjiMmyVxU9b2G', 'Computer Science', 4, 'sde,ai_ml', 35.0, 'placements,research', 'DBMS,CN', 16, 8.5, 7.0, 6.0, '2026-08-18 10:01:15.717732', 'student') ON CONFLICT DO NOTHING;
INSERT INTO "students" ("id", "roll_number", "name", "email", "password_hash", "branch", "year", "domains", "study_hours_per_week", "goals", "weak_subjects", "wakingHoursPerDay", "cpi", "sleep_hours", "screen_time_hours", "created_at", "role") VALUES (2, '21001002', 'Priya Sharma', 'priya.sharma@iitb.ac.in', '$2b$12$5qJsnMjclf344Rwbum3ffe1ENHERsBWNAyl94eWC660eTl5zl8TJS', 'Electrical', 3, 'research,core', 25.0, 'research,phd', 'Signals,Circuits', 16, 8.5, 7.0, 6.0, '2026-08-18 10:01:15.717732', 'student') ON CONFLICT DO NOTHING;
INSERT INTO "students" ("id", "roll_number", "name", "email", "password_hash", "branch", "year", "domains", "study_hours_per_week", "goals", "weak_subjects", "wakingHoursPerDay", "cpi", "sleep_hours", "screen_time_hours", "created_at", "role") VALUES (3, '21001003', 'Krish Tandel', 'krish@iitb.ac.in', '$2b$12$zlJaf8qPvJHXGzIp4qH1FOMvAGxI1I4OOGwhSkS11CDoXDSdGxKLa', 'CME', 3, '', 0.0, '', '', 16, 0.0, 0.0, 0.0, '2026-10-05 07:48:45.460925', 'student') ON CONFLICT DO NOTHING;

-- Data for ai_chats (1 rows)
INSERT INTO "ai_chats" ("id", "student_id", "title", "created_at") VALUES (1, 1, 'New Chat', '2026-08-18 10:13:52.634227') ON CONFLICT DO NOTHING;

-- Data for anonymous_posts_v2 (3 rows)
INSERT INTO "anonymous_posts_v2" ("id", "slug", "category_id", "is_anonymous", "account_id", "student_id", "kind", "title", "body", "is_official", "is_flagged", "images", "upvotes", "downvotes", "metoo", "reply_count", "created_at") VALUES (1, '3f144c7dfab8', 1, 1, 'e489be0f-4d09-4af0-add6-2b4cd0360c04', NULL, 'grievance', 'Hostel 16 water purifiers on 3rd & 4th floor taste of rust again', 'This has been an ongoing issue since midsems. Both coolers in B-wing are giving yellowish water with metallic taste. Already filed a complaint on the maintenance portal 5 days ago with zero response. Anyone else having throat irritation?', 0, 0, '[]', 28, 2, 43, 3, '2026-10-03 23:34:00.010127') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_posts_v2" ("id", "slug", "category_id", "is_anonymous", "account_id", "student_id", "kind", "title", "body", "is_official", "is_flagged", "images", "upvotes", "downvotes", "metoo", "reply_count", "created_at") VALUES (2, 'b3c1cfdbc0fc', 2, 1, 'e489be0f-4d09-4af0-add6-2b4cd0360c04', NULL, 'conversation', 'How strictly is the relative grading curved in IE courses?', 'First time taking an operations research elective with IE code. The class average in midsem was 42/100, standard deviation was $\sigma = 14.5$. Does the prof stick to a rigid bell curve for AA/AB or is there cutoff leniency if you show improvement in the final project?', 0, 0, '[]', 19, 0, 15, 2, '2026-10-03 17:34:00.013342') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_posts_v2" ("id", "slug", "category_id", "is_anonymous", "account_id", "student_id", "kind", "title", "body", "is_official", "is_flagged", "images", "upvotes", "downvotes", "metoo", "reply_count", "created_at") VALUES (3, '3f4087ee3c5e', 8, 0, NULL, 1, 'conversation', '✓ Welcome to ATLAS Anonymous Portal — Privacy & Community Guidelines', 'ATLAS Anonymous Portal is designed for the IIT Bombay community to raise grievances, ask vulnerable questions, and share experiences without fear of tracking.

- **Zero-knowledge Privacy:** Your anonymous posts are cryptographically decoupled from your roll number.
- **Support is Always Near:** Emergency campus contacts (Hospital, SWC, QRT, Angel) are available on every page.
- **Dual-Mode Choice:** You can choose to post anonymously or as your verified student profile when answering peers.

Please be respectful, protect fellow students'' privacy, and report any abusive content.', 1, 0, '[]', 65, 0, 0, 0, '2026-10-03 07:34:00.014904') ON CONFLICT DO NOTHING;

-- Data for burnout_scores (2 rows)
INSERT INTO "burnout_scores" ("id", "student_id", "score", "study_hours", "workload_factor", "stress_level", "consistency_factor", "risk_level", "cgpa", "daily_sleep_hours", "daily_study_hours", "physical_activity_hours", "social_support_score", "ml_screen_time_hours", "weekly_working_hours", "deadline_pressure", "sleep_deficit_hours", "task_backlog_score", "telemetry_score", "ml_score", "created_at") VALUES (1, 1, 46.56, NULL, NULL, NULL, NULL, 'Medium', 8.5, 7.0, 5.0, 1.0, 4.0, 5.0, 35.0, 0.168, 49.0, 0.0, 47.31, 60.0, '2026-08-18 10:14:43.595370') ON CONFLICT DO NOTHING;
INSERT INTO "burnout_scores" ("id", "student_id", "score", "study_hours", "workload_factor", "stress_level", "consistency_factor", "risk_level", "cgpa", "daily_sleep_hours", "daily_study_hours", "physical_activity_hours", "social_support_score", "ml_screen_time_hours", "weekly_working_hours", "deadline_pressure", "sleep_deficit_hours", "task_backlog_score", "telemetry_score", "ml_score", "created_at") VALUES (2, 1, 28.35, NULL, NULL, NULL, NULL, 'Low', NULL, NULL, NULL, NULL, NULL, NULL, 20.02, 0.418, 49.0, 0.0, 45.28, 25.0, '2026-08-18 15:01:20.923921') ON CONFLICT DO NOTHING;

-- Data for events (3 rows)
INSERT INTO "events" ("id", "title", "description", "event_date", "location", "domain", "organizer", "slides_link", "recording_link", "is_archived", "created_at", "created_by_id") VALUES (1, 'CP Workshop: Advanced Algorithms', 'Hands-on workshop on advanced algorithms including segment trees, BIT, and divide and conquer optimization.', '2026-08-25 15:31:15.719269', 'LC 101, IIT Bombay', 'sde', 'Programming Club', NULL, NULL, 0, '2026-08-18 10:01:15.721110', NULL) ON CONFLICT DO NOTHING;
INSERT INTO "events" ("id", "title", "description", "event_date", "location", "domain", "organizer", "slides_link", "recording_link", "is_archived", "created_at", "created_by_id") VALUES (2, 'Research Talk: Path to PhD', 'Seniors share their journey to top PhD programs. Q&A session included.', '2026-09-01 15:31:15.719269', 'VM 204, IIT Bombay', 'research', 'Academic Council', NULL, NULL, 0, '2026-08-18 10:01:15.721110', NULL) ON CONFLICT DO NOTHING;
INSERT INTO "events" ("id", "title", "description", "event_date", "location", "domain", "organizer", "slides_link", "recording_link", "is_archived", "created_at", "created_by_id") VALUES (3, 'ML Bootcamp: Deep Learning', '4-hour intensive bootcamp on PyTorch and deep learning fundamentals. Limited seats.', '2026-08-21 15:31:15.719269', 'CSE Lab 2', 'ai_ml', 'AI/ML Club', NULL, NULL, 0, '2026-08-18 10:01:15.721110', NULL) ON CONFLICT DO NOTHING;

-- Data for google_accounts (1 rows)
INSERT INTO "google_accounts" ("id", "student_id", "email", "name", "picture", "encrypted_access_token", "encrypted_refresh_token", "token_expiry", "scopes", "drive_root_folder_id", "calendar_id", "is_active", "created_at", "updated_at") VALUES (1, 1, 'sunshinehappy772@gmail.com', 'Sunshine Happy', 'https://lh3.googleusercontent.com/a/ACg8ocJNSphJyIEw07wMqp-99BebDegnbler-5YrVgN5QdDTqic3Xw=s96-c', 'gAAAAABqnEqfJcAMtJcHc89WL3eJMU40ZuEzqdP1XxMKR4dh4BgIZrBk_h5z-6tTaaVb9Z-A6rqnQ3b-7GsKu35bEoRto1f-CKt1MbvbBDjiWxnfLXlKiNz8odr2wmPZtJ1XmO_7_n9TfFa9QCSA0jhB_8YpnG3dHCpw_lMCWSvQXrXi-7x09ge9fN0249f3drK17a53cyQWtr-iHHrIsH4cIiPmDKv7ZkmJLCUB7SBDJE51ehOWCtEAyLrEOZXcBWSfb3m-CU7V7hpwQ2w2tnVVCSCOXHocF3lN8cZ69V5ffoi9skGirFFzLTgN6Mlq2b-2mzrjoG-HqvEV0n7y5hd7zgq029thHWlbM_96arrol2E-MZu7UF7DjEmv3TagdQJ-Qav4R9-amHqI_-1uk2o83AUxkmjXYQ==', 'gAAAAABqmcbBUz4bkosdM6rAlLQxRlgKFIVZI9QHciw1L7E3EecycaQqRFmHNcUAU2h6mGevzdUDghasaOrjEiI5BqT20vnwDieTxpvUrUdeHHuqwgi8vRODQFWVWo_4kjGw7Kw1lrcQnvdbN6s3LIEuY2LrapBgXeQjEYPZyf6MnOD-m2zuoDfiDlmE4k6Ma3tmvOCTh6TWyydb8INMRRi_HZ-SCYDOyg==', '2026-09-05 18:00:14.506007', 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly openid', NULL, NULL, 1, '2026-09-03 19:13:05.616732', '2026-09-05 17:00:15.506007') ON CONFLICT DO NOTHING;

-- Data for planner_events (20 rows)
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (1, 1, 'CS301 Assignment 2', '2026-08-21 15:31:15.719269', '10:00', '12:00', 'Database implementation and query optimization lab assignment', NULL, 'CRITICAL', 'EXAM', 0, NULL, 0, NULL, 0, NULL, NULL, NULL, '2026-08-21 15:31:15.719269', 'Assignment 2', '2026-08-18 10:01:15.722124', '2026-08-18 13:17:17.238227') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (2, 1, 'EE201 Lab Project', '2026-08-24 15:31:15.719269', '14:00', '17:00', 'Signal processing design project submission', NULL, 'IMPORTANT', 'CLASS', 0, NULL, 0, NULL, 0, NULL, NULL, NULL, '2026-08-24 15:31:15.719269', 'Lab Report', '2026-08-18 10:01:15.722124', '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (3, 1, 'PH227 | 3A', NULL, '11:30', '12:30', 'Imported timetable class for PH227 | 3A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 1, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (4, 1, 'HS108 | 12A', NULL, '17:00', '18:00', 'Imported timetable class for HS108 | 12A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 1, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (5, 1, 'EE325 | 4A', NULL, '08:00', '09:30', 'Imported timetable class for EE325 | 4A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 2, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (6, 1, 'PH227 | 3B', NULL, '11:30', '12:30', 'Imported timetable class for PH227 | 3B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 2, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (7, 1, 'EE103 | 11A', NULL, '15:30', '17:00', 'Imported timetable class for EE103 | 11A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 2, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (8, 1, 'HS108 | 12B', NULL, '17:00', '18:00', 'Imported timetable class for HS108 | 12B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 2, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (9, 1, 'HS109 | 5A', NULL, '08:00', '09:30', 'Imported timetable class for HS109 | 5A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 3, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (10, 1, 'TD626 | 6A', NULL, '09:30', '11:00', 'Imported timetable class for TD626 | 6A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 3, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (11, 1, 'ENT620 | 7A', NULL, '11:00', '12:30', 'Imported timetable class for ENT620 | 7A', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 3, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (12, 1, 'EE325 | 4B', NULL, '08:00', '09:30', 'Imported timetable class for EE325 | 4B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 4, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (13, 1, 'PH227 | 3C', NULL, '11:30', '12:30', 'Imported timetable class for PH227 | 3C', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 4, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (14, 1, 'HS109 | 5B', NULL, '08:00', '09:30', 'Imported timetable class for HS109 | 5B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 5, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (15, 1, 'TD626 | 6B', NULL, '09:30', '11:00', 'Imported timetable class for TD626 | 6B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 5, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (16, 1, 'ENT620 | 7B', NULL, '11:00', '12:30', 'Imported timetable class for ENT620 | 7B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 5, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (17, 1, 'EE103 | 11B', NULL, '15:30', '17:00', 'Imported timetable class for EE103 | 11B', NULL, 'IMPORTANT', 'CLASS', 1, NULL, 1, 5, 0, NULL, NULL, NULL, NULL, NULL, '2026-08-18 12:11:09.986129', '2026-08-18 12:11:09.986129') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (18, 1, 'Inaugural Macro-Finance Forum', '2026-08-21 00:00:00.000000', '09:30', '10:30', 'From email: [Student-notices] Final Reminder – Inaugural Macro-Finance Forum', 'F.C. Kohli Auditorium, Ground floor, Kanwal Rekhi Building (KReSIT), IIT Bombay', 'IMPORTANT', 'OTHER', 1, NULL, 0, NULL, 0, '', NULL, NULL, NULL, NULL, '2026-08-18 13:16:12.149160', '2026-08-18 13:16:12.149160') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (19, 1, 'MA105 ExCeL Session (Telugu)', '2026-08-18 00:00:00.000000', '21:00', '21:01', 'From email: [S.Events] MA105 ExCeL Session in Telugu | Revised Timing | 18th Aug | 9PM |
 SSS | UGAC', 'LC 001', 'CRITICAL', 'CLASS', 1, NULL, 0, NULL, 0, '', NULL, NULL, '2026-08-18 00:00:00.000000', 'MA105 ExCeL Session (Telugu)', '2026-08-18 13:20:03.379923', '2026-08-18 15:53:11.435427') ON CONFLICT DO NOTHING;
INSERT INTO "planner_events" ("id", "userId", "title", "date", "startTime", "endTime", "description", "location", "tag", "category", "isWorkingHour", "link", "isRecurring", "recurrenceDay", "isCompleted", "userComment", "deletedAt", "exdates", "deadline_date", "deadline_label", "created_at", "updated_at") VALUES (20, 1, 'VLSI & Physical Design Session', '2026-08-24 00:00:00.000000', '18:00', '19:00', 'From email: [EEstudents] Discover the World of VLSI & Physical Design with Prof. Venkatesh
 Patil', 'GG301', 'IMPORTANT', 'OTHER', 1, NULL, 0, NULL, 0, '', NULL, NULL, NULL, NULL, '2026-08-18 15:51:59.348402', '2026-08-18 15:51:59.348402') ON CONFLICT DO NOTHING;

-- Data for resources (18 rows)
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (1, 'Striver''s A2Z DSA Course', 'Complete DSA preparation course from basics to advanced. Covers arrays, strings, trees, graphs, DP and more.', 'https://takeuforward.org/', NULL, 'sde', 'CS 101', 'course', 157, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (2, 'System Design Primer', 'Deep dive into system design concepts: scalability, load balancing, caching, sharding.', 'https://github.com/donnemartin/system-design-primer', NULL, 'sde', 'CS 301', 'article', 98, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (3, 'NeetCode 150 - LeetCode Roadmap', 'Curated list of 150 LeetCode problems organized by topic. Best for systematic interview prep.', 'https://neetcode.io/', NULL, 'sde', NULL, 'tool', 142, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (4, 'Stanford CS229 Machine Learning', 'Comprehensive ML course by Andrew Ng. Covers regression, classification, neural networks, SVMs.', 'https://cs229.stanford.edu/', NULL, 'ai_ml', 'AI 601', 'course', 134, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (5, 'Fast.ai Practical Deep Learning', 'Free course making deep learning accessible. Great for hands-on projects with PyTorch.', 'https://fast.ai/', NULL, 'ai_ml', NULL, 'course', 87, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (6, '3Blue1Brown Neural Networks', 'Beautiful visual explanations of neural networks, backpropagation, and gradient descent fundamentals.', 'https://www.3blue1brown.com/topics/neural-networks', NULL, 'ai_ml', NULL, 'video', 112, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (7, 'Zerodha Varsity', 'Complete guide to Indian stock markets. Covers fundamentals, technical analysis, options, and derivatives.', 'https://zerodha.com/varsity/', NULL, 'finance', NULL, 'course', 89, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (8, 'MIT OCW Finance Theory', 'MIT''s introductory finance course covering valuation, risk, portfolio theory, and CAPM.', 'https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/', NULL, 'finance', 'FN 201', 'course', 56, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (9, 'QuantLib Python Tutorials', 'Hands-on tutorials for quantitative finance using Python. Pricing models, risk analysis, Monte Carlo.', 'https://www.quantlib.org/', NULL, 'finance', NULL, 'tool', 34, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (10, 'Core Engineering Handbook', 'Essential concepts for core engineering: thermodynamics, fluid mechanics, strength of materials.', NULL, NULL, 'core', 'ME 101', 'book', 45, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (11, 'NPTEL Core Engineering Courses', 'IIT professors'' video lectures on mechanical, civil, electrical core subjects. Free certification available.', 'https://nptel.ac.in/', NULL, 'core', NULL, 'course', 72, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (12, 'Engineering Fundamentals - Signals & Systems', 'Comprehensive notes on signals, systems, Fourier transforms, and Laplace transforms for EE students.', NULL, NULL, 'core', 'EE 201', 'notes', 38, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (13, 'Research Paper Writing Guide', 'How to write a good research paper: structure, citations, figures, revision tips.', 'https://www.cs.columbia.edu/~hgs/etc/writing.html', NULL, 'research', NULL, 'article', 67, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (14, 'How to Read a Paper - S. Keshav', 'The classic 3-pass method for reading research papers efficiently. Essential for any researcher.', 'https://web.stanford.edu/class/ee384m/Handouts/HowtoReadPaper.pdf', NULL, 'research', NULL, 'article', 91, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (15, 'Connected Papers', 'Visual tool to explore academic papers and find related work. Great for literature surveys.', 'https://www.connectedpapers.com/', NULL, 'research', NULL, 'tool', 78, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (16, 'Case Interview Prep - Victor Cheng', 'Gold standard for consulting case interview preparation. Frameworks, practice cases, and tips.', 'https://www.caseinterview.com/', NULL, 'consulting', NULL, 'course', 65, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (17, 'McKinsey Problem Solving Game Guide', 'Strategies and practice for the McKinsey Imbellus digital assessment used in consulting recruitment.', NULL, NULL, 'consulting', NULL, 'article', 48, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;
INSERT INTO "resources" ("id", "title", "description", "url", "content", "domain", "course", "resource_type", "upvotes", "uploader_id", "is_private", "is_curated", "created_at") VALUES (18, 'Crafting Cases - Free Frameworks', 'Free consulting frameworks and case walkthroughs. Market sizing, profitability, and M&A cases.', 'https://craftingcases.com/', NULL, 'consulting', NULL, 'course', 52, NULL, 0, 1, '2026-08-18 10:01:15.722124') ON CONFLICT DO NOTHING;

-- Data for senior_journeys (6 rows)
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (1, 1, 'My Google Interview Journey', 'sde', 'Started preparing 6 months before placements. Here''s my journey:

Month 1-2: Focused on fundamentals - arrays, strings, sorting, searching. Solved 100 easy LeetCode problems.

Month 3-4: Moved to medium problems. Topics covered: linked lists, trees, graphs, dynamic programming. Solved 80 medium problems.

Month 5: System design prep. Read Grokking System Design. Did mock interviews on Pramp.

Month 6: Applied aggressively. Got interview calls from Google, Amazon, Microsoft. Google interview was 4 rounds.

Key tips:
1. Consistency matters more than quantity
2. Always explain your approach before coding
3. Don''t panic when stuck - communicate with interviewer
4. Review each failed problem thoroughly

Result: Selected at Google, Bangalore.', 2025, 'placements,google,sde,interview-prep', 234, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (2, 2, 'From On-Campus Setbacks to Product Strategy at Revolut (London) & PPO', 'finance', 'We begin this series with Jubin Singh, a 4th-year student from the Department of Chemical Engineering at IIT Bombay, whose career path did not unfold as expected initially, but eventually became a story of growth, clarity, and resilience.

📌 Brief Overview & Career Trajectory
• On-Campus Season: Secured shortlists for 6 to 7 top-tier Week 1 companies, but got rejected in final rounds. Initially accepted an internship at BatterySmart.
• In-Sem Role at Groww: Dissatisfied and seeking more exposure, he landed an in-semester role at Groww (broker/investor platform) via external apping, working from March through July while managing full-time academics.
• Off-Cycle Breakthrough: Apped externally again in February and secured a Product Strategy Internship at Revolut (FinTech, London) — comparing its caliber to a Day 1/2 company — and later converted it into a Pre-Placement Offer (PPO)!

💔 What Did the Season Feel Like at the Start?
"Getting shortlisted for 6-7 top companies but getting rejected in the second-to-last or final round by the end of September was worse than not getting shortlisted at all. Initially, I couldn''t figure out what was going wrong."

🔥 What Kept You Going & Tough Times?
"The toughest part was reaching the final stage every single time and not converting, which made me question my approach. But I had an inner motivation to ''always push for more'' and get better exposure. I knew I only needed that one ''YES'' despite an infinite number of rejections."

🧠 Academics & Credit Management
"Knowing Chemical Engineering in 4th/5th semester can be hectic, I specifically kept my 5th semester lighter on academic workload — taking only core credits and avoiding electives. My strategy for core subjects was to skim content regularly and do focused revision a day or two before exams."

💡 Mental Health & Peer Comparison
"While it was initially disappointing to see friends getting interned before me, I was genuinely happy for them. Ultimately, I realized I should compete only with myself and focus on my own journey."

🚀 External Apping Strategies & Learnings
1. Direct Outreach: Reached out directly to senior management for corporate roles and professors for research/B-school projects.
2. Off-Cycle Programs: Applied early to structured off-cycle programs (Groww, Lenskart, Revolut) starting Feb/March.
3. Continuous Case Prep: Never stopped doing case studies even after on-campus rejections. The continuous practice gave a huge edge during Revolut''s case interview rounds.

👑 Seniors & Mentors Who Guided Him
A big shoutout to seniors Harshit Porwal (Civil Engineering) for keeping him motivated during his lowest phases and Dev Parekh (Chemical Engineering) for continuous guidance.

💬 Advice for Juniors
• "Learn from your mistakes. Repeating the same mistake is a fault on one''s own end."
• "Focus strictly on what you can control — preparation, case practice — and tune out negative talk or industry rumors."
• "Don''t rely solely on on-campus hiring. Look at In-Sem internships, B-school projects, or external apping. Go all in!" ', 2025, 'product-strategy,fintech,revolut,groww,in-sem,off-cycle,case-prep,ppo', 312, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (3, 2, 'From 0 to Research Internship at MIT', 'research', 'How I got a research internship at MIT in my 3rd year.

The journey started with cold emailing professors in my 2nd year. I sent about 30 emails, got 5 responses, 2 were positive.

What worked for me:
1. Built a strong foundation in my area (Computer Vision)
2. Did 2 projects with professors at IITB
3. Wrote a concise, specific email explaining why their research interested me
4. Had a personal website showcasing my work

Timeline:
- Jan: Started emailing professors
- Mar: First positive response from MIT professor
- Apr: Interview and acceptance
- May-Aug: Internship at MIT

Key advice: Start early, be genuine, and don''t be discouraged by rejections.', 2024, 'research,internship,mit,phd', 189, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (4, 1, 'Building a Path of Her Own: From Gradual Exploration to Investment Banking & Arcana', 'finance', 'In this edition, we feature Aarushi Agarwal, a fifth-year Dual Degree student from the Department of Electrical Engineering. Her journey, from an uncertain start to a Nomura investment banking internship and a final placement at Arcana, is a story of gradual self-discovery, quiet perseverance, and the courage to build a path entirely her own.

📌 Brief Overview & Trajectory
• Year 1 (Online): Arrived on campus in her second year without the usual early exposure or peer networks.
• Year 2: Explored various fields. Joined E-Cell, attended the P&G Spotlight program, and did a VC internship at Eagle Wings (which she extended to 6 months).
• Year 3: Interned at ClearTax in the Founder’s Office, gaining experience in business strategy and operations.
• Year 4: Focused on external/personal apping. Reached out to alumni and industry professionals, landing an Investment Banking internship at Nomura.
• Year 5 (Placements): Faced a challenging placement season with Day 1 shortlists that did not immediately convert. Stayed resilient and secured a placement at Arcana through PT Cell.

💔 What Did the Season Feel Like at the Start?
"I didn’t know what non-tech applications even looked like. I thought I’d figure it out, but the season moves fast, and I hadn’t really prepared for it."
Because her first year was online, Aarushi started her second year without the informal networks that help most students understand their options early. With most Electrical batchmates oriented toward tech, she had to navigate a difficult phase of self-reflection to figure out what she actually wanted.

🔥 Journey & Key Milestones
• Eagle Wings VC (Year 2 Summer): Started as operational work, but she extended it to six months, contributing to pitch decks and portfolio reviews. This clicked as her first proper look into finance and startups.
• P&G Spotlight Programme: Though she didn''t get through, the competitive selection process in Hyderabad clarified her interest in leadership, strategy, and roles engaging with people and ideas.
• E-Cell Involvement: Cultivated perspective on startup culture, building things, and career choices.
• ClearTax Founder''s Office (Year 3 Summer): Worked on business strategy and operations, building tangible skills and business insights.
• Nomura Investment Banking (Year 4): Secured an internship through disciplined external apping, consistently reaching out to alumni and professionals from August through November.

⚡ The Toughest Part
Without hesitation, she points to the final placement season. Arriving at Day 1 with multiple shortlists but not converting any of them initially was a heavy weight to carry while others were getting placed.
"You do everything right, and the results still don’t come immediately. That’s a hard thing to sit with."
However, she notes that the uncertainty of her earlier years was its own kind of difficult. By the final year, she at least had the self-knowledge and clarity of what she wanted.

💪 What Kept You Going?
• Peers & Friends: They were central throughout the process—checking in, keeping things light, and constantly reminding her that her time would come.
• Direct Senior Outreach: She reached out to senior alumni on LinkedIn and Instagram. One senior’s framing stayed with her: "If one road is closed, there is always another. You just have to prepare for the next one."
• DAMP Mentor: A B.Tech senior who provided steady guidance from the 3rd through the 4th year.
• Father''s Advice: "He told me it might feel like every road is blocked, but you can work on yourself, focus on one thing, and make your own way. You don’t have to follow anyone else’s route."

💡 External Apping Strategies & Learnings
1. Target Experienced Alumni: Reached out to seniors who were 3-6 years ahead rather than just 1 year ahead, as they have a more mature perspective on their fields.
2. Ask Deeper Questions: Instead of asking "how do I get this role", she asked "why did you choose this field, and how does it feel now?"
3. Value-First Outreach: Shifted from emails asking for help/referrals to emails highlighting what she could offer.

💬 Advice to Juniors
• "Second year is the best time to genuinely explore, not just apply to things because everyone else is. Find out where your interest actually lies, and then go deep on that."
• "On-campus recruitment is only one part of the picture. There are far more opportunities outside: external apping, university internships, professor projects. These are real paths, not fallbacks."
• "Close the blog after you’ve checked your roll number. Focus entirely on yourself. Other people’s timelines say nothing about yours."
• "There will be moments where it feels like every road is closed, but you can always make your own way. You don’t need to follow anyone else’s route to get somewhere worth going." ', 2025, 'finance,investment-banking,nomura,arcana,external-apping,placements', 245, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (5, 2, 'Navigating the Waiting Phase: Resilience and a Preparedness-First Mindset in Civil Engineering', 'core', 'In this edition, we feature Tanishka Yadav, a fourth-year B.Tech student from the Department of Civil Engineering, whose internship journey was shaped by patience, resilience, and a strong sense of perspective.

📌 Brief Overview & Mindset
Like many students navigating the internship season, Tanishka knew that the process would come with its own uncertainties. While others around her began securing shortlists and offers, she found herself navigating a phase that required patience and persistence. Instead of letting the uncertainty overwhelm her, she focused on preparation and maintaining a steady mindset throughout the season.
Going into the internship season, Tanishka adopted what she calls a “preparedness-first” mindset. She understood that the timeline of opportunities can vary from person to person, and she made a conscious decision to stay patient, self-aware, and ready for whatever opportunity came her way. Rather than getting caught up in comparisons, she chose to channel her energy into preparation.

💔 Overcoming Rejection
Like many students, she had a “dream” company — one where she believed she would be a great fit. However, when the shortlist was released, her name wasn’t on it. That moment became an important reality check.
It made her realize the danger of romanticizing roles or assuming that a particular opportunity is guaranteed. Instead of dwelling on the disappointment, she shifted her mindset from asking “Why not me?” to focusing on “What’s next?” Accepting rejection quickly, she found, helped her move forward with clarity and focus. Over time, she realized that maintaining a positive temperament isn’t just helpful during the season — it is one of the most important tools for navigating its pressures.

⚡ The Toughest Part
For Tanishka, the hardest part wasn’t preparation — it was the waiting. Watching peers receive shortlists and selections while her own journey was still unfolding tested her patience. Learning to handle that uncertainty without letting it affect her confidence became one of the biggest challenges she faced.

🔥 The Turning Point
The turning point came when she consciously shifted her mindset from anxiety about results to focusing entirely on preparation. By committing to a preparedness-first approach, she was able to stay grounded and maintain control over the aspects of the process that were within her reach.

💪 What Kept You Going?
• Parents: A quick daily call to her parents became her reset button. They constantly reminded her that stress solves nothing and that things often unfold at the right time.
• Friends & Wingmates: They didn’t just offer encouragement — they showed up for her consistently. Before interviews, they would look her in the eye and say, “It’s going to be LEGENDARY.” After interviews, regardless of the outcome, she would return to find them waiting — with snacks, conversations, and the space to process the day. Whether it was a moment of celebration or disappointment, their presence ensured she never felt alone.
• Seniors: Her seniors at E-Cell also played a key role in helping her stay confident and focused throughout the season.

💬 Advice to Juniors
• "If I could tell a junior one thing, it would be this — don’t let the worry of the result ruin the interview."
• Many capable students underperform not because they lack preparation, but because anxiety about the outcome takes over in the moment.
• "When you sit across from an interviewer, remember that they are often there to help you. Stay calm, stay present, and make the most of that window."
• Emphasize the importance of accepting rejections quickly and moving forward, rather than dwelling on missed opportunities.

🧠 Key Learnings
• Celebrating small wins.
• Staying productively engaged instead of overthinking.
• Maintaining confidence even when results were uncertain.
• Channeling anxiety into preparation rather than panic.

✨ Final Remarks
In the end, the internship did come. But for Tanishka, the most meaningful takeaway wasn’t just the offer — it was the resilience she built along the way. The waiting, the uncertainty, and the setbacks shaped her mindset in ways that immediate success never could have. More importantly, the friendships and support system that stood by her became one of the most valuable parts of the journey. Because sometimes, what we gain from the process matters far more than the outcome itself. ', 2025, 'internship,resilience,civil-engineering,mindset,patience', 180, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;
INSERT INTO "senior_journeys" ("id", "author_id", "title", "domain", "content", "year_completed", "tags", "upvotes", "is_verified", "created_at") VALUES (6, 2, 'Overcoming CPI Hurdles: Navigating ML Research & Securing Qure.ai Externally', 'ai_ml', 'In this second edition, we feature Shahu Patil, a fourth-year student from the Department of Mechanical Engineering, whose path through internships and placements was far from straightforward. What began with uncertainty and unmet expectations gradually evolved into a journey of self-discovery, resilience, and renewed direction.

📌 Brief Overview & Trajectory
By his fifth semester, Shahu decided to pursue one of two goals: securing an ML Research/Data Science role or having a Software Developer role as a backup. Despite intense DSA preparation (solving 350–400 questions) and strong technical skills, a low CPI was a major block. This resulted in rejections from SDE roles during tests even when his test scores were very good.
He focused on external apping to his ideal company, Qure.ai. By taking follow-ups and ultimately acing a rigorous selection process, which included a challenging research paper round, he secured the internship in late December and eventually received a Pre-Placement Offer (PPO).

💔 What Did the Season Feel Like at the Start?
The start of the season, particularly around September, was disappointing. Despite being well-prepared on the SDE side, he was not shortlisted for interviews at top companies, even though he excelled in the tests.
He felt the process was "a little unfair" because his strong test performance wasn’t enough to overcome his lower CPI. In this period, he realized that companies were favoring CPI over test scores for SDE roles, which he found to be a major flaw in the process, especially for non-core roles.

🔥 The Turning Point
The turning point was when he received a reply from Qure.ai in November. This was the first breakthrough after consistent follow-ups. Seniors recommended him as a perfect fit for the company since his interests aligned closely with Qure.ai''s medical imaging work.

💪 Overcoming Comparisons & Setbacks
He maintained patience. He says, “Time was never an issue for me. I knew that this does not make any sense. An early intern is not necessarily a good intern, for sure.” He was confident in his abilities and understood that the system is not perfect, so he avoided self-doubt and comparison.
He had a deep confidence and passion for ML Research. His motivation for working at Qure.ai was not primarily about money, but about the personal motivation of building a product for early lung cancer detection and making healthcare accessible in rural areas.

👥 Support & Commitments
• Family & Friends: His mother was concerned seeing him struggle for the first time, but he reassured her. His friends were extremely supportive throughout.
• Seniors & Mentors: He actively took advice from seniors for company-specific information.
• Managing Commitments: Leading WNCC as a Manager enhanced his profile and public speaking skills. He applied for the GSTA position after securing the Qure.ai internship in late December, confident in his ability to get a PPO because the work aligned perfectly with his passion.
• Backup Plan: If Qure.ai hadn''t worked out, he had a backup plan of doing an In-Sem internship with a professor working on ML in healthcare problems.

💬 Advice to Juniors
• "Reconsider yourself if you are consistently not able to perform well in tests. One must consider asking oneself if they are truly skilled or if they are just following the market."
• "Have Patience and Focus if you are sure of your interest and skills. Patience is the key."
• "On the intern blog, simply CTRL-F and find your roll number, and if it’s not there, close the blog and don’t look at others. Focus entirely on your own journey, because there’s a lot to come."
• "Do not fake anything in your resume. Being able to explain everything you’ve written with confidence is key. For technical profiles, interviews primarily focus on the work you have done and its relevance to the company."

💡 External Apping Strategy
His strategy was highly targeted. Instead of mass-emailing, he applied to only one company, Qure.ai, as it was the most ideal fit for his profile, and followed up consistently to ensure his resume was reviewed.

✨ Final Remarks
"The intern seasons are kind of overhyped. A lot of times because of this, we forget that we are in IITB. We come so far in this race that we forget that we have achieved a lot of our childhood goals; be grateful for all that. Stay consistent. Patience is the most important thing you’ll ever require in the intern season or even in placements. You should not panic. There should be a little acceptance sometimes; don’t blame others." ', 2025, 'ml-research,qure-ai,external-apping,low-cpi,resilience,mechanical-engineering', 210, 1, '2026-08-18 10:01:15.723703') ON CONFLICT DO NOTHING;

-- Data for task_logs (4 rows)
INSERT INTO "task_logs" ("id", "student_id", "title", "description", "domain", "priority", "estimated_hours", "actual_hours", "completed", "due_date", "created_at") VALUES (1, 1, 'Complete Graph Algorithms chapter', 'Study dijkstra, bellman-ford, floyd-warshall', 'sde', 1, 4.0, 4.5, 1, NULL, '2026-08-18 10:01:15.724711') ON CONFLICT DO NOTHING;
INSERT INTO "task_logs" ("id", "student_id", "title", "description", "domain", "priority", "estimated_hours", "actual_hours", "completed", "due_date", "created_at") VALUES (2, 1, 'CS224n Assignment 3', 'Word vectors and neural networks', 'ai_ml', 2, 3.0, 3.5, 1, NULL, '2026-08-18 10:01:15.724711') ON CONFLICT DO NOTHING;
INSERT INTO "task_logs" ("id", "student_id", "title", "description", "domain", "priority", "estimated_hours", "actual_hours", "completed", "due_date", "created_at") VALUES (3, 1, 'System Design reading', 'Read chapter 5 on Caching', 'sde', 3, 2.0, 0.0, 0, '2026-08-20 15:31:15.719269', '2026-08-18 10:01:15.725217') ON CONFLICT DO NOTHING;
INSERT INTO "task_logs" ("id", "student_id", "title", "description", "domain", "priority", "estimated_hours", "actual_hours", "completed", "due_date", "created_at") VALUES (4, 1, 'Practice mock interview', 'Pramp session scheduled', 'sde', 1, 1.5, 0.0, 0, '2026-08-19 15:31:15.719269', '2026-08-18 10:01:15.725217') ON CONFLICT DO NOTHING;

-- Data for user_api_keys (1 rows)
INSERT INTO "user_api_keys" ("id", "student_id", "provider", "encrypted_key", "model_name", "is_active", "last_validated_at", "created_at", "updated_at", "base_url") VALUES (1, 1, 'gemini', 'gAAAAABqhx6ZFqIo6y-Z55DfvkfVdcy9CS7iFeBp6T3llr1nZdSMKdG6DHq63-_1PndWEysYKTUVMDXbNFElaRUpUYVivMpe3np58tTjaAHw7hLDeCcMDe0qY4qrnFEyv5C5n6E9ahLc', 'gemini-3.6-flash', 1, '2026-08-20 15:34:49.538101', '2026-08-20 15:34:49.540113', '2026-08-20 15:34:49.540113', NULL) ON CONFLICT DO NOTHING;

-- Data for ai_messages (10 rows)
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (1, 1, 'user', 'What is the best way to study data structures for IIT placements?', '2026-08-18 10:13:52.640305') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (2, 1, 'assistant', 'Hello Amit Patel, it is great to see you focusing on your placement preparation as a final-year student. Given your goal of securing a strong SDE role while maintaining your solid 8.5 CPI, we need to balance your deep-dive research interests with high-efficiency interview prep.

Since you mentioned that **DBMS** and **CN** are your weaker subjects, I recommend a structured approach that prioritizes high-yield DSA practice while systematically addressing your core subject gaps.

Here is how I suggest you approach this:

1.  **Prioritize Systematic Practice:** Instead of jumping between random problems, use **Striver''s A2Z DSA Course** (https://takeuforward.org/). As a 4th-year student, you don''t have time for aimless grinding; this course follows a logical progression that will help you solidify your foundation.
2.  **Strategic Problem Solving:** Once you have a handle on a topic, use the **NeetCode 150 - LeetCode Roadmap** (https://neetcode.io/). It is excellent for tracking your progress and ensuring you are covering the specific patterns most frequently asked in interviews.
3.  **Integrating Weak Subjects:** Since you are spending 6 hours of screen time daily, dedicate 1.5 hours of that specifically to your weak subjects (DBMS/CN). I suggest treating these as "must-knows" for interviews rather than purely academic requirements. Use standard interview prep resources to understand the core concepts (like normalization, indexing, or TCP/IP handshakes) that companies frequently grill candidates on.
4.  **Balance & Research:** Given your goal of research, keep your **Fast.ai Practical Deep Learning** (https://fast.ai/) work to the weekends or your less "high-energy" evening hours. Don''t let your research projects bleed into your placement prep time; compartmentalizing will help you maintain your 7 hours of sleep, which is vital for your cognitive performance during assessments.

How are you currently balancing your interview prep with your final-year project work? If we know your current daily study schedule, I can help you carve out a more rigid time-block plan.', '2026-08-18 10:14:00.488771') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (3, 1, 'user', 'hi', '2026-08-18 11:38:22.691446') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (4, 1, 'assistant', 'Hi Amit Patel, how have things been since we last spoke? Have you had a chance to look into the resources for your DBMS and CN revision, or has your final-year project been taking up most of your bandwidth lately?

As a 4th-year student, this is a critical window for you. If you’re feeling overwhelmed by the final-year project alongside placement prep, we should look at how to optimize your daily screen time. Since you''re already at 6 hours, we want to make sure every minute counts so you aren''t sacrificing your sleep or your research goals. 

How are you feeling about your progress? Are there any specific topics in DBMS or CN that you feel are blocking your momentum?', '2026-08-18 11:38:25.437731') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (5, 1, 'user', 'so which model are you', '2026-08-20 15:35:14.292065') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (6, 1, 'assistant', 'I am the ITSP AI Academic Mentor, specifically configured to guide you through your final year in Computer Science at IIT Bombay. My role is to give you actionable, data-driven advice to help you maintain your 8.5 CPI, patch critical subject gaps, and balance placement preparation with your research goals.

Since you have dedicated **35 hours per week** for self-study, here is how we can structure that bandwidth to maximize your yield across placements and research:

### Recommended Weekly 35-Hour Time Allocation

1. **SDE & System Design Prep (14 Hours/Week)**
   * **Problem Solving (10 hrs):** Focus on problem-solving patterns using the **NeetCode 150 - LeetCode Roadmap** (https://neetcode.io/). If you run into weak areas in algorithms, revisit foundational modules via **Striver''s A2Z DSA Course** (https://takeuforward.org/).
   * **System Design (4 hrs):** Read through core scalability patterns, load balancing, and database sharding on the **System Design Primer** (https://github.com/donnemartin/system-design-primer).

2. **Targeted Revision: DBMS & CN (10 Hours/Week)**
   * Spend 5 hours/week per subject targeting high-frequency interview topics:
     * **DBMS:** Indexing (B/B+ Trees), Transactions & ACID properties, Concurrency Control, and SQL query optimization.
     * **CN:** TCP/IP stack, TCP 3-way handshake, Flow/Congestion control, HTTP/HTTPS, and DNS resolution.

3. **Research & AI/ML Development (11 Hours/Week)**
   * Use this block for your B.Tech project/research work. 
   * If your research involves machine learning foundations, strengthen your theoretical baseline with **Stanford CS229 Machine Learning** (https://cs229.stanford.edu/) or execute practical models using **Fast.ai Practical Deep Learning** (https://fast.ai/).

---

### Next Step
To refine this further: **Which company profiles are you prioritizing first on your preference list for placement season—Core SDE, AI/ML Engineer, or Quantitative/Research roles?** Let me know so we can tweak your daily study blocks accordingly.', '2026-08-20 15:35:26.374091') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (7, 1, 'user', 'I am asking which LLM model are you?', '2026-08-20 15:35:51.512858') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (8, 1, 'assistant', 'I am an AI language model configured to act specifically as your ITSP Academic Mentor. 

As a 4th-year CS student at IIT Bombay with an interest in AI/ML research, it makes complete sense that you''re curious about the underlying system! While my underlying architecture is a transformer-based large language model, my focus here is customized to give you personalized academic and career guidance—helping you balance your 8.5 CPI, navigate placement prep, address DBMS/CN gaps, and meet your research goals.

If your research or target job roles involve deep learning or natural language processing, we can certainly incorporate those topics into your weekly study plan. For deep dives into neural network fundamentals and practical implementations, you can draw from **3Blue1Brown Neural Networks** (https://www.3blue1brown.com/topics/neural-networks) for intuitive visualization or **Fast.ai Practical Deep Learning** (https://fast.ai/) for hands-on PyTorch work.

Now, bringing it back to your current placement setup: are you planning to focus primarily on Core SDE profiles, or are you targeting AI/ML & Research Engineer positions during the campus drives? Knowing this will help us fine-tune how much time you allocate to System Design vs. ML theory.', '2026-08-20 15:36:01.919140') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (9, 1, 'user', 'how can I improve my prodcutivity', '2026-08-20 15:36:32.338779') ON CONFLICT DO NOTHING;
INSERT INTO "ai_messages" ("id", "chat_id", "role", "content", "created_at") VALUES (10, 1, 'assistant', 'Improving productivity in your final year at IIT Bombay isn''t about working more hours—35 hours per week of dedicated self-study is already a solid budget. It’s about **reducing context-switching cost** and **eliminating decision fatigue** while juggling SDE prep, weak subjects (DBMS/CN), and research.

Here is an actionable, high-yield productivity framework tailored specifically to your situation:

---

### 1. Eliminate Decision Fatigue with Fixed Daily Windows
Context-switching between DSA, DBMS theory, and ML research rapidly drains cognitive energy. Divide your 35 hours into fixed, single-task blocks across the week:

* **High-Energy Blocks (Mornings / First Study Session): Placement DSA**
  * Use your highest mental energy for problem-solving. 
  * Stick strictly to structured paths like the **NeetCode 150 - LeetCode Roadmap** (https://neetcode.io/). Do not spend 20 minutes deciding *what* to solve next.

* **Mid-Energy Blocks (Afternoons / Early Evening): Core CS (DBMS & CN)**
  * Treat this like a 1-hour daily habit (5–6 hours/week). 
  * Avoid passive reading. Use **Active Recall**: write out the TCP 3-way handshake from memory, optimize a SQL query on paper, or draw B+ Tree insertions without looking at notes.

* **Deep-Work Blocks (Weekends / 3-4 Hour Chunks): Research & AI Project**
  * Research requires uninterrupted flow. Block two 4-hour slots on weekends or non-class days specifically for your B.Tech project/ML experiments.
  * If you need quick visual clarity on complex concepts while building models, watch **3Blue1Brown Neural Networks** (https://www.3blue1brown.com/topics/neural-networks) before diving into coding with **Fast.ai Practical Deep Learning** (https://fast.ai/).

---

### 2. Set the "45-Minute Hard Stop" Rule for DSA
A major productivity sink for CS students is spending 2+ hours stuck on a single LeetCode hard problem.
* **0–25 mins:** Brainstorm logic, write pseudocode, and analyze time/space complexity.
* **25–45 mins:** Implement the code. 
* **If stuck after 45 mins:** Stop. Look at the optimal pattern/solution on **Striver''s A2Z DSA Course** (https://takeuforward.org/) or NeetCode. Internalize the trick, log the problem in a "Mistakes Notebook," and solve it again from scratch 3 days later.

---

### 3. Implement "High-Yield" Interview Prep for DBMS and CN
Since these are weaker areas, studying entire textbooks will feel inefficient and slow you down.
* Focus on the **top 20 standard interview concepts** for each subject (e.g., Indexing, ACID, Normalization, TCP vs. UDP, DNS, OSI Layers).
* Practice explaining concepts aloud in 2 minutes as if answering an interviewer. If you stumble, review that specific sub-topic immediately rather than re-reading whole chapters.

---

### 4. Optimize System Design Time
System design can feel overwhelming without structured bounds.
* Dedicate 3 to 4 hours per week purely to concept-based design patterns using the **System Design Primer** (https://github.com/donnemartin/system-design-primer).
* Focus on understanding *trade-offs* (e.g., Latency vs. Throughput, SQL vs. NoSQL, Consistency vs. Availability) rather than trying to memorize system diagrams.

---

### Next Actionable Step
To help you fine-tune this: **Where do you currently feel your biggest time-sink or loss of momentum happens during the day?** (e.g., getting stuck on tough problems, procrastination starting research tasks, or feeling fatigued during theoretical subjects?)', '2026-08-20 15:37:00.815490') ON CONFLICT DO NOTHING;

-- Data for anonymous_replies_v2 (4 rows)
INSERT INTO "anonymous_replies_v2" ("id", "post_id", "parent_id", "is_anonymous", "account_id", "student_id", "body", "is_official", "is_senior_verified", "upvotes", "downvotes", "created_at") VALUES (1, 1, NULL, 1, 'e489be0f-4d09-4af0-add6-2b4cd0360c04', NULL, 'Facing the exact same issue in C-wing 2nd floor as well. Spoke to the hostel caretaker yesterday, he said the filter cartridge order is pending approval.', 0, 0, 12, 0, '2026-10-04 01:34:00.012262') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_replies_v2" ("id", "post_id", "parent_id", "is_anonymous", "account_id", "student_id", "body", "is_official", "is_senior_verified", "upvotes", "downvotes", "created_at") VALUES (2, 1, 1, 1, 'e489be0f-4d09-4af0-add6-2b4cd0360c04', NULL, 'Can the Mess Sec escalate this to the Hall Management Committee? We shouldn''t have to walk down to Ground floor at 2 AM for drinking water.', 0, 0, 9, 0, '2026-10-04 03:34:00.013342') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_replies_v2" ("id", "post_id", "parent_id", "is_anonymous", "account_id", "student_id", "body", "is_official", "is_senior_verified", "upvotes", "downvotes", "created_at") VALUES (3, 1, NULL, 0, NULL, 1, 'I''ve forwarded this thread link directly to the General Secretary of Hostel Affairs (GSHA). If it isn''t resolved by tomorrow evening, please DM me or raise it in the open house on Friday.', 0, 1, 34, 0, '2026-10-04 05:34:00.013342') ON CONFLICT DO NOTHING;
INSERT INTO "anonymous_replies_v2" ("id", "post_id", "parent_id", "is_anonymous", "account_id", "student_id", "body", "is_official", "is_senior_verified", "upvotes", "downvotes", "created_at") VALUES (4, 2, NULL, 0, NULL, 1, 'Took this course last autumn. The professor is quite reasonable: if your final project implementation is solid and you score above $\mu + 1.2\sigma$ overall, you comfortably land an AB or AA. Do not skip tutorial problem sets; midsem problems were 70% direct variations.', 0, 1, 21, 0, '2026-10-03 21:34:00.014904') ON CONFLICT DO NOTHING;

-- Data for deadline_subtasks (5 rows)
INSERT INTO "deadline_subtasks" ("id", "deadline_id", "title", "is_completed", "order", "created_at") VALUES (1, 1, 'Implement B-Tree index structure', 0, 1, '2026-08-18 10:01:15.729691') ON CONFLICT DO NOTHING;
INSERT INTO "deadline_subtasks" ("id", "deadline_id", "title", "is_completed", "order", "created_at") VALUES (2, 1, 'Write SQL benchmark queries', 1, 2, '2026-08-18 10:01:15.729691') ON CONFLICT DO NOTHING;
INSERT INTO "deadline_subtasks" ("id", "deadline_id", "title", "is_completed", "order", "created_at") VALUES (3, 1, 'Format final report PDF', 1, 3, '2026-08-18 10:01:15.729691') ON CONFLICT DO NOTHING;
INSERT INTO "deadline_subtasks" ("id", "deadline_id", "title", "is_completed", "order", "created_at") VALUES (4, 2, 'Collect oscilloscope readings', 1, 1, '2026-08-18 10:01:15.729691') ON CONFLICT DO NOTHING;
INSERT INTO "deadline_subtasks" ("id", "deadline_id", "title", "is_completed", "order", "created_at") VALUES (5, 2, 'Plot frequency response graph', 0, 2, '2026-08-18 10:01:15.729691') ON CONFLICT DO NOTHING;

-- Data for resource_bookmarks (1 rows)
INSERT INTO "resource_bookmarks" ("id", "student_id", "resource_id", "created_at") VALUES (1, 1, 1, '2026-09-03 21:27:39.347595') ON CONFLICT DO NOTHING;

-- Data for resource_upvotes (1 rows)
INSERT INTO "resource_upvotes" ("id", "student_id", "resource_id", "created_at") VALUES (1, 1, 1, '2026-09-02 21:36:24.065956') ON CONFLICT DO NOTHING;

-- Data for smart_suggestions (3 rows)
INSERT INTO "smart_suggestions" ("id", "student_id", "title", "reason", "action_steps", "priority", "status", "is_pinned", "resource_id", "created_at", "updated_at") VALUES (1, 1, 'Systematic DSA Practice', 'Final year placement season requires high-frequency problem solving to secure SDE offers.', '["Select 3 problems from the NeetCode 150 list specifically for arrays and linked lists.", "Time-box your practice to 90 minutes per session to simulate interview constraints."]', 1, 'active', 0, 3, '2026-08-18 10:14:46.561435', '2026-08-18 10:14:46.561435') ON CONFLICT DO NOTHING;
INSERT INTO "smart_suggestions" ("id", "student_id", "title", "reason", "action_steps", "priority", "status", "is_pinned", "resource_id", "created_at", "updated_at") VALUES (2, 1, 'Bridge DBMS Knowledge Gaps', 'DBMS is a core interview subject; current weakness poses a risk to technical screenings.', '["Review the NPTEL lecture series modules on SQL transactions and indexing.", "Summarize normalization forms to prepare for theoretical interview questions."]', 2, 'active', 0, 11, '2026-08-18 10:14:46.561435', '2026-08-18 10:14:46.561435') ON CONFLICT DO NOTHING;
INSERT INTO "smart_suggestions" ("id", "student_id", "title", "reason", "action_steps", "priority", "status", "is_pinned", "resource_id", "created_at", "updated_at") VALUES (3, 1, 'Refine Research Paper Reading', 'Balancing SDE prep with research goals requires efficient processing of new papers.', '["Read the Keshav guide to optimize your paper analysis technique.", "Apply the 3-pass method to one research paper relevant to your AI/ML focus."]', 3, 'active', 0, 14, '2026-08-18 10:14:46.561435', '2026-08-18 10:14:46.561435') ON CONFLICT DO NOTHING;

-- =============================================================
-- 3. SEQUENCE SYNCHRONIZATION
-- =============================================================

SELECT setval(pg_get_serial_sequence('"anonymous_categories"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_categories"), 1), (SELECT COUNT(*) FROM "anonymous_categories") > 0);
SELECT setval(pg_get_serial_sequence('"anonymous_posts"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_posts"), 1), (SELECT COUNT(*) FROM "anonymous_posts") > 0);
SELECT setval(pg_get_serial_sequence('"anonymous_reports"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_reports"), 1), (SELECT COUNT(*) FROM "anonymous_reports") > 0);
SELECT setval(pg_get_serial_sequence('"revoked_tokens"', 'id'), COALESCE((SELECT MAX(id) FROM "revoked_tokens"), 1), (SELECT COUNT(*) FROM "revoked_tokens") > 0);
SELECT setval(pg_get_serial_sequence('"students"', 'id'), COALESCE((SELECT MAX(id) FROM "students"), 1), (SELECT COUNT(*) FROM "students") > 0);
SELECT setval(pg_get_serial_sequence('"ai_chats"', 'id'), COALESCE((SELECT MAX(id) FROM "ai_chats"), 1), (SELECT COUNT(*) FROM "ai_chats") > 0);
SELECT setval(pg_get_serial_sequence('"anonymous_post_reports"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_post_reports"), 1), (SELECT COUNT(*) FROM "anonymous_post_reports") > 0);
SELECT setval(pg_get_serial_sequence('"anonymous_posts_v2"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_posts_v2"), 1), (SELECT COUNT(*) FROM "anonymous_posts_v2") > 0);
SELECT setval(pg_get_serial_sequence('"burnout_scores"', 'id'), COALESCE((SELECT MAX(id) FROM "burnout_scores"), 1), (SELECT COUNT(*) FROM "burnout_scores") > 0);
SELECT setval(pg_get_serial_sequence('"events"', 'id'), COALESCE((SELECT MAX(id) FROM "events"), 1), (SELECT COUNT(*) FROM "events") > 0);
SELECT setval(pg_get_serial_sequence('"google_accounts"', 'id'), COALESCE((SELECT MAX(id) FROM "google_accounts"), 1), (SELECT COUNT(*) FROM "google_accounts") > 0);
SELECT setval(pg_get_serial_sequence('"planner_events"', 'id'), COALESCE((SELECT MAX(id) FROM "planner_events"), 1), (SELECT COUNT(*) FROM "planner_events") > 0);
SELECT setval(pg_get_serial_sequence('"post_replies"', 'id'), COALESCE((SELECT MAX(id) FROM "post_replies"), 1), (SELECT COUNT(*) FROM "post_replies") > 0);
SELECT setval(pg_get_serial_sequence('"resources"', 'id'), COALESCE((SELECT MAX(id) FROM "resources"), 1), (SELECT COUNT(*) FROM "resources") > 0);
SELECT setval(pg_get_serial_sequence('"senior_journeys"', 'id'), COALESCE((SELECT MAX(id) FROM "senior_journeys"), 1), (SELECT COUNT(*) FROM "senior_journeys") > 0);
SELECT setval(pg_get_serial_sequence('"task_logs"', 'id'), COALESCE((SELECT MAX(id) FROM "task_logs"), 1), (SELECT COUNT(*) FROM "task_logs") > 0);
SELECT setval(pg_get_serial_sequence('"user_api_keys"', 'id'), COALESCE((SELECT MAX(id) FROM "user_api_keys"), 1), (SELECT COUNT(*) FROM "user_api_keys") > 0);
SELECT setval(pg_get_serial_sequence('"ai_messages"', 'id'), COALESCE((SELECT MAX(id) FROM "ai_messages"), 1), (SELECT COUNT(*) FROM "ai_messages") > 0);
SELECT setval(pg_get_serial_sequence('"anonymous_replies_v2"', 'id'), COALESCE((SELECT MAX(id) FROM "anonymous_replies_v2"), 1), (SELECT COUNT(*) FROM "anonymous_replies_v2") > 0);
SELECT setval(pg_get_serial_sequence('"deadline_subtasks"', 'id'), COALESCE((SELECT MAX(id) FROM "deadline_subtasks"), 1), (SELECT COUNT(*) FROM "deadline_subtasks") > 0);
SELECT setval(pg_get_serial_sequence('"journey_upvotes"', 'id'), COALESCE((SELECT MAX(id) FROM "journey_upvotes"), 1), (SELECT COUNT(*) FROM "journey_upvotes") > 0);
SELECT setval(pg_get_serial_sequence('"resource_bookmarks"', 'id'), COALESCE((SELECT MAX(id) FROM "resource_bookmarks"), 1), (SELECT COUNT(*) FROM "resource_bookmarks") > 0);
SELECT setval(pg_get_serial_sequence('"resource_upvotes"', 'id'), COALESCE((SELECT MAX(id) FROM "resource_upvotes"), 1), (SELECT COUNT(*) FROM "resource_upvotes") > 0);
SELECT setval(pg_get_serial_sequence('"smart_suggestions"', 'id'), COALESCE((SELECT MAX(id) FROM "smart_suggestions"), 1), (SELECT COUNT(*) FROM "smart_suggestions") > 0);

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Migration completed successfully.