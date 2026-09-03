// Hand-written to match supabase/migrations/000X_*.sql exactly.
// Once a real Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// and re-apply any manual additions from this file's history.

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type UserCategory =
  | 'SUPER_ADMIN'
  | 'COMPANY_ADMIN'
  | 'MANAGEMENT'
  | 'COMPANY_AGENT'
  | 'BROKER'
  | 'EXTERNAL_AGENT'
  | 'KEY_HOLDER'
  | 'PROPERTY_OWNER'
  | 'PROPERTY_REPRESENTATIVE'
  | 'PARTNER_BUSINESS_ADMIN'
  | 'PARTNER_BUSINESS_MEMBER';

export type ProfileStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export type ListingType = 'RENT' | 'SALE';

export type PropertyType =
  | 'CONDOMINIUM'
  | 'HOUSE'
  | 'HOUSE_AND_LOT'
  | 'APARTMENT'
  | 'COMMERCIAL'
  | 'OFFICE'
  | 'LOT'
  | 'ROOM'
  | 'BEDSPACE'
  | 'TOWNHOUSE'
  | 'WAREHOUSE'
  | 'OTHER';

export type FurnishingType = 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';

export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'AVAILABLE'
  | 'RESERVED'
  | 'RENTED'
  | 'SOLD'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'REJECTED'
  | 'ARCHIVED';

export type ListingContactType = 'OWNER' | 'KEY_HOLDER' | 'REPRESENTATIVE';

export type AmenityKind = 'AMENITY' | 'NEARBY';

export type PreferredContactMethod = 'PHONE' | 'EMAIL' | 'MESSENGER';

export type InquiryStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'VIEWING_SCHEDULED'
  | 'FOLLOW_UP'
  | 'CONVERTED'
  | 'LOST'
  | 'CLOSED';

export type ViewingStatus = 'REQUESTED' | 'CONFIRMED' | 'RESCHEDULED' | 'COMPLETED' | 'CANCELLED';

export type SyncJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'CANCELLED'
  | 'FAILED_REQUIRES_ATTENTION';

// supabase-js's generic helpers (GenericTable) require a Relationships array
// even when we aren't declaring any foreign-table joins for `.select()`.
type NoRelationships = { Relationships: [] };

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          status: OrganizationStatus;
          settings: Record<string, unknown>;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          archived_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          status?: OrganizationStatus;
          settings?: Record<string, unknown>;
          created_by?: string | null;
          updated_by?: string | null;
          archived_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>;
      } & NoRelationships;
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          user_category: UserCategory;
          status: ProfileStatus;
          messenger_contact: string | null;
          address: string | null;
          organization_name: string | null;
          terms_accepted_at: string | null;
          created_at: string;
          updated_at: string;
          approved_at: string | null;
          approved_by: string | null;
          suspended_at: string | null;
          archived_at: string | null;
        };
        Insert: never; // rows are only ever created by the handle_new_auth_user trigger
        // Matches exactly the columns granted to `authenticated` in migration
        // 0009 — status/approved_*/suspended_at/archived_at are excluded at
        // the database privilege level, not just here.
        Update: Partial<
          Pick<
            Database['public']['Tables']['profiles']['Row'],
            'full_name' | 'phone' | 'messenger_contact' | 'address' | 'organization_id' | 'organization_name'
          >
        >;
      } & NoRelationships;
      roles: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_system?: boolean;
        };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      } & NoRelationships;
      permissions: {
        Row: {
          id: string;
          key: string;
          category: string;
          description: string | null;
        };
        Insert: never;
        Update: never;
      } & NoRelationships;
      role_permissions: {
        Row: { role_id: string; permission_id: string };
        Insert: { role_id: string; permission_id: string };
        Update: never;
      } & NoRelationships;
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role_id: string;
          organization_id: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          role_id: string;
          organization_id?: string | null;
          created_by?: string | null;
        };
        Update: never;
      } & NoRelationships;
      system_settings: {
        Row: {
          key: string;
          value: Record<string, unknown>;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: { key: string; value?: Record<string, unknown>; updated_by?: string | null };
        Update: Partial<Database['public']['Tables']['system_settings']['Insert']>;
      } & NoRelationships;
      organization_settings: {
        Row: {
          organization_id: string;
          auto_approve_registrations: boolean;
          listing_approval_required: boolean;
          auto_publish_website: boolean;
          auto_publish_facebook: boolean;
          auto_sync_google_sheets: boolean;
          settings: Record<string, unknown>;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never; // created automatically by handle_new_organization trigger
        Update: Partial<
          Omit<Database['public']['Tables']['organization_settings']['Row'], 'organization_id' | 'updated_at'>
        >;
      } & NoRelationships;
      listings: {
        Row: {
          id: string;
          organization_id: string;
          listing_number: string;
          slug: string;
          listing_type: ListingType;
          property_type: PropertyType;
          property_name: string;
          title: string | null;
          description: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          has_balcony: boolean;
          tower: string | null;
          building: string | null;
          floor: string | null;
          unit_number: string | null;
          floor_area: number | null;
          lot_area: number | null;
          furnishing: FurnishingType | null;
          has_parking: boolean;
          parking_slots: number | null;
          monthly_rent: number | null;
          selling_price: number | null;
          association_dues: number | null;
          security_deposit: number | null;
          advance: number | null;
          payment_terms: string | null;
          is_negotiable: boolean;
          country: string;
          province: string | null;
          city: string | null;
          barangay: string | null;
          full_address: string | null;
          latitude: number | null;
          longitude: number | null;
          status: ListingStatus;
          assigned_agent_id: string | null;
          website_enabled: boolean;
          facebook_enabled: boolean;
          google_sheets_enabled: boolean;
          auto_sync_enabled: boolean;
          seo_title: string | null;
          seo_description: string | null;
          last_verified_at: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          published_at: string | null;
          reserved_at: string | null;
          rented_at: string | null;
          sold_at: string | null;
          archived_at: string | null;
          version: number;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          listing_number?: string; // auto-generated by handle_new_listing() if omitted
          slug?: string; // auto-generated by handle_new_listing() if omitted
          listing_type: ListingType;
          property_type: PropertyType;
          property_name: string;
          title?: string | null;
          description?: string | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          has_balcony?: boolean;
          tower?: string | null;
          building?: string | null;
          floor?: string | null;
          unit_number?: string | null;
          floor_area?: number | null;
          lot_area?: number | null;
          furnishing?: FurnishingType | null;
          has_parking?: boolean;
          parking_slots?: number | null;
          monthly_rent?: number | null;
          selling_price?: number | null;
          association_dues?: number | null;
          security_deposit?: number | null;
          advance?: number | null;
          payment_terms?: string | null;
          is_negotiable?: boolean;
          country?: string;
          province?: string | null;
          city?: string | null;
          barangay?: string | null;
          full_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          assigned_agent_id?: string | null;
          created_by?: string | null;
          // status and every automatic timestamp are intentionally absent:
          // handle_new_listing() forces status=DRAFT and clears all of these
          // regardless of what's sent (0011) — see set_listing_status() for
          // the only way to change status.
        };
        // Matches exactly the columns granted to `authenticated` in migration
        // 0013 — status/approval timestamps/version/assigned_agent_id are
        // excluded at the database privilege level, not just here.
        Update: Partial<
          Pick<
            Database['public']['Tables']['listings']['Row'],
            | 'listing_type'
            | 'property_type'
            | 'property_name'
            | 'title'
            | 'description'
            | 'bedrooms'
            | 'bathrooms'
            | 'has_balcony'
            | 'tower'
            | 'building'
            | 'floor'
            | 'unit_number'
            | 'floor_area'
            | 'lot_area'
            | 'furnishing'
            | 'has_parking'
            | 'parking_slots'
            | 'monthly_rent'
            | 'selling_price'
            | 'association_dues'
            | 'security_deposit'
            | 'advance'
            | 'payment_terms'
            | 'is_negotiable'
            | 'country'
            | 'province'
            | 'city'
            | 'barangay'
            | 'full_address'
            | 'latitude'
            | 'longitude'
            | 'website_enabled'
            | 'facebook_enabled'
            | 'google_sheets_enabled'
            | 'auto_sync_enabled'
            | 'seo_title'
            | 'seo_description'
            | 'updated_by'
          >
        >;
      } & NoRelationships;
      listing_images: {
        Row: {
          id: string;
          listing_id: string;
          storage_path: string;
          sort_order: number;
          is_cover: boolean;
          alt_text: string | null;
          caption: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          storage_path: string;
          sort_order?: number;
          is_cover?: boolean;
          alt_text?: string | null;
          caption?: string | null;
          created_by?: string | null;
        };
        Update: Partial<
          Pick<Database['public']['Tables']['listing_images']['Row'], 'sort_order' | 'is_cover' | 'alt_text' | 'caption'>
        >;
      } & NoRelationships;
      listing_contacts: {
        Row: {
          id: string;
          listing_id: string;
          contact_type: ListingContactType;
          name: string;
          email: string | null;
          phone: string | null;
          messenger: string | null;
          company: string | null;
          viewing_instructions: string | null;
          access_instructions: string | null;
          internal_notes: string | null;
          commission_info: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          listing_id: string;
          contact_type: ListingContactType;
          name: string;
          email?: string | null;
          phone?: string | null;
          messenger?: string | null;
          company?: string | null;
          viewing_instructions?: string | null;
          access_instructions?: string | null;
          internal_notes?: string | null;
          commission_info?: string | null;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['listing_contacts']['Insert']>;
      } & NoRelationships;
      amenities: {
        Row: { id: string; key: string; label: string; kind: AmenityKind; is_system: boolean };
        Insert: { id?: string; key: string; label: string; kind: AmenityKind; is_system?: false };
        Update: never;
      } & NoRelationships;
      listing_amenities: {
        Row: { listing_id: string; amenity_id: string; distance_note: string | null };
        Insert: { listing_id: string; amenity_id: string; distance_note?: string | null };
        Update: never;
      } & NoRelationships;
      listing_status_history: {
        Row: {
          id: string;
          listing_id: string;
          from_status: ListingStatus | null;
          to_status: ListingStatus;
          note: string | null;
          changed_by: string | null;
          changed_at: string;
        };
        Insert: never; // written only by set_listing_status()
        Update: never;
      } & NoRelationships;
      listing_revisions: {
        Row: {
          id: string;
          listing_id: string;
          version: number;
          snapshot: Database['public']['Tables']['listings']['Row'];
          changed_by: string | null;
          created_at: string;
        };
        Insert: never; // written only by record_listing_revision()
        Update: never;
      } & NoRelationships;
      inquiries: {
        Row: {
          id: string;
          listing_id: string;
          organization_id: string;
          assigned_agent_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          message: string | null;
          preferred_contact_method: PreferredContactMethod | null;
          status: InquiryStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        // organization_id/assigned_agent_id/status are set by
        // handle_new_inquiry() regardless of what's sent (section 37
        // auto-assignment) — the public form only ever sends these fields.
        Insert: {
          id?: string;
          listing_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          message?: string | null;
          preferred_contact_method?: PreferredContactMethod | null;
        };
        Update: Partial<{ status: InquiryStatus; notes: string | null; assigned_agent_id: string | null }>;
      } & NoRelationships;
      viewing_requests: {
        Row: {
          id: string;
          listing_id: string;
          organization_id: string;
          assigned_agent_id: string | null;
          name: string;
          phone: string | null;
          email: string | null;
          preferred_date: string | null;
          preferred_time: string | null;
          notes: string | null;
          status: ViewingStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          preferred_date?: string | null;
          preferred_time?: string | null;
          notes?: string | null;
        };
        Update: Partial<{
          status: ViewingStatus;
          notes: string | null;
          assigned_agent_id: string | null;
          preferred_date: string | null;
          preferred_time: string | null;
        }>;
      } & NoRelationships;
      automation_events: {
        Row: {
          id: string;
          organization_id: string | null;
          event_type: string;
          resource_type: string;
          resource_id: string | null;
          actor_id: string | null;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: never; // written only by create_automation_event()
        Update: never;
      } & NoRelationships;
      sync_jobs: {
        Row: {
          id: string;
          organization_id: string | null;
          listing_id: string | null;
          event_id: string | null;
          job_type: string;
          platform: string;
          payload: Record<string, unknown>;
          status: SyncJobStatus;
          priority: number;
          attempt_count: number;
          max_attempts: number;
          next_retry_at: string | null;
          idempotency_key: string;
          last_error: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
          locked_at: string | null;
        };
        Insert: never; // written only by enqueue_sync_job()
        Update: never; // status transitions only via complete_sync_job()/claim_next_sync_jobs()
      } & NoRelationships;
      integration_logs: {
        Row: {
          id: string;
          sync_job_id: string | null;
          organization_id: string | null;
          level: string;
          event: string;
          message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: never; // written only by claim_next_sync_jobs()/complete_sync_job()
        Update: never;
      } & NoRelationships;
      notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          sync_job_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          sync_job_id?: string | null;
        };
        // Only read_at is client-settable (marking a notification read) —
        // matches the column grant in migration 0019.
        Update: Partial<{ read_at: string | null }>;
      } & NoRelationships;
      google_sheet_connections: {
        Row: {
          organization_id: string;
          spreadsheet_id: string | null;
          property_sheet_name: string;
          status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
          last_checked_at: string | null;
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never; // one row per org, auto-provisioned by trigger (0023)
        // Deliberately two disjoint update shapes at the call site (see
        // migration 0024): changing the target resets status, so
        // "save settings" and "test connection" must be separate writes.
        Update: Partial<{
          spreadsheet_id: string | null;
          property_sheet_name: string;
          status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
          last_checked_at: string | null;
          last_synced_at: string | null;
          last_error: string | null;
          updated_by: string | null;
        }>;
      } & NoRelationships;
      sheet_sync_records: {
        Row: {
          id: string;
          organization_id: string;
          listing_id: string;
          row_number: number;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // Written by direct table access from the worker's service-role
        // client (like `notifications`, unlike the RPC-only automation
        // tables above) — RLS/grants (migration 0023) block authenticated/
        // anon from ever exercising this shape themselves.
        Insert: {
          id?: string;
          organization_id: string;
          listing_id: string;
          row_number: number;
          last_synced_at?: string | null;
        };
        Update: Partial<{ row_number: number; last_synced_at: string | null }>;
      } & NoRelationships;
      facebook_page_connections: {
        // access_token IS included in Row — the worker's service-role client
        // (which bypasses grants entirely) legitimately reads it via a plain
        // `.select()` to call the Graph API, so hiding it from the type
        // would break that real path, not just an unwanted one. The actual
        // security boundary is the Postgres column-level REVOKE for
        // authenticated/anon (migration 0025), not this TS type — only
        // server.ts's service-role client should ever select this column;
        // an ordinary authenticated request gets it stripped by Postgres
        // regardless of what the type allows.
        Row: {
          organization_id: string;
          page_id: string | null;
          page_name: string | null;
          access_token: string | null;
          status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
          last_checked_at: string | null;
          last_synced_at: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: never; // one row per org, auto-provisioned by trigger (0025)
        // Same two-disjoint-writes discipline as google_sheet_connections:
        // changing page_id/access_token resets status, so "save settings"
        // and "test connection" must be separate calls.
        Update: Partial<{
          page_id: string | null;
          access_token: string | null;
          page_name: string | null;
          status: 'DISCONNECTED' | 'CONNECTED' | 'ERROR';
          last_checked_at: string | null;
          last_synced_at: string | null;
          last_error: string | null;
          updated_by: string | null;
        }>;
      } & NoRelationships;
      facebook_post_records: {
        Row: {
          id: string;
          organization_id: string;
          listing_id: string;
          post_id: string;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // Written by direct table access from the worker's service-role
        // client, like sheet_sync_records — RLS/grants (migration 0025)
        // block authenticated/anon from ever exercising this shape.
        Insert: {
          id?: string;
          organization_id: string;
          listing_id: string;
          post_id: string;
          last_synced_at?: string | null;
        };
        Update: Partial<{ post_id: string; last_synced_at: string | null }>;
      } & NoRelationships;
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: {
        Args: { p_user_id: string; p_permission: string; p_organization_id?: string | null };
        Returns: boolean;
      };
      has_permission_any: {
        Args: { p_user_id: string; p_permission: string };
        Returns: boolean;
      };
      current_user_has_permission: {
        Args: { p_permission: string; p_organization_id?: string | null };
        Returns: boolean;
      };
      my_permissions: {
        Args: Record<string, never>;
        Returns: { permission_key: string; organization_id: string | null }[];
      };
      my_profile: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      set_profile_status: {
        Args: { p_profile_id: string; p_new_status: ProfileStatus };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      set_listing_status: {
        Args: { p_listing_id: string; p_new_status: ListingStatus; p_note?: string | null };
        Returns: Database['public']['Tables']['listings']['Row'];
      };
      submit_listing: {
        Args: { p_listing_id: string };
        Returns: Database['public']['Tables']['listings']['Row'];
      };
      approve_and_publish_listing: {
        Args: { p_listing_id: string; p_note?: string | null };
        Returns: Database['public']['Tables']['listings']['Row'];
      };
      assign_listing_agent: {
        Args: { p_listing_id: string; p_agent_id: string | null };
        Returns: Database['public']['Tables']['listings']['Row'];
      };
      // Phase 8: permission-checked (listing_actor_has), touches only
      // last_verified_at — the "Confirm still available" action.
      verify_listing: {
        Args: { p_listing_id: string };
        Returns: Database['public']['Tables']['listings']['Row'];
      };
      // The following are revoked from authenticated/anon (0020, 0022) —
      // callable only by the service-role worker, never via a user session's
      // supabase.rpc(). Typed here for the worker's own use.
      create_automation_event: {
        Args: {
          p_organization_id: string | null;
          p_event_type: string;
          p_resource_type: string;
          p_resource_id: string | null;
          p_actor_id: string | null;
          p_payload?: Record<string, unknown>;
        };
        Returns: string;
      };
      enqueue_sync_job: {
        Args: {
          p_organization_id: string | null;
          p_listing_id: string | null;
          p_event_id: string | null;
          p_job_type: string;
          p_platform: string;
          p_payload: Record<string, unknown>;
          p_idempotency_key: string;
        };
        Returns: string | null;
      };
      enqueue_notification_job: {
        Args: {
          p_user_id: string;
          p_organization_id: string | null;
          p_event_id: string | null;
          p_type: string;
          p_title: string;
          p_body: string | null;
          p_link: string | null;
          p_idempotency_suffix: string;
        };
        Returns: string | null;
      };
      notify_users_with_permission: {
        Args: {
          p_permission: string;
          p_organization_id: string | null;
          p_event_id: string | null;
          p_type: string;
          p_title: string;
          p_body: string | null;
          p_link: string | null;
          p_idempotency_suffix: string;
        };
        Returns: undefined;
      };
      claim_next_sync_jobs: {
        Args: { p_limit?: number };
        Returns: Database['public']['Tables']['sync_jobs']['Row'][];
      };
      complete_sync_job: {
        Args: { p_job_id: string; p_success: boolean; p_error?: string | null };
        Returns: Database['public']['Tables']['sync_jobs']['Row'];
      };
      reclaim_stuck_sync_jobs: {
        Args: { p_stuck_after?: string };
        Returns: number;
      };
      // Permission-checked internally (migration 0024) — callable directly
      // by an authenticated session with integrations.manage/google/retry,
      // unlike the RPCs above.
      reconcile_google_sheets: {
        Args: { p_organization_id: string };
        Returns: number;
      };
      // Permission-checked internally (migration 0026) — generic retry for
      // any dead-lettered sync_job, not Facebook-specific.
      retry_sync_job: {
        Args: { p_job_id: string };
        Returns: Database['public']['Tables']['sync_jobs']['Row'];
      };
    };
    Enums: {
      organization_status: OrganizationStatus;
      user_category: UserCategory;
      profile_status: ProfileStatus;
      listing_type: ListingType;
      property_type: PropertyType;
      furnishing_type: FurnishingType;
      listing_status: ListingStatus;
      listing_contact_type: ListingContactType;
      amenity_kind: AmenityKind;
      preferred_contact_method: PreferredContactMethod;
      inquiry_status: InquiryStatus;
      viewing_status: ViewingStatus;
      sync_job_status: SyncJobStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
