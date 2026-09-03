-- Phase 2: Property listings — enums (section 11, 14)

create type listing_type as enum ('RENT', 'SALE');

create type property_type as enum (
  'CONDOMINIUM', 'HOUSE', 'HOUSE_AND_LOT', 'APARTMENT', 'COMMERCIAL',
  'OFFICE', 'LOT', 'ROOM', 'BEDSPACE', 'TOWNHOUSE', 'WAREHOUSE', 'OTHER'
);

create type furnishing_type as enum ('UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED');

-- Section 14 status list + section 72 transition rules (enforced in
-- set_listing_status(), not just documented here).
create type listing_status as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'SOLD',
  'TEMPORARILY_UNAVAILABLE',
  'REJECTED',
  'ARCHIVED'
);
