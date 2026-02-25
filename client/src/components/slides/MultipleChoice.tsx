import BarChart from "../charts/BarChart";

interface Props {
  prompt: string;
  counts: Record<string, number>;
}

export default function MultipleChoice({ prompt, counts }: Props) {
  const totalVotes = Object.values(counts).reduce((sum, v) => sum + v, 0);

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center text-white mb-2">{prompt}</h2>
      <p className="text-gray-400 text-center mb-6">
        {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
      </p>
      <div className="bg-gray-800 rounded-2xl p-6">
        <BarChart counts={counts} />
      </div>
    </div>
  );
}
