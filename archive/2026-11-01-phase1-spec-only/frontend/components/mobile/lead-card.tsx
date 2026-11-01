'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, Clock, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { LeadContact } from '@/types';

interface LeadCardProps {
  contact: LeadContact;
  onCall?: (contact: LeadContact) => void;
}

export function LeadCard({ contact, onCall }: LeadCardProps) {
  const getBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'danger' | 'info' => {
    switch (status) {
      case 'new':
        return 'info';
      case 'in_progress':
        return 'warning';
      case 'converted':
        return 'success';
      case 'rejected':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            {contact.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
            <Phone className="w-4 h-4" />
            {contact.phone}
          </p>
          {contact.lead && (
            <p className="text-xs text-primary-600 font-medium mt-1">
              الحملة: {contact.lead.name}
            </p>
          )}
        </div>
        <Badge variant={getBadgeVariant(contact.status)}>
          {contact.status}
        </Badge>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {contact.created_at ? new Date(contact.created_at).toLocaleDateString('ar-EG') : 'اليوم'}
        </span>
        <Link
          href={`/mobile/call/${contact.id}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
        >
          <Phone className="w-4 h-4" />
          بدء المكالمة
        </Link>
      </div>
    </Card>
  );
}
