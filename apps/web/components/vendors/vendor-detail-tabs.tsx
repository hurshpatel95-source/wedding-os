"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VendorOverviewTab } from "@/components/vendors/tabs/vendor-overview-tab";
import { VendorPricingTab } from "@/components/vendors/tabs/vendor-pricing-tab";
import { VendorTasksTab } from "@/components/vendors/tabs/vendor-tasks-tab";
import { VendorFilesTab } from "@/components/vendors/tabs/vendor-files-tab";
import type {
  VendorAttachmentRow,
  VendorRow,
  VendorTaskRow,
} from "@/lib/vendor-types";

export function VendorDetailTabs({
  vendor,
  userId,
  role,
  initialTasks,
  initialAttachments,
}: {
  vendor: VendorRow;
  userId: string;
  role: "admin" | "couple" | null;
  initialTasks: VendorTaskRow[];
  initialAttachments: VendorAttachmentRow[];
}) {
  const openTaskCount = initialTasks.filter((t) => !t.done).length;
  const isAdmin = role === "admin";

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {/* Pricing tab is enabled for couples too — they need to edit
            their own quotes and deposit tracking. Tasks + Files stay
            admin-only since those are planner-internal workflows. */}
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        {isAdmin && (
          <TabsTrigger value="tasks">
            Tasks ({openTaskCount}/{initialTasks.length})
          </TabsTrigger>
        )}
        {isAdmin && (
          <TabsTrigger value="files">Files ({initialAttachments.length})</TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview">
        <VendorOverviewTab vendor={vendor} role={role} />
      </TabsContent>
      <TabsContent value="pricing">
        <VendorPricingTab vendor={vendor} role={role} />
      </TabsContent>
      {isAdmin && (
        <TabsContent value="tasks">
          <VendorTasksTab
            vendorId={vendor.id}
            userId={userId}
            role={role}
            initialTasks={initialTasks}
          />
        </TabsContent>
      )}
      {isAdmin && (
        <TabsContent value="files">
          <VendorFilesTab
            vendorId={vendor.id}
            userId={userId}
            role={role}
            initialAttachments={initialAttachments}
          />
        </TabsContent>
      )}
    </Tabs>
  );
}
