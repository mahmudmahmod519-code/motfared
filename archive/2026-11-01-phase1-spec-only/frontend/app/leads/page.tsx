'use client';

import React, { useEffect, useState } from 'react';
import { leadsApi } from '@/lib/api';
import { LeadList } from '@/components/leads/lead-list';
import { LeadForm } from '@/components/leads/lead-form';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Plus } from 'lucide-react';
import type { LeadSource } from '@/types';

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadSource | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await leadsApi.getAll();
      setLeads(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCreateOrUpdate = async (data: Record<string, unknown>) => {
    try {
      if (selectedLead) {
        await leadsApi.update(selectedLead.id, data);
      } else {
        await leadsApi.create(data);
      }
      setIsModalOpen(false);
      setSelectedLead(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (lead: LeadSource) => {
    if (confirm(`هل أنت متأكد من حذف حملة ${lead.name}؟`)) {
      try {
        await leadsApi.delete(lead.id);
        fetchLeads();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مصادر وحملات العملاء</h1>
          <p className="text-sm text-gray-500 mt-1">ربط ومتابعة حملات Google Sheets, Facebook Ads وغيرها</p>
        </div>
        <Button
          onClick={() => {
            setSelectedLead(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة حملة جديدة
        </Button>
      </div>

      <LeadList
        leads={leads}
        loading={loading}
        onEdit={(l) => {
          setSelectedLead(l);
          setIsModalOpen(true);
        }}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedLead(null);
        }}
        title={selectedLead ? 'تعديل بيانات الحملة' : 'إضافة حملة جديدة'}
      >
        <LeadForm
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedLead(null);
            fetchLeads();
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedLead(null);
          }}
        />
      </Modal>
    </div>
  );
}
