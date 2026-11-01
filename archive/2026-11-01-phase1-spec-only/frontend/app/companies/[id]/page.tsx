'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { companiesApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Building2, Phone, MapPin, Users } from 'lucide-react';
import type { Company } from '@/types';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      companiesApi
        .getById(id)
        .then((res) => setCompany(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return <div className="p-6">جاري التحميل...</div>;
  }

  if (!company) {
    return <div className="p-6">الشركة غير موجودة</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{company.name}</h1>
        <Badge variant={company.status === 'active' ? 'success' : 'warning'}>{company.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            بيانات الشركة
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>مجال العمل:</strong> {company.type_company || 'غير محدد'}</p>
            <p><strong>الوصف:</strong> {company.description || 'لا يوجد'}</p>
            <p><strong>مسمى العميل:</strong> {company.client_label || 'عميل'}</p>
            <p><strong>مسمى مسؤول الاتصال:</strong> {company.call_center_label || 'مركز الاتصال'}</p>
            <p><strong>مسمى مدير المبيعات:</strong> {company.crm_manager_label || 'مدير CRM'}</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary-600" />
            التواصل والموقع
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {company.address || 'العنوان غير مسجل'}</p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> واتساب: {company.phone_whatsapp || 'غير متوفر'}</p>
            <p className="flex items-center gap-2"><Phone className="w-4 h-4" /> أرضي: {company.phone_telephone || 'غير متوفر'}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
