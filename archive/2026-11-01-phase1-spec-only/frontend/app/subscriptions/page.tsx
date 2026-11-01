'use client';

import React, { useEffect, useState } from 'react';
import { subscriptionsApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Subscription } from '@/types';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionsApi
      .getAll()
      .then((res) => setSubscriptions(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الاشتراكات والفواتير (Billing)</h1>
        <p className="text-sm text-gray-500 mt-1">إدارة باقات الاشتراك، التجديد التلقائي عبر Stripe و Paymob</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-2 border-primary-600 relative overflow-hidden">
          <div className="absolute top-0 left-0 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-br-lg">
            الباقة الحالية
          </div>
          <h3 className="text-xl font-bold text-gray-900 mt-2">Pro Business</h3>
          <p className="text-sm text-gray-500 mt-1">للمؤسسات والشركات المتوسطة</p>
          <div className="my-4">
            <span className="text-3xl font-extrabold text-gray-900">299</span>
            <span className="text-gray-500 mr-2">EGP / شهرياً</span>
          </div>
          <ul className="space-y-2 text-sm text-gray-600 mb-6">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> حتى 20 مستخدم مركز اتصال
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> 10 حملات ومصادر ربط Google Sheets
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> 10,000 جهة اتصال شهرياً
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> دعم فني متواصل وإحصائيات متقدمة
            </li>
          </ul>
          <Button className="w-full">إدارة الاشتراك</Button>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600" />
          سجل الاشتراكات للشركة
        </h2>
        {subscriptions.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد اشتراكات مسجلة</p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s) => (
              <div key={s.id} className="p-4 bg-gray-50 rounded-xl flex items-center justify-between border border-gray-100">
                <div>
                  <p className="font-semibold text-gray-800">
                    {s.plan_price?.plan?.name || 'Pro Business Plan'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    بدأ في: {new Date(s.starts_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <Badge variant={s.status === 'active' ? 'success' : 'warning'}>{s.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
