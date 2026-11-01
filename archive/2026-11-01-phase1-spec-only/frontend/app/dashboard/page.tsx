'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { dashboardApi } from '@/lib/api';
import { StatsCard } from '@/components/dashboard/stats-card';
import { Card } from '@/components/ui/card';
import {
  Building2,
  Users,
  CreditCard,
  Target,
  Phone,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import type { DashboardStats } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await dashboardApi.getStats();
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const isPlatformAdmin = user?.platform_role === 'platform_admin';

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">مرحباً بك، {user?.name || 'مستخدم النظام'} 👋</h1>
        <p className="text-primary-100 mt-1">
          {isPlatformAdmin
            ? 'لوحة إدارة المنصة المركزية — مراقبة الشركات والاشتراكات والمدفوعات'
            : 'لوحة التحكم التشغيلية للشركة — متابعة الحملات، المكالمات، وتوزيع المهام'}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isPlatformAdmin ? (
          <>
            <StatsCard
              title="إجمالي الشركات"
              value={stats?.totalCompanies ?? 0}
              icon={<Building2 className="w-6 h-6" />}
              color="blue"
            />
            <StatsCard
              title="إجمالي المستخدمين"
              value={stats?.totalUsers ?? 0}
              icon={<Users className="w-6 h-6" />}
              color="purple"
            />
            <StatsCard
              title="الاشتراكات النشطة"
              value={stats?.activeSubscriptions ?? 0}
              icon={<CreditCard className="w-6 h-6" />}
              color="green"
            />
            <StatsCard
              title="إجمالي الإيرادات"
              value={`${stats?.totalRevenue ?? 0} EGP`}
              icon={<DollarSign className="w-6 h-6" />}
              color="yellow"
            />
          </>
        ) : (
          <>
            <StatsCard
              title="مصادر وحملات العملاء"
              value={stats?.totalLeads ?? 0}
              icon={<Target className="w-6 h-6" />}
              color="blue"
            />
            <StatsCard
              title="جهات الاتصال المستلمة"
              value={stats?.totalContacts ?? 0}
              icon={<Users className="w-6 h-6" />}
              color="purple"
            />
            <StatsCard
              title="إجمالي المكالمات المنفذة"
              value={stats?.totalCalls ?? 0}
              icon={<Phone className="w-6 h-6" />}
              color="yellow"
            />
            <StatsCard
              title="المكالمات الناجحة (تم الرد)"
              value={stats?.answeredCalls ?? 0}
              icon={<CheckCircle2 className="w-6 h-6" />}
              color="green"
            />
          </>
        )}
      </div>

      {/* Additional Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            نظرة سريعة على تدفق العمل
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">1. استيراد العملاء المحتملين</p>
                <p className="text-sm text-gray-500">Google Sheets أو Facebook Ads أو Google Forms</p>
              </div>
              <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-1 rounded-full">تلقائي</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">2. خطط وتوزيع المبيعات (Plan Sales)</p>
                <p className="text-sm text-gray-500">توزيع العملاء على مسؤولي الاتصال مع تحديد الحصص</p>
              </div>
              <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2.5 py-1 rounded-full">ذكي</span>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">3. تنفيذ المكالمات وتسجيل النتائج</p>
                <p className="text-sm text-gray-500">من تطبيق الجوال أو الويب وتسجيل القرار والملاحظات</p>
              </div>
              <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">فوري</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            حالة النظام والربط البرمجي
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">قاعدة البيانات (MySQL + TypeORM)</span>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">متصل</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">بوابة الدفع الإلكتروني (Stripe)</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">جاهز</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">بوابة الدفع المحلي (Paymob)</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">جاهز</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">مزامنة Google Sheets API</span>
              <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">نشط</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600">عزل الشركات المتعددة (Multi-Tenancy)</span>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">مفعل</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
