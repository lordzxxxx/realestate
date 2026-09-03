import { PropertyListingPage } from '@/components/public/property-listing-page';

export default async function PropertiesPage(props: PageProps<'/properties'>) {
  const searchParams = await props.searchParams;
  return <PropertyListingPage title="Properties" action="/properties" searchParams={searchParams} />;
}
