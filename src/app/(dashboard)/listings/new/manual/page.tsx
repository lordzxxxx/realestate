import { createClient } from '@/lib/supabase/server';
import { ListingForm } from '../../listing-form';

export default async function NewListingManualPage() {
  const supabase = await createClient();
  const { data: amenities } = await supabase.from('amenities').select('*').order('label');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">New Property</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <ListingForm amenities={amenities ?? []} />
      </div>
    </div>
  );
}
