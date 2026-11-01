'use client';

import React, { useEffect, useState } from 'react';
import { servicesApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Plus } from 'lucide-react';
import type { Service } from '@/types';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    servicesApi
      .getAll()
      .then((res) => setServices(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">كتالوج الخدمات والمنتجات</h1>
          <p className="text-sm text-gray-500 mt-1">الخدمات أو المنتجات التي تقدمها الشركة لعملائها</p>
        </div>
      </div>

      {loading ? (
        <div>جاري التحميل...</div>
      ) : services.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p>لم يتم تسجيل خدمات حتى الآن</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((s) => (
            <Card key={s.id} className="p-6 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-gray-900">{s.name}</h3>
                <Badge variant={s.status === 'active' ? 'success' : 'default'}>{s.status}</Badge>
              </div>
              <p className="text-sm text-gray-500">{s.description || 'لا يوجد وصف'}</p>
              <div className="pt-2 text-lg font-bold text-primary-600">
                {s.price} {s.currency}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
