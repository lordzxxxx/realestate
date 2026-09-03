'use client';

import { useState } from 'react';
import { parsePropertyText, type ParsedListingFields } from '@/lib/listings/paste-parser';
import { Button } from '@/components/ui/button';
import { ListingForm } from '../../listing-form';
import type { Database } from '@/types/database';
import type { ListingInput } from '@/lib/listings/schemas';

type Amenity = Database['public']['Tables']['amenities']['Row'];

export function PastePropertyClient({ amenities }: { amenities: Amenity[] }) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedListingFields | null>(null);

  const extract = () => {
    setParsed(parsePropertyText(text));
  };

  if (parsed) {
    const filledCount = Object.values(parsed).filter((v) => v !== undefined).length;
    const defaultValues: Partial<ListingInput> = {
      property_name: parsed.property_name,
      bedrooms: parsed.bedrooms,
      has_balcony: parsed.has_balcony ?? false,
      monthly_rent: parsed.monthly_rent,
      selling_price: parsed.selling_price,
      floor: parsed.floor,
      tower: parsed.tower,
      building: parsed.building,
      unit_number: parsed.unit_number,
      furnishing: parsed.furnishing,
      payment_terms: parsed.payment_terms,
      floor_area: parsed.floor_area,
      listing_type: parsed.listing_type ?? 'RENT',
    };

    return (
      <div>
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Extracted {filledCount} field{filledCount === 1 ? '' : 's'} from your text. Review and correct
          everything below before saving — nothing is published automatically from a paste.
        </div>
        <div className="mb-4">
          <Button size="sm" variant="secondary" onClick={() => setParsed(null)}>
            ← Back to paste
          </Button>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <ListingForm amenities={amenities} defaultValues={defaultValues} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <label htmlFor="paste-text" className="mb-1.5 block text-sm font-medium text-slate-700">
        Paste property details
      </label>
      <textarea
        id="paste-text"
        rows={12}
        placeholder={
          'SIX SENSES\n2 Bedroom\n₱35,000\n46 sqm\nTower 3\n18B\nSemi Furnished\n1+2'
        }
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mb-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      />
      <Button onClick={extract} disabled={text.trim().length === 0}>
        Extract Details
      </Button>
    </div>
  );
}
