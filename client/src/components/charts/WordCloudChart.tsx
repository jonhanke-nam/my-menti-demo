const COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#F97316", "#06B6D4", "#EF4444",
];

interface Props {
  counts: Record<string, number>;
}

export default function WordCloudChart({ counts }: Props) {
  const entries = Object.entries(counts);

  if (entries.length === 0) {
    return <p className="text-gray-400 text-center py-8">No responses yet</p>;
  }

  const maxCount = Math.max(...entries.map(([, v]) => v));
  // Shuffle for a more organic look
  const shuffled = [...entries].sort(() => Math.random() - 0.5);

  return (
    <div className="flex flex-wrap gap-4 justify-center items-center py-8 min-h-[200px]">
      {shuffled.map(([word, count], i) => {
        const scale = 1 + (count / maxCount) * 2.5;
        const color = COLORS[i % COLORS.length];
        return (
          <span
            key={word}
            className="font-bold transition-all duration-300"
            style={{
              fontSize: `${scale}rem`,
              color,
              opacity: 0.7 + (count / maxCount) * 0.3,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
