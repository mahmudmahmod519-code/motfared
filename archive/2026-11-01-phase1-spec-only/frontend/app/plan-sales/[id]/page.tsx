'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { planSalesApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckSquare, Users, Phone } from 'lucide-react';
import type { PlanSale } from '@/types';

export default function PlanSaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [plan, setPlan] = useState<PlanSale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      planSalesApi
        .getById(id)
        .then((res) => setPlan(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-6">جاري التحميل...</div>;
  if (!plan) return <div className="p-6">المهمة غير موجودة</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
        <Badge variant={plan.status === 'active' ? 'success' : 'warning'}>{plan.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary-600" />
            بيانات الخطة
          </h2>
          <p className="text-sm text-gray-600"><strong>الوصف:</strong> {plan.description || plan.info || 'لا يوجد'}</p>
          <p className="text-sm text-gray-600"><strong>الحد الأساسي للمكالمات:</strong> {plan.limit_calls ?? 'غير محدد'}</p>
          <p className="text-sm text-gray-600"><strong>حد المكالمات الإضافية (Bonus):</strong> {plan.limit_bonus_calls ?? 'لا يوجد'}</p>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            المسؤولون والحملات المرتبطة
          </h2>
          <p className="text-sm text-gray-500">
            عدد الحملات المربوطة بالخطة: {plan.lead_items?.length || 0}
          </p>
        </Card>
      </div>
    </div>
  );
}
