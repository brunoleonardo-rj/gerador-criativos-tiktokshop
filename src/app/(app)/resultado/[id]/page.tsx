import { ResultPage } from "@/features/results/result-page";

export default async function ResultRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResultPage id={id} />;
}
