import { getPriceBook } from "@/lib/prices";

export async function GET() {
  const book = await getPriceBook();
  return Response.json(book, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    },
  });
}
