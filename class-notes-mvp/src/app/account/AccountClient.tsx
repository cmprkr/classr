// src/app/account/AccountClient.tsx
"use client";

import ProfileSettingsCard from "@/components/ProfileSettingsCard";
import EventShield from "@/components/EventShield";

export default function AccountClient({
  user,
  isSignedIn,
}: {
  user: { id: string | null; name: string; email: string; image: string | null; username?: string | null };
  isSignedIn: boolean;
}) {
  // Ensure username exists for UserLite type
  const userWithUsername = { ...user, username: user.username ?? null };

  return (
    <div className="relative h-full w-full overflow-y-auto p-6 sm:p-10 flex items-start justify-center">
      <EventShield>
        <ProfileSettingsCard user={userWithUsername} isSignedIn={isSignedIn} />
      </EventShield>
    </div>
  );
}
