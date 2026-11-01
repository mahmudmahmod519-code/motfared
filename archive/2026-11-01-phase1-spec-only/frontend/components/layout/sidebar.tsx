'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  Users,
  Target,
  Contact,
  CheckSquare,
  Phone,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'لوحة التحكم',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo', 'crm_manager', 'call_center'],
  },
  {
    href: '/companies',
    label: 'الشركات',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['platform_admin'],
  },
  {
    href: '/users',
    label: 'المستخدمون',
    icon: <Users className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo'],
  },
  {
    href: '/leads',
    label: 'مصادر العملاء',
    icon: <Target className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo', 'crm_manager'],
  },
  {
    href: '/contacts',
    label: 'جهات الاتصال',
    icon: <Contact className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo', 'crm_manager', 'call_center'],
  },
  {
    href: '/plan-sales',
    label: 'خطط المبيعات',
    icon: <CheckSquare className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo', 'crm_manager'],
  },
  {
    href: '/calls',
    label: 'سجل المكالمات',
    icon: <Phone className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo', 'crm_manager', 'call_center'],
  },
  {
    href: '/subscriptions',
    label: 'الاشتراكات',
    icon: <CreditCard className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo'],
  },
  {
    href: '/services',
    label: 'الخدمات',
    icon: <Settings className="h-5 w-5" />,
    roles: ['platform_admin', 'ceo'],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const userRole = user?.role as UserRole;
  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-20 lg:hidden',
          collapsed ? 'hidden' : 'block'
        )}
        onClick={() => setCollapsed(true)}
      />

      <aside
        className={cn(
          'fixed right-0 top-0 h-full bg-gray-900 text-white z-30',
          'flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo / Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="font-bold text-lg">CRM نظام</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {collapsed ? (
              <Menu className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
                  'hover:bg-gray-700',
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-300',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info + Logout */}
        <div className="border-t border-gray-700 p-4">
          {!collapsed && user && (
            <div className="mb-3">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={logout}
            className={cn(
              'flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors text-sm w-full',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
