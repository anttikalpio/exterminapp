"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc";
import { CustomerForm } from "@/components/forms/customer-form";
import { ArrowLeft } from "lucide-react";

export default function EditCustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = use(params);
  const t = useTranslations("customers");
  const tc = useTranslations("common");

  const { data: customer, isLoading } = trpc.customer.getById.useQuery({
    id: customerId,
  });

  if (isLoading) {
    return <p className="text-gray-500">{tc("loading")}</p>;
  }

  if (!customer) {
    return <p className="text-gray-500">{tc("noResults")}</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/customers"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {tc("back")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {t("editCustomer")}
        </h1>
      </div>
      <CustomerForm
        initialData={{
          id: customer.id,
          customerNumber: customer.customerNumber ?? "",
          businessName: customer.businessName,
          contactName: customer.contactName ?? "",
          contactEmail: customer.contactEmail ?? "",
          contactPhone: customer.contactPhone ?? "",
          orderingParty: customer.orderingParty ?? "",
          billingStreetAddress: customer.billingStreetAddress ?? "",
          billingPoBox: customer.billingPoBox ?? "",
          billingZipCode: customer.billingZipCode ?? "",
          billingCity: customer.billingCity ?? "",
          billingEinvoiceAddress: customer.billingEinvoiceAddress ?? "",
          billingEmail: customer.billingEmail ?? "",
          notes: customer.notes ?? "",
        }}
      />
    </div>
  );
}
