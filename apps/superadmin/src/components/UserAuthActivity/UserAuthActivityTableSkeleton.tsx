"use client";

import React from "react";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={`rounded bg-slate-200 animate-pulse ${className ?? ""}`} />
  );
}

const SKELETON_ROWS = 8;

/** Main list: one row per user (grouped). */
export function UserAuthActivityGroupTableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr className="border border-slate-200">
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
              Email
            </th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
              Workspace
            </th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
              Last activity
            </th>
            <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
              Events
            </th>
            <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i} className="bg-white border border-slate-200">
              <td className="px-6 py-4">
                <SkeletonBar className="h-4 w-40" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBar className="h-4 w-48" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBar className="h-4 w-36" />
              </td>
              <td className="px-6 py-4">
                <SkeletonBar className="h-4 w-12" />
              </td>
              <td className="px-6 py-4 text-right">
                <SkeletonBar className="ml-auto h-8 w-24 rounded-md" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
