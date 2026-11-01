'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { leadsApi } from '@/lib/api';

const leadSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  type: z.string().min(1, 'النوع مطلوب'),
  description: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function LeadForm({ onSuccess, onCancel }: LeadFormProps) {
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormData>({ resolver: zodResolver(leadSchema) });

  const onSubmit = async (data: LeadFormData) => {
    setError('');
    try {
      await leadsApi.create(data);
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir="rtl">
      <Input
        label="اسم المصدر"
        placeholder="مثلاً: إعلانات جوجل"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="النوع"
        placeholder="مثلاً: رقمي، تلفزيوني"
        error={errors.type?.message}
        {...register('type')}
      />
      <Textarea
        label="الوصف (اختياري)"
        placeholder="وصف مختصر للمصدر..."
        error={errors.description?.message}
        {...register('description')}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          حفظ
        </Button>
      </div>
    </form>
  );
}
