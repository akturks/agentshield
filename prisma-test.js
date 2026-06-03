import prismaPkg from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const { PrismaClient } = prismaPkg;

const adapter = new PrismaBetterSqlite3({
  url: "file:./agentshield.db"
});

const prisma = new PrismaClient({
  adapter
});

async function main() {
  const count = await prisma.tenant.count();

  console.log("Tenant count:", count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
