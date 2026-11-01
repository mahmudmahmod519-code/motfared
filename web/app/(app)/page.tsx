import { PagePlaceholder } from '../../components/shell/PagePlaceholder';
import { NAV } from '../../lib/nav';

export default function OverviewPage() {
  return <PagePlaceholder title={NAV[0].label} />;
}
