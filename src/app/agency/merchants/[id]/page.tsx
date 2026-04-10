import AgencyOrgDetailPage from "../../orgs/[orgId]/page";

export const dynamic = "force-dynamic";

export default async function AgencyMerchantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  return AgencyOrgDetailPage({
    params: Promise.resolve({ orgId: id }),
    searchParams,
  });
}
