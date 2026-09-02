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
    };
    Enums: {
      organization_status: OrganizationStatus;
      user_category: UserCategory;
      profile_status: ProfileStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
