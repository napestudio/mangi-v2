import { useCurrentUser } from "@/hooks/useAuth";
import { useStaffRoster } from "@/hooks/useStaffRoster";
import { cn } from "@/lib/utils";

interface StaffPickerProps {
  value?: string;
  onChange: (userId: string) => void;
  id?: string;
  className?: string;
}

export function StaffPicker({ value, onChange, id, className }: StaffPickerProps) {
  const { data: roster, isLoading } = useStaffRoster();
  const { user } = useCurrentUser();

  const selected = value ?? user?.id ?? "";

  return (
    <select
      id={id}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      disabled={isLoading}
      className={cn("h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm", className)}
    >
      {roster?.map((staff) => (
        <option key={staff.id} value={staff.id}>
          {staff.name ?? staff.username}
        </option>
      ))}
    </select>
  );
}
