'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { contactsApi, callsApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Phone, ArrowRight, User, CheckCircle2, Clock } from 'lucide-react';
import type { LeadContact } from '@/types';

export default function MobileCallScreenPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [contact, setContact] = useState<LeadContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState('answered');
  const [customerDecision, setCustomerDecision] = useState('interested');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      contactsApi
        .getById(id)
        .then((res) => setContact(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact) return;
    try {
      setSubmitting(true);
      await callsApi.create({
        lead_contact_id: contact.id,
        outcome,
        customer_decision: customerDecision,
        duration_seconds: parseInt(duration) || 0,
        notes,
      });
      router.replace('/mobile/dashboard');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center">جاري التحميل...</div>;
  if (!contact) return <div className="p-6 text-center">العميل غير موجود</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Top Header */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-10 flex items-center justify-between shadow-md">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>
        <span className="font-bold text-sm">شاشة إجراء المكالمة</span>
        <div className="w-12"></div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
        {/* Contact Info Card */}
        <Card className="p-6 text-center space-y-4 bg-white shadow-sm border-slate-200">
          <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mx-auto text-2xl font-bold">
            {contact.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{contact.name}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{contact.lead?.name || 'حملة عامة'}</p>
          </div>

          <a
            href={`tel:${contact.phone}`}
            className="inline-flex items-center justify-center gap-3 w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-600/30 transition-all text-lg"
          >
            <Phone className="w-5 h-5 fill-white" />
            اتصال الآن ({contact.phone})
          </a>
        </Card>

        {/* Call Result Form */}
        <Card className="p-6 bg-white shadow-sm border-slate-200">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary-600" />
            تسجيل نتيجة المكالمة
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                النتيجة الفنية للمكالمة
              </label>
              <Select
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                options={[
                  { value: 'answered', label: 'تم الرد بنجاح (Answered)' },
                  { value: 'no_answer', label: 'لم يرد (No Answer)' },
                  { value: 'busy', label: 'مشغول (Busy)' },
                  { value: 'rejected', label: 'مرفوض من البداية (Rejected)' },
                  { value: 'callback_requested', label: 'طلب إعادة الاتصال لاحقاً' },
                  { value: 'wrong_number', label: 'رقم خاطئ' },
                  { value: 'voicemail', label: 'بريد صوتي' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                قرار ورغبة العميل (Decision)
              </label>
              <Select
                value={customerDecision}
                onChange={(e) => setCustomerDecision(e.target.value)}
                options={[
                  { value: 'interested', label: 'مهتم بالخدمة' },
                  { value: 'accepted', label: 'موافق وتم إتمام الاتفاق (Accepted)' },
                  { value: 'rejected', label: 'غير مهتم إطلاقاً (Rejected)' },
                  { value: 'needs_follow_up', label: 'يحتاج متابعة لاحقة' },
                  { value: 'undecided', label: 'متردد وغير محدد' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                مدة المكالمة (بالثواني)
              </label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ملاحظات المكالمة
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تفاصيل الحوار، الموعد المناسب، أو أي تفاصيل أخرى..."
                rows={3}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-3">
              {submitting ? 'جاري الحفظ...' : 'حفظ النتيجة والمتابعة للعميل التالي'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
