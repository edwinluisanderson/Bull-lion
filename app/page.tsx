import { SlotMachine } from "@/components/slot-machine";
import { getPriceBook } from "@/lib/prices";

export default async function Home() {
  const book = await getPriceBook();
  return <SlotMachine initialBook={book} />;
}
