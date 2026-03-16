'use client';

import React from 'react';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const SKELETON_ROWS = 8;

export function WorkspaceTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="border border-slate-200">
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Name</th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Slug</th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Colors</th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Created</th>
            <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i} className="bg-white border border-slate-200">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <SkeletonBar className="h-10 w-10 rounded-lg shrink-0" />
                  <SkeletonBar className="h-4 w-28" />
                </div>
              </td>
              <td className="px-6 py-4"><SkeletonBar className="h-6 w-28 rounded" /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <SkeletonBar className="h-6 w-6 rounded" />
                  <SkeletonBar className="h-6 w-6 rounded" />
                </div>
              </td>
              <td className="px-6 py-4"><SkeletonBar className="h-4 w-24" /></td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <SkeletonBar className="h-6 w-10 rounded-md" />
                  <SkeletonBar className="h-6 w-14 rounded-md" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
