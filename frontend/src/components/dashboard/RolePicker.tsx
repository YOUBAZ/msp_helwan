"use client";

import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Checkbox } from "./ui";

/** Role checkboxes. Roles you aren't allowed to hand out are disabled. */
export default function RolePicker({
  roles,
  value,
  onChange,
}: {
  roles: Role[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { canGrant } = useAuth();
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {roles.map((r) => {
        const allowed = canGrant(r);
        return (
          <Checkbox
            key={r.id}
            checked={value.includes(r.id)}
            disabled={!allowed}
            onChange={(on) =>
              onChange(on ? [...value, r.id] : value.filter((id) => id !== r.id))
            }
            label={r.name}
            hint={
              allowed
                ? r.description || `${r.isSystem ? "All" : r.permissions.length} permissions`
                : "It has permissions you don't have"
            }
          />
        );
      })}
    </div>
  );
}
