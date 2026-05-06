import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone-500">Coming in Wave 2</p>
        </CardContent>
      </Card>
    </div>
  );
}
