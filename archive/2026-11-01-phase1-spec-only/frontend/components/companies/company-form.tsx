'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { companiesApi } from '@/lib/api';

const companySchema = z.object({
  name: z.string().min(2, 'اسم الشركة يجب أن يكون حرفين على الأقل'),
  domain: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;

interface CompanyFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CompanyForm({ onSuccess, onCancel }: CompanyFormProps) {
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
  });

  const onSubmit = async (data: CompanyForm) => {
    setError('');
    try {
      await companiesApi.create(data);
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir="rtl">
      <Input
        label="اسم الشركة"
        placeholder="شركة المثال"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="النطاق (اختياري)"
        placeholder="example.com"
        error={errors.domain?.message}
        {...register('domain')}
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
