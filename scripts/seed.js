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
  let tenant =
    await prisma.tenant.findFirst({
      where: {
        name: "Demo Customer"
      }
    });

  if (!tenant) {
    tenant =
      await prisma.tenant.create({
        data: {
          name: "Demo Customer"
        }
      });

    console.log(
      "Created demo tenant"
    );
  }

  const existingKey =
    await prisma.apiKey.findUnique({
      where: {
        key: "test_key_123"
      }
    });

  if (!existingKey) {
    await prisma.apiKey.create({
      data: {
        key: "test_key_123",
        tenantId: tenant.id
      }
    });

    console.log(
      "Created demo api key"
    );
  }

  console.log(
    "Bootstrap complete"
  );
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
