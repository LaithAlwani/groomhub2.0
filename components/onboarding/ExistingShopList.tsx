"use client";

import type { useOrganizationList } from "@clerk/nextjs";

type Memberships = NonNullable<
  NonNullable<ReturnType<typeof useOrganizationList>["userMemberships"]>["data"]
>;

export function ExistingShopList({
  memberships,
  disabled,
  onSwitch,
}: {
  memberships: Memberships;
  disabled: boolean;
  onSwitch: (organizationId: string) => void;
}) {
  if (memberships.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Or jump into a shop you already belong to:
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {memberships.map((membership) => (
          <li key={membership.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSwitch(membership.organization.id)}
              className="text-sm font-medium text-zinc-900 underline-offset-2 hover:underline disabled:opacity-50 dark:text-zinc-100"
            >
              {membership.organization.name}
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {membership.role.replace("org:", "")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
