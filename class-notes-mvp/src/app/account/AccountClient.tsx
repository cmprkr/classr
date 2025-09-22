"use client";

import ProfileSettingsCard from "@/components/ProfileSettingsCard";
import EventShield from "@/components/EventShield";
import BillingButtons from "@/components/BillingButtons"; // <-- add this

export default function AccountClient({
  user,
  isSignedIn,
}: {
  user: { id: string | null; name: string; email: string; image: string | null; username?: string | null };
  isSignedIn: boolean;
}) {
  const userWithUsername = { ...user, username: user.username ?? null };

  return (
    <div className="relative h-full w-full overflow-y-auto p-6 sm:p-10 flex items-start justify-center">
      <EventShield>
        <div>
          <ProfileSettingsCard user={userWithUsername} isSignedIn={isSignedIn} />
          {/* Show billing actions only when signed in */}
          {isSignedIn && <BillingButtons />}
        </div>
      </EventShield>
    </div>
  );
}
