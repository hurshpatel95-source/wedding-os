# admin-push components

Owned by **Agent E**. These are the action buttons used by Agent A (library
venues) and Agent D (clients/library vendors) to push library data into a
specific couple workspace.

In Wave 2 they ship as standalone, importable components. They are NOT yet
wired into Agent A / Agent D's pages — that integration is a follow-up after
all of Wave 2 lands.

## Components

- `<PushVenueButton libraryVenueId workspaces />` — picks a workspace, POSTs
  `/api/admin/push/library-venue`.
- `<PushVendorButton libraryVendorId workspaces />` — POSTs
  `/api/admin/push/library-vendor`.
- `<PushPlaybookButton workspaces />` — POSTs `/api/admin/push/playbook` for the
  whole playbook.
- `<WorkspacePicker />` — internal helper used by the three buttons.

## Workspaces prop

Each button accepts a `workspaces: { id, name }[]` array — caller is
responsible for fetching this once at the page level (they are already in the
admin layout, so the calling page can use the same pattern).
