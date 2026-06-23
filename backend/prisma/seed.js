const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("123456", 10); 

  const users = [
    {
      email: "admin@example.com",
      name: "Admin",
      role: "admin",
      is_active: true,
    },
    {
      email: "auteur@example.com",
      name: "Auteur",
      role: "auteur",
      is_active: true,
    },
    {
      email: "superadmin@example.com",
      name: "Super Admin",
      role: "super_admin",
      is_active: true,
    },
    {
      email: "system@bot.com",// Used to send review reminders in review details
      name: "System Bot",
      role: "admin", // Use admin to avoid other permission issues
      is_active: false, // Unable to log in
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        password_hash: user.email === 'system@bot.com' ? 'system_dummy_password' : password,
        role: user.role,
        is_active: user.is_active,
      },
    });
  }

  console.log(" Seeded 3 users + System Bot with password '123456'");
}

main()
  .catch(e => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
