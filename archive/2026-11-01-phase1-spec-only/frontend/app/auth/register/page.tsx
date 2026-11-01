'use client';

import Link from 'next/link';
import { RegisterForm } from '@/components/auth/register-form';
import { Card } from '@/components/ui/card';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white font-bold text-2xl shadow-lg shadow-primary-500/30 mb-4">
            CRM
          </div>
          <h1 className="text-2xl font-bold text-gray-900">تسجيل شركة جديدة</h1>
          <p className="text-sm text-gray-600 mt-2">ابدأ إدارة وتوزيع عملائك وفريق المبيعات بكل احترافية</p>
        </div>

        <Card className="p-8 shadow-xl border-gray-100 bg-white/90 backdrop-blur">
          <RegisterForm />
          <div className="mt-6 text-center text-sm text-gray-500">
            لديك حساب بالفعل؟{' '}
            <Link href="/auth/login" className="text-primary-600 font-semibold hover:underline">
              تسجيل الدخول
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
