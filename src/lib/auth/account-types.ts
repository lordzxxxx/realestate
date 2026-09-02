// Self-service registration (section 9) only offers non-internal categories.
// SUPER_ADMIN / COMPANY_ADMIN / MANAGEMENT can only be granted by an existing
// privileged admin — enforced server-side by assert_registration_category().
export const REGISTRABLE_ACCOUNT_TYPES = [
  { value: 'EXTERNAL_AGENT', label: 'Agent' },
  { value: 'BROKER', label: 'Broker' },
  { value: 'PROPERTY_OWNER', label: 'Property Owner' },
  { value: 'KEY_HOLDER', label: 'Key Holder' },
  { value: 'PROPERTY_REPRESENTATIVE', label: 'Property Representative' },
  { value: 'PARTNER_BUSINESS_MEMBER', label: 'Partner Business' },
] as const;

export type RegistrableAccountType = (typeof REGISTRABLE_ACCOUNT_TYPES)[number]['value'];

export const ACCOUNT_TYPE_VALUES = REGISTRABLE_ACCOUNT_TYPES.map((t) => t.value) as [
  RegistrableAccountType,
  ...RegistrableAccountType[],
];
