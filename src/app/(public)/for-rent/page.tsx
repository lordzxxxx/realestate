import { PropertyListingPage } from '@/components/public/property-listing-page';

export default async function ForRentPage(props: PageProps<'/for-rent'>) {
  const searchParams = await props.searchParams;
  return <PropertyListingPage title="For Rent" action="/for-rent" forcedType="RENT" searchParams={searchParams} />;
}
