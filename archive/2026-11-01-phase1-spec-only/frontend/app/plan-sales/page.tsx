'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { planSalesApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, CheckSquare, Users, PhoneCall } from 'lucide-react';
import type { PlanSale } from '@/types';

export default function PlanSalesPage() {
  const [plans, setPlans] = useState<PlanSale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    planSalesApi
      .getAll()
      .then((res) => setPlans(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مهام وخطط الاتصال (Plan Sales)</h1>
          <p className="text-sm text-gray-500 mt-1">توزيع حملات العملاء على ممثلي خدمة العملاء مع تحديد الحصص</p>
        </div>
      </div>

      {loading ? (
        <div>جاري التحميل...</div>
      ) : plans.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <CheckSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>لا توجد مهام أو خطط اتصال مسجلة حالياً</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <Card key={p.id} className="p-6 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{p.info || p.description || 'بدون وصف'}</p>
                </div>
                <Badge variant={p.status === 'active' ? 'success' : 'warning'}>{p.status}</Badge>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <PhoneCall className="w-4 h-4 text-primary-600" />
                  حد المكالمات: {p.limit_calls ?? 'غير محدود'}
                </span>
                <Link
                  href={`/plan-sales/${p.id}`}
                  className="text-primary-600 font-semibold text-xs hover:underline"
                >
                  التفاصيل والتعيينات ←
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
