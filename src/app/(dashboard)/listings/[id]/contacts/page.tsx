import { createClient } from '@/lib/supabase/server';
import { ContactList } from './contact-list';

export default async function ListingContactsPage(props: PageProps<'/listings/[id]/contacts'>) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from('listing_contacts')
    .select('*')
    .eq('listing_id', id)
    .order('created_at');

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <ContactList listingId={id} contacts={contacts ?? []} />
    </div>
  );
}
