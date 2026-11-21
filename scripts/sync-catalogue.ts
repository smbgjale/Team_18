import { syncAll } from "../src/lib/shops/sync";

const dryRun = process.argv.includes("--dry-run");
syncAll({ dryRun }).then((reports) => {
  for (const r of reports) {
    console.log(`${r.shop}${r.dryRun ? " (dry run)" : ""}: seen ${r.seen}, created ${r.created}, updated ${r.updated}, unchanged ${r.unchanged}, deactivated ${r.deactivated}, rejected ${r.rejected.length}`);
    for (const x of r.rejected.slice(0, 10)) console.log(`  rejected ${x.externalId}: ${x.reason}`);
  }
});
