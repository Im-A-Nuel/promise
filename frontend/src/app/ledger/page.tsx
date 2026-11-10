import type { Metadata } from "next";
import { LedgerView } from "@/components/app/ledger-view";
import { Page } from "@/components/app/states";
import { makeT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: makeT(await getLocale())("ledgerPage.title") };
}

export default function LedgerPage() {
  return (
    <>
      <Page>
        <LedgerView />
      </Page>
    </>
  );
}
