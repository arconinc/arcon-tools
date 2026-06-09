export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="py-16 text-center text-red-600">
      <p>{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
          Retry
        </button>
      )}
    </div>
  )
}
