"use client";
import { useState } from "react";

export default function BillingButtons({ isPremium }: { isPremium: boolean }) {
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-4 flex gap-2 items-center">
      {!isPremium && (
        <button
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            const r = await fetch("/api/billing/create-checkout-session", { method: "POST" });
            const { url } = await r.json();
            window.location.href = url;
          }}
        >
          Upgrade to Premium
        </button>
      )}

      <button
        className="px-4 py-2 rounded border"
        onClick={async () => {
          const r = await fetch("/api/billing/create-portal-session", { method: "POST" });
          const { url } = await r.json();
          window.location.href = url;
        }}
      >
        Manage billing
      </button>

      {isPremium && (
        <span className="text-sm rounded-full bg-green-100 text-green-800 px-2 py-1">
          Premium
        </span>
      )}
    </div>
  );
}
