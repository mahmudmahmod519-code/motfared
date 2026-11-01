'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle } from 'lucide-react';

const registerSchema = z.object({
  companyName: z.string().min(2, 'اسم الشركة يجب أن يكون حرفين على الأقل'),
  domain: z.string().optional(),
  adminName: z.string().min(2, 'الاسم يجب أن يكون حرفين على الأقل'),
  adminEmail: z.string().email('البريد الإلكتروني غير صالح'),
  adminPassword: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  confirmPassword: z.string(),
}).refine((d) => d.adminPassword === d.confirmPassword, {
  message: 'كلمتا المرور غير متطابقتين',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setError('');
    try {
      await authApi.register({
        companyName: data.companyName,
        domain: data.domain,
        adminName: data.adminName,
        adminEmail: data.adminEmail,
        adminPassword: data.adminPassword,
      });
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 2000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-8" dir="rtl">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-semibold text-gray-900">تم إنشاء الحساب بنجاح!</p>
        <p className="text-sm text-gray-500">يتم تحويلك لصفحة تسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="اسم الشركة"
          placeholder="شركة المثال"
          error={errors.companyName?.message}
          {...register('companyName')}
        />
        <Input
          label="النطاق (اختياري)"
          placeholder="example.com"
          error={errors.domain?.message}
          {...register('domain')}
        />
      </div>
      <Input
        label="اسمك الكامل"
        placeholder="محمد أحمد"
        error={errors.adminName?.message}
        {...register('adminName')}
      />
      <Input
        label="البريد الإلكتروني"
        type="email"
        placeholder="admin@example.com"
        error={errors.adminEmail?.message}
        {...register('adminEmail')}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="كلمة المرور"
          type="password"
          placeholder="••••••••"
          error={errors.adminPassword?.message}
          {...register('adminPassword')}
        />
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
        إنشاء حساب
      </Button>
    </form>
  );
}
