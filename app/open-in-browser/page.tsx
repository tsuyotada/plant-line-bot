import { OpenInBrowserClient } from "./OpenInBrowserClient";

export default async function OpenInBrowserPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextUrl = params.next ?? "/login";
  return <OpenInBrowserClient nextUrl={nextUrl} />;
}
