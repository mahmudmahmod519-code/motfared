'use client';

import React from 'react';
import { Table } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatDate, statusLabels, statusColors } from '@/lib/utils';
import type { LeadContact } from '@/types';
import { Phone, Edit } from 'lucide-react';

interface ContactListProps {
  contacts: LeadContact[];
  loading?: boolean;
  onCall?: (contact: LeadContact) => void;
  onEdit?: (contact: LeadContact) => void;
}

export function ContactList({ contacts, loading, onCall, onEdit }: ContactListProps) {
  const columns = [
    {
      key: 'name' as keyof LeadContact,
      header: 'الاسم',
      render: (value: unknown, row: LeadContact) => (
        <div>
          <p className="font-medium">{String(value)}</p>
          <p className="text-xs text-gray-500 ltr">{row.phone}</p>
        </div>
      ),
    },
    {
      key: 'leadSource' as keyof LeadContact,
      header: 'المصدر',
      render: (value: unknown, row: LeadContact) =>
        row.leadSource?.name || '-',
    },
    {
      key: 'status' as keyof LeadContact,
      header: 'الحالة',
      render: (value: unknown) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[String(value)] || 'bg-gray-100 text-gray-800'}`}>
          {statusLabels[String(value)] || String(value)}
        </span>
      ),
    },
    {
      key: 'assignedUser' as keyof LeadContact,
      header: 'المسؤول',
      render: (value: unknown, row: LeadContact) =>
        row.assignedUser?.name || 'غير محدد',
    },
    {
      key: 'createdAt' as keyof LeadContact,
      header: 'التاريخ',
      render: (value: unknown) => formatDate(String(value)),
    },
    {
      key: 'id' as keyof LeadContact,
      header: 'الإجراءات',
      render: (_: unknown, row: LeadContact) => (
        <div className="flex items-center gap-2">
          {onCall && (
            <Button variant="ghost" size="sm" onClick={() => onCall(row)}>
              <Phone className="h-4 w-4 text-green-600" />
            </Button>
          )}
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
      data={contacts as unknown as Record<string, unknown>[]}
      columns={columns as Parameters<typeof Table>[0]['columns']}
      loading={loading}
      emptyMessage="لا توجد جهات اتصال"
    />
  );
}
