"use client";
import React, { useState, useEffect } from 'react'
import Link from "next/link";
import { useAuth } from "@/src/providers/AuthProvider";
import type { Workspace } from '@app/db';

interface User {
  id: string;
  email: string;
  created_at: string;
  role: string | null;
  name: string | null;
  workspace_id: string | null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Superadmin';
  const [users, setUsers] = useState<User[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch users and workspaces
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch users
        const usersResponse = await fetch('/api/users');
        const usersData = await usersResponse.json();
        if (usersResponse.ok) {
          setUsers(usersData.users || []);
        }

        // Fetch workspaces
        const workspacesResponse = await fetch('/api/workspaces');
        const workspacesData = await workspacesResponse.json();
        if (workspacesResponse.ok) {
          setWorkspaces(workspacesData.workspaces || []);
        }

        // Fetch bookings
        const bookingsResponse = await fetch('/api/bookings');
        const bookingsData = await bookingsResponse.json();
        if (bookingsResponse.ok) {
          setBookings(bookingsData.bookings || []);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get workspace name by ID
  const getWorkspaceName = (workspaceId: string | null): string => {
    if (!workspaceId) return '-';
    if (!workspaces || workspaces.length === 0) return '-';
    
    // Convert both to strings for comparison to handle UUID/string mismatches
    const workspace = workspaces.find(w => String(w.id) === String(workspaceId));
    
    return workspace?.name || '-';
  };

  // Format role for display
  const formatRole = (role: string | null): string => {
    if (!role) return '-';
    return role
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get recent users (last 5)
  const recentUsers = users
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Get recent workspaces (last 5)
  const recentWorkspaces = workspaces
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section aria-label="welcome-note" className="bg-indigo-600 rounded-xl p-8 shadow-md border border-slate-100/50 backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Welcome, {userName}</h1>
              <span className="animate-wave text-2xl inline-block">👋</span>
            </div>
            <p className="text-white text-sm">Superadmin Dashboard - Full access to all data and settings.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/users" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-indigo-600 hover:bg-transparent hover:border-white hover:text-white border border-white transition">Manage Users</Link>
            <Link href="/workspaces" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-indigo-600 hover:bg-transparent hover:border-white hover:text-white border border-white transition">View Workspaces</Link>
          </div>
        </div>
      </section>

      {/* Box Section */}
      <section aria-label="box-section" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Total Users Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#f0f7ff] border border-[#dbe9ff] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Total Users</h2>
              <p className="mt-1 text-4xl font-extrabold text-sky-500">
                {loading ? '-' : users.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">All platform users</div>
        </div>

        {/* Total Workspaces Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#fff8f0] border border-[#ffe6d1] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Workspaces</h2>
              <p className="mt-1 text-4xl font-extrabold text-orange-500">
                {loading ? '-' : workspaces.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Active workspaces</div>
        </div>

        {/* Total Bookings Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#f0fff4] border border-[#d1ffe0] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Total Bookings</h2>
              <p className="mt-1 text-4xl font-extrabold text-emerald-500">
                {loading ? '-' : bookings.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">All platform bookings</div>
        </div>

        {/* System Status Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#fef0ff] border border-[#f0d1ff] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">System Status</h2>
              <p className="mt-1 text-2xl font-extrabold text-purple-500">Active</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">All systems operational</div>
        </div>
      </section>

      {/* Users and Workspaces Lists Section */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-xl shadow-md border border-slate-100/50 overflow-hidden">
          <div className="py-3 px-4 border-b border-slate-200 bg-indigo-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Users</h2>
              <Link href="/users" className="text-sm bg-white px-2 py-1 rounded-lg text-indigo-600 font-medium">View All →</Link>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading users...</div>
            ) : recentUsers.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm">No users found</p>
              </div>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {user.name || user.email}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                          user.role === 'superadmin' 
                            ? 'bg-purple-100 text-purple-800'
                            : user.role === 'workspace_admin'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {formatRole(user.role)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">{user.email}</p>
                      {user.workspace_id && (user.role === 'customer' || user.role === 'workspace_admin') && (
                        <p className="text-xs text-slate-400 mt-1">
                          Workspace: {getWorkspaceName(user.workspace_id)}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 ml-4">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Workspaces */}
        <div className="bg-white rounded-xl shadow-md border border-slate-100/50 overflow-hidden">
          <div className="py-3 px-4 border-b border-slate-200 bg-indigo-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Recent Workspaces</h2>
              <Link href="/workspaces" className="text-sm bg-white px-2 py-1 rounded-lg text-indigo-600 font-medium">View All →</Link>
            </div>
          </div>
          <div className="divide-y divide-slate-200">
            {loading ? (
              <div className="p-6 text-center text-slate-500">Loading workspaces...</div>
            ) : recentWorkspaces.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                <p className="text-sm">No workspaces found</p>
              </div>
            ) : (
              recentWorkspaces.map((workspace) => (
                <div key={workspace.id} className="p-4 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {workspace.logo_url ? (
                        <img
                          src={workspace.logo_url}
                          alt={workspace.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {workspace.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                            {workspace.slug}
                          </code>
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 ml-4">
                      {new Date(workspace.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">Superadmin Access</h2>
        <p className="text-blue-800">
          You have full administrative access to the platform. Use the service role key to access all data without Row Level Security (RLS) restrictions.
          Use <code className="bg-blue-100 px-2 py-1 rounded">supabaseServer</code> from <code className="bg-blue-100 px-2 py-1 rounded">@/lib/supabaseServer</code> for unrestricted database access.
        </p>
      </section>
    </div>
  )
}

export default Dashboard