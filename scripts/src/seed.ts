// Creates the demo story on testnet (docs/DEMO.md section 1). Needs an empty contract.
//
//   pnpm seed -- --dry-run      show the plan, send nothing
//   pnpm seed                   create the story
//   pnpm seed -- --hours 20     events this many hours ahead (default 12, at most 24 so hosts can check in)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrap, fail, preflight } from "./bootstrap.js";
import { Reporter, UNIT, tusdc } from "./story.js";

export const SEED_TITLE = "Pernikahan Ayu & Bima";

const PLAN = [
  "Ayu creates the wedding hajat (open link)",
  "Ayu invites Budi, Citra and Dewi",
  "Budi seals 5 tUSDC, Citra seals 2 tUSDC",
  "Ayu checks in Budi and Citra: both envelopes open",
  "Budi creates the khitan hajat and invites Ayu and Citra (nothing sealed)",
  "Eko creates the house blessing and invites Dewi",
  "Dewi seals 3 tUSDC into it, then Eko cancels the hajat (refund left unclaimed)",
];

async function main() {
  const ctx = await bootstrap(process.argv.slice(2));
  const { cfg, story, actors } = ctx;
  if (cfg.hours > 24) fail("--hours must be at most 24, or the hosts cannot check in yet.");

  console.log(`Promise seed on ${cfg.amplop}, ${cfg.dryRun ? "dry run (nothing is sent)" : "EXECUTE"}`);

  const count = await story.hajatCount();
  if (count > 0) {
    const first = await story.getHajat(1);
    if (first?.title === SEED_TITLE && first.host === actors.ayu!.accountId) {
      console.log(`Already seeded: the contract has ${count} hajat(s) and hajat 1 is "${SEED_TITLE}". Nothing to do.`);
      return;
    }
    fail(`The contract already has ${count} hajat(s) that are not this story. Seeding needs an empty contract.`);
  }

  console.log("\nPlan:");
  PLAN.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  const problems = await preflight(ctx, { budi: 5n * UNIT, citra: 2n * UNIT, dewi: 3n * UNIT });
  if (problems.length) fail(problems.join("\n"));
  if (cfg.dryRun) {
    console.log("\nDry run only. Run again without --dry-run to send these transactions.");
    return;
  }
  console.log("");

  const { ayu, budi, citra, dewi, eko } = actors as Record<"ayu" | "budi" | "citra" | "dewi" | "eko", NonNullable<(typeof actors)[string]>>;
  const r = new Reporter();
  const hours = cfg.hours;

  const h1 = await story.createHajat(ayu, { title: SEED_TITLE, kind: "Wedding", venue: "Gedung Serbaguna", hoursAhead: hours, policy: "OpenLink" });
  r.step(`Ayu creates hajat ${h1.id} "${SEED_TITLE}"`, h1.tx);
  const inv1 = await story.inviteMany(ayu, h1.id, [
    { account: budi.accountId, label: "Budi" },
    { account: citra.accountId, label: "Citra" },
    { account: dewi.accountId, label: "Dewi" },
  ]);
  r.step("Ayu invites Budi, Citra, Dewi", inv1.tx);
  const [tBudi, tCitra, tDewi] = inv1.ids as [number, number, number];

  r.step("Budi seals 5.00 tUSDC", await story.seal(budi, tBudi, 5n * UNIT, "Selamat Ayu dan Bima"));
  r.step("Citra seals 2.00 tUSDC", await story.seal(citra, tCitra, 2n * UNIT));
  r.step("Ayu checks in Budi, the envelope opens", await story.checkIn(ayu, tBudi));
  r.step("Ayu checks in Citra, the envelope opens", await story.checkIn(ayu, tCitra));

  const h2 = await story.createHajat(budi, { title: "Syukuran khitanan Raka", kind: "Khitan", venue: "Rumah Budi", hoursAhead: hours, policy: "InviteOnly" });
  r.step(`Budi creates hajat ${h2.id} "Syukuran khitanan Raka"`, h2.tx);
  const inv2 = await story.inviteMany(budi, h2.id, [
    { account: ayu.accountId, label: "Ayu" },
    { account: citra.accountId, label: "Citra" },
  ]);
  r.step("Budi invites Ayu and Citra", inv2.tx);
  const [tAyuAtBudi, tCitraAtBudi] = inv2.ids as [number, number];

  const h3 = await story.createHajat(eko, { title: "Selamatan rumah baru", kind: "Syukuran", venue: "Rumah Eko", hoursAhead: hours, policy: "InviteOnly" });
  r.step(`Eko creates hajat ${h3.id} "Selamatan rumah baru"`, h3.tx);
  const inv3 = await story.inviteMany(eko, h3.id, [{ account: dewi.accountId, label: "Dewi" }]);
  r.step("Eko invites Dewi", inv3.tx);
  const [tDewiAtEko] = inv3.ids as [number];
  r.step("Dewi seals 3.00 tUSDC", await story.seal(dewi, tDewiAtEko, 3n * UNIT));
  r.step("Eko cancels the hajat", await story.cancel(eko, h3.id));

  // ---- verify the state the walkthrough starts from
  const inv = async (id: number) => (await story.getInvitation(id))!;
  const b = await inv(tBudi);
  const c = await inv(tCitra);
  const d = await inv(tDewi);
  r.expect(b.card_status === "Opened" && b.released === "5000000", "Budi's card is Opened with 5.00");
  r.expect(c.card_status === "Opened" && c.released === "2000000", "Citra's card is Opened with 2.00");
  r.expect(d.card_status === "Invited", "Dewi is still only invited");
  const hajat1 = await story.getHajat(h1.id);
  r.expect(hajat1?.invite_count === 3 && hajat1.released_total === "7000000", "hajat 1 has 3 invitations and 7.00 released");
  r.expect((await inv(tAyuAtBudi)).card_status === "Invited" && (await inv(tCitraAtBudi)).card_status === "Invited", "hajat 2 holds two empty invitations");
  const dewiRefund = await inv(tDewiAtEko);
  r.expect(dewiRefund.state === "Sealed" && dewiRefund.sealed === "3000000", "Dewi's 3.00 waits in the cancelled hajat");
  r.expect((await story.getHajat(h3.id))?.status === "Cancelled", "hajat 3 is cancelled");

  const owed = Object.fromEntries((await story.getLedger(ayu.accountId)).i_owe.map((row) => [row.counterparty, row.remaining]));
  r.expect(owed[budi.accountId] === "5000000" && owed[citra.accountId] === "2000000", "Ayu owes Budi 5.00 and Citra 2.00");
  r.expect((await story.card(tBudi)).includes("5.00 tUSDC"), "Budi's card, drawn by the contract, shows 5.00 tUSDC");
  r.expect(
    (await story.tusdcBalance(cfg.amplop)) === 3n * UNIT,
    `the contract holds only Dewi's 3.00 (holds ${tusdc(await story.tusdcBalance(cfg.amplop))})`,
  );

  const mapping = [
    `token ${tBudi} = Budi @ hajat ${h1.id}`,
    `token ${tCitra} = Citra @ hajat ${h1.id}`,
    `token ${tDewi} = Dewi @ hajat ${h1.id}`,
    `token ${tAyuAtBudi} = Ayu @ hajat ${h2.id}`,
    `token ${tCitraAtBudi} = Citra @ hajat ${h2.id}`,
    `token ${tDewiAtEko} = Dewi @ hajat ${h3.id}`,
  ];
  console.log("\nPaste into docs/DEMO.md section 1:\n  " + mapping.join(", "));

  mkdirSync(join(ctx.repoRoot, "scripts", "out"), { recursive: true });
  writeFileSync(
    join(ctx.repoRoot, "scripts", "out", "seed-report.json"),
    JSON.stringify({ at: new Date().toISOString(), amplop: cfg.amplop, mapping, links: r.links }, null, 2) + "\n",
  );
  process.exit(r.summary());
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
