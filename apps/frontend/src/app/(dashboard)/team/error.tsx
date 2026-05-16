'use client';

export default function TeamError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-gray-400">{error.message || 'Something went wrong'}</p>
      <button onClick={reset} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Try again</button>
    </div>
  );
}
