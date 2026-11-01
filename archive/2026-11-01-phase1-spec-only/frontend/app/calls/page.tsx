'use client';

import React, { useEffect, useState } from 'react';
import { callsApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import { Phone, Clock, User, CheckCircle2 } from 'lucide-react';
import type { Call } from '@/types';

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    callsApi
      .getAll()
      .then((res) => setCalls(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      key: 'lead_contact' as keyof Call,
      header: 'العميل',
      render: (_: unknown, row: Call) => (
        <div>
          <p className="font-semibold text-gray-900">{row.lead_contact?.name || 'غير معروف'}</p>
          <p className="text-xs text-gray-500 ltr">{row.lead_contact?.phone}</p>
        </div>
      ),
    },
    {
      key: 'call_center_user' as keyof Call,
      header: 'المتصل',
      render: (_: unknown, row: Call) => row.call_center_user?.name || 'مجهول',
    },
    {
      key: 'outcome' as keyof Call,
      header: 'النتيجة الفنية',
      render: (val: unknown) => (
        <Badge variant={val === 'answered' ? 'success' : 'default'}>{String(val)}</Badge>
      ),
    },
    {
      key: 'customer_decision' as keyof Call,
      header: 'قرار العميل',
      render: (val: unknown) => (val ? <Badge variant="info">{String(val)}</Badge> : '-'),
    },
    {
      key: 'duration_seconds' as keyof Call,
      header: 'المدة (ثواني)',
      render: (val: unknown) => `${val || 0} ثانية`,
    },
    {
      key: 'called_at' as keyof Call,
      header: 'وقت المكالمة',
      render: (val: unknown) => (val ? new Date(String(val)).toLocaleString('ar-EG') : '-'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">سجل المكالمات</h1>
        <p className="text-sm text-gray-500 mt-1">سجل تفصيلي لجميع المكالمات التي تمت ونتائجها</p>
      </div>

      <Table<Call> columns={columns} data={calls} loading={loading} />
    </div>
  );
}
