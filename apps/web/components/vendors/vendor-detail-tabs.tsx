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
  baseCurrency = "USD",
}: {
  vendor: VendorRow;
  userId: string;
  role: "admin" | "couple" | null;
  initialTasks: VendorTaskRow[];
  initialAttachments: VendorAttachmentRow[];
  baseCurrency?: string;
}) {
  const openTaskCount = initialTasks.filter((t) => !t.done).length;

  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {/* Couples need every tab. They are tracking their own per-vendor
            tasks ("send reference photos by Friday") and uploading their
            own quote PDFs / contracts to the vendor. */}
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="tasks">
          Tasks ({openTaskCount}/{initialTasks.length})
        </TabsTrigger>
        <TabsTrigger value="files">Files ({initialAttachments.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <VendorOverviewTab vendor={vendor} role={role} />
      </TabsContent>
      <TabsContent value="pricing">
        <VendorPricingTab vendor={vendor} role={role} baseCurrency={baseCurrency} />
      </TabsContent>
      <TabsContent value="tasks">
        <VendorTasksTab
          vendorId={vendor.id}
          userId={userId}
          role={role}
          initialTasks={initialTasks}
        />
      </TabsContent>
      <TabsContent value="files">
        <VendorFilesTab
          vendorId={vendor.id}
          userId={userId}
          role={role}
          initialAttachments={initialAttachments}
        />
      </TabsContent>
    </Tabs>
  );
}
