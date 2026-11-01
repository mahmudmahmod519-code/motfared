'use client';

import React, { useState } from 'react';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, statusLabels, statusColors } from '@/lib/utils';
import type { Company } from '@/types';
import { Eye, Edit } from 'lucide-react';
import Link from 'next/link';

interface CompanyListProps {
  companies: Company[];
  loading?: boolean;
  onEdit?: (company: Company) => void;
}

export function CompanyList({ companies, loading, onEdit }: CompanyListProps) {
  const columns = [
    {
      key: 'name' as keyof Company,
      header: 'اسم الشركة',
      render: (value: unknown, row: Company) => (
        <div>
          <p className="font-medium text-gray-900">{String(value)}</p>
          {row.domain && <p className="text-xs text-gray-500">{row.domain}</p>}
        </div>
      ),
    },
    {
      key: 'subscriptionStatus' as keyof Company,
      header: 'حالة الاشتراك',
      render: (value: unknown) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[String(value)] || 'bg-gray-100 text-gray-800'}`}>
          {statusLabels[String(value)] || String(value)}
        </span>
      ),
    },
    {
      key: 'isActive' as keyof Company,
      header: 'الحالة',
      render: (value: unknown) => (
        <Badge variant={value ? 'success' : 'danger'}>
          {value ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'createdAt' as keyof Company,
      header: 'تاريخ الإنشاء',
      render: (value: unknown) => formatDate(String(value)),
    },
    {
      key: 'id' as keyof Company,
      header: 'الإجراءات',
      render: (_: unknown, row: Company) => (
        <div className="flex items-center gap-2">
          <Link href={`/companies/${row.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      data={companies as unknown as Record<string, unknown>[]}
      columns={columns as Parameters<typeof Table>[0]['columns']}
      loading={loading}
      emptyMessage="لا توجد شركات مسجلة"
    />
  );
}
