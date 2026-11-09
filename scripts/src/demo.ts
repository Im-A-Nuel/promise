// Runs the whole story on testnet with the demo personas and prints an explorer link per step.
// It creates its own hajats, so it does not depend on the seed. Exit code 0 only when every
// expected state matches.
//
//   pnpm demo                   run the story
//   pnpm demo -- --dry-run      show the plan, send nothing
//   pnpm demo -- --hours 20     events this many hours ahead (default 12, at most 24)

import { bootstrap, fail, preflight } from "./bootstrap.js";
import { Reporter, UNIT, tusdc } from "./story.js";

const PLAN = [
  "Ayu hosts a wedding and invites Budi, Citra and Dewi",
  "Budi seals 5, Citra seals 2, Dewi seals 5 (with a note)",
  "Ayu checks all three in: the envelopes open and the ledger records what Ayu owes",
  "Budi hosts a khitan and invites Ayu",
  "Ayu pays back what the ledger says (suggest_reply), Budi checks Ayu in",
  "Budi's old card turns Repaid and Ayu's new card turns Reply",
  "Eko hosts, Dewi seals 3, Eko cancels, Citra triggers the refund: Dewi gets her 3 back",
];

async function main() {
  const ctx = await bootstrap(process.argv.slice(2));
  const { cfg, story, actors } = ctx;
  if (cfg.hours > 24) fail("--hours must be at most 24, or the hosts cannot check in yet.");

  console.log(`Promise demo on ${cfg.amplop}, ${cfg.dryRun ? "dry run (nothing is sent)" : "running"}\n`);
  if (cfg.dryRun) {
    PLAN.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    const problems = await preflight(ctx, { budi: 5n * UNIT, citra: 2n * UNIT, dewi: 8n * UNIT, ayu: 40n * UNIT });
    console.log(problems.length ? `\nProblems:\n  ${problems.join("\n  ")}` : "\nPersonas have enough NEAR and tUSDC.");
    console.log("\nDry run only. Run without --dry-run to send the transactions.");
    return;
  }

  // Ayu pays back whatever the ledger says, which can include older claims, so she needs headroom.
  const problems = await preflight(ctx, { budi: 5n * UNIT, citra: 2n * UNIT, dewi: 8n * UNIT, ayu: 40n * UNIT });
  if (problems.length) fail(problems.join("\n"));

  const { ayu, budi, citra, dewi, eko } = actors as Record<"ayu" | "budi" | "citra" | "dewi" | "eko", NonNullable<(typeof actors)[string]>>;
  const r = new Reporter();
  const hours = cfg.hours;
  const inv = async (id: number) => (await story.getInvitation(id))!;

  // ---- Ayu's wedding
  const owedBefore = {
    budi: (await story.getPair(budi.accountId, ayu.accountId)).remaining,
    citra: (await story.getPair(citra.accountId, ayu.accountId)).remaining,
    dewi: (await story.getPair(dewi.accountId, ayu.accountId)).remaining,
  };
  const contractBefore = await story.tusdcBalance(cfg.amplop);
  const ayuBefore = await story.tusdcBalance(ayu.accountId);

  const h1 = await story.createHajat(ayu, { title: "Demo wedding", kind: "Wedding", venue: "Demo hall", hoursAhead: hours, policy: "InviteOnly" });
  r.step(`Ayu creates hajat ${h1.id} "Demo wedding"`, h1.tx);
  const invites = await story.inviteMany(ayu, h1.id, [
    { account: budi.accountId, label: "Budi" },
    { account: citra.accountId, label: "Citra" },
    { account: dewi.accountId, label: "Dewi" },
  ]);
  r.step("Ayu invites Budi, Citra, Dewi", invites.tx);
  const [tBudi, tCitra, tDewi] = invites.ids as [number, number, number];

  r.step("Budi seals 5.00 tUSDC", await story.seal(budi, tBudi, 5n * UNIT, "Selamat ya"));
  r.step("Citra seals 2.00 tUSDC", await story.seal(citra, tCitra, 2n * UNIT));
  r.step("Dewi seals 5.00 tUSDC with a note", await story.seal(dewi, tDewi, 5n * UNIT, "Semoga sakinah"));
  const sealedCard = await story.card(tDewi);
  r.expect(sealedCard.includes(">SEALED</text>") && !sealedCard.includes("5.00"), "Dewi's sealed card hides the amount");
  r.expect((await inv(tDewi)).card_status === "Sealed", "Dewi's card is Sealed");

  r.step("Ayu checks in Budi", await story.checkIn(ayu, tBudi));
  r.step("Ayu checks in Citra", await story.checkIn(ayu, tCitra));
  r.step("Ayu checks in Dewi", await story.checkIn(ayu, tDewi));
  for (const [name, id, amount] of [["Budi", tBudi, "5000000"], ["Citra", tCitra, "2000000"], ["Dewi", tDewi, "5000000"]] as const) {
    const v = await inv(id);
    r.expect(v.state === "Opened" && v.released === amount, `${name}'s envelope is Opened with ${tusdc(amount)}`);
  }
  r.expect((await story.tusdcBalance(ayu.accountId)) === ayuBefore + 12n * UNIT, "Ayu received 12.00 tUSDC");
  r.expect((await story.tusdcBalance(cfg.amplop)) === contractBefore, "the contract holds no more than before");
  r.expect((await story.card(tDewi)).includes("5.00 tUSDC"), "Dewi's card now shows 5.00 tUSDC, drawn by the contract");

  const owedAfter = {
    budi: (await story.getPair(budi.accountId, ayu.accountId)).remaining,
    citra: (await story.getPair(citra.accountId, ayu.accountId)).remaining,
    dewi: (await story.getPair(dewi.accountId, ayu.accountId)).remaining,
  };
  r.step("Ledger read: what Ayu owes now (view call)");
  r.expect(owedAfter.budi - owedBefore.budi === 5n * UNIT, "Ayu owes Budi 5.00 more");
  r.expect(owedAfter.citra - owedBefore.citra === 2n * UNIT, "Ayu owes Citra 2.00 more");
  r.expect(owedAfter.dewi - owedBefore.dewi === 5n * UNIT, "Ayu owes Dewi 5.00 more");

  // ---- Budi's event: Ayu pays back
  const h2 = await story.createHajat(budi, { title: "Demo khitan", kind: "Khitan", venue: "Budi's house", hoursAhead: hours, policy: "InviteOnly" });
  r.step(`Budi creates hajat ${h2.id} "Demo khitan"`, h2.tx);
  const inv2 = await story.inviteMany(budi, h2.id, [{ account: ayu.accountId, label: "Ayu" }]);
  r.step("Budi invites Ayu", inv2.tx);
  const [tAyu] = inv2.ids as [number];

  const suggested = await story.suggestReply(h2.id, ayu.accountId);
  r.step(`Ayu asks the contract what she owes Budi: ${tusdc(suggested)} tUSDC (view call)`);
  r.expect(suggested >= 5n * UNIT, "the suggested reply covers at least the 5.00 from this run");

  r.step(`Ayu seals ${tusdc(suggested)} tUSDC, exactly what the ledger says`, await story.seal(ayu, tAyu, suggested));
  r.step("Budi checks Ayu in: the contract settles the oldest claims first", await story.checkIn(budi, tAyu));

  const budiOld = await inv(tBudi);
  const reply = await inv(tAyu);
  r.expect(budiOld.card_status === "Repaid", "Budi's old card now reads Repaid");
  r.expect(reply.card_status === "Reply" && reply.settled === suggested.toString(), "Ayu's new card reads Reply and settled everything");
  r.expect(reply.repays.length >= 1, "Ayu's card lists the claims it repaid");
  r.expect((await story.getPair(budi.accountId, ayu.accountId)).remaining === 0n, "Ayu's debt to Budi is 0");
  const ayuLedger = await story.getLedger(ayu.accountId);
  r.expect(!ayuLedger.i_owe.some((row) => row.counterparty === budi.accountId), "Budi is gone from Ayu's ledger");
  r.step("Budi's old card, drawn by the contract, reads REPAID (view call)");
  r.expect((await story.card(tBudi)).includes(">REPAID</text>"), "the SVG from nft_token says REPAID");

  // ---- a cancelled hajat and a refund
  const dewiBefore = await story.tusdcBalance(dewi.accountId);
  const h3 = await story.createHajat(eko, { title: "Demo house blessing", kind: "Syukuran", venue: "Eko's house", hoursAhead: hours, policy: "InviteOnly" });
  r.step(`Eko creates hajat ${h3.id} "Demo house blessing"`, h3.tx);
  const inv3 = await story.inviteMany(eko, h3.id, [{ account: dewi.accountId, label: "Dewi" }]);
  r.step("Eko invites Dewi", inv3.tx);
  const [tDewi3] = inv3.ids as [number];
  r.step("Dewi seals 3.00 tUSDC", await story.seal(dewi, tDewi3, 3n * UNIT));
  r.step("Eko cancels the hajat", await story.cancel(eko, h3.id));
  r.step("Citra, not Dewi, triggers the refund", await story.refund(citra, tDewi3));
  const refunded = await inv(tDewi3);
  r.expect(refunded.state === "Refunded" && refunded.card_status === "Refunded", "Dewi's envelope is Refunded");
  r.expect((await story.tusdcBalance(dewi.accountId)) === dewiBefore, "Dewi got her 3.00 back although Citra pressed the button");
  r.expect((await story.tusdcBalance(cfg.amplop)) === contractBefore, "the contract is back to where it started");

  process.exit(r.summary());
}

main().catch((e: unknown) => fail(e instanceof Error ? e.message : String(e)));
