'use client';

import React, { useEffect, useState } from 'react';
import { contactsApi } from '@/lib/api';
import { ContactList } from '@/components/contacts/contact-list';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import type { LeadContact } from '@/types';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<LeadContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<LeadContact | null>(null);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await contactsApi.getAll();
      setContacts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل العملاء المحتملين</h1>
          <p className="text-sm text-gray-500 mt-1">عرض جميع الأشخاص وجهات الاتصال المسجلة في النظام</p>
        </div>
      </div>

      <ContactList
        contacts={contacts}
        loading={loading}
        onCall={(contact) => {
          window.location.href = `/mobile/call/${contact.id}`;
        }}
      />
    </div>
  );
}
