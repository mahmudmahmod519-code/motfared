'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadsApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Target, RefreshCw } from 'lucide-react';
import type { LeadSource } from '@/types';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [lead, setLead] = useState<LeadSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      leadsApi
        .getById(id)
        .then((res) => setLead(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) return <div className="p-6">جاري التحميل...</div>;
  if (!lead) return <div className="p-6">الحملة غير موجودة</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{lead.name}</h1>
        <Badge variant={lead.is_active ? 'success' : 'default'}>{lead.is_active ? 'نشط' : 'متوقف'}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary-600" />
            معلومات المصدر
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>نوع المصدر:</strong> {lead.source_type}</p>
            <p><strong>معرّف Google Sheet:</strong> {lead.google_sheet_id || 'غير مربوط'}</p>
            <p><strong>اسم التبويب:</strong> {lead.google_sheet_tab || 'الأول'}</p>
            <p><strong>ملاحظات:</strong> {lead.notes || 'لا يوجد'}</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary-600" />
            المزامنة والجهات المستلمة
          </h2>
          <p className="text-sm text-gray-500">
            عدد جهات الاتصال المرتبطة: <strong className="text-gray-900">{lead.lead_contacts?.length || 0}</strong>
          </p>
        </Card>
      </div>
    </div>
  );
}
