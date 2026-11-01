import { notFound } from 'next/navigation';
import { PagePlaceholder } from '../../../components/shell/PagePlaceholder';
import { NAV } from '../../../lib/nav';

export const dynamicParams = false;

export function generateStaticParams() {
  return NAV.filter((n) => n.id !== 'overview').map((n) => ({ page: n.id }));
}

export default function Page({ params }: { params: { page: string } }) {
  const item = NAV.find((n) => n.id === params.page);
  if (!item) notFound();
  return <PagePlaceholder title={item.label} />;
}
