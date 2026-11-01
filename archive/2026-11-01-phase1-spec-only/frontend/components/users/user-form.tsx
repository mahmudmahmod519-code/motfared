'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usersApi } from '@/lib/api';

const userSchema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').optional(),
  role: z.enum(['platform_admin', 'ceo', 'crm_manager', 'call_center']),
});

type UserFormData = z.infer<typeof userSchema>;

const roleOptions = [
  { value: 'ceo', label: 'المدير التنفيذي' },
  { value: 'crm_manager', label: 'مدير CRM' },
  { value: 'call_center', label: 'موظف الاتصالات' },
];

interface UserFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  isAdmin?: boolean;
}

export function UserForm({ onSuccess, onCancel, isAdmin }: UserFormProps) {
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { role: 'call_center' },
  });

  const onSubmit = async (data: UserFormData) => {
    setError('');
    try {
      await usersApi.create(data);
      onSuccess?.();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'حدث خطأ أثناء الحفظ');
    }
  };

  const options = isAdmin
    ? [{ value: 'platform_admin', label: 'مدير المنصة' }, ...roleOptions]
    : roleOptions;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir="rtl">
      <Input
        label="الاسم الكامل"
        placeholder="محمد أحمد"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="البريد الإلكتروني"
        type="email"
        placeholder="user@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="كلمة المرور"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Select
        label="الدور"
        options={options}
        error={errors.role?.message}
        {...register('role')}
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
