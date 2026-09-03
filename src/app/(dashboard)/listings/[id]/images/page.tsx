import { createClient } from '@/lib/supabase/server';
import { ImageManager, type ImageRecord } from './image-manager';

export default async function ListingImagesPage(props: PageProps<'/listings/[id]/images'>) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: images } = await supabase
    .from('listing_images')
    .select('*')
    .eq('listing_id', id)
    .order('sort_order');

  const initialImages: ImageRecord[] = (images ?? []).map((img) => ({
    id: img.id,
    storage_path: img.storage_path,
    sort_order: img.sort_order,
    is_cover: img.is_cover,
    alt_text: img.alt_text,
    caption: img.caption,
    url: supabase.storage.from('listing-images').getPublicUrl(img.storage_path).data.publicUrl,
  }));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <ImageManager listingId={id} initialImages={initialImages} />
    </div>
  );
}
