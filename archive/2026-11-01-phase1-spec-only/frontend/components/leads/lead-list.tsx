'use client';

import React from 'react';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { LeadSource } from '@/types';
import { Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface LeadListProps {
  leads: LeadSource[];
  loading?: boolean;
  onEdit?: (lead: LeadSource) => void;
  onDelete?: (lead: LeadSource) => void;
}

export function LeadList({ leads, loading, onEdit, onDelete }: LeadListProps) {
  const columns = [
    {
      key: 'name' as keyof LeadSource,
      header: 'اسم المصدر',
      render: (value: unknown, row: LeadSource) => (
        <div>
          <p className="font-medium">{String(value)}</p>
          {row.description && <p className="text-xs text-gray-500 truncate max-w-xs">{row.description}</p>}
        </div>
      ),
    },
    {
      key: 'type' as keyof LeadSource,
      header: 'النوع',
    },
    {
      key: 'contactsCount' as keyof LeadSource,
      header: 'عدد العملاء',
      render: (value: unknown) => (
        <span className="font-medium text-primary-600">{String(value ?? 0)}</span>
      ),
    },
    {
      key: 'isActive' as keyof LeadSource,
      header: 'الحالة',
      render: (value: unknown) => (
        <Badge variant={value ? 'success' : 'danger'}>
          {value ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'createdAt' as keyof LeadSource,
      header: 'تاريخ الإنشاء',
      render: (value: unknown) => formatDate(String(value)),
    },
    {
      key: 'id' as keyof LeadSource,
      header: 'الإجراءات',
      render: (_: unknown, row: LeadSource) => (
        <div className="flex items-center gap-2">
          <Link href={`/leads/${row.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          </Link>
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Table
      data={leads as unknown as Record<string, unknown>[]}
      columns={columns as Parameters<typeof Table>[0]['columns']}
      loading={loading}
      emptyMessage="لا توجد مصادر عملاء"
    />
  );
}
