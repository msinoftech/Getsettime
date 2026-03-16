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

export function ContactTableSkeleton() {
  return (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr className="border border-slate-200">
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Name</th>
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Email</th>
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Phone number</th>
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">City</th>
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">State</th>
          <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Country</th>
          <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <tr key={i} className="bg-white border border-slate-200">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <SkeletonBar className="h-9 w-9 rounded-full shrink-0" />
                <SkeletonBar className="h-4 w-24" />
              </div>
            </td>
            <td className="px-6 py-4"><SkeletonBar className="h-4 w-36" /></td>
            <td className="px-6 py-4"><SkeletonBar className="h-4 w-28" /></td>
            <td className="px-6 py-4"><SkeletonBar className="h-4 w-20" /></td>
            <td className="px-6 py-4"><SkeletonBar className="h-4 w-20" /></td>
            <td className="px-6 py-4"><SkeletonBar className="h-4 w-16" /></td>
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
  );
}
