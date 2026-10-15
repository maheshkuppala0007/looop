-- ============================================================================
-- LOOOP Platform - Complete PostgreSQL Database Schema
-- Circular Economy & Community Goods Sharing Platform
-- ============================================================================

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  bio VARCHAR(500) DEFAULT '',
  city VARCHAR(100) DEFAULT '',
  locality VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  interests TEXT[] DEFAULT '{}',
  profile_visibility VARCHAR(20) DEFAULT 'public',
  account_status VARCHAR(20) DEFAULT 'active',
  trust_score INT DEFAULT 95,
  rating NUMERIC(3,2) DEFAULT 0.0,
  reviews_count INT DEFAULT 0,
  response_rate VARCHAR(50) DEFAULT 'Under 1 hour',
  verified BOOLEAN DEFAULT FALSE,
  phone VARCHAR(30) DEFAULT '',
  plain_password VARCHAR(255) DEFAULT '',
  reset_password_token VARCHAR(255),
  reset_password_expires TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, account_status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  slug VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(300) DEFAULT '',
  icon VARCHAR(60) DEFAULT 'FolderTree',
  subcategories TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);

-- ----------------------------------------------------------------------------
-- 3. ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  subcategory VARCHAR(60) DEFAULT 'General',
  brand VARCHAR(60) DEFAULT '',
  model VARCHAR(60) DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  sharing_type VARCHAR(20) NOT NULL DEFAULT 'give_away',
  condition VARCHAR(30) NOT NULL DEFAULT 'good',
  availability VARCHAR(30) DEFAULT 'Available',
  status VARCHAR(30) DEFAULT 'active',
  city VARCHAR(100) DEFAULT '',
  district VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  locality VARCHAR(100) DEFAULT '',
  approximate_address VARCHAR(255) DEFAULT '',
  latitude DOUBLE PRECISION DEFAULT 12.9716,
  longitude DOUBLE PRECISION DEFAULT 77.5946,
  borrow_max_duration_days INT DEFAULT 14,
  borrow_max_duration_unit VARCHAR(20) DEFAULT 'days',
  borrow_notes VARCHAR(500) DEFAULT '',
  exchange_wanted_items VARCHAR(300) DEFAULT '',
  specifications JSONB DEFAULT '[]'::jsonb,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  views_count INT DEFAULT 0,
  saves_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_items_cat_status_avail ON items(category, status, availability);
CREATE INDEX IF NOT EXISTS idx_items_sharing_status ON items(sharing_type, status);
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_status_created ON items(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_city ON items(city, status);

-- ----------------------------------------------------------------------------
-- 4. WANTED ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wanted_items (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  subcategory VARCHAR(60) DEFAULT 'General',
  quantity INT DEFAULT 1,
  preferred_sharing_type VARCHAR(30) DEFAULT 'any',
  condition_preference VARCHAR(30) DEFAULT 'any',
  city VARCHAR(100) DEFAULT '',
  district VARCHAR(100) DEFAULT '',
  state VARCHAR(100) DEFAULT '',
  locality VARCHAR(100) DEFAULT '',
  approximate_address VARCHAR(255) DEFAULT '',
  latitude DOUBLE PRECISION DEFAULT 12.9716,
  longitude DOUBLE PRECISION DEFAULT 77.5946,
  urgency VARCHAR(20) DEFAULT 'medium',
  required_by TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  images JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(30) DEFAULT 'ACTIVE',
  requester_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wanted_status_cat ON wanted_items(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wanted_requester ON wanted_items(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wanted_city ON wanted_items(city, status);

-- ----------------------------------------------------------------------------
-- 5. REQUESTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS requests (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) REFERENCES items(id) ON DELETE SET NULL,
  wanted_item_id VARCHAR(64) REFERENCES wanted_items(id) ON DELETE SET NULL,
  requester_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL DEFAULT 'REQUEST_ITEM',
  message TEXT DEFAULT '',
  expected_return_date TIMESTAMP WITH TIME ZONE,
  offered_item_id VARCHAR(64) REFERENCES items(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'PENDING',
  accepted_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_owner_status ON requests(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_item ON requests(item_id, requester_id, status);

-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  offered_item_id VARCHAR(64) REFERENCES items(id) ON DELETE SET NULL,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  status VARCHAR(40) DEFAULT 'PENDING_HANDOVER',
  handover_method VARCHAR(40) DEFAULT 'In Person',
  handover_date TIMESTAMP WITH TIME ZONE,
  handover_time VARCHAR(50) DEFAULT '',
  handover_city VARCHAR(100) DEFAULT '',
  handover_locality VARCHAR(100) DEFAULT '',
  handover_meeting_area VARCHAR(255) DEFAULT '',
  handover_notes TEXT DEFAULT '',
  handover_confirmed_by_owner BOOLEAN DEFAULT FALSE,
  handover_confirmed_by_recipient BOOLEAN DEFAULT FALSE,
  handover_confirmed_at TIMESTAMP WITH TIME ZONE,
  expected_return_date TIMESTAMP WITH TIME ZONE,
  return_date TIMESTAMP WITH TIME ZONE,
  return_notes TEXT DEFAULT '',
  return_confirmed_by_borrower BOOLEAN DEFAULT FALSE,
  return_confirmed_by_owner BOOLEAN DEFAULT FALSE,
  return_confirmed_at TIMESTAMP WITH TIME ZONE,
  returned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_owner ON transactions(owner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON transactions(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_item ON transactions(item_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 7. MATCHES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matches (
  id VARCHAR(64) PRIMARY KEY,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  wanted_item_id VARCHAR(64) NOT NULL REFERENCES wanted_items(id) ON DELETE CASCADE,
  item_owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  match_reasons TEXT[] DEFAULT '{}',
  distance_km NUMERIC(6,2),
  status VARCHAR(30) DEFAULT 'ACTIVE',
  notified BOOLEAN DEFAULT FALSE,
  last_evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_match_item_wanted UNIQUE (item_id, wanted_item_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_requester ON matches(requester_id, status, score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_owner ON matches(item_owner_id, status, score DESC);

-- ----------------------------------------------------------------------------
-- 8. CONVERSATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES requests(id) ON DELETE CASCADE,
  item_id VARCHAR(64) REFERENCES items(id) ON DELETE SET NULL,
  transaction_id VARCHAR(64) REFERENCES transactions(id) ON DELETE SET NULL,
  participant_ids TEXT[] NOT NULL,
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conv_last_message ON conversations(last_message_at DESC);

-- ----------------------------------------------------------------------------
-- 9. MESSAGES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  read_by_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

-- ----------------------------------------------------------------------------
-- 10. REVIEWS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) PRIMARY KEY,
  reviewer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_review UNIQUE (reviewer_id, transaction_id, reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 11. REPORTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(64) PRIMARY KEY,
  reporter_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL, -- USER or ITEM
  target_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  target_item_id VARCHAR(64) REFERENCES items(id) ON DELETE SET NULL,
  reason VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  status VARCHAR(20) DEFAULT 'PENDING',
  resolution_notes TEXT DEFAULT '',
  action_taken VARCHAR(100) DEFAULT '',
  resolved_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);

-- ----------------------------------------------------------------------------
-- 12. SAVED ITEMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_items (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id VARCHAR(64) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_saved_item UNIQUE (user_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_items(user_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 13. NOTIFICATIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  dedupe_key VARCHAR(255),
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(64),
  related_item_id VARCHAR(64),
  related_wanted_item_id VARCHAR(64),
  related_request_id VARCHAR(64),
  related_transaction_id VARCHAR(64),
  related_conversation_id VARCHAR(64),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, deleted_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipient_id, deleted_at, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(recipient_id, dedupe_key);

-- ----------------------------------------------------------------------------
-- 14. NOTIFICATION PREFERENCES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  in_app BOOLEAN DEFAULT TRUE,
  browser BOOLEAN DEFAULT FALSE,
  categories JSONB DEFAULT '{"requests":true,"transactions":true,"messages":true,"matching":true,"items":true,"safety":true,"account":true,"impact":true,"system":true}'::jsonb,
  quiet_hours JSONB DEFAULT '{"enabled":false,"start":"22:00","end":"07:00","timezone":"Asia/Kolkata"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 15. IMPACT FACTORS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impact_factors (
  id VARCHAR(64) PRIMARY KEY,
  category VARCHAR(60) NOT NULL,
  metric_type VARCHAR(40) NOT NULL,
  value NUMERIC(10,3) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  basis VARCHAR(100) DEFAULT 'per item reused',
  source VARCHAR(255) NOT NULL,
  methodology_version VARCHAR(20) DEFAULT '1.0',
  factor_version INT DEFAULT 1,
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  effective_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_impact_factors_lookup ON impact_factors(category, metric_type, active);

-- ----------------------------------------------------------------------------
-- 16. IMPACT EVENTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impact_events (
  id VARCHAR(64) PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL UNIQUE REFERENCES transactions(id) ON DELETE CASCADE,
  owner_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  impact_type VARCHAR(30) NOT NULL,
  category VARCHAR(60) DEFAULT 'Other',
  quantity INT DEFAULT 1,
  items JSONB DEFAULT '[]'::jsonb,
  reuse_count INT DEFAULT 1,
  estimated_co2e_avoided NUMERIC(10,3),
  estimated_waste_avoided NUMERIC(10,3),
  estimated_water_saved NUMERIC(10,3),
  methodology_version VARCHAR(20) DEFAULT '1.0',
  factor_version VARCHAR(20) DEFAULT '1.0',
  source VARCHAR(255) DEFAULT 'Platform verified impact factors',
  calculation_notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_impact_events_owner ON impact_events(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_events_recipient ON impact_events(recipient_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_events_created ON impact_events(created_at DESC);

-- ----------------------------------------------------------------------------
-- 17. ADMIN AUDIT LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  admin_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(64),
  target_title VARCHAR(255) DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45) DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_logs(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 18. ADMIN SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_settings (
  id VARCHAR(64) PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  label VARCHAR(255) DEFAULT '',
  description TEXT DEFAULT '',
  category VARCHAR(50) DEFAULT 'GENERAL',
  updated_by_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 19. OTP TOKENS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_tokens (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  email VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  hashed_otp VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  failed_attempts INT DEFAULT 0,
  resend_count INT DEFAULT 0,
  consumed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_tokens(email, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_user_purpose ON otp_tokens(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_tokens(expires_at);

-- ----------------------------------------------------------------------------
-- 20. EMAIL OUTBOX TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_outbox (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  deduplication_key VARCHAR(255) UNIQUE,
  recipient_user_id VARCHAR(64),
  recipient_email VARCHAR(255) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) DEFAULT 'PENDING',
  attempt_count INT DEFAULT 0,
  next_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  provider_message_id VARCHAR(255),
  last_error_code VARCHAR(100),
  last_error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_next ON email_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_outbox_email ON email_outbox(recipient_email);
CREATE INDEX IF NOT EXISTS idx_outbox_user ON email_outbox(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON email_outbox(created_at DESC);

-- ----------------------------------------------------------------------------
-- 21. SITE REVIEWS (Platform Testimonials) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS site_reviews (
  id VARCHAR(64) PRIMARY KEY,
  person VARCHAR(120) NOT NULL,
  role VARCHAR(150) NOT NULL DEFAULT 'Community Member',
  item VARCHAR(150) DEFAULT 'Platform Experience',
  rating INT NOT NULL DEFAULT 5,
  quote TEXT NOT NULL,
  avatar TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
  badge VARCHAR(60) DEFAULT 'Verified Member',
  is_published BOOLEAN DEFAULT TRUE,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_site_reviews_published ON site_reviews(is_published, display_order ASC, created_at DESC);

-- ----------------------------------------------------------------------------
-- 22. SUBSCRIBERS (Newsletter with OTP) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscribers (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(120) DEFAULT 'Subscriber',
  verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(30) DEFAULT 'ACTIVE',
  verification_otp VARCHAR(255),
  otp_expires_at TIMESTAMP WITH TIME ZONE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_verified ON subscribers(verified, status);

-- ----------------------------------------------------------------------------
-- 23. BROADCAST UPDATES (Admin Announcements) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broadcast_updates (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(60) DEFAULT 'Platform Update',
  message TEXT NOT NULL,
  recipient_count INT DEFAULT 0,
  sent_by VARCHAR(64) DEFAULT 'Admin',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_broadcast_sent_at ON broadcast_updates(sent_at DESC);

