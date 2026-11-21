import { useState } from "react";

interface DoctorAvatarProps {
  name: string;
  initials: string;
  avatarUrl?: string;
  size?: "sm" | "md";
}

export function DoctorAvatar({
  name,
  initials,
  avatarUrl,
  size = "md",
}: DoctorAvatarProps) {
  const [failed, setFailed] = useState(false);
  const dims = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-xs";

  if (!avatarUrl || failed) {
    return (
      <div
        aria-label={name}
        className={`${dims} shrink-0 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-semibold text-sky-300`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={avatarUrl}
      alt={`Portrait of ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dims} shrink-0 rounded-lg object-cover border border-slate-700 bg-slate-800`}
    />
  );
}
