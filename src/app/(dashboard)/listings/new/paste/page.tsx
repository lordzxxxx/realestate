import { createClient } from '@/lib/supabase/server';
import { PastePropertyClient } from './paste-property-client';

export default async function NewListingPastePage() {
  const supabase = await createClient();
  const { data: amenities } = await supabase.from('amenities').select('*').order('label');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Paste Property Details</h1>
      <PastePropertyClient amenities={amenities ?? []} />
    </div>
  );
}
