import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.tenant.count();

  console.log("Tenant count:", count);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
