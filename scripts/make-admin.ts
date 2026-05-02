import { eq } from 'drizzle-orm'

import { closeDatabasePool, db } from '../src/infrastructure/db/db.js'
import { roles, userRoles, users } from '../src/infrastructure/db/schema/index.js'

const makeAdmin = async (email: string) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)

    if (!user) {
      console.log(`User ${email} not found.`)
      return
    }

    const [adminRole] = await db.select().from(roles).where(eq(roles.code, 'admin')).limit(1)

    if (!adminRole) {
      console.log('Admin role not found. Did you run the seed script?')
      return
    }

    await db
      .insert(userRoles)
      .values({
        userId: user.id,
        roleId: adminRole.id,
      })
      .onConflictDoNothing()

    console.log(`Successfully assigned admin role to ${email}`)
  } catch (error) {
    console.error('Error assigning admin role:', error)
  } finally {
    await closeDatabasePool()
  }
}

const email = process.argv[2]

if (!email) {
  console.log('Please provide an email address. Example: npx tsx scripts/make-admin.ts user@example.com')
  process.exit(1)
}

void makeAdmin(email)

