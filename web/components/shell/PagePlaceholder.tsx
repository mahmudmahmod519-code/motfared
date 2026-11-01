/** What a page shows until it is built: the original's empty-state card, so the shell can be checked on its own. */
export function PagePlaceholder({ title }: { title: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      الصفحة دي لسه مش جاهزة.
    </div>
  );
}
