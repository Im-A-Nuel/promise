import Image from "next/image";
import { Amount } from "@/components/coin";
import { SealBadge } from "@/components/pao";
import type { CardStatus } from "@/lib/near/types";

type Pose = "open-empty" | "sealed" | "open-coin" | "sleeping";

const POSE: Record<CardStatus, Pose> = {
  Invited: "open-empty",
  Sealed: "sealed",
  Opened: "open-coin",
  PartiallyRepaid: "open-coin",
  Repaid: "sealed",
  Reply: "sealed",
  Refunded: "sealed",
  Void: "sleeping",
};

// The artwork is an 800 px square per pose, cropped and aligned so the envelope body keeps one width and one
// baseline across poses. Swapping the pose of a card therefore never makes the envelope jump.
const SRC: Record<Pose, string> = {
  "open-empty": "/art/pao-open-empty.webp",
  sealed: "/art/pao-sealed.webp",
  "open-coin": "/art/pao-open-coin.webp",
  sleeping: "/art/pao-sleeping.webp",
};

const showsAmount = (s: CardStatus) => s === "Opened" || s === "PartiallyRepaid" || s === "Repaid";

/** Share of the credit already paid back, 0 to 100. */
function paidShare(released: string, settled: string, reciprocated: string): number {
  const credit = BigInt(released) - BigInt(settled);
  if (credit <= 0n) return 0;
  const paid = BigInt(reciprocated) < credit ? BigInt(reciprocated) : credit;
  return Number((paid * 100n) / credit);
}

/**
 * The invitation as the app shows it: the Pao envelope in the pose of its status, with the amount that came out of
 * it. The name and status sit under the card, so they are not repeated here. The on-chain SVG is a separate, simpler
 * drawing for wallets and explorers.
 */
export function InvitationCard({
  status,
  tokenId,
  released,
  settled,
  reciprocated,
  alt,
  className = "",
}: {
  status: CardStatus;
  tokenId: number;
  released: string;
  settled: string;
  reciprocated: string;
  alt: string;
  className?: string;
}) {
  const void_ = status === "Void";
  const share = status === "PartiallyRepaid" ? paidShare(released, settled, reciprocated) : 0;
  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative aspect-[360/220] w-full overflow-hidden rounded-[18px] shadow-[0_16px_28px_-18px_rgba(122,20,20,0.55)] ${
        void_ ? "bg-gradient-to-b from-[#F6F2EE] to-[#E9E3DD]" : "bg-gradient-to-b from-[#FFF8F1] to-[#FFE6DC]"
      } ${className}`}
    >
      {!void_ && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_64%,rgba(255,240,184,0.75)_0,rgba(255,240,184,0)_52%)]"
        />
      )}
      <span aria-hidden="true" className="absolute right-4 top-3 text-xs font-bold text-ink-soft">
        #{tokenId}
      </span>
      <div
        aria-hidden="true"
        className={`absolute left-1/2 w-[64%] -translate-x-1/2 transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03] ${
          showsAmount(status) ? "bottom-[18%]" : "bottom-[8%]"
        } ${status === "Refunded" ? "opacity-50" : ""}`}
      >
        {/* Static artwork from /public. The files are small, so the image optimizer adds nothing. */}
        <Image src={SRC[POSE[status]]} alt="" width={800} height={800} unoptimized priority={false} className="h-auto w-full" />
        {(status === "Repaid" || status === "Reply") && <SealBadge kind={status === "Repaid" ? "repaid" : "reply"} />}
      </div>
      {showsAmount(status) && (
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/85 px-3 py-1 font-extrabold text-ink shadow-[0_4px_10px_-6px_rgba(122,20,20,0.5)]"
        >
          <Amount units={released} size="sm" />
        </span>
      )}
      {status === "PartiallyRepaid" && (
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-[#F0DDD0]">
          <span className="block h-full bg-[#2F6B3F]" style={{ width: `${share}%` }} />
        </span>
      )}
    </div>
  );
}
