import { notFound, redirect } from "next/navigation";
import listingsData from "../../../data/listings.json";

type Listing = { id: string; slug: string };

function getAllListings(): Listing[] {
  return listingsData as Listing[];
}
function getById(id: string) {
  return getAllListings().find((l) => l.id === id);
}

export default function OldIdRedirectPage({ params }: { params: { id: string } }) {
  const listing = getById(params.id);
  if (!listing) notFound();
  redirect(`/listing/${listing.slug}`);
}
