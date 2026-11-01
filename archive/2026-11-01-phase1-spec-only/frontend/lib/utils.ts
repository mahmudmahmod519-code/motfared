import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const roleLabels: Record<string, string> = {
  platform_admin: 'مدير المنصة',
  ceo: 'المدير التنفيذي',
  crm_manager: 'مدير CRM',
  call_center: 'موظف الاتصالات',
};

export const statusLabels: Record<string, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
  trial: 'تجريبي',
  expired: 'منتهي',
  cancelled: 'ملغى',
  new: 'جديد',
  contacted: 'تم التواصل',
  interested: 'مهتم',
  not_interested: 'غير مهتم',
  converted: 'تم التحويل',
  pending: 'معلق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  answered: 'تم الرد',
  not_answered: 'لم يرد',
  busy: 'مشغول',
  voicemail: 'بريد صوتي',
  low: 'منخفض',
  medium: 'متوسط',
  high: 'عالي',
};

export const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  trial: 'bg-blue-100 text-blue-800',
  expired: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  interested: 'bg-green-100 text-green-800',
  not_interested: 'bg-red-100 text-red-800',
  converted: 'bg-purple-100 text-purple-800',
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  answered: 'bg-green-100 text-green-800',
  not_answered: 'bg-red-100 text-red-800',
  busy: 'bg-orange-100 text-orange-800',
  voicemail: 'bg-gray-100 text-gray-800',
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
};
