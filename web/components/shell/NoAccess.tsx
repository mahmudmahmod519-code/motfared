import { ShellFooter } from './ShellFooter';

const COPY: Record<string, { title: string; text: string }> = {
  'no-dashboard': {
    title: 'اللوحة دي للمديرين',
    text: 'حسابك بيشتغل من تطبيق الموبايل. لو محتاج صلاحية على اللوحة كلّم مدير الحسابات.',
  },
  platform: {
    title: 'حساب إدارة المنصة',
    text: 'لوحة الشركة مش خاصة بحساب إدارة المنصة. صفحات المنصة هتتضاف قريب.',
  },
  blocked: {
    title: 'الاشتراك مش شغال',
    text: 'الوصول لبيانات الشركة متوقف دلوقتي. المالك يقدر يجدّد الاشتراك من صفحة الدفع، وبياناتكم كلها محفوظة.',
  },
  error: {
    title: 'السيرفر مش متاح',
    text: 'مقدرناش نتصل بالسيرفر. استنى شوية وحدّث الصفحة.',
  },
};

/** One plain screen in the sign-in card's style, for everyone who cannot use the company dashboard right now. */
export function NoAccess({ kind, name }: { kind: keyof typeof COPY; name?: string }) {
  const c = COPY[kind];
  return (
    <div id="login-view">
      <div className="login-card">
        <h2>{c.title}</h2>
        <p>{name ? `${name} — ${c.text}` : c.text}</p>
        {kind !== 'error' && <div className="foot" style={{ display: 'grid', gap: 6 }}><ShellFooter /></div>}
      </div>
    </div>
  );
}
