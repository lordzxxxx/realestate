-- Phase 1: RBAC seed data
-- Permission catalogue (section 8) and default role → permission mapping
-- (one system role per user_category). Editable later via the RBAC settings UI
-- (rbac.manage) — this is a sane default, not a hardcoded ceiling.

insert into permissions (key, category, description) values
  ('listing.create',               'LISTINGS',     'Create a new listing'),
  ('listing.read_own',             'LISTINGS',     'Read listings the user owns/is assigned to'),
  ('listing.read_organization',    'LISTINGS',     'Read all listings within the organization'),
  ('listing.read_all',             'LISTINGS',     'Read all listings platform-wide'),
  ('listing.update_own',           'LISTINGS',     'Update own listings'),
  ('listing.update_organization',  'LISTINGS',     'Update any listing within the organization'),
  ('listing.update_all',           'LISTINGS',     'Update any listing platform-wide'),
  ('listing.archive_own',          'LISTINGS',     'Archive own listings'),
  ('listing.archive_all',          'LISTINGS',     'Archive any listing'),
  ('listing.approve',              'LISTINGS',     'Approve a pending listing'),
  ('listing.reject',               'LISTINGS',     'Reject a pending listing'),
  ('listing.publish',              'LISTINGS',     'Publish an approved listing'),
  ('listing.publish_directly',     'LISTINGS',     'Publish without requiring approval'),
  ('listing.change_status',        'LISTINGS',     'Change listing availability status'),
  ('listing.assign_agent',         'LISTINGS',     'Assign an agent to a listing'),
  ('listing.view_private_contacts','LISTINGS',     'View owner/key-holder private contact info'),
  ('listing.manage_images',        'LISTINGS',     'Upload/reorder/delete listing images'),

  ('user.view',       'USERS', 'View user profiles'),
  ('user.create',     'USERS', 'Create a user account directly'),
  ('user.edit',       'USERS', 'Edit a user profile'),
  ('user.approve',    'USERS', 'Approve a pending registration'),
  ('user.suspend',    'USERS', 'Suspend a user'),
  ('user.reactivate', 'USERS', 'Reactivate a suspended user'),
  ('user.archive',    'USERS', 'Archive a user'),

  ('organization.view',            'ORGANIZATIONS', 'View organization details'),
  ('organization.create',          'ORGANIZATIONS', 'Create a new organization'),
  ('organization.edit',            'ORGANIZATIONS', 'Edit organization details/settings'),
  ('organization.manage_members',  'ORGANIZATIONS', 'Manage organization membership'),

  ('inquiry.view_own',          'INQUIRIES', 'View own inquiries'),
  ('inquiry.view_organization', 'INQUIRIES', 'View organization inquiries'),
  ('inquiry.view_all',          'INQUIRIES', 'View all inquiries platform-wide'),
  ('inquiry.assign',            'INQUIRIES', 'Assign an inquiry to an agent'),
  ('inquiry.update',            'INQUIRIES', 'Update inquiry status/notes'),

  ('viewing.view',   'VIEWINGS', 'View viewing requests'),
  ('viewing.manage', 'VIEWINGS', 'Manage viewing requests'),
  ('viewing.assign', 'VIEWINGS', 'Assign a viewing request to an agent'),

  ('reports.view_own',          'REPORTS', 'View own reports'),
  ('reports.view_organization', 'REPORTS', 'View organization reports'),
  ('reports.view_all',          'REPORTS', 'View platform-wide reports'),
  ('reports.export',            'REPORTS', 'Export reports'),

  ('integrations.view',    'INTEGRATIONS', 'View integration connections/status'),
  ('integrations.manage',  'INTEGRATIONS', 'Connect/disconnect integrations'),
  ('integrations.facebook','INTEGRATIONS', 'Manage the Facebook integration specifically'),
  ('integrations.google',  'INTEGRATIONS', 'Manage the Google Sheets integration specifically'),
  ('integrations.retry',   'INTEGRATIONS', 'Manually retry a failed sync job'),

  ('rbac.view',   'RBAC', 'View roles/permissions'),
  ('rbac.manage', 'RBAC', 'Manage roles/permissions/user role assignments'),

  ('audit.view', 'AUDIT', 'View audit logs'),

  ('social.preview',           'SOCIAL', 'Preview a social post before publishing'),
  ('social.publish',           'SOCIAL', 'Manually trigger a social publish'),
  ('social.retry',             'SOCIAL', 'Retry a failed social sync job'),
  ('social.manage_templates',  'SOCIAL', 'Edit caption templates')
on conflict (key) do nothing;

insert into roles (name, description, is_system) values
  ('SUPER_ADMIN',              'Platform-wide administrator with unrestricted access', true),
  ('COMPANY_ADMIN',            'Administrator for the primary company organization', true),
  ('MANAGEMENT',               'Approves listings, manages inquiries/viewings, views reports', true),
  ('COMPANY_AGENT',            'Trusted internal agent, may publish listings directly', true),
  ('BROKER',                   'Trusted org-wide agent, may publish listings directly', true),
  ('EXTERNAL_AGENT',           'External contributor, listings require approval', true),
  ('KEY_HOLDER',               'Holds property keys, read-only access to assigned listings', true),
  ('PROPERTY_OWNER',           'Owns property, read-only access to own listings', true),
  ('PROPERTY_REPRESENTATIVE',  'Represents an owner, may update assigned listings', true),
  ('PARTNER_BUSINESS_ADMIN',   'Administrator for a partner business organization', true),
  ('PARTNER_BUSINESS_MEMBER',  'Member of a partner business organization', true)
on conflict (name) do nothing;

with role_perm_map (role_name, permission_key) as (
  values
    -- SUPER_ADMIN gets every permission (expanded below via cross join instead of listing here)
    ('COMPANY_ADMIN', 'listing.create'), ('COMPANY_ADMIN', 'listing.read_organization'),
    ('COMPANY_ADMIN', 'listing.update_organization'), ('COMPANY_ADMIN', 'listing.archive_own'),
    ('COMPANY_ADMIN', 'listing.approve'), ('COMPANY_ADMIN', 'listing.reject'),
    ('COMPANY_ADMIN', 'listing.publish'), ('COMPANY_ADMIN', 'listing.publish_directly'),
    ('COMPANY_ADMIN', 'listing.change_status'), ('COMPANY_ADMIN', 'listing.assign_agent'),
    ('COMPANY_ADMIN', 'listing.view_private_contacts'), ('COMPANY_ADMIN', 'listing.manage_images'),
    ('COMPANY_ADMIN', 'user.view'), ('COMPANY_ADMIN', 'user.create'), ('COMPANY_ADMIN', 'user.edit'),
    ('COMPANY_ADMIN', 'user.approve'), ('COMPANY_ADMIN', 'user.suspend'), ('COMPANY_ADMIN', 'user.reactivate'),
    ('COMPANY_ADMIN', 'user.archive'),
    ('COMPANY_ADMIN', 'organization.view'), ('COMPANY_ADMIN', 'organization.edit'),
    ('COMPANY_ADMIN', 'organization.manage_members'),
    ('COMPANY_ADMIN', 'inquiry.view_organization'), ('COMPANY_ADMIN', 'inquiry.assign'), ('COMPANY_ADMIN', 'inquiry.update'),
    ('COMPANY_ADMIN', 'viewing.view'), ('COMPANY_ADMIN', 'viewing.manage'), ('COMPANY_ADMIN', 'viewing.assign'),
    ('COMPANY_ADMIN', 'reports.view_organization'), ('COMPANY_ADMIN', 'reports.export'),
    ('COMPANY_ADMIN', 'integrations.view'), ('COMPANY_ADMIN', 'integrations.manage'),
    ('COMPANY_ADMIN', 'integrations.facebook'), ('COMPANY_ADMIN', 'integrations.google'), ('COMPANY_ADMIN', 'integrations.retry'),
    ('COMPANY_ADMIN', 'rbac.view'), ('COMPANY_ADMIN', 'rbac.manage'),
    ('COMPANY_ADMIN', 'audit.view'),
    ('COMPANY_ADMIN', 'social.preview'), ('COMPANY_ADMIN', 'social.publish'),
    ('COMPANY_ADMIN', 'social.retry'), ('COMPANY_ADMIN', 'social.manage_templates'),

    ('MANAGEMENT', 'listing.read_organization'), ('MANAGEMENT', 'listing.update_organization'),
    ('MANAGEMENT', 'listing.approve'), ('MANAGEMENT', 'listing.reject'), ('MANAGEMENT', 'listing.publish'),
    ('MANAGEMENT', 'listing.change_status'), ('MANAGEMENT', 'listing.assign_agent'),
    ('MANAGEMENT', 'listing.view_private_contacts'), ('MANAGEMENT', 'listing.manage_images'),
    ('MANAGEMENT', 'user.view'), ('MANAGEMENT', 'user.approve'),
    ('MANAGEMENT', 'organization.view'),
    ('MANAGEMENT', 'inquiry.view_organization'), ('MANAGEMENT', 'inquiry.assign'), ('MANAGEMENT', 'inquiry.update'),
    ('MANAGEMENT', 'viewing.view'), ('MANAGEMENT', 'viewing.manage'), ('MANAGEMENT', 'viewing.assign'),
    ('MANAGEMENT', 'reports.view_organization'), ('MANAGEMENT', 'reports.export'),
    ('MANAGEMENT', 'integrations.view'), ('MANAGEMENT', 'integrations.retry'),
    ('MANAGEMENT', 'audit.view'),
    ('MANAGEMENT', 'social.preview'), ('MANAGEMENT', 'social.retry'),

    ('COMPANY_AGENT', 'listing.create'), ('COMPANY_AGENT', 'listing.read_own'),
    ('COMPANY_AGENT', 'listing.update_own'), ('COMPANY_AGENT', 'listing.archive_own'),
    ('COMPANY_AGENT', 'listing.publish_directly'), ('COMPANY_AGENT', 'listing.change_status'),
    ('COMPANY_AGENT', 'listing.manage_images'),
    ('COMPANY_AGENT', 'inquiry.view_own'), ('COMPANY_AGENT', 'inquiry.update'),
    ('COMPANY_AGENT', 'viewing.view'),
    ('COMPANY_AGENT', 'reports.view_own'),
    ('COMPANY_AGENT', 'social.preview'),

    ('BROKER', 'listing.create'), ('BROKER', 'listing.read_organization'),
    ('BROKER', 'listing.update_own'), ('BROKER', 'listing.archive_own'),
    ('BROKER', 'listing.publish_directly'), ('BROKER', 'listing.change_status'),
    ('BROKER', 'listing.assign_agent'), ('BROKER', 'listing.manage_images'),
    ('BROKER', 'inquiry.view_organization'), ('BROKER', 'inquiry.update'),
    ('BROKER', 'viewing.view'), ('BROKER', 'viewing.assign'),
    ('BROKER', 'reports.view_organization'),
    ('BROKER', 'social.preview'),

    ('EXTERNAL_AGENT', 'listing.create'), ('EXTERNAL_AGENT', 'listing.read_own'),
    ('EXTERNAL_AGENT', 'listing.update_own'), ('EXTERNAL_AGENT', 'listing.manage_images'),
    ('EXTERNAL_AGENT', 'inquiry.view_own'), ('EXTERNAL_AGENT', 'viewing.view'),
    ('EXTERNAL_AGENT', 'reports.view_own'),

    ('KEY_HOLDER', 'listing.read_own'), ('KEY_HOLDER', 'viewing.view'),

    ('PROPERTY_OWNER', 'listing.read_own'),

    ('PROPERTY_REPRESENTATIVE', 'listing.read_own'), ('PROPERTY_REPRESENTATIVE', 'listing.update_own'),

    ('PARTNER_BUSINESS_ADMIN', 'listing.create'), ('PARTNER_BUSINESS_ADMIN', 'listing.read_organization'),
    ('PARTNER_BUSINESS_ADMIN', 'listing.update_organization'), ('PARTNER_BUSINESS_ADMIN', 'listing.archive_own'),
    ('PARTNER_BUSINESS_ADMIN', 'listing.approve'), ('PARTNER_BUSINESS_ADMIN', 'listing.reject'),
    ('PARTNER_BUSINESS_ADMIN', 'listing.publish'), ('PARTNER_BUSINESS_ADMIN', 'listing.change_status'),
    ('PARTNER_BUSINESS_ADMIN', 'listing.assign_agent'), ('PARTNER_BUSINESS_ADMIN', 'listing.view_private_contacts'),
    ('PARTNER_BUSINESS_ADMIN', 'listing.manage_images'),
    ('PARTNER_BUSINESS_ADMIN', 'user.view'), ('PARTNER_BUSINESS_ADMIN', 'user.edit'),
    ('PARTNER_BUSINESS_ADMIN', 'user.approve'), ('PARTNER_BUSINESS_ADMIN', 'user.suspend'),
    ('PARTNER_BUSINESS_ADMIN', 'user.reactivate'),
    ('PARTNER_BUSINESS_ADMIN', 'organization.view'), ('PARTNER_BUSINESS_ADMIN', 'organization.edit'),
    ('PARTNER_BUSINESS_ADMIN', 'organization.manage_members'),
    ('PARTNER_BUSINESS_ADMIN', 'inquiry.view_organization'), ('PARTNER_BUSINESS_ADMIN', 'inquiry.assign'),
    ('PARTNER_BUSINESS_ADMIN', 'inquiry.update'),
    ('PARTNER_BUSINESS_ADMIN', 'viewing.view'), ('PARTNER_BUSINESS_ADMIN', 'viewing.manage'),
    ('PARTNER_BUSINESS_ADMIN', 'viewing.assign'),
    ('PARTNER_BUSINESS_ADMIN', 'reports.view_organization'), ('PARTNER_BUSINESS_ADMIN', 'reports.export'),
    ('PARTNER_BUSINESS_ADMIN', 'integrations.view'), ('PARTNER_BUSINESS_ADMIN', 'integrations.manage'),
    ('PARTNER_BUSINESS_ADMIN', 'integrations.facebook'), ('PARTNER_BUSINESS_ADMIN', 'integrations.google'),
    ('PARTNER_BUSINESS_ADMIN', 'integrations.retry'),
    ('PARTNER_BUSINESS_ADMIN', 'audit.view'),
    ('PARTNER_BUSINESS_ADMIN', 'social.preview'), ('PARTNER_BUSINESS_ADMIN', 'social.publish'),
    ('PARTNER_BUSINESS_ADMIN', 'social.retry'), ('PARTNER_BUSINESS_ADMIN', 'social.manage_templates'),

    ('PARTNER_BUSINESS_MEMBER', 'listing.create'), ('PARTNER_BUSINESS_MEMBER', 'listing.read_own'),
    ('PARTNER_BUSINESS_MEMBER', 'listing.update_own'), ('PARTNER_BUSINESS_MEMBER', 'listing.manage_images'),
    ('PARTNER_BUSINESS_MEMBER', 'inquiry.view_own'), ('PARTNER_BUSINESS_MEMBER', 'viewing.view'),
    ('PARTNER_BUSINESS_MEMBER', 'reports.view_own'), ('PARTNER_BUSINESS_MEMBER', 'social.preview')
)
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from role_perm_map m
join roles r on r.name = m.role_name
join permissions p on p.key = m.permission_key
on conflict do nothing;

-- SUPER_ADMIN: every permission that exists, kept in sync automatically as new
-- permissions are added by future migrations.
insert into role_permissions (role_id, permission_id)
select r.id, p.id
from roles r
cross join permissions p
where r.name = 'SUPER_ADMIN'
on conflict do nothing;
