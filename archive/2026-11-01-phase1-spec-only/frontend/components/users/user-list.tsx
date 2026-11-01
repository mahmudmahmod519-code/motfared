'use client';

import React from 'react';
import { Table } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, roleLabels } from '@/lib/utils';
import type { User } from '@/types';
import { Edit, Trash2 } from 'lucide-react';

interface UserListProps {
  users: User[];
  loading?: boolean;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
}

export function UserList({ users, loading, onEdit, onDelete }: UserListProps) {
  const columns = [
    {
      key: 'name' as keyof User,
      header: 'الاسم',
      render: (value: unknown, row: User) => (
        <div>
          <p className="font-medium">{String(value)}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: 'role' as keyof User,
      header: 'الدور',
      render: (value: unknown) => roleLabels[String(value)] || String(value),
    },
    {
      key: 'isActive' as keyof User,
      header: 'الحالة',
      render: (value: unknown) => (
        <Badge variant={value ? 'success' : 'danger'}>
          {value ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'createdAt' as keyof User,
      header: 'تاريخ الانضمام',
      render: (value: unknown) => formatDate(String(value)),
    },
    {
      key: 'id' as keyof User,
      header: 'الإجراءات',
      render: (_: unknown, row: User) => (
        <div className="flex items-center gap-2">
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
      data={users as unknown as Record<string, unknown>[]}
      columns={columns as Parameters<typeof Table>[0]['columns']}
      loading={loading}
      emptyMessage="لا يوجد مستخدمون"
    />
  );
}
