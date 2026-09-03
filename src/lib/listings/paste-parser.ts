// Best-effort heuristic extraction for the "paste property details" flow
// (section 10). This is never trusted directly — parsePropertyText() only
// ever feeds a REVIEW step (the manual ListingForm, pre-filled), so a wrong
// guess costs the user one correction, not a bad publish.

export interface ParsedListingFields {
  property_name?: string;
  bedrooms?: string;
  has_balcony?: boolean;
  monthly_rent?: string;
  selling_price?: string;
  floor?: string;
  tower?: string;
  building?: string;
  unit_number?: string;
  furnishing?: 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';
  payment_terms?: string;
  floor_area?: string;
  listing_type?: 'RENT' | 'SALE';
}

const WORD_NUMBERS: Record<string, string> = {
  studio: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
};

const LABEL_FIELDS: { keys: string[]; field: keyof ParsedListingFields }[] = [
  { keys: ['price', 'rent', 'monthly rent'], field: 'monthly_rent' },
  { keys: ['selling price'], field: 'selling_price' },
  { keys: ['floor'], field: 'floor' },
  { keys: ['tower'], field: 'tower' },
  { keys: ['building'], field: 'building' },
  { keys: ['unit', 'unit number', 'unit no'], field: 'unit_number' },
  { keys: ['term', 'terms', 'payment terms'], field: 'payment_terms' },
  { keys: ['floor area', 'area'], field: 'floor_area' },
];

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseNumber(raw: string): string | undefined {
  const match = raw.replace(/,/g, '').match(/[\d.]+/);
  return match ? match[0] : undefined;
}

export function parsePropertyText(text: string): ParsedListingFields {
  const result: ParsedListingFields = {};
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const unmatchedLines: string[] = [];

  for (const line of lines) {
    const labelMatch = line.match(/^([^:]{2,30}):\s*(.+)$/);
    if (labelMatch) {
      const label = normalizeLabel(labelMatch[1]);
      const value = labelMatch[2].trim();
      const target = LABEL_FIELDS.find((f) => f.keys.includes(label));

      if (target) {
        if (target.field === 'monthly_rent' || target.field === 'selling_price' || target.field === 'floor_area') {
          const num = parseNumber(value);
          if (num) result[target.field] = num;
        } else {
          (result as Record<string, string>)[target.field] = value;
        }
        continue;
      }

      if (label === 'unit type' || label === 'bedrooms') {
        applyBedroomHint(value, result);
        if (/balcony/i.test(value)) result.has_balcony = true;
        continue;
      }
      if (label === 'furnishing' || label === 'furnished') {
        applyFurnishingHint(value, result);
        continue;
      }
      if (label === 'listing type' || label === 'type') {
        if (/sale|sell/i.test(value)) result.listing_type = 'SALE';
        else if (/rent/i.test(value)) result.listing_type = 'RENT';
        continue;
      }
    }

    unmatchedLines.push(line);
  }

  // Second pass over lines that weren't explicit "Label: Value" pairs —
  // positional/regex heuristics matching the section 10 example format.
  for (const line of unmatchedLines) {
    if (!result.property_name && !isLikelyFieldValue(line)) {
      result.property_name = line;
      continue;
    }

    applyBedroomHint(line, result);
    applyFurnishingHint(line, result);

    if (/balcony/i.test(line)) result.has_balcony = true;

    const towerMatch = line.match(/tower\s*(\S+)/i);
    if (towerMatch && !result.tower) result.tower = towerMatch[1];

    const buildingMatch = line.match(/^(.+?)\s+building$/i);
    if (buildingMatch && !result.building) result.building = buildingMatch[1];

    const floorMatch = line.match(/(\d+)(?:st|nd|rd|th)\s*floor/i);
    if (floorMatch && !result.floor) result.floor = floorMatch[1];

    const areaMatch = line.match(/([\d.]+)\s*(?:sq\.?\s*m\.?|sqm|square meters?)/i);
    if (areaMatch && !result.floor_area) result.floor_area = areaMatch[1];

    const termsMatch = line.match(/\b(\d+\s*\+\s*\d+)\b/);
    if (termsMatch && !result.payment_terms) result.payment_terms = termsMatch[1].replace(/\s+/g, '');

    const priceMatch = line.match(/₱\s*([\d,]+)|(?:^|\s)([\d,]{4,})\s*(?:\/month|\/mo)?$/);
    if (priceMatch && !result.monthly_rent && !result.selling_price) {
      const num = parseNumber(priceMatch[1] ?? priceMatch[2] ?? '');
      if (num) result.monthly_rent = num;
    }

    if (/for sale|selling/i.test(line)) result.listing_type = 'SALE';

    if (!result.unit_number && /^[0-9]{1,3}[a-z]?$/i.test(line) && line.length <= 5) {
      result.unit_number = line;
    }
  }

  return result;
}

function isLikelyFieldValue(line: string): boolean {
  return (
    /bedroom|balcony|floor|tower|furnished|sqm|square meter|₱|\d+\s*\+\s*\d+|for sale|for rent/i.test(line) ||
    /^[0-9]{1,3}[a-z]?$/i.test(line)
  );
}

function applyBedroomHint(value: string, result: ParsedListingFields) {
  if (result.bedrooms !== undefined) return;
  const digitMatch = value.match(/(\d+)\s*(?:BR|Bedroom)/i);
  if (digitMatch) {
    result.bedrooms = digitMatch[1];
    return;
  }
  const lower = value.toLowerCase();
  for (const [word, digit] of Object.entries(WORD_NUMBERS)) {
    if (lower.includes(word)) {
      result.bedrooms = digit;
      return;
    }
  }
}

function applyFurnishingHint(value: string, result: ParsedListingFields) {
  if (result.furnishing) return;
  if (/fully\s*furnished/i.test(value)) result.furnishing = 'FULLY_FURNISHED';
  else if (/semi[\s-]?furnished|basic\s*furnished/i.test(value)) result.furnishing = 'SEMI_FURNISHED';
  else if (/unfurnished|bare/i.test(value)) result.furnishing = 'UNFURNISHED';
}
