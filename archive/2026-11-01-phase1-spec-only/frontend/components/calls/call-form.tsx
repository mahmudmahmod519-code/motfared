'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { callsApi } from '@/lib/api';
import type { LeadContact } from '@/types';

const callSchema = z.object({
  outcome: z.enum(['answered', 'not_answered', 'busy', 'voicemail', 'interested', 'not_interested']),
  notes: z.string().optional(),
  duration: z.coerce.number().optional(),
});

type CallFormData = z.infer<typeof callSchema>;

const outcomeOptions = [
  { value: 'answered', label: 'تم الرد' },
  { value: 'not_answered', label: 'لم يرد' },
  { value: 'busy', label: 'مشغول' },
  { value: 'voicemail', label: 'بريد صوتي' },
  { value: 'interested', label: 'مهتم' },
  { value: 'not_interested', label: 'غير مهتم' },
];

interface CallFormProps {
  contact: LeadContact;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CallForm({ contact, onSuccess, onCancel }: CallFormProps) {
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CallFormData>({
    resolver: zodResolver(callSchema),
    defaultValues: { outcome: 'answered' },
  });

  const onSubmit = async (data: CallFormData) => {
    setError('');
    try {
      await callsApi.create({
        contactId: contact.id,
        outcome: data.outcome,
        notes: data.notes,
        duration: data.duration,
      });
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <div dir="rtl">
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="font-medium text-gray-900">{contact.name}</p>
        <p className="text-sm text-gray-500 ltr">{contact.phone}</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Select
          label="نتيجة المكالمة"
          options={outcomeOptions}
          error={errors.outcome?.message}
          {...register('outcome')}
        />
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 mb-1">المدة (بالثواني)</label>
          <input
            type="number"
            min={0}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            {...register('duration')}
          />
        </div>
        <Textarea
          label="ملاحظات"
          placeholder="اكتب ملاحظاتك هنا..."
          {...register('notes')}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              إلغاء
            </Button>
          )}
          <Button type="submit" loading={isSubmitting}>
            حفظ المكالمة
          </Button>
        </div>
      </form>
    </div>
  );
}
