import WordCloudChart from "../charts/WordCloudChart";

interface Props {
  prompt: string;
  counts: Record<string, number>;
}

export default function WordCloud({ prompt, counts }: Props) {
  const totalVotes = Object.values(counts).reduce((sum, v) => sum + v, 0);

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center text-white mb-2">{prompt}</h2>
      <p className="text-gray-400 text-center mb-6">
        {totalVotes} response{totalVotes !== 1 ? "s" : ""}
      </p>
      <div className="bg-gray-800 rounded-2xl p-6">
        <WordCloudChart counts={counts} />
      </div>
    </div>
  );
}
