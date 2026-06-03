import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.create({
    data: {
      name: "Demo Customer",
      apiKeys: {
        create: {
          key: "test_key_123"
        }
      }
    }
  });

  console.log("Tenant created:");
  console.log(tenant);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
