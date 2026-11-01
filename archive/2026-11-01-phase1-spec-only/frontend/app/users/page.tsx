'use client';

import React, { useEffect, useState } from 'react';
import { usersApi } from '@/lib/api';
import { UserList } from '@/components/users/user-list';
import { UserForm } from '@/components/users/user-form';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Plus } from 'lucide-react';
import type { User } from '@/types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usersApi.getAll();
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateOrUpdate = async (data: Record<string, unknown>) => {
    try {
      if (selectedUser) {
        await usersApi.update(selectedUser.id, data);
      } else {
        await usersApi.create(data);
      }
      setIsModalOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (user: User) => {
    if (confirm(`هل أنت متأكد من حذف المستخدم ${user.name}؟`)) {
      try {
        await usersApi.delete(user.id);
        fetchUsers();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة المستخدمين</h1>
          <p className="text-sm text-gray-500 mt-1">إضافة وإدارة أعضاء الفريق ومسؤولي الاتصال</p>
        </div>
        <Button
          onClick={() => {
            setSelectedUser(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          إضافة مستخدم جديد
        </Button>
      </div>

      <UserList
        users={users}
        loading={loading}
        onEdit={(u) => {
          setSelectedUser(u);
          setIsModalOpen(true);
        }}
        onDelete={handleDelete}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedUser(null);
        }}
        title={selectedUser ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
      >
        <UserForm
          onSuccess={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
            fetchUsers();
          }}
          onCancel={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
        />
      </Modal>
    </div>
  );
}
