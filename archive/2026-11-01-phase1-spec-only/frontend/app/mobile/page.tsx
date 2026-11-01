'use client';

import { LoginForm } from '@/components/auth/login-form';
import { Card } from '@/components/ui/card';
import { PhoneCall } from 'lucide-react';

export default function MobileLoginPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center px-4 py-8">
      <div className="max-w-sm mx-auto w-full text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white shadow-xl shadow-primary-500/30 mb-4">
          <PhoneCall className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold">بوابة ممثل خدمة العملاء</h1>
        <p className="text-slate-400 text-sm mt-1">تسجيل الدخول لبدء استلام المكالمات والمهام</p>
      </div>

      <div className="max-w-sm mx-auto w-full">
        <Card className="p-6 bg-slate-800 border-slate-700 text-slate-100">
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
