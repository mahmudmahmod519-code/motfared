'use client';

import React, { useEffect, useState } from 'react';
import { companiesApi } from '@/lib/api';
import { CompanyList } from '@/components/companies/company-list';
import { CompanyForm } from '@/components/companies/company-form';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Plus } from 'lucide-react';
import type { Company } from '@/types';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const res = await companiesApi.getAll();
      setCompanies(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleCreateOrUpdate = async (data: Record<string, unknown>) => {
    try {
      if (selectedCompany) {
        await companiesApi.update(selectedCompany.id, data);
      } else {
        await companiesApi.create(data);
      }
      setIsModalOpen(false);
      setSelectedCompany(null);
      fetchCompanies();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة الشركات</h1>
          <p className="text-sm text-gray-500 mt-1">عرض وإدارة جميع الشركات المشتركة في المنصة</p>
        </div>
        <Button
          onClick={() => {
            setSelectedCompany(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة شركة جديدة
        </Button>
      </div>

      <CompanyList
        companies={companies}
        loading={loading}
        onEdit={(company) => {
          setSelectedCompany(company);
          setIsModalOpen(true);
        }}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCompany(null);
        }}
        title={selectedCompany ? 'تعديل بيانات الشركة' : 'إضافة شركة جديدة'}
      >
        <CompanyForm
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedCompany(null);
            fetchCompanies();
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedCompany(null);
          }}
        />
      </Modal>
    </div>
  );
}
