// Seed script: creates 3 clubs, 70 users, 60 members per club, 4 managers each
// Run with: npx tsx scripts/seed.ts

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const FIRST_NAMES_M = [
  "Arun", "Vikram", "Rahul", "Sanjay", "Deepak", "Amit", "Raj", "Nikhil",
  "Suresh", "Karthik", "Rohan", "Arjun", "Pranav", "Varun", "Siddharth",
  "Naveen", "Gaurav", "Mohit", "Ankit", "Vivek", "Akash", "Harsh", "Manish",
  "Sachin", "Ravi", "Ajay", "Tarun", "Kunal", "Sahil", "Dhruv",
  "Pavan", "Jai", "Dev", "Yash", "Omar",
];

const FIRST_NAMES_F = [
  "Priya", "Ananya", "Sneha", "Divya", "Kavitha", "Meera", "Pooja", "Nisha",
  "Swathi", "Lakshmi", "Rina", "Tanvi", "Aditi", "Neha", "Shruti",
  "Megha", "Pallavi", "Ritu", "Sakshi", "Ishita", "Trisha", "Aisha",
  "Sana", "Zara", "Naina", "Bhavna", "Komal", "Jyoti", "Rekha", "Simran",
  "Fatima", "Hina", "Geeta", "Uma", "Deepa",
];

const LAST_NAMES = [
  "Sharma", "Gupta", "Singh", "Kumar", "Patel", "Reddy", "Nair", "Iyer",
  "Joshi", "Rao", "Mehta", "Shah", "Verma", "Chopra", "Malhotra",
  "Banerjee", "Das", "Chatterjee", "Pillai", "Menon", "Bhat", "Kaur",
  "Khan", "Ali", "Ahmed", "Fernandes", "D'Souza", "Thomas", "George", "Mathew",
];

const CLUB_NAMES = [
  { name: "Dublin Smash Club", slug: "dublin-smash-club", desc: "Premier badminton club in Dublin. All levels welcome!" },
  { name: "Phoenix Shuttlers", slug: "phoenix-shuttlers", desc: "Competitive badminton for intermediate to advanced players." },
  { name: "Weekend Warriors BC", slug: "weekend-warriors-bc", desc: "Casual weekend badminton sessions. Fun first, wins second." },
];

function normalRandom(mean: number, std: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.round(mean + z * std);
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create 70 users
  const users: { id: string; email: string; gender: string; level: number; name: string }[] = [];

  for (let i = 1; i <= 70; i++) {
    const gender = Math.random() < 0.5 ? "M" : "F";
    const firstName = gender === "M" ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
    const lastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const email = `player${i}@shuttlr.com`;
    const level = clamp(normalRandom(5.5, 1.2), 3, 8);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: "pass1234",
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) {
      console.error(`  ❌ Failed to create user ${email}:`, error.message);
      continue;
    }

    const userId = data.user.id;

    // Update profile with gender and level
    await supabase
      .from("profiles")
      .update({ gender, level, full_name: fullName })
      .eq("id", userId);

    users.push({ id: userId, email, gender, level, name: fullName });
    process.stdout.write(`  👤 Created ${fullName} (${email}, ${gender}, L${level})\n`);
  }

  console.log(`\n✅ Created ${users.length} users\n`);

  // Create clubs
  // We need one "admin" user to be the creator — use first user
  const adminUser = users[0];

  for (const clubDef of CLUB_NAMES) {
    console.log(`\n🏸 Creating club: ${clubDef.name}`);

    const { data: club, error: clubErr } = await supabase
      .from("clubs")
      .insert({
        name: clubDef.name,
        slug: clubDef.slug,
        description: clubDef.desc,
        visibility: "public",
        created_by: adminUser.id,
      })
      .select()
      .single();

    if (clubErr || !club) {
      console.error(`  ❌ Failed to create club:`, clubErr?.message);
      continue;
    }

    // Pick 60 random members for this club
    const shuffled = [...users].sort(() => Math.random() - 0.5);
    const members = shuffled.slice(0, 60);

    // First 4 are managers
    for (let i = 0; i < members.length; i++) {
      const role = i < 4 ? "manager" : "player";
      const { error: memErr } = await supabase.from("club_members").insert({
        club_id: club.id,
        user_id: members[i].id,
        role,
        invited_email: members[i].email,
        invited_name: members[i].name,
        invited_gender: members[i].gender,
        invited_level: members[i].level,
        status: "active",
      });

      if (memErr) {
        console.error(`  ❌ Failed to add member:`, memErr.message);
      }
    }

    // Create courts for the club
    for (let c = 1; c <= 4; c++) {
      await supabase.from("courts").insert({
        club_id: club.id,
        name: `Court ${c}`,
        locked: false,
      });
    }

    console.log(`  ✅ Added ${members.length} members (4 managers), 4 courts`);
  }

  console.log("\n🎉 Seeding complete!");
  console.log("\nTest login: any player1@shuttlr.com through player70@shuttlr.com");
  console.log("Password: pass1234");
}

main().catch(console.error);
