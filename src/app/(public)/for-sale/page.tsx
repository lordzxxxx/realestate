import { PropertyListingPage } from '@/components/public/property-listing-page';

export default async function ForSalePage(props: PageProps<'/for-sale'>) {
  const searchParams = await props.searchParams;
  return <PropertyListingPage title="For Sale" action="/for-sale" forcedType="SALE" searchParams={searchParams} />;
}
