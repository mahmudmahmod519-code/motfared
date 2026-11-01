'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { contactsApi } from '@/lib/api';
import { LeadCard } from '@/components/mobile/lead-card';
import { Phone, CheckCircle2, User, LogOut } from 'lucide-react';
import type { LeadContact } from '@/types';

export default function MobileDashboardPage() {
  const { user, logout } = useAuth();
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contactsApi
      .getAll()
      .then((res) => setContacts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Mobile Top App Bar */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center font-bold">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="font-bold text-sm">{user?.name || 'ممثل الاتصال'}</h1>
            <p className="text-xs text-slate-400">مركز الاتصال والمبيعات</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-medium">العملاء المخصصون لك للاتصال</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{contacts.length}</p>
          </div>
          <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
            <Phone className="w-6 h-6" />
          </div>
        </div>

        <h2 className="font-bold text-slate-900 text-sm mt-6">قائمة جهات الاتصال المطلوبة</h2>

        {loading ? (
          <div className="text-center py-8 text-slate-400">جاري تحميل العملاء...</div>
        ) : contacts.length === 0 ? (
          <div className="bg-white p-8 rounded-xl text-center text-slate-500 border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="font-medium">رائع! لا توجد جهات اتصال معلقة حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <LeadCard key={contact.id} contact={contact} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
