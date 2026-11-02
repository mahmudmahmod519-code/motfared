/** The original's empty-state card, for a page that has nothing to show or could not load. */
export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {message}
    </div>
  );
}

export const NO_ACCESS = 'مش مسموح لحسابك يفتح الصفحة دي.';
