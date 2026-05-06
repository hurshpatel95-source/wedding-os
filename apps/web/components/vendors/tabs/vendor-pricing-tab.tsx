"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Check, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";
import type { VendorRow } from "@/lib/vendor-types";

type VendorClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
    };
  };
};

const CURRENCY: "EUR" | "USD" = "EUR";

export function VendorPricingTab({
  vendor,
  role,
}: {
  vendor: VendorRow;
  role: "admin" | "couple" | null;
}) {
  const router = useRouter();
  // Couples need to edit quotes + deposits to track their own payments
  // (they pay the planner directly). Admin-only fields stay gated below.
  const isAdmin = role === "admin";
  const canEditPricing = role === "admin" || role === "couple";
  const [editingQuote, setEditingQuote] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState(false);
  const [editingFinal, setEditingFinal] = useState(false);
  const [pending, setPending] = useState(false);

  // Quote
  const [quotedPrice, setQuotedPrice] = useState<string>(
    vendor.quoted_price_eur?.toString() ?? "",
  );

  // Deposit
  const [depositAmount, setDepositAmount] = useState<string>(
    vendor.deposit_amount_eur?.toString() ?? "",
  );
  const [depositDueAt, setDepositDueAt] = useState<string>(
    vendor.deposit_due_at?.slice(0, 10) ?? "",
  );

  // Final balance
  const [finalBalance, setFinalBalance] = useState<string>(
    vendor.final_balance_eur?.toString() ?? "",
  );
  const [finalDueAt, setFinalDueAt] = useState<string>(
    vendor.final_due_at?.slice(0, 10) ?? "",
  );

  const update = async (values: Record<string, unknown>) => {
    setPending(true);
    const supabase = createClient();
    const sb = supabase as unknown as VendorClient;
    const { error } = await sb.from("vendors").update(values).eq("id", vendor.id);
    setPending(false);
    if (!error) router.refresh();
  };

  const saveQuote = async () => {
    const num = quotedPrice.trim() ? Number(quotedPrice) : null;
    await update({ quoted_price_eur: num });
    setEditingQuote(false);
  };
  const saveDeposit = async () => {
    const num = depositAmount.trim() ? Number(depositAmount) : null;
    await update({
      deposit_amount_eur: num,
      deposit_due_at: depositDueAt.trim() || null,
    });
    setEditingDeposit(false);
  };
  const saveFinal = async () => {
    const num = finalBalance.trim() ? Number(finalBalance) : null;
    await update({
      final_balance_eur: num,
      final_due_at: finalDueAt.trim() || null,
    });
    setEditingFinal(false);
  };

  const markDepositPaid = async () => {
    await update({ deposit_paid_at: new Date().toISOString() });
  };
  const markFinalPaid = async () => {
    await update({ final_paid_at: new Date().toISOString() });
  };
  const togglePricingInclude = async () => {
    await update({ include_in_pricing: !vendor.include_in_pricing });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {/* Quoted price */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif">Quoted price</CardTitle>
            {canEditPricing && !editingQuote && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Edit quoted price"
                onClick={() => setEditingQuote(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editingQuote ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="quoted">Quote ({CURRENCY})</Label>
                  <Input
                    id="quoted"
                    type="number"
                    inputMode="decimal"
                    value={quotedPrice}
                    onChange={(e) => setQuotedPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button type="button" onClick={saveQuote} disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQuotedPrice(vendor.quoted_price_eur?.toString() ?? "");
                    setEditingQuote(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : vendor.quoted_price_eur != null ? (
              <p className="font-serif text-4xl">
                {formatMoney(Number(vendor.quoted_price_eur), CURRENCY)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No quote yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Deposit */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif">Deposit</CardTitle>
            {canEditPricing && !editingDeposit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Edit deposit"
                onClick={() => setEditingDeposit(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editingDeposit ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="deposit-amt">Amount ({CURRENCY})</Label>
                  <Input
                    id="deposit-amt"
                    type="number"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="deposit-due">Due date</Label>
                  <Input
                    id="deposit-due"
                    type="date"
                    value={depositDueAt}
                    onChange={(e) => setDepositDueAt(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="button" onClick={saveDeposit} disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setDepositAmount(vendor.deposit_amount_eur?.toString() ?? "");
                      setDepositDueAt(vendor.deposit_due_at?.slice(0, 10) ?? "");
                      setEditingDeposit(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-1 md:grid-cols-3">
                  <Field
                    label="Amount"
                    value={
                      vendor.deposit_amount_eur != null
                        ? formatMoney(Number(vendor.deposit_amount_eur), CURRENCY)
                        : "—"
                    }
                  />
                  <Field label="Due" value={fmtDate(vendor.deposit_due_at)} />
                  <Field
                    label="Paid"
                    value={
                      vendor.deposit_paid_at ? (
                        <Badge variant="success">
                          Paid {fmtDate(vendor.deposit_paid_at)}
                        </Badge>
                      ) : (
                        <Badge variant="muted">Unpaid</Badge>
                      )
                    }
                  />
                </div>
                {canEditPricing && !vendor.deposit_paid_at && vendor.deposit_amount_eur != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={markDepositPaid}
                    disabled={pending}
                  >
                    <Check className="h-4 w-4" />
                    Mark deposit paid
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Final balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif">Final balance</CardTitle>
            {canEditPricing && !editingFinal && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Edit final balance"
                onClick={() => setEditingFinal(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {editingFinal ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="final-amt">Amount ({CURRENCY})</Label>
                  <Input
                    id="final-amt"
                    type="number"
                    inputMode="decimal"
                    value={finalBalance}
                    onChange={(e) => setFinalBalance(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="final-due">Due date</Label>
                  <Input
                    id="final-due"
                    type="date"
                    value={finalDueAt}
                    onChange={(e) => setFinalDueAt(e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="button" onClick={saveFinal} disabled={pending}>
                    {pending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setFinalBalance(vendor.final_balance_eur?.toString() ?? "");
                      setFinalDueAt(vendor.final_due_at?.slice(0, 10) ?? "");
                      setEditingFinal(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-1 md:grid-cols-3">
                  <Field
                    label="Amount"
                    value={
                      vendor.final_balance_eur != null
                        ? formatMoney(Number(vendor.final_balance_eur), CURRENCY)
                        : "—"
                    }
                  />
                  <Field label="Due" value={fmtDate(vendor.final_due_at)} />
                  <Field
                    label="Paid"
                    value={
                      vendor.final_paid_at ? (
                        <Badge variant="success">
                          Paid {fmtDate(vendor.final_paid_at)}
                        </Badge>
                      ) : (
                        <Badge variant="muted">Unpaid</Badge>
                      )
                    }
                  />
                </div>
                {canEditPricing && !vendor.final_paid_at && vendor.final_balance_eur != null && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={markFinalPaid}
                    disabled={pending}
                  >
                    <Check className="h-4 w-4" />
                    Mark final balance paid
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Pricing scenario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {vendor.include_in_pricing ? (
              <>
                <p className="text-muted-foreground">
                  This vendor&apos;s quoted price rolls into the scenario total in{" "}
                  <Link className="font-medium text-foreground underline" href="/pricing">
                    /pricing
                  </Link>
                  .
                </p>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={togglePricingInclude}
                    disabled={pending}
                  >
                    Exclude from total
                  </Button>
                )}
              </>
            ) : (
              <>
                <p className="text-muted-foreground">Excluded from scenario total.</p>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={togglePricingInclude}
                    disabled={pending}
                  >
                    Include in total
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "PP");
  } catch {
    return iso;
  }
}
