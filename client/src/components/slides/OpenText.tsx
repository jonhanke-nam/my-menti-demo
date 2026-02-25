interface Props {
  prompt: string;
  counts: Record<string, number>;
}

export default function OpenText({ prompt, counts }: Props) {
  const entries = Object.entries(counts);
  const totalVotes = entries.length;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-bold text-center text-white mb-2">{prompt}</h2>
      <p className="text-gray-400 text-center mb-6">
        {totalVotes} response{totalVotes !== 1 ? "s" : ""}
      </p>
      <div className="bg-gray-800 rounded-2xl p-6">
        {entries.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No responses yet</p>
        ) : (
          <div className="max-h-96 overflow-y-auto space-y-3">
            {entries.map(([text, count]) => (
              <div
                key={text}
                className="bg-gray-700 rounded-lg px-5 py-3 text-gray-200 flex items-center justify-between"
              >
                <span>{text}</span>
                {count > 1 && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full ml-3">
                    x{count}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
